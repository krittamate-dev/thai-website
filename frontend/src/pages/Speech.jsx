import { useState, useEffect, useRef, useCallback } from 'react'
import { getAccessToken } from '../utils/auth'
import '../styles/speech.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'
const ACCEPTED = '.mp3,.m4a,.wav,.webm,.ogg,.flac'
const MAX_SIZE = 10 * 1024 * 1024

const STATUS_LABEL = {
  pending:    { label: 'รอดำเนินการ',    color: '#d97706', bg: '#fffbeb' },
  processing: { label: 'กำลังประมวลผล', color: '#2563eb', bg: '#eff6ff' },
  done:       { label: 'เสร็จสิ้น',      color: '#057a55', bg: '#f0fdf4' },
  failed:     { label: 'ล้มเหลว',        color: '#dc2626', bg: '#fef2f2' },
}

function formatSize(bytes) {
  return bytes < 1048576
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`
}

function formatDate(str) {
  return new Date(str).toLocaleString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function authHeaders() {
  return { Authorization: `Bearer ${getAccessToken()}` }
}

function StatusBadge({ status }) {
  const s = STATUS_LABEL[status] || STATUS_LABEL.pending
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: '0.2rem 0.7rem', borderRadius: '50px',
      fontSize: '0.8rem', fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
    }}>
      {status === 'processing' && <span className="spinner-sm" />}
      {s.label}
    </span>
  )
}

export default function Speech() {
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('th')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [jobs, setJobs] = useState([])
  const [expanded, setExpanded] = useState(null)
  const [copied, setCopied] = useState(null)
  const inputRef = useRef()
  const pollRef = useRef()

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API}/speech/jobs/`, { headers: authHeaders() })
      if (res.ok) setJobs(await res.json())
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  // Poll every 4s while any job is pending/processing
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'pending' || j.status === 'processing')
    clearInterval(pollRef.current)
    if (hasActive) {
      pollRef.current = setInterval(fetchJobs, 4000)
    }
    return () => clearInterval(pollRef.current)
  }, [jobs, fetchJobs])

  const handleFile = (f) => {
    setSubmitError('')
    if (!f) return
    if (f.size > MAX_SIZE) { setSubmitError('ไฟล์ขนาดใหญ่เกินไป (สูงสุด 10MB)'); return }
    setFile(f)
  }

  const handleSubmit = async () => {
    if (!file) return
    setSubmitting(true)
    setSubmitError('')
    const form = new FormData()
    form.append('audio', file)
    form.append('language', language)
    try {
      const res = await fetch(`${API}/speech/submit/`, {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      })
      const data = await res.json()
      if (res.ok) {
        setFile(null)
        setJobs(prev => [data, ...prev])
        setExpanded(data.id)
      } else {
        setSubmitError(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch {
      setSubmitError('เชื่อมต่อ server ไม่ได้')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    await fetch(`${API}/speech/jobs/${id}/`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    setJobs(prev => prev.filter(j => j.id !== id))
    if (expanded === id) setExpanded(null)
  }

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="speech-page">
      <h1>แปลงเสียงเป็นข้อความ</h1>
      <p className="subtitle">อัปโหลดไฟล์เสียง ระบบจะประมวลผลใน background คุณสามารถรอหรือกลับมาดูผลลัพธ์ได้ภายหลัง</p>

      {/* Upload form */}
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          onChange={(e) => handleFile(e.target.files[0])}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="upload-icon">🎙️</div>
        <h3>คลิกหรือลากไฟล์มาวางที่นี่</h3>
        <p>รองรับไฟล์เสียงสูงสุด 10MB</p>
        <div className="file-types">
          {['MP3', 'M4A', 'WAV', 'WebM', 'OGG', 'FLAC'].map(t => (
            <span key={t} className="badge">{t}</span>
          ))}
        </div>
      </div>

      {file && (
        <div className="selected-file">
          <span>📄</span>
          <span className="file-name">{file.name}</span>
          <span className="file-size">{formatSize(file.size)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setFile(null) }}
            style={{ background: 'none', border: 'none', color: 'var(--text-light)', fontSize: '1.1rem', cursor: 'pointer' }}
          >×</button>
        </div>
      )}

      {submitError && <div className="alert alert-error" style={{ marginTop: '1rem' }}>{submitError}</div>}

      <div className="controls">
        <select className="lang-select" value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="th">🇹🇭 ภาษาไทย</option>
          <option value="en">🇬🇧 English</option>
        </select>
        <button className="btn-transcribe" onClick={handleSubmit} disabled={!file || submitting}>
          {submitting ? 'กำลังส่งงาน...' : '📤 ส่งงานแปลงเสียง'}
        </button>
      </div>

      {/* Job list */}
      {jobs.length > 0 && (
        <div className="jobs-section">
          <div className="jobs-header">
            <h2>งานของฉัน</h2>
            <span className="jobs-count">{jobs.length} รายการ</span>
          </div>

          <div className="jobs-list">
            {jobs.map(job => (
              <div key={job.id} className="job-card">
                <div className="job-row" onClick={() => setExpanded(expanded === job.id ? null : job.id)}>
                  <div className="job-info">
                    <span className="job-filename">📄 {job.filename}</span>
                    <span className="job-meta">{formatDate(job.created_at)}</span>
                  </div>
                  <div className="job-actions">
                    <StatusBadge status={job.status} />
                    <button
                      className="btn-icon"
                      onClick={(e) => { e.stopPropagation(); handleDelete(job.id) }}
                      title="ลบ"
                    >🗑️</button>
                    <span className="job-chevron">{expanded === job.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {expanded === job.id && (
                  <div className="job-result">
                    {job.status === 'pending' && (
                      <div className="job-waiting">
                        <div className="spinner" />
                        <span>รอการประมวลผล...</span>
                      </div>
                    )}
                    {job.status === 'processing' && (
                      <div className="job-waiting">
                        <div className="spinner" />
                        <span>กำลังแปลงเสียงเป็นข้อความ...</span>
                      </div>
                    )}
                    {job.status === 'done' && (
                      <>
                        <div className="result-toolbar">
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
                            {job.language === 'th-TH' ? '🇹🇭 ภาษาไทย' : '🇬🇧 English'}
                          </span>
                          <button className="btn-copy" onClick={() => handleCopy(job.id, job.result)}>
                            {copied === job.id ? '✓ คัดลอกแล้ว' : 'คัดลอก'}
                          </button>
                        </div>
                        <div className="result-text">{job.result}</div>
                      </>
                    )}
                    {job.status === 'failed' && (
                      <div className="alert alert-error" style={{ margin: 0 }}>
                        ❌ {job.error_message || 'เกิดข้อผิดพลาดในการประมวลผล'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
