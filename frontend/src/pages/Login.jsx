import { useState } from 'react'
import axios from 'axios'

const API = '/api'

export default function Login({ onLogin, dark, setDark }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const t = dark ? D : L

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.')
      return
    }

    if (mode === 'register' && !name.trim()) {
      setError('Name is required for registration.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const endpoint = mode === 'register' ? '/auth/register' : '/auth/login'
      const body = mode === 'register'
        ? { name: name.trim(), email: email.trim(), password }
        : { email: email.trim(), password }

      const res = await axios.post(`${API}${endpoint}`, body)
      const { token, user_id, name: returnedName } = res.data

      localStorage.setItem('mentor_token', token)
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      onLogin({
        name: returnedName || name.trim(),
        email: email.trim(),
        userId: user_id,
      })
    } catch (err) {
      const msg = err.response?.data?.detail
      setError(msg || 'Could not connect. Is the backend running on port 8000?')
    } finally {
      setLoading(false)
    }
  }

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
        input::placeholder { color: ${t.placeholder}; }
        input:focus {
          border-color: ${t.accent} !important;
          box-shadow: 0 0 0 4px ${t.accent}22 !important;
          outline: none;
        }
        .login-btn:hover:not(:disabled) {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }
        .toggle-btn:hover,
        .feature-card:hover {
          background: ${t.hover} !important;
          transform: translateY(-1px);
        }
        .mode-btn:hover { opacity: 0.9; }
      `}</style>

      <div
        style={{
          flex: 1,
          background: t.leftBg,
          borderRight: `1px solid ${t.border}`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '42px 52px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: -120, right: -90, width: 360, height: 360, borderRadius: '50%', background: `${t.accent}22`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -130, left: -90, width: 310, height: 310, borderRadius: '50%', background: `${t.green}18`, pointerEvents: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${t.accent}, ${t.green})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18, boxShadow: t.shadow }}>
              M
            </div>
            <span style={{ color: t.text, fontSize: 20, fontWeight: 800 }}>MentorBot</span>
          </div>

          <button
            type="button"
            className="toggle-btn"
            onClick={() => setDark(p => !p)}
            style={{
              background: t.cardBg,
              border: `1px solid ${t.border}`,
              borderRadius: 999,
              padding: '8px 15px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              color: t.subtext,
              transition: 'all 0.2s',
              boxShadow: dark ? 'none' : '0 10px 24px rgba(15, 23, 42, 0.06)',
            }}
          >
            {dark ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        <div style={{ zIndex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: t.accentText, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            AI Mentor Platform
          </div>

          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 54, fontWeight: 600, color: t.text, lineHeight: 1.08, marginBottom: 20, letterSpacing: 0 }}>
            Your mentor.<br />
            Your memory.<br />
            <span style={{ color: t.accentText }}>Your growth.</span>
          </h1>

          <p style={{ color: t.muted, fontSize: 16, lineHeight: 1.8, maxWidth: 430 }}>
            An AI mentor that remembers your conversations, understands your mood, and helps you move forward with a personal learning path.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, zIndex: 1 }}>
          {[
            ['🔐', 'Secure Login', 'Protected account access with JWT authentication'],
            ['🧠', 'Persistent Memory', 'Keeps useful context across your mentoring sessions'],
            ['😊', 'Mood Detection', 'Adapts the mentor tone based on how you feel'],
            ['🎯', 'Goal Tracking', 'Tracks progress and supports learning goals'],
          ].map(([icon, title, sub]) => (
            <div
              key={title}
              className="feature-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '13px 15px',
                background: t.cardBg,
                borderRadius: 14,
                border: `1px solid ${t.border}`,
                transition: 'all 0.2s',
                boxShadow: dark ? 'none' : '0 10px 26px rgba(15, 23, 42, 0.05)',
              }}
            >
              <span style={{ fontSize: 22 }}>{icon}</span>
              <div>
                <div style={{ color: t.text, fontSize: 14, fontWeight: 800 }}>{title}</div>
                <div style={{ color: t.muted, fontSize: 12.5, marginTop: 2 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 52, background: t.rightBg }}>
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ display: 'flex', background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 14, padding: 5, marginBottom: 30, boxShadow: dark ? 'none' : '0 12px 30px rgba(15, 23, 42, 0.06)' }}>
            {['login', 'register'].map(m => (
              <button
                type="button"
                key={m}
                className="mode-btn"
                onClick={() => {
                  setMode(m)
                  setError('')
                }}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: mode === m ? `linear-gradient(135deg, ${t.accent}, ${t.green})` : 'transparent',
                  color: mode === m ? '#fff' : t.muted,
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <h2 style={{ fontFamily: "'Playfair Display', serif", color: t.text, fontSize: 32, fontWeight: 600, marginBottom: 8, letterSpacing: 0 }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>

          <p style={{ color: t.muted, fontSize: 15, marginBottom: 26, lineHeight: 1.6 }}>
            {mode === 'login' ? 'Sign in to continue with your mentor.' : 'Start your personalized mentoring journey.'}
          </p>

          {mode === 'register' && (
            <Field label="Full Name" value={name} onChange={setName} placeholder="Ankit Mishra" t={t} />
          )}

          <Field label="Email Address" value={email} onChange={setEmail} placeholder="you@email.com" type="email" t={t} />

          <Field
            label="Password"
            value={password}
            onChange={setPass}
            placeholder="Min. 6 characters"
            type="password"
            t={t}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />

          {error && (
            <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, padding: '11px 13px', background: 'rgba(239,68,68,0.10)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.25)', lineHeight: 1.45 }}>
              ⚠️ {error}
            </div>
          )}

          <button
            type="button"
            className="login-btn"
            style={{
              width: '100%',
              padding: 14,
              background: `linear-gradient(135deg, ${t.accent}, ${t.green})`,
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 800,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontFamily: "'DM Sans', sans-serif",
              opacity: loading ? 0.72 : 1,
              boxShadow: t.shadow,
            }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>

          <p style={{ color: t.muted, fontSize: 13, textAlign: 'center', marginTop: 18 }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <span
              style={{ color: t.accentText, cursor: 'pointer', fontWeight: 800 }}
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setError('')
              }}
            >
              {mode === 'login' ? 'Register here' : 'Sign in here'}
            </span>
          </p>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', t, onKeyDown }) {
  return (
    <div style={{ marginBottom: 15 }}>
      <label style={{ display: 'block', color: t.subtext, fontSize: 13, fontWeight: 800, marginBottom: 7 }}>
        {label}
      </label>
      <input
        style={{
          width: '100%',
          padding: '12px 14px',
          background: t.inputBg,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          color: t.text,
          fontSize: 14,
          transition: 'all 0.2s',
          fontFamily: "'DM Sans', sans-serif",
        }}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  )
}

const L = {
  bg: '#f6f7fb',
  leftBg: 'rgba(255,255,255,0.68)',
  rightBg: 'rgba(255,255,255,0.52)',
  text: '#111827',
  subtext: '#243047',
  muted: '#7d8796',
  placeholder: '#a8b1c0',
  border: '#dde3ec',
  hover: '#eef4ff',
  cardBg: 'rgba(255,255,255,0.82)',
  inputBg: '#ffffff',
  accent: '#2563eb',
  accentText: '#1d4ed8',
  green: '#14b8a6',
  shadow: '0 16px 40px rgba(15, 23, 42, 0.10)',
}

const D = {
  bg: '#0b1220',
  leftBg: 'rgba(8,17,31,0.82)',
  rightBg: 'rgba(13,24,40,0.72)',
  text: '#f8fbff',
  subtext: '#c8d7ea',
  muted: '#71829b',
  placeholder: '#52677f',
  border: '#1f3b57',
  hover: '#12243a',
  cardBg: 'rgba(16,31,51,0.82)',
  inputBg: '#101f33',
  accent: '#38bdf8',
  accentText: '#7dd3fc',
  green: '#22c55e',
  shadow: '0 18px 50px rgba(0, 0, 0, 0.35)',
}
