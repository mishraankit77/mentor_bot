import { useState, useEffect } from 'react'
import axios from 'axios'
import Login from './pages/Login.jsx'
import Chat from './pages/Chat.jsx'
import Dashboard from './pages/Dashboard.jsx'

/*
  WHY APP.JSX CHANGED:
  Before: user state was lost on page refresh (no token persistence).
  After:  On mount, checks localStorage for a saved JWT token.
          If found, restores the session without re-logging in.
          If not found, shows Login.
*/
export default function App() {
  const [user, setUser] = useState(null)
  const [dark, setDark] = useState(false)
  const [page, setPage] = useState('chat')

  // Restore session from localStorage on first load
  useEffect(() => {
    const token  = localStorage.getItem('mentor_token')
    const stored = localStorage.getItem('mentor_user')
    if (token && stored) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      setUser(JSON.parse(stored))
    }
  }, [])

  const handleLogin = (userData) => {
    localStorage.setItem('mentor_user', JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('mentor_token')
    localStorage.removeItem('mentor_user')
    delete axios.defaults.headers.common['Authorization']
    setUser(null)
  }

  return (
    <div style={{ height:'100vh', margin:0, fontFamily:"'DM Sans', sans-serif" }}>
      {!user
        ? <Login onLogin={handleLogin} dark={dark} setDark={setDark} />
        : page === 'dashboard'
          ? <Dashboard user={user} dark={dark} onBack={() => setPage('chat')} />
          : <Chat user={user} onLogout={handleLogout} dark={dark} setDark={setDark} onDashboard={() => setPage('dashboard')} />
      }
    </div>
  )
}
