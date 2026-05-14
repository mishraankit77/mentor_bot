import { useState, useEffect } from 'react'
import axios from 'axios'

const API = '/api'

const MOOD_COLORS = {
  motivated: '#10b981',
  neutral: '#6366f1',
  confused: '#eab308',
  stressed: '#ef4444',
  sad: '#6366f1',
  angry: '#f97316',
}

export default function Dashboard({ user, onBack, dark }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const t = dark ? D : L

  useEffect(() => {
    axios.get(`${API}/analytics/${user.userId}`)
      .then(res => {
        setData(res.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user.userId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: t.bg, color: t.text, fontFamily: "'DM Sans', sans-serif", fontSize: 16 }}>
      Loading analytics... 📊
    </div>
  )

  if (!data) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: t.bg, color: t.text }}>
      Could not load analytics.
    </div>
  )

  const topMood = Object.entries(data.mood_stats).sort((a, b) => b[1] - a[1])[0]
  const moodTotal = Object.values(data.mood_stats).reduce((a, b) => a + b, 0)

  return (
    <div style={{ minHeight: '100vh', background: t.bg, fontFamily: "'DM Sans', sans-serif", color: t.text }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=DM+Sans:wght@300;400;500&display=swap');`}</style>

      <div style={{ borderBottom: `1px solid ${t.border}`, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.sidebar }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${t.border}`, borderRadius: 8, padding: '6px 14px', color: t.subtext, cursor: 'pointer', fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
            ← Back to Chat
          </button>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: t.text, margin: 0 }}>Your Analytics</h1>
        </div>
        <div style={{ fontSize: 13, color: t.muted }}>Hi {user.name} 👋</div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Total Messages', value: data.total_messages, icon: '💬', color: '#6366f1' },
            { label: 'Active Goals', value: data.active_goals, icon: '🎯', color: dark ? '#00B4D8' : '#d4a853' },
            { label: 'Goals Completed', value: data.completed_goals, icon: '✅', color: '#10b981' },
            { label: 'Avg Progress', value: data.avg_progress + '%', icon: '📈', color: '#f97316' },
          ].map(card => (
            <div key={card.label} style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 14, padding: '20px 20px 16px' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: card.color, marginBottom: 4 }}>{card.value}</div>
              <div style={{ fontSize: 13, color: t.muted }}>{card.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: t.text }}>😊 Mood Breakdown</h3>
            <p style={{ color: t.muted, fontSize: 13, marginBottom: 20 }}>
              Your most common mood: <strong style={{ color: MOOD_COLORS[topMood?.[0]] || t.text }}>{topMood?.[0] || 'N/A'}</strong>
            </p>

            {Object.entries(data.mood_stats).map(([mood, count]) => {
              const pct = Math.round((count / moodTotal) * 100)
              return (
                <div key={mood} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: t.subtext, textTransform: 'capitalize' }}>{mood}</span>
                    <span style={{ fontSize: 13, color: t.muted }}>{count} times ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: dark ? '#0D1B2A' : '#f3f4f6', borderRadius: 3 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: MOOD_COLORS[mood] || '#6366f1', borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>
                </div>
              )
            })}

            {Object.keys(data.mood_stats).length === 0 && (
              <p style={{ color: t.muted, fontSize: 13 }}>No mood data yet. Start chatting!</p>
            )}
          </div>

          <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 600, color: t.text }}>🎯 Goals Progress</h3>
            <p style={{ color: t.muted, fontSize: 13, marginBottom: 20 }}>
              {data.completed_goals} of {data.total_goals} goals completed
            </p>

            {data.goals.length === 0 && (
              <p style={{ color: t.muted, fontSize: 13 }}>No goals yet. Add goals in the chat sidebar!</p>
            )}

            {data.goals.map(g => (
              <div key={g.id} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>
                    {g.status === 'completed' ? '✅' : '🎯'} {g.title}
                  </span>
                  <span style={{ fontSize: 12, color: t.muted }}>{g.progress}%</span>
                </div>
                <div style={{ height: 6, background: dark ? '#0D1B2A' : '#f3f4f6', borderRadius: 3 }}>
                  <div style={{ width: `${g.progress}%`, height: '100%', background: g.status === 'completed' ? '#10b981' : (dark ? '#00B4D8' : '#d4a853'), borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 14, padding: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 600, color: t.text }}>📅 Recent Mood Timeline</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.mood_history.length === 0 && (
              <p style={{ color: t.muted, fontSize: 13 }}>No mood history yet.</p>
            )}
            {data.mood_history.map((m, i) => (
              <div
                key={i}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  background: (MOOD_COLORS[m.emotion] || '#6366f1') + '20',
                  color: MOOD_COLORS[m.emotion] || '#6366f1',
                  border: `1px solid ${(MOOD_COLORS[m.emotion] || '#6366f1')}40`,
                }}
              >
                {m.emotion}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const L = {
  bg: '#ffffff',
  sidebar: '#f9fafb',
  text: '#111827',
  subtext: '#374151',
  muted: '#9ca3af',
  border: '#e5e7eb',
  cardBg: '#ffffff',
}

const D = {
  bg: '#0D1B2A',
  sidebar: '#0a1628',
  text: '#E8F4F8',
  subtext: '#90E0EF',
  muted: '#4a7fa5',
  border: '#0077B6',
  cardBg: '#1A2E40',
}