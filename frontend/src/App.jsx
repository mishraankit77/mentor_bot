import { useState } from 'react'
import Login from './pages/Login.jsx'
import Chat from './pages/Chat.jsx'
import Dashboard from './pages/Dashboard.jsx'

export default function App() {
  const [user, setUser]   = useState(null)
  const [dark, setDark]   = useState(false)
  const [page, setPage]   = useState('chat')  // 'chat' or 'dashboard'

  return (
    <div style={{ height:'100vh', margin:0, fontFamily:"'DM Sans', sans-serif" }}>
      {!user
        ? <Login onLogin={setUser} dark={dark} setDark={setDark} />
        : page === 'dashboard'
          ? <Dashboard user={user} dark={dark} onBack={() => setPage('chat')} />
          : <Chat user={user} onLogout={() => setUser(null)} dark={dark} setDark={setDark} onDashboard={() => setPage('dashboard')} />
      }
    </div>
  )
}