import { Link, useNavigate } from 'react-router-dom'
import { isAuthenticated, clearTokens } from '../utils/auth'
import '../styles/navbar.css'

function Navbar() {
  const navigate = useNavigate()
  const loggedIn = isAuthenticated()

  const handleLogout = () => {
    clearTokens()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">🇹🇭 เว็บไซต์ไทย</Link>
      <div className="navbar-nav">
        <Link to="/" className="nav-link">หน้าแรก</Link>
        {loggedIn ? (
          <>
            <Link to="/dashboard" className="nav-link">แดชบอร์ด</Link>
            <button onClick={handleLogout} className="btn-nav">ออกจากระบบ</button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-link">เข้าสู่ระบบ</Link>
            <Link to="/register">
              <button className="btn-nav">สมัครสมาชิก</button>
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}

export default Navbar
