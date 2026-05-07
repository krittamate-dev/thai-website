import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../utils/api'
import { setTokens, setUser, isAuthenticated } from '../utils/auth'
import '../styles/auth.css'

const GoogleIcon = () => (
  <svg className="google-icon" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (isAuthenticated()) navigate('/dashboard')
  }, [navigate])

  useEffect(() => {
    if (!window.google || !googleClientId) return
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleResponse,
    })
    window.google.accounts.id.renderButton(
      document.getElementById('google-signin-btn'),
      { theme: 'outline', size: 'large', width: 360, text: 'signin_with', locale: 'th' }
    )
  }, [googleClientId])

  const handleGoogleResponse = async (response) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.googleAuth(response.credential)
      const data = await res.json()
      if (res.ok) {
        setTokens(data.tokens.access, data.tokens.refresh)
        setUser(data.user)
        navigate('/dashboard')
      } else {
        setError(data.error || 'เข้าสู่ระบบด้วย Google ล้มเหลว')
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.username || !form.password) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await api.login(form)
      const data = await res.json()
      if (res.ok) {
        setTokens(data.access, data.refresh)
        const profileRes = await api.profile()
        if (profileRes.ok) {
          setUser(await profileRes.json())
        }
        navigate('/dashboard')
      } else {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      }
    } catch {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">เข้าสู่ระบบ</h1>
        <p className="auth-subtitle">ยินดีต้อนรับกลับ! กรุณาเข้าสู่ระบบ</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">ชื่อผู้ใช้</label>
            <input
              type="text"
              name="username"
              className="form-input"
              placeholder="กรอกชื่อผู้ใช้"
              value={form.username}
              onChange={handleChange}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">รหัสผ่าน</label>
            <input
              type="password"
              name="password"
              className="form-input"
              placeholder="กรอกรหัสผ่าน"
              value={form.password}
              onChange={handleChange}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="divider">หรือ</div>

        {googleClientId ? (
          <div id="google-signin-btn" style={{ display: 'flex', justifyContent: 'center' }} />
        ) : (
          <button className="btn-google" disabled>
            <GoogleIcon />
            เข้าสู่ระบบด้วย Google (ตั้งค่า VITE_GOOGLE_CLIENT_ID ก่อน)
          </button>
        )}

        <div className="auth-footer">
          ยังไม่มีบัญชี? <Link to="/register">สมัครสมาชิกที่นี่</Link>
        </div>
      </div>
    </div>
  )
}

export default Login
