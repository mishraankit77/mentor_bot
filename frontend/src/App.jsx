


import { useEffect, useState } from 'react'
import axios from 'axios'
import Login from './pages/Login.jsx'
import Chat from './pages/Chat.jsx'
import Dashboard from './pages/Dashboard.jsx'

axios.defaults.withCredentials = true

export default function App() {
  const [user, setUser] = useState(null)
  const [dark, setDark] = useState(false)
  const [page, setPage] = useState('chat')
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const res = await axios.get('/api/auth/me')
        setUser(res.data.user)
      } catch {
        try {
          await axios.post('/api/auth/refresh')
          const res = await axios.get('/api/auth/me')
          setUser(res.data.user)
        } catch {
          setUser(null)
        }
      } finally {
        setBooting(false)
      }
    }

    bootstrap()
  }, [])

  const handleLogin = (userData) => {
    setUser(userData)
  }

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout')
    } finally {
      setUser(null)
      setPage('chat')
    }
  }

  if (booting) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
        Loading...
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
      {!user ? (
        <Login onLogin={handleLogin} dark={dark} setDark={setDark} />
      ) : page === 'dashboard' ? (
        <Dashboard user={user} dark={dark} onBack={() => setPage('chat')} />
      ) : (
        <Chat
          user={user}
          onLogout={handleLogout}
          dark={dark}
          setDark={setDark}
          onDashboard={() => setPage('dashboard')}
        />
      )}
    </div>
  )
}