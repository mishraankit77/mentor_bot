import { useEffect, useRef, useState } from 'react'
import axios from 'axios'

import { ImPencil2 } from 'react-icons/im'
import { GoGoal, GoPlus } from 'react-icons/go'
import { GrAnalytics } from 'react-icons/gr'
import { MdMenuBook } from 'react-icons/md'
import { FaBrain } from 'react-icons/fa'
import { GiSkills } from 'react-icons/gi'
import { TbRoute } from 'react-icons/tb'

const API = '/api'

const SUGGESTIONS = [
  {
    icon: <MdMenuBook />,
    text: 'Help me make a study plan 📚',
    bg: 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(99,102,241,0.18))',
    glow: 'rgba(59,130,246,0.22)',
    color: '#3b82f6',
  },
  {
    icon: <FaBrain />,
    text: "I'm feeling stressed about exams 😰",
    bg: 'linear-gradient(135deg, rgba(168,85,247,0.16), rgba(236,72,153,0.16))',
    glow: 'rgba(168,85,247,0.22)',
    color: '#a855f7',
  },
  {
    icon: <GiSkills />,
    text: 'What skills should I learn for placements?',
    bg: 'linear-gradient(135deg, rgba(16,185,129,0.16), rgba(20,184,166,0.16))',
    glow: 'rgba(16,185,129,0.22)',
    color: '#10b981',
  },
  {
    icon: <TbRoute />,
    text: 'Give me a 30-day learning roadmap 🗺️',
    bg: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(239,68,68,0.14))',
    glow: 'rgba(245,158,11,0.20)',
    color: '#f59e0b',
  },
]

const createSessionId = () =>
  `session-${Date.now()}-${Math.random().toString(36).slice(2)}`

function IconBubble({ children, bg, color, size = 38, glow = 'rgba(0,0,0,0.12)' }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
        boxShadow: `0 10px 24px ${glow}`,
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}

export default function Chat({ user, onLogout, dark, setDark, onDashboard }) {
  const [messages, setMessages] = useState([])
  const [sessions, setSessions] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachment, setAttachment] = useState(null)
  const [emotion, setEmotion] = useState({ label: 'neutral', emoji: '😊' })
  const [sidebarOpen, setSidebarOpen] = useState(true)
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
    axios
      .get(`${API}/history`)
      .then((res) => {
        const hist = res.data.history || []
        buildSessions(hist)
        setMessages([])
        setActiveSessionId(createSessionId())
      })
      .catch(() => {})

    axios
      .get(`${API}/goals`)
      .then((res) => setGoals(res.data.goals || []))
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
      const res = await axios.post(`${API}/goals`, { title: newGoal.trim() })
      setGoals((p) => [res.data.goal, ...p])
      setNewGoal('')
    } catch {}
  }

  const updateProgress = async (goalId, progress) => {
    try {
      await axios.put(`${API}/goals/${goalId}/progress`, { progress })
      setGoals((p) =>
        p.map((g) =>
          g.id === goalId
            ? { ...g, progress, status: progress >= 100 ? 'completed' : 'active' }
            : g
        )
      )
    } catch {}
  }

  const deleteGoal = async (goalId) => {
    try {
      await axios.delete(`${API}/goals/${goalId}`)
      setGoals((p) => p.filter((g) => g.id !== goalId))
    } catch {}
  }

  const upsertSession = (sessionId, sessionMessages) => {
    const firstUser = sessionMessages.find((m) => m.role === 'user')
    const title = firstUser
      ? firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '…' : '')
      : 'New chat'

    setSessions((prev) => {
      const withoutCurrent = prev.filter((s) => s.id !== sessionId)
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
      ? `${rawText || 'Please help me with this uploaded file.'}\n\n[Uploaded file: ${attachment.name}]\n${attachment.text}`.slice(0, 6000)
      : rawText.slice(0, 6000)

    const displayMessage = attachment
      ? `${rawText || 'Please help me with this uploaded file.'}\n\n📎 ${attachment.name}`
      : msg

    const sessionId = activeSessionId || createSessionId()

    const userMessage = {
      role: 'user',
      content: displayMessage,
      session_id: sessionId,
    }

    setActiveSessionId(sessionId)
    setMessages((p) => [...p, userMessage])
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

      setMessages((prev) => {
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
      setMessages((p) => [
        ...p,
        {
          role: 'assistant',
          content:
            detail === 'Rate limit exceeded'
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
    neutral: dark ? '#7dd3fc' : '#d4a853',
  }

  const moodColor = emotionColors[emotion.label] || '#d4a853'

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: dark
          ? 'linear-gradient(135deg, #07111f 0%, #0b1220 45%, #101827 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #f6f7fb 50%, #eef4ff 100%)',
        fontFamily: "'DM Sans', sans-serif",
        color: t.text,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        textarea, input { outline: none; }
        input::placeholder, textarea::placeholder { color: ${t.placeholder}; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: ${dark ? '#1e3a5f' : '#d1d5db'}; border-radius: 999px; }
        .soft-hover:hover { background: ${t.hover} !important; }
        .soft-btn:hover:not(:disabled) { filter: brightness(1.03); transform: translateY(-1px); }
        .suggestion-btn:hover { transform: translateY(-2px); }
      `}</style>

      {sidebarOpen && (
        <div
          style={{
            width: 300,
            background: t.sidebar,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            padding: 18,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -100,
              right: -80,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: dark ? 'rgba(56,189,248,0.08)' : 'rgba(37,99,235,0.08)',
              pointerEvents: 'none',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
              zIndex: 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconBubble
                bg="linear-gradient(135deg, #8b5cf6, #06b6d4)"
                color="#fff"
                size={38}
                glow="rgba(59,130,246,0.28)"
              >
                <FaBrain size={18} />
              </IconBubble>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18, color: t.text }}>MentorBot</div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: 2,
                    textTransform: 'uppercase',
                    color: t.accentText,
                  }}
                >
                  AI Mentor Platform
                </div>
              </div>
            </div>

            <button
              type="button"
              className="soft-hover"
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: t.muted,
                cursor: 'pointer',
                fontSize: 20,
                padding: 6,
                borderRadius: 8,
              }}
            >
              ✕
            </button>
          </div>

          <button
            type="button"
            className="soft-btn"
            onClick={newChat}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              background: t.cardBg,
              border: 'none',
              borderRadius: 16,
              color: t.text,
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 700,
              transition: 'all 0.2s',
              boxShadow: dark ? 'none' : '0 14px 34px rgba(15,23,42,0.06)',
            }}
          >
            <IconBubble
              bg="linear-gradient(135deg, #8b5cf6, #6366f1)"
              color="#fff"
              size={34}
              glow="rgba(99,102,241,0.32)"
            >
              <ImPencil2 size={15} />
            </IconBubble>
            New chat
          </button>

          <div
            style={{
              marginTop: 18,
              marginBottom: 10,
              color: t.muted,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Recents
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            {sessions.length > 0 ? (
              sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => openSession(s)}
                  className="soft-hover"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontSize: 13,
                    color: activeSessionId === s.id ? t.text : t.subtext,
                    marginBottom: 6,
                    background: activeSessionId === s.id ? t.hover : 'transparent',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <span style={{ color: dark ? '#7dd3fc' : '#2563eb', marginRight: 6 }}>💬</span>
                  {s.title}
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 10px', color: t.muted, fontSize: 13, textAlign: 'center' }}>
                No chats yet.
                <br />
                Start a conversation!
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${dark ? 'rgba(125,211,252,0.10)' : 'rgba(37,99,235,0.10)'}`,
            }}
          >
            <button
              type="button"
              className="soft-hover"
              onClick={() => setDark((p) => !p)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                background: t.cardBg,
                border: 'none',
                borderRadius: 14,
                color: t.text,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 10,
                transition: 'all 0.15s',
              }}
            >
              <span>{dark ? '☀️' : '🌙'}</span>
              <span>{dark ? 'Light mode' : 'Dark mode'}</span>
            </button>

            <button
              type="button"
              className="soft-hover"
              onClick={onDashboard}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 14px',
                background: t.cardBg,
                border: 'none',
                borderRadius: 14,
                color: t.text,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 12,
                transition: 'all 0.15s',
              }}
            >
              <IconBubble
                bg="linear-gradient(135deg, #06b6d4, #3b82f6)"
                color="#fff"
                size={28}
                glow="rgba(59,130,246,0.28)"
              >
                <GrAnalytics size={13} />
              </IconBubble>
              Analytics Dashboard
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                background: t.cardBg,
                borderRadius: 14,
              }}
            >
              <IconBubble
                bg="linear-gradient(135deg, #8b5cf6, #06b6d4, #14b8a6)"
                color="#fff"
                size={36}
                glow="rgba(59,130,246,0.28)"
              >
                {user.name?.[0]?.toUpperCase() || 'U'}
              </IconBubble>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: t.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: t.muted,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.email}
                </div>
              </div>
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: t.muted,
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                ⇄
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            background: t.topbar,
            borderBottom: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!sidebarOpen && (
              <button
                type="button"
                className="soft-hover"
                onClick={() => setSidebarOpen(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: t.muted,
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: '4px 8px',
                  borderRadius: 8,
                }}
              >
                ☰
              </button>
            )}
            <div style={{ fontWeight: 800, fontSize: 18, color: t.text }}>MentorBot</div>
          </div>

          <div
            style={{
              padding: '7px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              background: dark ? 'rgba(125,211,252,0.08)' : 'rgba(212,165,83,0.10)',
              color: moodColor,
              textTransform: 'capitalize',
            }}
          >
            {emotion.emoji} {emotion.label}
          </div>
        </div>

        <div style={{ padding: '0 20px 8px' }}>
          <button
            type="button"
            className="soft-hover"
            onClick={() => setShowGoals((p) => !p)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'transparent',
              border: 'none',
              borderRadius: 14,
              color: t.subtext,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <IconBubble
                bg="linear-gradient(135deg, #10b981, #14b8a6)"
                color="#fff"
                size={26}
                glow="rgba(16,185,129,0.24)"
              >
                <GoGoal size={14} />
              </IconBubble>
              Goals ({goals.filter((g) => g.status === 'active').length} active)
            </span>
            <span style={{ color: t.muted }}>{showGoals ? '▲' : '▼'}</span>
          </button>

          {showGoals && (
            <div
              style={{
                marginTop: 10,
                padding: 14,
                background: t.cardBg,
                borderRadius: 18,
                boxShadow: dark ? 'none' : '0 16px 38px rgba(15,23,42,0.06)',
              }}
            >
              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <input
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    background: t.inputBg,
                    border: 'none',
                    borderRadius: 14,
                    color: t.text,
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  placeholder="Add a goal..."
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addGoal()}
                />
                <button
                  type="button"
                  onClick={addGoal}
                  style={{
                    width: 48,
                    height: 48,
                    background: `linear-gradient(135deg, ${t.accent}, ${t.green})`,
                    border: 'none',
                    borderRadius: 16,
                    color: '#fff',
                    fontSize: 18,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: dark ? 'none' : '0 12px 26px rgba(37,99,235,0.18)',
                  }}
                >
                  <GoPlus size={22} />
                </button>
              </div>

              {goals.slice(0, 5).map((g) => (
                <div
                  key={g.id}
                  style={{
                    marginBottom: 10,
                    padding: '10px 12px',
                    background: dark ? 'rgba(255,255,255,0.03)' : '#fff',
                    borderRadius: 14,
                    border: 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: t.text,
                        fontWeight: 700,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <IconBubble
                        bg={
                          g.status === 'completed'
                            ? 'linear-gradient(135deg, #10b981, #14b8a6)'
                            : 'linear-gradient(135deg, #f59e0b, #f97316)'
                        }
                        color="#fff"
                        size={22}
                        glow={g.status === 'completed' ? 'rgba(16,185,129,0.22)' : 'rgba(245,158,11,0.22)'}
                      >
                        <GoGoal size={12} />
                      </IconBubble>
                      {g.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteGoal(g.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: t.muted,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 5,
                        background: dark ? '#0D1B2A' : '#edf2f7',
                        borderRadius: 999,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${g.progress}%`,
                          height: '100%',
                          background:
                            g.status === 'completed'
                              ? 'linear-gradient(135deg, #10b981, #14b8a6)'
                              : `linear-gradient(135deg, ${t.accent}, ${t.green})`,
                          borderRadius: 999,
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: t.muted, minWidth: 30 }}>{g.progress}%</span>
                  </div>

                  {g.status !== 'completed' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {[25, 50, 75, 100].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateProgress(g.id, p)}
                          style={{
                            flex: 1,
                            padding: '5px 0',
                            background: g.progress >= p ? `linear-gradient(135deg, ${t.accent}, ${t.green})` : 'transparent',
                            border: 'none',
                            borderRadius: 10,
                            fontSize: 11,
                            color: g.progress >= p ? '#fff' : t.muted,
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                padding: '0 20px',
              }}
            >
              <IconBubble
                bg="linear-gradient(135deg, #8b5cf6, #06b6d4, #14b8a6)"
                color="#fff"
                size={78}
                glow="rgba(59,130,246,0.28)"
              >
                <FaBrain size={28} />
              </IconBubble>

              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: 34,
                  color: t.text,
                  fontWeight: 600,
                  marginBottom: 12,
                  lineHeight: 1.1,
                }}
              >
                Good to see you, {user.name}!
              </h2>

              <p style={{ color: t.muted, fontSize: 16, lineHeight: 1.8, marginBottom: 32 }}>
                What&apos;s on your mind today?
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  maxWidth: 700,
                  width: '100%',
                }}
              >
                {SUGGESTIONS.map((item) => (
                  <button
                    key={item.text}
                    type="button"
                    className="suggestion-btn soft-btn"
                    onClick={() => send(item.text)}
                    style={{
                      padding: '16px 18px',
                      background: item.bg,
                      border: 'none',
                      borderRadius: 18,
                      color: t.text,
                      fontSize: 14,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: "'DM Sans', sans-serif",
                      lineHeight: 1.45,
                      transition: 'all 0.15s',
                      boxShadow: dark ? 'none' : `0 14px 30px ${item.glow}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <IconBubble
                      bg={`linear-gradient(135deg, ${item.color}, ${dark ? '#7c3aed' : '#6366f1'})`}
                      color="#fff"
                      size={36}
                      glow={item.glow}
                    >
                      {item.icon}
                    </IconBubble>

                    <span style={{ fontWeight: 700 }}>{item.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 820, margin: '0 auto', paddingTop: 26, paddingBottom: 8 }}>
              {messages.map((m, i) => (
                <Bubble
                  key={`${m.session_id || activeSessionId}-${i}`}
                  role={m.role}
                  content={m.content}
                  name={user.name}
                  t={t}
                  dark={dark}
                />
              ))}
              {loading && <ThinkingDots t={t} dark={dark} />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div
          style={{
            padding: '16px 20px 18px',
            background: t.topbar,
          }}
        >
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            {attachment && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 10,
                  padding: '10px 14px',
                  background: t.cardBg,
                  borderRadius: 16,
                  color: t.text,
                  fontSize: 13,
                }}
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#3b82f6', marginRight: 6 }}>📎</span>
                  {attachment.name}
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: t.muted,
                    cursor: 'pointer',
                    fontSize: 15,
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 10,
                background: t.cardBg,
                border: 'none',
                borderRadius: 20,
                padding: '12px 12px 12px 18px',
                boxShadow: dark ? 'none' : '0 16px 40px rgba(15,23,42,0.08)',
              }}
            >
              <textarea
                ref={inputRef}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: t.text,
                  fontSize: 15,
                  resize: 'none',
                  fontFamily: "'DM Sans', sans-serif",
                  lineHeight: 1.6,
                  maxHeight: 120,
                  minHeight: 24,
                }}
                placeholder={
                  uploading
                    ? 'Reading file...'
                    : attachment
                    ? 'Ask about this file...'
                    : 'Ask your mentor anything...'
                }
                value={input}
                rows={1}
                onChange={(e) => {
                  setInput(e.target.value.slice(0, 2000))
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={(e) => {
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
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  background: uploading
                    ? `linear-gradient(135deg, ${t.accent}, ${t.green})`
                    : dark
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))'
                    : 'linear-gradient(135deg, #ffffff, #f3f4f6)',
                  border: 'none',
                  color: uploading ? '#fff' : t.subtext,
                  cursor: uploading || loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  opacity: uploading || loading ? 0.7 : 1,
                  order: -1,
                  boxShadow: dark ? 'none' : '0 12px 24px rgba(15,23,42,0.06)',
                }}
              >
                {uploading ? '…' : <GoPlus size={28} />}
              </button>

              <button
                type="button"
                className="soft-btn"
                onClick={() => send()}
                disabled={!canSend}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  background: `linear-gradient(135deg, ${t.accent}, ${t.green})`,
                  border: 'none',
                  color: '#fff',
                  fontSize: 16,
                  cursor: canSend ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  opacity: canSend ? 1 : 0.45,
                  transition: 'all 0.2s',
                  boxShadow: dark ? 'none' : '0 12px 26px rgba(37,99,235,0.18)',
                }}
              >
                ➤
              </button>
            </div>

            <p style={{ color: t.muted, fontSize: 11, textAlign: 'center', marginTop: 10 }}>
              {uploading
                ? 'Reading file...'
                : attachment
                ? 'File attached • Type a question or press send'
                : 'Enter to send • Shift+Enter for new line'}
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
    <div
      style={{
        display: 'flex',
        gap: 12,
        marginBottom: 24,
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
      }}
    >
      {isUser ? (
        <IconBubble
          bg="linear-gradient(135deg, #8b5cf6, #06b6d4, #14b8a6)"
          color="#fff"
          size={38}
          glow="rgba(59,130,246,0.28)"
        >
          {name?.[0]?.toUpperCase() || 'U'}
        </IconBubble>
      ) : (
        <IconBubble
          bg={dark ? 'linear-gradient(135deg, #1f2937, #111827)' : 'linear-gradient(135deg, #ffffff, #f8fafc)'}
          color={dark ? '#7dd3fc' : '#374151'}
          size={38}
          glow={dark ? 'rgba(125,211,252,0.08)' : 'rgba(15,23,42,0.06)'}
        >
          <FaBrain size={18} />
        </IconBubble>
      )}

      <div style={{ maxWidth: '78%' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            marginBottom: 6,
            textAlign: isUser ? 'right' : 'left',
            color: isUser ? t.accentText : t.muted,
          }}
        >
          {isUser ? name : 'MentorBot'}
        </div>

        <div
          style={{
            padding: '14px 16px',
            fontSize: 15,
            lineHeight: 1.75,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: isUser
              ? dark
                ? 'rgba(56,189,248,0.08)'
                : 'rgba(37,99,235,0.06)'
              : t.cardBg,
            border: 'none',
            borderRadius: isUser ? '20px 6px 20px 20px' : '6px 20px 20px 20px',
            color: t.text,
            boxShadow: dark ? 'none' : '0 12px 30px rgba(15,23,42,0.05)',
          }}
        >
          {content}
        </div>
      </div>
    </div>
  )
}

function ThinkingDots({ t, dark }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'flex-start' }}>
      <IconBubble
        bg={dark ? 'linear-gradient(135deg, #1f2937, #111827)' : 'linear-gradient(135deg, #ffffff, #f8fafc)'}
        color={dark ? '#7dd3fc' : '#374151'}
        size={38}
        glow={dark ? 'rgba(125,211,252,0.08)' : 'rgba(15,23,42,0.06)'}
      >
        <FaBrain size={18} />
      </IconBubble>

      <div>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6, color: t.muted }}>MentorBot</div>
        <div
          style={{
            padding: '14px 18px',
            background: t.cardBg,
            border: 'none',
            borderRadius: '6px 20px 20px 20px',
            display: 'flex',
            gap: 6,
            boxShadow: dark ? 'none' : '0 12px 30px rgba(15,23,42,0.05)',
          }}
        >
          {[0, 0.2, 0.4].map((d, i) => (
            <span
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: t.accentText,
                display: 'inline-block',
                animation: 'bounce 1.2s infinite',
                animationDelay: `${d}s`,
                boxShadow: dark ? '0 0 0 2px rgba(125,211,252,0.06)' : '0 0 0 2px rgba(37,99,235,0.04)',
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%,100% { transform: translateY(0); opacity: .35; }
          50% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

const L = {
  bg: '#ffffff',
  sidebar: 'rgba(255,255,255,0.72)',
  topbar: 'rgba(255,255,255,0.58)',
  text: '#111827',
  subtext: '#374151',
  muted: '#7d8796',
  placeholder: '#a8b1c0',
  border: 'transparent',
  hover: 'rgba(37,99,235,0.06)',
  suggBg: '#ffffff',
  suggHover: 'rgba(37,99,235,0.06)',
  cardBg: 'rgba(255,255,255,0.82)',
  inputBg: '#ffffff',
  accent: '#2563eb',
  accentText: '#1d4ed8',
  green: '#14b8a6',
}

const D = {
  bg: '#0b1220',
  sidebar: 'rgba(8,17,31,0.84)',
  topbar: 'rgba(11,18,32,0.74)',
  text: '#f8fbff',
  subtext: '#c8d7ea',
  muted: '#71829b',
  placeholder: '#52677f',
  border: 'transparent',
  hover: 'rgba(56,189,248,0.08)',
  suggBg: 'rgba(255,255,255,0.03)',
  suggHover: 'rgba(255,255,255,0.06)',
  cardBg: 'rgba(16,31,51,0.82)',
  inputBg: '#101f33',
  accent: '#38bdf8',
  accentText: '#7dd3fc',
  green: '#22c55e',
}