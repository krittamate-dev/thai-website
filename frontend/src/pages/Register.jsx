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

const INITIAL_FORM = {
  username: '', email: '', first_name: '', last_name: '',
  password: '', password_confirm: '',
}

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL_FORM)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
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
      document.getElementById('google-register-btn'),
      { theme: 'outline', size: 'large', width: 360, text: 'signup_with', locale: 'th' }
    )
  }, [googleClientId])

  const handleGoogleResponse = async (response) => {
    setLoading(true)
    setServerError('')
    try {
      const res = await api.googleAuth(response.credential)
      const data = await res.json()
      if (res.ok) {
        setTokens(data.tokens.access, data.tokens.refresh)
        setUser(data.user)
        navigate('/dashboard')
      } else {
        setServerError(data.error || 'สมัครสมาชิกด้วย Google ล้มเหลว')
      }
    } catch {
      setServerError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrors({ ...errors, [e.target.name]: '' })
    setServerError('')
  }

  const validate = () => {
    const e = {}
    if (!form.username) e.username = 'กรุณากรอกชื่อผู้ใช้'
    if (!form.email) e.email = 'กรุณากรอกอีเมล'
    if (!form.password) e.password = 'กรุณากรอกรหัสผ่าน'
    else if (form.password.length < 8) e.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'
    if (form.password !== form.password_confirm) e.password_confirm = 'รหัสผ่านไม่ตรงกัน'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setLoading(true)
    try {
      const res = await api.register(form)
      const data = await res.json()
      if (res.ok) {
        setTokens(data.tokens.access, data.tokens.refresh)
        setUser(data.user)
        navigate('/dashboard')
      } else {
        const firstError = Object.values(data)[0]
        setServerError(Array.isArray(firstError) ? firstError[0] : String(firstError))
      }
    } catch {
      setServerError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">สมัครสมาชิก</h1>
        <p className="auth-subtitle">สร้างบัญชีใหม่เพื่อเริ่มต้นใช้งาน</p>

        {serverError && <div className="alert alert-error">{serverError}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">ชื่อ</label>
              <input type="text" name="first_name" className="form-input"
                placeholder="ชื่อ" value={form.first_name} onChange={handleChange} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">นามสกุล</label>
              <input type="text" name="last_name" className="form-input"
                placeholder="นามสกุล" value={form.last_name} onChange={handleChange} />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1.25rem' }}>
            <label className="form-label">ชื่อผู้ใช้ *</label>
            <input type="text" name="username"
              className={`form-input ${errors.username ? 'error' : ''}`}
              placeholder="กรอกชื่อผู้ใช้" value={form.username} onChange={handleChange} />
            {errors.username && <p className="error-text">{errors.username}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">อีเมล *</label>
            <input type="email" name="email"
              className={`form-input ${errors.email ? 'error' : ''}`}
              placeholder="กรอกอีเมล" value={form.email} onChange={handleChange} />
            {errors.email && <p className="error-text">{errors.email}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">รหัสผ่าน *</label>
            <input type="password" name="password"
              className={`form-input ${errors.password ? 'error' : ''}`}
              placeholder="อย่างน้อย 8 ตัวอักษร" value={form.password} onChange={handleChange} />
            {errors.password && <p className="error-text">{errors.password}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">ยืนยันรหัสผ่าน *</label>
            <input type="password" name="password_confirm"
              className={`form-input ${errors.password_confirm ? 'error' : ''}`}
              placeholder="กรอกรหัสผ่านอีกครั้ง" value={form.password_confirm} onChange={handleChange} />
            {errors.password_confirm && <p className="error-text">{errors.password_confirm}</p>}
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <div className="divider">หรือ</div>

        {googleClientId ? (
          <div id="google-register-btn" style={{ display: 'flex', justifyContent: 'center' }} />
        ) : (
          <button className="btn-google" disabled>
            <GoogleIcon />
            สมัครด้วย Google (ตั้งค่า VITE_GOOGLE_CLIENT_ID ก่อน)
          </button>
        )}

        <div className="auth-footer">
          มีบัญชีอยู่แล้ว? <Link to="/login">เข้าสู่ระบบที่นี่</Link>
        </div>
      </div>
    </div>
  )
}

export default Register
