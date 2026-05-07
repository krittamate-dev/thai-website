import { useState, useRef } from 'react'
import { getAccessToken } from '../utils/auth'
import '../styles/speech.css'

const ACCEPTED = '.mp3,.wav,.webm,.ogg,.flac'
const MAX_SIZE = 10 * 1024 * 1024

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function Speech() {
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('th')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef()

  const handleFile = (f) => {
    setError('')
    setResult('')
    if (!f) return
    if (f.size > MAX_SIZE) {
      setError('ไฟล์ขนาดใหญ่เกินไป (สูงสุด 10MB)')
      return
    }
    setFile(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleTranscribe = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult('')

    const formData = new FormData()
    formData.append('audio', file)
    formData.append('language', language)

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api'}/speech/transcribe/`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${getAccessToken()}` },
          body: formData,
        }
      )
      const data = await res.json()
      if (res.ok) {
        setResult(data.text)
      } else {
        setError(data.error || 'เกิดข้อผิดพลาด')
      }
    } catch {
      setError('เชื่อมต่อ server ไม่ได้')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="speech-page">
      <h1>แปลงเสียงเป็นข้อความ</h1>
      <p className="subtitle">อัปโหลดไฟล์เสียง แล้วระบบจะแปลงเป็นข้อความให้อัตโนมัติ</p>

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
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
        <p>รองรับไฟล์เสียงขนาดสูงสุด 10MB</p>
        <div className="file-types">
          {['MP3', 'WAV', 'WebM', 'OGG', 'FLAC'].map(t => (
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
            onClick={(e) => { e.stopPropagation(); setFile(null); setResult('') }}
            style={{ background: 'none', border: 'none', color: 'var(--text-light)', fontSize: '1.1rem' }}
          >×</button>
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>{error}</div>
      )}

      <div className="controls">
        <select
          className="lang-select"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="th">🇹🇭 ภาษาไทย</option>
          <option value="en">🇬🇧 English</option>
        </select>
        <button
          className="btn-transcribe"
          onClick={handleTranscribe}
          disabled={!file || loading}
        >
          {loading ? 'กำลังแปลง...' : '🔊 แปลงเป็นข้อความ'}
        </button>
      </div>

      {(loading || result) && (
        <div className="result-box">
          <div className="result-header">
            <h3>ผลลัพธ์</h3>
            {result && (
              <button className="btn-copy" onClick={handleCopy}>
                {copied ? '✓ คัดลอกแล้ว' : 'คัดลอก'}
              </button>
            )}
          </div>
          {loading ? (
            <div className="processing">
              <div className="spinner" />
              <span>กำลังประมวลผลเสียง...</span>
            </div>
          ) : (
            <div className="result-text">{result}</div>
          )}
        </div>
      )}
    </div>
  )
}

export default Speech
