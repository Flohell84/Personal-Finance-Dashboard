import React, { useEffect, useMemo, useState } from 'react'

type AdminUser = {
  id: number
  username: string
  is_active: boolean
  is_admin: boolean
}

export default function AdminPanel({ token, themeColors, currentUsername }: Readonly<{ token: string, themeColors: any, currentUsername: string }>) {
  const t = themeColors
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [success, setSuccess] = useState<string|null>(null)
  const [createForm, setCreateForm] = useState({ username: '', password: '', is_admin: false, is_active: true })
  const [pwMap, setPwMap] = useState<Record<number, string>>({})

  async function reload() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Fehler beim Laden der Nutzer')
      const data = await res.json()
      setUsers(data)
    } catch (e: any) {
      setError(e?.message || 'Unbekannter Fehler')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [token])

  async function createUser(e: React.FormEvent) {
    e.preventDefault()
    setError(null); setSuccess(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(createForm)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || 'Fehler beim Anlegen')
      }
      setSuccess('Nutzer angelegt')
      setCreateForm({ username: '', password: '', is_admin: false, is_active: true })
      reload()
    } catch (e: any) {
      setError(e?.message || 'Unbekannter Fehler')
    }
  }

  async function updateUser(u: AdminUser, patch: Partial<Pick<AdminUser, 'is_active'|'is_admin'>>) {
    setError(null); setSuccess(null)
    try {
      const res = await fetch(`/api/admin/users/${u.id}` , {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || 'Fehler beim Aktualisieren')
      }
      setSuccess('Nutzer aktualisiert')
      reload()
    } catch (e: any) {
      setError(e?.message || 'Unbekannter Fehler')
    }
  }

  async function setPassword(u: AdminUser) {
    const newPw = (pwMap[u.id] || '').trim()
    if (!newPw) { setError('Bitte ein Passwort eingeben'); return }
    setError(null); setSuccess(null)
    try {
      const res = await fetch(`/api/admin/users/${u.id}` , {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: newPw })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || 'Fehler beim Setzen des Passworts')
      }
      setSuccess('Passwort aktualisiert')
      setPwMap(prev => ({ ...prev, [u.id]: '' }))
      reload()
    } catch (e: any) {
      setError(e?.message || 'Unbekannter Fehler')
    }
  }

  async function deleteUser(u: AdminUser) {
    if (!window.confirm(`Nutzer ${u.username} wirklich löschen?`)) return
    setError(null); setSuccess(null)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || 'Fehler beim Löschen')
      }
      setSuccess('Nutzer gelöscht')
      reload()
    } catch (e: any) {
      setError(e?.message || 'Unbekannter Fehler')
    }
  }

  const cardStyle: React.CSSProperties = useMemo(() => ({
    background: t.card || '#fff',
    borderRadius: 14,
    boxShadow: t.shadow || '0 2px 16px 0 #dbeafe55',
    padding: '2vw',
    marginBottom: 28,
  }), [t])

  const tableStyle: React.CSSProperties = useMemo(() => ({
    width: '100%', borderCollapse: 'collapse' as const, color: t.text || '#222'
  }), [t])

  return (
    <div style={cardStyle}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 22, margin: 0, color: t.text || '#222' }}>Admin: Kundenverwaltung</h2>
      </div>
      <form onSubmit={createUser} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input placeholder="Username" value={createForm.username} onChange={e=>setCreateForm({ ...createForm, username: e.target.value })} style={inputStyle} required />
        <input placeholder="Passwort" value={createForm.password} onChange={e=>setCreateForm({ ...createForm, password: e.target.value })} style={inputStyle} required />
        <label style={{ display:'flex', alignItems:'center', gap:6, color: t.text }}>
          <input type="checkbox" checked={createForm.is_admin} onChange={e=>setCreateForm({ ...createForm, is_admin: e.target.checked })} /> Admin
        </label>
        <label style={{ display:'flex', alignItems:'center', gap:6, color: t.text }}>
          <input type="checkbox" checked={createForm.is_active} onChange={e=>setCreateForm({ ...createForm, is_active: e.target.checked })} /> Aktiv
        </label>
        <button type="submit" style={buttonStyle}>Anlegen</button>
      </form>
      {error && <div style={{ color: '#e74c3c', marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: '#22c55e', marginBottom: 8 }}>{success}</div>}
      {loading ? <div>Lade Nutzer...</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Aktiv</th>
                <th style={thStyle}>Admin</th>
                <th style={thStyle}>Passwort ändern</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
                  <td style={tdStyle}>{u.id}</td>
                  <td style={tdStyle}>{u.username}</td>
                  <td style={tdStyle}>
                    <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                      <input type="checkbox" checked={u.is_active} onChange={e=>updateUser(u, { is_active: e.target.checked })} /> Aktiv
                    </label>
                  </td>
                  <td style={tdStyle}>
                    <label style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                      <input type="checkbox" checked={u.is_admin} onChange={e=>updateUser(u, { is_admin: e.target.checked })} /> Admin
                    </label>
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <input
                      type="password"
                      placeholder="Neues Passwort"
                      value={pwMap[u.id] || ''}
                      onChange={e=>setPwMap(prev => ({ ...prev, [u.id]: e.target.value }))}
                      style={{ ...inputStyle, marginRight: 6 }}
                    />
                    <button onClick={()=>setPassword(u)} style={buttonStyle}>Setzen</button>
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                    <button
                      onClick={()=> u.username !== currentUsername && deleteUser(u)}
                      disabled={u.username === currentUsername}
                      style={{
                        ...buttonStyle,
                        background: u.username === currentUsername ? '#94a3b8' : '#e74c3c',
                        cursor: u.username === currentUsername ? 'not-allowed' : 'pointer',
                        opacity: u.username === currentUsername ? 0.7 : 1
                      }}
                    >Löschen</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 15,
  outline: 'none',
  background: '#f8fafc',
}

const buttonStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  boxShadow: '0 2px 8px 0 #6366f122',
}

const thStyle: React.CSSProperties = {
  border: 'none',
  padding: '10px 8px',
  fontWeight: 600,
  color: '#22223b',
  fontSize: 15,
  background: 'inherit',
  textAlign: 'left',
}

const tdStyle: React.CSSProperties = {
  border: 'none',
  padding: '8px 8px',
  fontSize: 15,
  color: '#22223b',
  background: 'inherit',
}
