import React, { useState } from 'react'

export default function AuthForm({ onAuth, mode = 'login' }: { onAuth: (token: string) => void, mode?: 'login' | 'register' }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const url = mode === 'register' ? '/api/auth/register' : '/api/auth/token'
      const body = mode === 'register'
        ? JSON.stringify({ username, password })
        : new URLSearchParams({ username, password })
      const headers = mode === 'register'
        ? { 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/x-www-form-urlencoded' }
      const res = await fetch(url, { method: 'POST', body, headers })
      if (!res.ok) throw new Error('Login fehlgeschlagen')
      const data = await res.json()
      onAuth(data.access_token)
    } catch (e: any) {
      setError(e.message || 'Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 320, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px 0 #dbeafe33', padding: 32 }}>
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>{mode === 'register' ? 'Registrieren' : 'Login'}</h2>
      <input type="text" placeholder="Benutzername" value={username} onChange={e => setUsername(e.target.value)} required style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 16 }} />
      <input type="password" placeholder="Passwort" value={password} onChange={e => setPassword(e.target.value)} required style={{ padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 16 }} />
      <button type="submit" disabled={loading} style={{ padding: '10px 0', borderRadius: 6, background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 16, border: 'none', cursor: 'pointer' }}>{loading ? 'Bitte warten...' : (mode === 'register' ? 'Registrieren' : 'Login')}</button>
      {error && <div style={{ color: '#e74c3c', textAlign: 'center' }}>{error}</div>}
    </form>
  )
}
