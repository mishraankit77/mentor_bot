import { useState } from 'react'
import axios from 'axios'

export default function Login({ onLogin, dark, setDark }) {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const t = dark ? D : L

  const handleLogin = async () => {
    if (!name.trim() || !email.trim()) { setError('Please fill in both fields.'); return }
    setLoading(true); setError('')
    try {
      const res = await axios.post('/api/user/create', { name: name.trim(), email: email.trim() })
      onLogin({ name: name.trim(), email: email.trim(), userId: res.data.user_id })
    } catch {
      setError('Cannot connect to backend. Is it running on port 8000?')
    } finally { setLoading(false) }
  }

  const t_accent = dark ? '#00B4D8' : '#d4a853'

  return (
    <div style={{ display:'flex', height:'100vh', background: t.bg, fontFamily:"'DM Sans', sans-serif", transition:'background 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        input::placeholder { color: ${t.placeholder}; }
        input:focus { border-color: ${t_accent} !important; box-shadow: 0 0 0 3px ${t_accent}22 !important; outline:none; }
        .login-btn:hover:not(:disabled) { filter:brightness(1.08); transform:translateY(-1px); }
        .toggle-btn:hover { background: ${t.hover} !important; }
      `}</style>

      {/* ── Left Panel ── */}
      <div style={{ flex:1, background: t.leftBg, borderRight:`1px solid ${t.border}`, display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'40px 48px', position:'relative', overflow:'hidden' }}>

        {/* Decorative blobs */}
        <div style={{ position:'absolute', top:-80, right:-80, width:300, height:300, borderRadius:'50%', background:`${t_accent}15`, pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-60, left:-60, width:200, height:200, borderRadius:'50%', background:`${t_accent}10`, pointerEvents:'none' }} />

        {/* Brand + toggle */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:1, position:'relative' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:9, background: t_accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:700, fontSize:16 }}>M</div>
            <span style={{ color: t.text, fontSize:17, fontWeight:600 }}>MentorBot</span>
          </div>
          <button className="toggle-btn" onClick={() => setDark(p => !p)}
            style={{ background: t.cardBg, border:`1px solid ${t.border}`, borderRadius:20, padding:'6px 14px', cursor:'pointer', fontSize:13, color: t.subtext, transition:'all 0.2s' }}>
            {dark ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        {/* Hero */}
        <div style={{ zIndex:1, position:'relative' }}>
          <div style={{ fontSize:12, fontWeight:600, color: t_accent, letterSpacing:2, textTransform:'uppercase', marginBottom:14 }}>AI Mentor Platform</div>
          <h1 style={{ fontFamily:"'Playfair Display', serif", fontSize:46, fontWeight:600, color: t.text, lineHeight:1.18, marginBottom:18, letterSpacing:'-1px' }}>
            Your mentor.<br />Your memory.<br />
            <span style={{ color: t_accent }}>Your growth.</span>
          </h1>
          <p style={{ color: t.muted, fontSize:15, lineHeight:1.8, maxWidth:380 }}>
            An AI mentor that remembers every conversation, adapts to your mood, and builds a personalized learning path just for you.
          </p>
        </div>

        {/* Feature pills */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, zIndex:1, position:'relative' }}>
          {[
            ['🧠', 'Persistent Memory', 'Remembers you across every session'],
            ['😊', 'Mood Detection',    'Adapts tone based on how you feel'],
            ['🎯', 'Goal Tracking',     'Follows up on your progress weekly'],
          ].map(([icon, title, sub]) => (
            <div key={title} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background: t.cardBg, borderRadius:12, border:`1px solid ${t.border}` }}>
              <span style={{ fontSize:20 }}>{icon}</span>
              <div>
                <div style={{ color: t.text, fontSize:13, fontWeight:600 }}>{title}</div>
                <div style={{ color: t.muted, fontSize:12 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div style={{ width:460, display:'flex', alignItems:'center', justifyContent:'center', padding:48, background: t.bg }}>
        <div style={{ width:'100%', maxWidth:360 }}>
          <h2 style={{ fontFamily:"'Playfair Display', serif", color: t.text, fontSize:28, fontWeight:600, marginBottom:8, letterSpacing:'-0.5px' }}>
            Welcome back
          </h2>
          <p style={{ color: t.muted, fontSize:14, marginBottom:28 }}>Sign in to continue with your mentor</p>

          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', color: t.subtext, fontSize:13, fontWeight:500, marginBottom:6 }}>Full Name</label>
            <input
              style={{ width:'100%', padding:'11px 14px', background: t.inputBg, border:`1px solid ${t.border}`, borderRadius:10, color: t.text, fontSize:14, transition:'all 0.2s', fontFamily:"'DM Sans', sans-serif" }}
              placeholder="Ankit Mishra"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>

          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', color: t.subtext, fontSize:13, fontWeight:500, marginBottom:6 }}>Email Address</label>
            <input
              style={{ width:'100%', padding:'11px 14px', background: t.inputBg, border:`1px solid ${t.border}`, borderRadius:10, color: t.text, fontSize:14, transition:'all 0.2s', fontFamily:"'DM Sans', sans-serif" }}
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
            />
          </div>

          {error && (
            <div style={{ color:'#ef4444', fontSize:13, marginBottom:14, padding:'10px 12px', background:'rgba(239,68,68,0.08)', borderRadius:8, border:'1px solid rgba(239,68,68,0.2)' }}>
              ⚠️ {error}
            </div>
          )}

          <button className="login-btn"
            style={{ width:'100%', padding:13, background: t_accent, color:'#fff', border:'none', borderRadius:10, fontSize:15, fontWeight:600, cursor:'pointer', transition:'all 0.2s', fontFamily:"'DM Sans', sans-serif", opacity: loading?0.7:1 }}
            onClick={handleLogin} disabled={loading}>
            {loading ? 'Connecting...' : 'Continue →'}
          </button>

          <p style={{ color: t.muted, fontSize:12, textAlign:'center', marginTop:16 }}>
            New here? We'll create your profile automatically.
          </p>
        </div>
      </div>
    </div>
  )
}

// Light theme
const L = {
  bg:          '#ffffff',
  leftBg:      '#fafafa',
  text:        '#111827',
  subtext:     '#374151',
  muted:       '#9ca3af',
  placeholder: '#d1d5db',
  border:      '#e5e7eb',
  hover:       '#f3f4f6',
  cardBg:      '#ffffff',
  inputBg:     '#ffffff',
}

// Dark theme — bluish navy
const D = {
  bg:          '#0D1B2A',
  leftBg:      '#0a1628',
  text:        '#E8F4F8',
  subtext:     '#90E0EF',
  muted:       '#4a7fa5',
  placeholder: '#2a5a7a',
  border:      '#0077B6',
  hover:       '#1A2E40',
  cardBg:      '#1A2E40',
  inputBg:     '#1A2E40',
}