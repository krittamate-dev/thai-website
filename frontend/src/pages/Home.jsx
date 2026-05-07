import { Link, useNavigate } from 'react-router-dom'
import { isAuthenticated } from '../utils/auth'
import '../styles/home.css'

function Home() {
  const navigate = useNavigate()
  const loggedIn = isAuthenticated()

  return (
    <div className="home-page">
      <section className="hero">
        <h1>ยินดีต้อนรับสู่<br />เว็บไซต์ไทย</h1>
        <p>แพลตฟอร์มออนไลน์สำหรับคนไทย ใช้งานง่าย ปลอดภัย และรวดเร็ว</p>
        <div className="hero-buttons">
          {loggedIn ? (
            <button className="btn-hero btn-hero-white" onClick={() => navigate('/dashboard')}>
              ไปยังแดชบอร์ด
            </button>
          ) : (
            <>
              <button className="btn-hero btn-hero-white" onClick={() => navigate('/register')}>
                เริ่มต้นใช้งานฟรี
              </button>
              <Link to="/login" className="btn-hero btn-hero-outline">
                เข้าสู่ระบบ
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="features">
        <h2>ทำไมต้องเลือกเรา?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>ปลอดภัยสูงสุด</h3>
            <p>ระบบรักษาความปลอดภัยระดับสูง พร้อมการยืนยันตัวตนผ่าน Google</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3>รวดเร็วทันใจ</h3>
            <p>ประสิทธิภาพสูง โหลดเร็ว ใช้งานได้ลื่นไหลบนทุกอุปกรณ์</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🇹🇭</div>
            <h3>รองรับภาษาไทย</h3>
            <p>ออกแบบมาเพื่อคนไทยโดยเฉพาะ ใช้งานง่ายในภาษาของคุณ</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3>ใช้งานได้ทุกที่</h3>
            <p>รองรับทุกอุปกรณ์ ทั้งมือถือ แท็บเล็ต และคอมพิวเตอร์</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Home
