import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const API = '/api'

const SUGGESTIONS = [
  "Help me make a study plan 📚",
  "I'm feeling stressed about exams 😰",
  "What skills should I learn for placements?",
  "Give me a 30-day learning roadmap 🗺️",
]

const createSessionId = () => {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function Chat({ user, onLogout, dark, setDark, onDashboard }) {
  const [messages, setMessages] = useState([])
  const [sessions, setSessions] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [emotion, setEmotion] = useState({ label: 'neutral', emoji: '😊' })
  const [sidebarOpen, setSidebar] = useState(true)
  const [goals, setGoals] = useState([])
  const [newGoal, setNewGoal] = useState('')
  const [showGoals, setShowGoals] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState(createSessionId())

  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const t = dark ? D : L

  const buildSessions = (hist = []) => {
    if (!hist.length) {
      setSessions([])
      return
    }

    const grouped = hist.reduce((acc, msg, index) => {
      const sessionId = msg.session_id || msg.sessionId || `old-session-${Math.floor(index / 10)}`

      if (!acc[sessionId]) {
        acc[sessionId] = {
          id: sessionId,
          title: 'New chat',
          messages: [],
          createdAt: msg.timestamp || msg.created_at || msg.createdAt || index,
        }
      }

      acc[sessionId].messages.push(msg)

      if (msg.role === 'user' && acc[sessionId].title === 'New chat') {
        acc[sessionId].title = msg.content.slice(0, 40) + (msg.content.length > 40 ? '…' : '')
      }

      return acc
    }, {})

    setSessions(
      Object.values(grouped).sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime() || 0
        const bTime = new Date(b.createdAt).getTime() || 0
        return bTime - aTime
      })
    )
  }

  useEffect(() => {
    axios.get(`${API}/history`)
      .then(res => {
        const hist = res.data.history || []
        buildSessions(hist)
        setMessages([])
        setActiveSessionId(createSessionId())
      })
      .catch(() => {})

    axios.get(`${API}/goals`)
      .then(res => setGoals(res.data.goals || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const openSession = (session) => {
    setActiveSessionId(session.id)
    setMessages(session.messages || [])
    setInput('')
    setAttachment(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const newChat = () => {
    setActiveSessionId(createSessionId())
    setMessages([])
    setInput('')
    setAttachment(null)
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const addGoal = async () => {
    if (!newGoal.trim()) return

    try {
      const res = await axios.post(`${API}/goals`, {
        title: newGoal.trim(),
      })

      setGoals(p => [res.data.goal, ...p])
      setNewGoal('')
    } catch {}
  }

  const updateProgress = async (goalId, progress) => {
    try {
      await axios.put(`${API}/goals/${goalId}/progress`, { progress })

      setGoals(p => p.map(g =>
        g.id === goalId
          ? { ...g, progress, status: progress >= 100 ? 'completed' : 'active' }
          : g
      ))
    } catch {}
  }

  const deleteGoal = async (goalId) => {
    try {
      await axios.delete(`${API}/goals/${goalId}`)
      setGoals(p => p.filter(g => g.id !== goalId))
    } catch {}
  }

  const upsertSession = (sessionId, sessionMessages) => {
    const firstUser = sessionMessages.find(m => m.role === 'user')
    const title = firstUser
      ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '…' : '')
      : 'New chat'

    setSessions(prev => {
      const withoutCurrent = prev.filter(s => s.id !== sessionId)
      return [
        {
          id: sessionId,
          title,
          messages: sessionMessages,
          createdAt: new Date().toISOString(),
        },
        ...withoutCurrent,
      ]
    })
  }

  const send = async (text) => {
    const rawText = (text || input).trim()

    if ((!rawText && !attachment) || loading || uploading) return

    const msg = attachment
      ? `${rawText || 'Please help me with this uploaded file.'}

[Uploaded file: ${attachment.name}]
${attachment.text}`.slice(0, 6000)
      : rawText.slice(0, 6000)

    const displayMessage = attachment
      ? `${rawText || 'Please help me with this uploaded file.'}

📎 ${attachment.name}`
      : msg

    const sessionId = activeSessionId || createSessionId()
    const userMessage = {
      role: 'user',
      content: displayMessage,
      session_id: sessionId,
    }

    setActiveSessionId(sessionId)
    setMessages(p => [...p, userMessage])
    setInput('')
    setAttachment(null)
    setLoading(true)

    try {
      const res = await axios.post(`${API}/chat`, {
        message: msg,
        session_id: sessionId,
      })

      const assistantMessage = {
        role: 'assistant',
        content: res.data.reply,
        session_id: sessionId,
      }

      setMessages(prev => {
        const updated = [...prev, assistantMessage]
        upsertSession(sessionId, updated)
        return updated
      })

      setEmotion({
        label: res.data.emotion,
        emoji: res.data.emotion_emoji,
      })
    } catch (err) {
      const detail = err.response?.data?.detail

      setMessages(p => [
        ...p,
        {
          role: 'assistant',
          content: detail === 'Rate limit exceeded'
            ? '⚠️ You are sending messages too fast. Please wait a moment.'
            : '⚠️ Backend not reachable. Check FastAPI on port 8000.',
          session_id: sessionId,
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file || uploading || loading) return

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await axios.post(`${API}/files/extract`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setAttachment({
        name: res.data.filename || file.name,
        type: res.data.content_type || file.type,
        text: res.data.text || '',
      })

      setTimeout(() => inputRef.current?.focus(), 0)
    } catch (err) {
      const detail = err.response?.data?.detail || 'Could not read this file.'
      alert(detail)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  const isEmpty = messages.length === 0
  const canSend = (!!input.trim() || !!attachment) && !loading && !uploading

  const emotionColors = {
    stressed: '#ef4444',
    sad: '#6366f1',
    angry: '#f97316',
    confused: '#eab308',
    motivated: '#10b981',
    neutral: dark ? '#00B4D8' : '#d4a853',
  }

  const moodColor = emotionColors[emotion.label] || '#d4a853'

  return (
    <div style={{ display: 'flex', height: '100vh', background: t.bg, fontFamily: "'DM Sans', sans-serif", color: t.text, overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${dark ? '#1e3a5f' : '#d1d5db'}; border-radius: 2px; }
        textarea { outline: none; }
        .hov:hover { background: ${t.hover} !important; }
        .send-btn:hover:not(:disabled) { opacity: 1 !important; filter: brightness(1.1); }
        .suggestion-btn:hover { background: ${t.suggHover} !important; }
      `}</style>

      {sidebarOpen && (
        <div style={{ width: 260, background: t.sidebar, borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '12px 12px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: dark ? '#00B4D8' : '#d4a853', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>M</div>
              <span style={{ fontWeight: 600, fontSize: 15, color: t.text }}>MentorBot</span>
            </div>
            <button type="button" className="hov" onClick={() => setSidebar(false)} style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, fontSize: 16 }}>✕</button>
          </div>

          <div style={{ padding: '6px 12px 10px' }}>
            <button type="button" className="hov" onClick={newChat} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: isEmpty ? t.hover : 'transparent', border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, cursor: 'pointer', fontSize: 14, fontWeight: 500, transition: 'all 0.15s', fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ fontSize: 16 }}>✏️</span> New chat
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {sessions.length > 0 ? (
              <>
                <div style={{ color: t.muted, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', padding: '8px 8px 4px' }}>Recents</div>
                {sessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => openSession(s)}
                    className="hov"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 13,
                      color: activeSessionId === s.id ? t.text : t.subtext,
                      marginBottom: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      background: activeSessionId === s.id ? t.hover : 'transparent',
                    }}
                  >
                    💬 {s.title}
                  </div>
                ))}
              </>
            ) : (
              <div style={{ padding: '20px 10px', color: t.muted, fontSize: 13, textAlign: 'center' }}>
                No chats yet.<br />Start a conversation!
              </div>
            )}
          </div>

          <div style={{ padding: '10px 12px 14px', borderTop: `1px solid ${t.border}` }}>
            <button type="button" className="hov" onClick={() => setDark(p => !p)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: 8, color: t.subtext, cursor: 'pointer', fontSize: 13, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
              <span>{dark ? '☀️' : '🌙'}</span>
              <span>{dark ? 'Light mode' : 'Dark mode'}</span>
            </button>

            <button type="button" className="hov" onClick={onDashboard} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: 8, color: t.subtext, cursor: 'pointer', fontSize: 13, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
              <span>📊</span><span>Analytics Dashboard</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: dark ? '#00B4D8' : '#d4a853', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {user.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                <div style={{ fontSize: 11, color: t.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </div>
              <button type="button" onClick={onLogout} style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 16, padding: 4, borderRadius: 6 }} title="Sign out">⇄</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${t.border}`, background: t.topbar }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!sidebarOpen && (
              <button type="button" className="hov" onClick={() => setSidebar(true)} style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 18, padding: '4px 8px', borderRadius: 6 }}>☰</button>
            )}
            <span style={{ fontSize: 14, fontWeight: 500, color: t.subtext }}>MentorBot</span>
          </div>

          <div style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: moodColor + '20', color: moodColor, border: `1px solid ${moodColor}40`, textTransform: 'capitalize' }}>
            {emotion.emoji} {emotion.label}
          </div>
        </div>

        <div style={{ padding: '0 8px 8px' }}>
          <button type="button" className="hov" onClick={() => setShowGoals(p => !p)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: 'transparent', border: 'none', borderRadius: 8, color: t.subtext, cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
            <span>🎯 Goals ({goals.filter(g => g.status === 'active').length} active)</span>
            <span>{showGoals ? '▲' : '▼'}</span>
          </button>

          {showGoals && (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  style={{ flex: 1, padding: '7px 10px', background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, fontSize: 12, outline: 'none', fontFamily: "'DM Sans', sans-serif" }}
                  placeholder="Add a goal..."
                  value={newGoal}
                  onChange={e => setNewGoal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addGoal()}
                />
                <button type="button" onClick={addGoal} style={{ padding: '7px 10px', background: dark ? '#00B4D8' : '#d4a853', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, cursor: 'pointer' }}>+</button>
              </div>

              {goals.slice(0, 5).map(g => (
                <div key={g.id} style={{ marginBottom: 8, padding: '8px 10px', background: t.inputBg, borderRadius: 8, border: `1px solid ${t.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: t.text, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.status === 'completed' ? '✅' : '🎯'} {g.title}
                    </span>
                    <button type="button" onClick={() => deleteGoal(g.id)} style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 12, padding: '0 2px' }}>✕</button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 4, background: dark ? '#0D1B2A' : '#e5e7eb', borderRadius: 2 }}>
                      <div style={{ width: `${g.progress}%`, height: '100%', background: g.status === 'completed' ? '#10b981' : (dark ? '#00B4D8' : '#d4a853'), borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 10, color: t.muted, minWidth: 28 }}>{g.progress}%</span>
                  </div>

                  {g.status !== 'completed' && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                      {[25, 50, 75, 100].map(p => (
                        <button key={p} type="button" onClick={() => updateProgress(g.id, p)} style={{ flex: 1, padding: '3px 0', background: g.progress >= p ? (dark ? '#00B4D8' : '#d4a853') : (dark ? '#0D1B2A' : '#f3f4f6'), border: `1px solid ${t.border}`, borderRadius: 5, fontSize: 10, color: g.progress >= p ? '#fff' : t.muted, cursor: 'pointer' }}>
                          {p}%
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {isEmpty ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '0 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🧠</div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: t.text, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.5px' }}>
                Good to see you, {user.name}!
              </h2>
              <p style={{ color: t.muted, fontSize: 15, lineHeight: 1.7, marginBottom: 32 }}>
                What's on your mind today?
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, maxWidth: 520, width: '100%' }}>
                {SUGGESTIONS.map(q => (
                  <button key={q} type="button" className="suggestion-btn" onClick={() => send(q)} style={{ padding: '12px 16px', background: t.suggBg, border: `1px solid ${t.border}`, borderRadius: 12, color: t.subtext, fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4, transition: 'all 0.15s' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: 24, paddingBottom: 8 }}>
              {messages.map((m, i) => (
                <Bubble key={`${m.session_id || activeSessionId}-${i}`} role={m.role} content={m.content} name={user.name} t={t} dark={dark} />
              ))}
              {loading && <ThinkingDots t={t} dark={dark} />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${t.border}`, background: t.topbar }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            {attachment && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8, padding: '8px 10px', background: dark ? '#1A2E40' : '#f9fafb', border: `1px solid ${t.border}`, borderRadius: 10, color: t.subtext, fontSize: 13 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  📎 {attachment.name}
                </div>
                <button type="button" onClick={() => setAttachment(null)} style={{ background: 'transparent', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 15 }}>
                  ✕
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, background: t.inputBg, border: `1px solid ${attachment ? (dark ? '#00B4D8' : '#d4a853') : t.border}`, borderRadius: 14, padding: '10px 10px 10px 16px' }}>
              <textarea
                ref={inputRef}
                style={{ flex: 1, background: 'transparent', border: 'none', color: t.text, fontSize: 15, resize: 'none', fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6, maxHeight: 120 }}
                placeholder={uploading ? 'Reading file...' : attachment ? 'Ask about this file...' : 'Ask your mentor anything...'}
                value={input}
                rows={1}
                onChange={e => {
                  setInput(e.target.value.slice(0, 2000))
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv,image/*"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload PDF, image, or text file"
                disabled={uploading || loading}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: uploading ? (dark ? '#00B4D8' : '#d4a853') : 'transparent',
                  border: `1px solid ${uploading ? (dark ? '#00B4D8' : '#d4a853') : t.border}`,
                  color: uploading ? '#fff' : t.subtext,
                  fontSize: 16,
                  cursor: uploading || loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  opacity: uploading || loading ? 0.7 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {uploading ? '…' : '📎'}
              </button>

              <button type="button" className="send-btn" style={{ width: 36, height: 36, borderRadius: 9, background: dark ? '#00B4D8' : '#d4a853', border: 'none', color: '#fff', fontSize: 16, cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: canSend ? 1 : 0.4, transition: 'all 0.2s' }} onClick={() => send()} disabled={!canSend}>
                ➤
              </button>
            </div>
            <p style={{ color: t.muted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
              {uploading ? 'Reading file...' : attachment ? 'File attached • Type a question or press send' : 'Enter to send • Shift+Enter for new line'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Bubble({ role, content, name, t, dark }) {
  const isUser = role === 'user'

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexDirection: isUser ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: isUser ? (dark ? '#00B4D8' : '#d4a853') : (dark ? '#1A2E40' : '#f3f4f6'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: isUser ? '#fff' : (dark ? '#00B4D8' : '#374151'), fontWeight: 700, fontSize: isUser ? 14 : 18, flexShrink: 0, border: isUser ? 'none' : `1px solid ${dark ? '#0077B6' : '#e5e7eb'}` }}>
        {isUser ? name[0].toUpperCase() : '🧠'}
      </div>

      <div style={{ maxWidth: '75%' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5, textAlign: isUser ? 'right' : 'left', color: isUser ? (dark ? '#00B4D8' : '#d4a853') : (dark ? '#90E0EF' : '#6b7280') }}>
          {isUser ? name : 'MentorBot'}
        </div>

        <div style={{ padding: '12px 16px', fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: isUser ? (dark ? '#0D2137' : '#fff8ed') : (dark ? '#1A2E40' : '#f9fafb'), border: `1px solid ${isUser ? (dark ? '#0077B6' : '#fde68a') : (dark ? '#0077B6' : '#e5e7eb')}`, borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px', color: t.text }}>
          {content}
        </div>
      </div>
    </div>
  )
}

function ThinkingDots({ t, dark }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-start' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: dark ? '#1A2E40' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, border: `1px solid ${dark ? '#0077B6' : '#e5e7eb'}` }}>🧠</div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 5, color: dark ? '#90E0EF' : '#6b7280' }}>MentorBot</div>
        <div style={{ padding: '14px 18px', background: dark ? '#1A2E40' : '#f9fafb', border: `1px solid ${dark ? '#0077B6' : '#e5e7eb'}`, borderRadius: '4px 18px 18px 18px', display: 'flex', gap: 5 }}>
          {[0, 0.2, 0.4].map((d, i) => (
            <span key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: dark ? '#00B4D8' : '#9ca3af', display: 'inline-block', animation: 'bounce 1.2s infinite', animationDelay: `${d}s` }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0);opacity:.3}50%{transform:translateY(-5px);opacity:1}}`}</style>
    </div>
  )
}

const L = {
  bg: '#ffffff',
  sidebar: '#f9fafb',
  topbar: '#ffffff',
  text: '#111827',
  subtext: '#374151',
  muted: '#9ca3af',
  border: '#e5e7eb',
  hover: '#f3f4f6',
  inputBg: '#ffffff',
  suggBg: '#f9fafb',
  suggHover: '#f3f4f6',
}

const D = {
  bg: '#0D1B2A',
  sidebar: '#0a1628',
  topbar: '#0D1B2A',
  text: '#E8F4F8',
  subtext: '#90E0EF',
  muted: '#4a7fa5',
  border: '#0077B6',
  hover: '#1A2E40',
  inputBg: '#1A2E40',
  suggBg: '#1A2E40',
  suggHover: '#243d52',
}
