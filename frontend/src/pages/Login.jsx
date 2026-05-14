import { useState } from 'react'
import axios from 'axios'
import { RiLockPasswordFill } from 'react-icons/ri'
import { LuBrain } from 'react-icons/lu'
import { GoGoal } from 'react-icons/go'
import { BiHappy } from 'react-icons/bi'

const API = '/api'

const FEATURES = [
  {
    icon: RiLockPasswordFill,
    title: 'Secure Login',
    sub: 'Protected account access with JWT authentication',
    gradient: 'linear-gradient(135deg, #2563eb, #06b6d4)',
    glow: 'rgba(37,99,235,0.25)',
    color: '#3b82f6',
  },
  {
    icon: LuBrain,
    title: 'Persistent Memory',
    sub: 'Keeps useful context across mentoring sessions',
    gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)',
    glow: 'rgba(139,92,246,0.25)',
    color: '#8b5cf6',
  },
  {
    icon: BiHappy,
    title: 'Mood Detection',
    sub: 'Adapts mentor tone based on emotions',
    gradient: 'linear-gradient(135deg, #10b981, #14b8a6)',
    glow: 'rgba(16,185,129,0.25)',
    color: '#10b981',
  },
  {
    icon: GoGoal,
    title: 'Goal Tracking',
    sub: 'Tracks progress and learning goals',
    gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    glow: 'rgba(245,158,11,0.22)',
    color: '#f59e0b',
  },
]

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

      const body =
        mode === 'register'
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
      setError(msg || 'Could not connect. Is backend running on port 8000?')
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
        overflow: 'hidden',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@300;400;500;600;700;800&display=swap');

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        input::placeholder {
          color: ${t.placeholder};
        }

        input:focus {
          outline: none;
          box-shadow: none;
        }
      `}</style>

      <div
        style={{
          flex: 1,
          background: t.leftBg,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '42px 52px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -90,
            width: 360,
            height: 360,
            borderRadius: '50%',
            background: `${t.accent}22`,
            filter: 'blur(2px)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: -130,
            left: -90,
            width: 310,
            height: 310,
            borderRadius: '50%',
            background: `${t.green}18`,
            filter: 'blur(2px)',
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #8b5cf6, #06b6d4, #14b8a6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontWeight: 800,
                fontSize: 18,
                boxShadow: '0 12px 28px rgba(59,130,246,0.25)',
              }}
            >
              M
            </div>

            <div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: t.text,
                }}
              >
                MentorBot
              </div>

              <div
                style={{
                  fontSize: 12,
                  letterSpacing: 2,
                  color: t.accentText,
                  fontWeight: 700,
                }}
              >
                AI MENTOR PLATFORM
              </div>
            </div>
          </div>

          <button
            onClick={() => setDark((p) => !p)}
            style={{
              padding: '10px 18px',
              borderRadius: 999,
              border: 'none',
              background: t.cardBg,
              color: t.text,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14,
              boxShadow: dark ? 'none' : '0 10px 24px rgba(15, 23, 42, 0.06)',
            }}
          >
            {dark ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        <div style={{ zIndex: 1 }}>
          <h1
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 70,
              lineHeight: 1.05,
              color: t.text,
              marginBottom: 24,
            }}
          >
            Your mentor.
            <br />
            Your memory.
            <br />
            <span style={{ color: t.accentText }}>Your growth.</span>
          </h1>

          <p
            style={{
              maxWidth: 480,
              fontSize: 18,
              lineHeight: 1.8,
              color: t.muted,
            }}
          >
            An AI mentor that remembers your conversations, understands your mood, and helps you move forward with a personal learning path.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            zIndex: 1,
          }}
        >
          {FEATURES.map(({ icon: Icon, title, sub, gradient, glow, color }) => (
            <div
              key={title}
              style={{
               
                padding: '10px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                
                
                backdropFilter: 'blur(16px)',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 15,
                  background: gradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  boxShadow: `0 10px 22px ${glow}`,
                  flexShrink: 0,
                }}
              >
                <Icon size={22} />
              </div>

              <div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: t.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ color }}>{title}</span>
                </div>

                <div
                  style={{
                    fontSize: 13,
                    color: t.muted,
                    marginTop: 3,
                    lineHeight: 1.5,
                  }}
                >
                  {sub}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          width: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 50,
          background: t.rightBg,
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div
            style={{
              display: 'flex',
              background: t.cardBg,
              borderRadius: 16,
              padding: 6,
              marginBottom: 30,
              boxShadow: dark ? 'none' : '0 12px 28px rgba(15, 23, 42, 0.06)',
              border: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(148,163,184,0.12)'}`,
            }}
          >
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m)
                  setError('')
                }}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  border: 'none',
                  borderRadius: 12,
                  background:
                    mode === m
                      ? 'linear-gradient(135deg, #8b5cf6, #06b6d4, #14b8a6)'
                      : 'transparent',
                  color: mode === m ? '#fff' : t.muted,
                  fontWeight: 800,
                  cursor: 'pointer',
                  fontSize: 14,
                  transition: 'all 0.2s',
                  boxShadow: mode === m ? '0 10px 22px rgba(59,130,246,0.20)' : 'none',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <h2
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 34,
              color: t.text,
              marginBottom: 10,
            }}
          >
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>

          <p
            style={{
              color: t.muted,
              marginBottom: 28,
              lineHeight: 1.7,
            }}
          >
            {mode === 'login'
              ? 'Sign in to continue with your mentor.'
              : 'Start your personalized mentoring journey.'}
          </p>

          {mode === 'register' && (
            <Field
              label="Full Name"
              value={name}
              onChange={setName}
              placeholder="Ankit Mishra"
              t={t}
            />
          )}

          <Field
            label="Email Address"
            value={email}
            onChange={setEmail}
            placeholder="you@email.com"
            type="email"
            t={t}
          />

          <Field
            label="Password"
            value={password}
            onChange={setPass}
            placeholder="Min. 6 characters"
            type="password"
            t={t}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />

          {error && (
            <div
              style={{
                background: 'rgba(239,68,68,0.12)',
                color: '#ef4444',
                padding: 14,
                borderRadius: 12,
                marginBottom: 16,
                fontSize: 13,
                border: '1px solid rgba(239,68,68,0.16)',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%',
              padding: 15,
              border: 'none',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #8b5cf6, #06b6d4, #14b8a6)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: dark ? 'none' : '0 12px 26px rgba(59,130,246,0.22)',
              opacity: loading ? 0.9 : 1,
            }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>

          <p
            style={{
              textAlign: 'center',
              marginTop: 18,
              color: t.muted,
              fontSize: 13,
            }}
          >
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}

            <span
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setError('')
              }}
              style={{
                color: t.accentText,
                cursor: 'pointer',
                fontWeight: 800,
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  t,
  onKeyDown,
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: 'block',
          marginBottom: 8,
          color: t.subtext,
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          padding: '14px 16px',
          border: 'none',
          borderRadius: 14,
          background: t.inputBg,
          color: t.text,
          fontSize: 14,
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: darkShadow(t, false),
        }}
      />
    </div>
  )
}

function darkShadow(t, dark) {
  return dark
    ? 'none'
    : '0 10px 24px rgba(15, 23, 42, 0.06)'
}

const L = {
  leftBg: 'rgba(255,255,255,0.70)',
  rightBg: 'rgba(255,255,255,0.55)',
  text: '#111827',
  subtext: '#1f2937',
  muted: '#6b7280',
  placeholder: '#9ca3af',
  cardBg: 'rgba(255,255,255,0.82)',
  inputBg: '#ffffff',
  accent: '#2563eb',
  accentText: '#1d4ed8',
  green: '#14b8a6',
}

const D = {
  leftBg: 'rgba(8,17,31,0.82)',
  rightBg: 'rgba(13,24,40,0.72)',
  text: '#f8fbff',
  subtext: '#c8d7ea',
  muted: '#71829b',
  placeholder: '#52677f',
  cardBg: 'rgba(16,31,51,0.82)',
  inputBg: '#101f33',
  accent: '#38bdf8',
  accentText: '#7dd3fc',
  green: '#22c55e',
}