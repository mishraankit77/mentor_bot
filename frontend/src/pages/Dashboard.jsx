import { useState, useEffect } from 'react'
import axios from 'axios'

const API = '/api'

const MOOD_COLORS = {
  motivated: '#10b981',
  neutral: '#6366f1',
  confused: '#eab308',
  stressed: '#ef4444',
  sad: '#8b5cf6',
  angry: '#f97316',
}

const MOOD_EMOJIS = {
  motivated: '🔥',
  neutral: '😊',
  confused: '😕',
  stressed: '😰',
  sad: '😔',
  angry: '😤',
}

export default function Dashboard({ user, onBack, dark }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const t = dark ? D : L

  useEffect(() => {
    axios.get(`${API}/analytics`)
      .then(res => {
        setData(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Shell t={t}>
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.text, fontFamily: "'DM Sans', sans-serif", fontWeight: 800 }}>
          Loading analytics...
        </div>
      </Shell>
    )
  }

  if (!data) {
    return (
      <Shell t={t}>
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.text, fontFamily: "'DM Sans', sans-serif" }}>
          Could not load analytics.
        </div>
      </Shell>
    )
  }

  const moodStats = data.mood_stats || {}
  const moodEntries = Object.entries(moodStats).sort((a, b) => b[1] - a[1])
  const topMood = moodEntries[0]
  const moodTotal = Object.values(moodStats).reduce((a, b) => a + b, 0)
  const moodHistory = data.mood_history || []
  const goals = data.goals || []

  return (
    <Shell t={t}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .dash-card:hover { transform: translateY(-2px); }
        .dash-btn:hover { background: ${t.hover} !important; transform: translateY(-1px); }
      `}</style>

      <div style={{ position: 'absolute', top: -130, right: '18%', width: 360, height: 360, borderRadius: '50%', background: t.blobOne, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: -130, left: -90, width: 310, height: 310, borderRadius: '50%', background: t.blobTwo, pointerEvents: 'none' }} />

      <header style={{ position: 'relative', zIndex: 1, padding: '24px 44px 18px', borderBottom: `1px solid ${t.border}`, background: t.headerBg, backdropFilter: 'blur(18px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: t.accentGradient, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18, boxShadow: t.shadow }}>
            M
          </div>
          <div>
            <div style={{ color: t.text, fontSize: 22, fontWeight: 800 }}>MentorBot</div>
            <div style={{ color: t.accentText, fontSize: 11, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 }}>
              AI Mentor Platform
            </div>
          </div>
        </div>

        <button
          type="button"
          className="dash-btn"
          onClick={onBack}
          style={{
            background: t.cardBg,
            border: `1px solid ${t.border}`,
            borderRadius: 999,
            padding: '10px 16px',
            color: t.subtext,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 800,
            fontFamily: "'DM Sans', sans-serif",
            transition: 'all 0.2s',
            boxShadow: t.softShadow,
          }}
        >
          ← Back to Chat
        </button>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1180, margin: '0 auto', padding: '34px 24px 44px' }}>
        <section style={{ marginBottom: 30 }}>
          <div style={{ color: t.accentText, fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
            Your Analytics
          </div>

          <h1 style={{ fontFamily: "'Playfair Display', serif", color: t.text, fontSize: 48, lineHeight: 1.08, fontWeight: 600, margin: '0 0 12px' }}>
            Growth dashboard
          </h1>

          <p style={{ color: t.muted, fontSize: 16, lineHeight: 1.7, maxWidth: 640, margin: 0 }}>
            Hi {user.name}, here is a snapshot of your mentoring activity, mood patterns, and goal progress.
          </p>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 22 }}>
          <MetricCard t={t} label="Total Messages" value={data.total_messages} icon="💬" color={t.accentText} />
          <MetricCard t={t} label="User Messages" value={data.user_messages} icon="✍️" color="#8b5cf6" />
          <MetricCard t={t} label="Active Goals" value={data.active_goals} icon="🎯" color={t.accentText} />
          <MetricCard t={t} label="Avg Progress" value={`${data.avg_progress}%`} icon="📈" color="#10b981" />
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 20, marginBottom: 22 }}>
          <Card t={t}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
              <div>
                <h2 style={headingStyle(t)}>Mood Breakdown</h2>
                <p style={subStyle(t)}>
                  Most common mood:{' '}
                  <strong style={{ color: MOOD_COLORS[topMood?.[0]] || t.text, textTransform: 'capitalize' }}>
                    {topMood ? `${MOOD_EMOJIS[topMood[0]] || ''} ${topMood[0]}` : 'N/A'}
                  </strong>
                </p>
              </div>
              <div style={{ width: 54, height: 54, borderRadius: 18, background: t.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                😊
              </div>
            </div>

            {moodEntries.length === 0 ? (
              <p style={{ color: t.muted, fontSize: 14 }}>No mood data yet. Start chatting!</p>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {moodEntries.map(([mood, count]) => {
                  const pct = moodTotal ? Math.round((count / moodTotal) * 100) : 0
                  const color = MOOD_COLORS[mood] || t.accent

                  return (
                    <div key={mood}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                        <span style={{ fontSize: 14, color: t.subtext, fontWeight: 800, textTransform: 'capitalize' }}>
                          {MOOD_EMOJIS[mood] || '•'} {mood}
                        </span>
                        <span style={{ fontSize: 13, color: t.muted, fontWeight: 700 }}>
                          {count}× ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: 9, background: t.track, borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          <Card t={t}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
              <div>
                <h2 style={headingStyle(t)}>Goals Progress</h2>
                <p style={subStyle(t)}>
                  {data.completed_goals} of {data.total_goals} goals completed
                </p>
              </div>
              <div style={{ width: 54, height: 54, borderRadius: 18, background: t.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                🎯
              </div>
            </div>

            {goals.length === 0 ? (
              <p style={{ color: t.muted, fontSize: 14 }}>No goals yet. Add goals in the chat sidebar.</p>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                {goals.slice(0, 6).map(g => (
                  <div key={g.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 7 }}>
                      <span style={{ fontSize: 14, color: t.text, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {g.status === 'completed' ? '✅' : '🎯'} {g.title}
                      </span>
                      <span style={{ fontSize: 13, color: t.muted, fontWeight: 700 }}>{g.progress}%</span>
                    </div>
                    <div style={{ height: 9, background: t.track, borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${g.progress}%`, height: '100%', background: g.status === 'completed' ? '#10b981' : t.accentGradient, borderRadius: 999, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 20 }}>
          <Card t={t}>
            <h2 style={headingStyle(t)}>Completion</h2>
            <p style={subStyle(t)}>Overall progress across all goals.</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 22, marginTop: 22 }}>
              <ProgressRing value={data.avg_progress || 0} t={t} />
              <div>
                <div style={{ color: t.text, fontSize: 34, fontWeight: 800 }}>{data.avg_progress}%</div>
                <div style={{ color: t.muted, fontSize: 14, marginTop: 4 }}>Average progress</div>
              </div>
            </div>
          </Card>

          <Card t={t}>
            <h2 style={headingStyle(t)}>Recent Mood Timeline</h2>
            <p style={subStyle(t)}>Latest detected emotions from your conversations.</p>

            {moodHistory.length === 0 ? (
              <p style={{ color: t.muted, fontSize: 14, marginTop: 18 }}>No mood history yet.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
                {moodHistory.slice(0, 24).map((m, i) => {
                  const color = MOOD_COLORS[m.emotion] || t.accentText
                  return (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: `${color}18`, color, border: `1px solid ${color}44`, textTransform: 'capitalize' }}>
                      {MOOD_EMOJIS[m.emotion] || '•'} {m.emotion}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </section>
      </main>
    </Shell>
  )
}

function Shell({ children, t }) {
  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontFamily: "'DM Sans', sans-serif", position: 'relative', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function MetricCard({ t, label, value, icon, color }) {
  return (
    <div className="dash-card" style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 18, padding: 20, boxShadow: t.softShadow, transition: 'all 0.2s', backdropFilter: 'blur(18px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: t.accentSoft, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, color, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 13, color: t.muted, fontWeight: 700 }}>{label}</div>
    </div>
  )
}

function Card({ t, children }) {
  return (
    <div className="dash-card" style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 20, padding: 24, boxShadow: t.softShadow, transition: 'all 0.2s', backdropFilter: 'blur(18px)' }}>
      {children}
    </div>
  )
}

function ProgressRing({ value, t }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  const bg = `conic-gradient(${t.accent} ${pct * 3.6}deg, ${t.track} 0deg)`

  return (
    <div style={{ width: 118, height: 118, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: t.softShadow }}>
      <div style={{ width: 84, height: 84, borderRadius: '50%', background: t.innerCircle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.text, fontWeight: 800 }}>
        {pct}%
      </div>
    </div>
  )
}

const headingStyle = (t) => ({
  margin: '0 0 7px',
  color: t.text,
  fontSize: 19,
  fontWeight: 800,
})

const subStyle = (t) => ({
  color: t.muted,
  fontSize: 14,
  lineHeight: 1.6,
  margin: 0,
})

const L = {
  bg: 'linear-gradient(135deg, #f8fafc 0%, #f6f7fb 52%, #eef4ff 100%)',
  headerBg: 'rgba(255,255,255,0.72)',
  text: '#111827',
  subtext: '#243047',
  muted: '#7d8796',
  border: '#dde3ec',
  hover: '#eef4ff',
  cardBg: 'rgba(255,255,255,0.84)',
  track: '#e2e8f0',
  innerCircle: '#ffffff',
  accent: '#2563eb',
  accentText: '#1d4ed8',
  accentSoft: '#dbeafe',
  accentGradient: 'linear-gradient(135deg, #2563eb, #14b8a6)',
  shadow: '0 16px 40px rgba(15, 23, 42, 0.10)',
  softShadow: '0 12px 30px rgba(15, 23, 42, 0.07)',
  blobOne: 'rgba(37, 99, 235, 0.14)',
  blobTwo: 'rgba(20, 184, 166, 0.12)',
}

const D = {
  bg: 'linear-gradient(135deg, #07111f 0%, #0b1220 48%, #101827 100%)',
  headerBg: 'rgba(13,24,40,0.76)',
  text: '#f8fbff',
  subtext: '#c8d7ea',
  muted: '#71829b',
  border: '#1f3b57',
  hover: '#12243a',
  cardBg: 'rgba(16,31,51,0.82)',
  track: '#08111f',
  innerCircle: '#0b1220',
  accent: '#38bdf8',
  accentText: '#7dd3fc',
  accentSoft: '#07364d',
  accentGradient: 'linear-gradient(135deg, #38bdf8, #22c55e)',
  shadow: '0 18px 50px rgba(0, 0, 0, 0.35)',
  softShadow: '0 12px 30px rgba(0, 0, 0, 0.22)',
  blobOne: 'rgba(56, 189, 248, 0.12)',
  blobTwo: 'rgba(34, 197, 94, 0.10)',
}
