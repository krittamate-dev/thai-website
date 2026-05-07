import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser, clearTokens } from '../utils/auth'
import { api } from '../utils/api'
import '../styles/dashboard.css'

function Dashboard() {
  const navigate = useNavigate()
  const [user, setUser] = useState(getUser())

  useEffect(() => {
    api.profile().then(res => {
      if (res?.ok) res.json().then(setUser)
    })
  }, [])

  const handleLogout = () => {
    clearTokens()
    navigate('/')
  }

  const getInitial = () => {
    if (user?.first_name) return user.first_name[0].toUpperCase()
    if (user?.username) return user.username[0].toUpperCase()
    return 'ผ'
  }

  const getDisplayName = () => {
    if (user?.first_name && user?.last_name) return `${user.first_name} ${user.last_name}`
    if (user?.first_name) return user.first_name
    return user?.username || 'ผู้ใช้'
  }

  return (
    <div className="dashboard-page">
      <div className="profile-section">
        <div className="avatar">{getInitial()}</div>
        <div className="profile-info">
          <h2>สวัสดี, {getDisplayName()}!</h2>
          <p>{user?.email || user?.username}</p>
        </div>
        <button onClick={handleLogout} className="btn-logout">ออกจากระบบ</button>
      </div>

      <div className="dashboard-header">
        <h1>แดชบอร์ด</h1>
        <p>ยินดีต้อนรับสู่ระบบ คุณเข้าสู่ระบบสำเร็จแล้ว</p>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>สถานะบัญชี</h3>
          <div className="value" style={{ color: '#057a55', fontSize: '1.1rem' }}>✓ ใช้งานอยู่</div>
        </div>
        <div className="dashboard-card">
          <h3>ชื่อผู้ใช้</h3>
          <div className="value">{user?.username || '-'}</div>
        </div>
        <div className="dashboard-card">
          <h3>อีเมล</h3>
          <div className="value" style={{ fontSize: '1rem' }}>{user?.email || '-'}</div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
