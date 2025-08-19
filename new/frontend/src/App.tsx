import React, { useEffect, useState } from 'react'
import AuthForm from './AuthForm'
import MonthlyCategoryChart from './MonthlyCategoryChart'

type Transaction = {
  id?: number
  date: string
  amount: number
  description: string
  category?: string
  }

type TransactionCreate = {
  date: string
  amount: number
  description: string
  category?: string
}

export default function App() {
  // ...
  // Auth-Status
  const [token, setToken] = useState<string|null>(() => localStorage.getItem('token'))
  const [authMode, setAuthMode] = useState<'login'|'register'>('login')
  const [user, setUser] = useState<{username:string}|null>(null)

  // User-Info laden
  useEffect(() => {
    if (!token) { setUser(null); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(data => setUser(data))
      .catch(() => setUser(null))
  }, [token])

  function handleAuth(newToken: string) {
    setToken(newToken)
    localStorage.setItem('token', newToken)
    setAuthMode('login')
  }
  function handleLogout() {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
  }

  // Editier-Modal-Logik
  const [editTx, setEditTx] = useState<Transaction|null>(null)
  const [health, setHealth] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<TransactionCreate>({ date: '', amount: 0, description: '', category: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  // Summen für Dashboard-Karten (nach Deklaration von transactions)
  const totalIncome = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
  const totalExpense = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)
  const totalBalance = totalIncome + totalExpense

  async function handleDelete(t: Transaction) {
    if (!window.confirm('Wirklich löschen?')) return;
    await fetch(`/api/transactions/${t.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    setFormSuccess('Transaktion gelöscht!');
  }

  async function handleEditSave(updated: Transaction) {
    await fetch(`/api/transactions/${updated.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(updated)
    });
    setEditTx(null);
    setFormSuccess('Transaktion aktualisiert!');
  }

  const [chartData, setChartData] = useState<any[]>([])
  const [chartLoading, setChartLoading] = useState(false)
  const [chartError, setChartError] = useState<string | null>(null)

  // Health-Check
  useEffect(() => {
    fetch('/api/health')
      .then(res => {
        if (!res.ok) throw new Error('Fehler beim Backend-Request')
        return res.json()
      })
      .then(data => setHealth(data.status))
      .catch(e => setError(e.message))
  }, [])


  // Filter-States
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // Kategorien für Dropdown (aus Transaktionen extrahieren, sortiert, keine leeren Strings)
  // Kategorien für Dropdown (aus Transaktionen extrahieren, sortiert, keine leeren Strings)
  const categories = Array.from(
    new Set(
      transactions
        .map(t => (typeof t.category === 'string' ? t.category.trim() : ''))
        .filter(cat => !!cat)
    )
  ).sort((a, b) => a.localeCompare(b, 'de'))

  // --- Dark Mode Grundstruktur ---
  const themes = {
    light: {
      background: 'linear-gradient(120deg, #f8fafc 0%, #e0e7ef 100%)',
      card: '#fff',
      text: '#22223b',
      textSoft: '#888',
      border: '#cbd5e1',
      inputBg: '#f8fafc',
      shadow: '0 2px 16px 0 #dbeafe55',
      tableBg: '#f8fafc',
      tableAlt: '#f6f8fa',
      tableHeader: '#f1f5f9',
      modalBg: '#fff',
      overlay: 'rgba(0,0,0,0.18)'
    },
    dark: {
      background: 'linear-gradient(120deg, #232946 0%, #16161a 100%)',
      card: '#232946',
      text: '#f4f4f5',
      textSoft: '#a1a1aa',
      border: '#444',
      inputBg: '#16161a',
      shadow: '0 2px 16px 0 #23294699',
      tableBg: '#232946',
      tableAlt: '#16161a',
      tableHeader: '#232946',
      modalBg: '#16161a',
      overlay: 'rgba(0,0,0,0.45)'
    }
  }
  const [theme, setTheme] = useState<'light'|'dark'>(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setTheme(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  const t = themes[theme]

  // Mobile-Optimierung: Media Query für dynamische Styles
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 700)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Dynamische Styles für Mobile + Theme
  const mobileInputStyle = isMobile ? { ...inputStyle, fontSize: 17, padding: '11px 12px', width: '100%', background: t.inputBg, color: t.text, border: `1px solid ${t.border}` } : { ...inputStyle, background: t.inputBg, color: t.text, border: `1px solid ${t.border}` }
  const mobileButtonStyle = isMobile ? { ...buttonStyle, fontSize: 17, padding: '13px 0', width: '100%' } : buttonStyle
  const mobileFormStyle: React.CSSProperties = isMobile
    ? { display: 'flex', flexDirection: 'column' as const, gap: 12, width: '100%' }
    : { display: 'flex', gap: 12, flexWrap: 'wrap' as const, alignItems: 'center', marginBottom: 8 }

  const mobileTableStyle: React.CSSProperties = isMobile
    ? { borderCollapse: 'collapse' as const, width: '100%', minWidth: 0, background: t.tableBg, borderRadius: 8, boxShadow: t.shadow, fontSize: 15, color: t.text }
    : { borderCollapse: 'collapse' as const, width: '100%', minWidth: 400, background: t.tableBg, borderRadius: 8, boxShadow: t.shadow, color: t.text }
  const mobileSummaryCardStyle = isMobile ? { padding: '16px 8px', minWidth: 120 } : { padding: '22px 32px', minWidth: 170 }
  // Hamburger-Menü-Vorbereitung (Platzhalter)
  // ...hier kann später ein echtes Menü eingebaut werden...

  // Transaktionen laden (mit Filter)
  useEffect(() => {
    if (!token) return;
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.append('q', search)
    if (filterCategory) params.append('category', filterCategory)
    if (minAmount) params.append('min_amount', minAmount)
    if (maxAmount) params.append('max_amount', maxAmount)
    if (fromDate) params.append('from_date', fromDate)
    if (toDate) params.append('to_date', toDate)
    fetch('/api/transactions?' + params.toString(), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Fehler beim Laden der Transaktionen')
        return res.json()
      })
      .then(data => setTransactions(data))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false))
  }, [formSuccess, search, filterCategory, minAmount, maxAmount, fromDate, toDate, token])

  // Chart-Daten laden
  useEffect(() => {
    if (!token) return;
    setChartLoading(true)
    fetch('/api/stats/monthly-category', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Fehler beim Laden der Diagrammdaten')
        return res.json()
      })
      .then(data => setChartData(data))
      .catch(e => setChartError(e.message))
      .finally(() => setChartLoading(false))
  }, [formSuccess, token])

  // Formular-Handler
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormSuccess(null)
    if (!form.date || !form.amount || !form.description) {
      setFormError('Bitte alle Pflichtfelder ausfüllen!')
      return
    }
    fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form)
    })
      .then(res => {
        if (!res.ok) throw new Error('Fehler beim Speichern')
        return res.json()
      })
      .then(() => {
        setFormSuccess('Transaktion gespeichert!')
        setForm({ date: '', amount: 0, description: '', category: '' })
      })
      .catch(e => setFormError(e.message))
  }

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', background: t.background, fontFamily: 'Inter, Arial, sans-serif', padding: 0, margin: 0, transition: 'background 0.3s' }}>
        <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 100, display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={theme === 'light' ? 'Dark Mode aktivieren' : 'Light Mode aktivieren'}
            style={{
              background: t.card,
              color: t.text,
              border: `1.5px solid ${t.border}`,
              borderRadius: 24,
              padding: '7px 16px',
              fontSize: 18,
              fontWeight: 600,
              boxShadow: t.shadow,
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s',
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            {theme === 'light' ? (
              <img
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ctext y='50%25' x='0' font-size='32'%3E%F0%9F%8C%99%3C/text%3E%3C/svg%3E"
                alt="Dark Mode"
                style={{ width: '1em', height: '1em', verticalAlign: 'middle' }}
              />
            ) : (
              <img
                src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ctext y='50%25' x='0' font-size='32'%3E%E2%98%80%EF%B8%8F%3C/text%3E%3C/svg%3E"
                alt="Light Mode"
                style={{ width: '1em', height: '1em', verticalAlign: 'middle' }}
              />
            )}
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
        <div style={{ maxWidth: 400, margin: '0 auto', paddingTop: 80 }}>
          <AuthForm onAuth={handleAuth} mode={authMode} />
          <div style={{ textAlign: 'center', marginTop: 18 }}>
            {authMode === 'login' ? (
              <>
                Noch kein Account?{' '}
                <button onClick={() => setAuthMode('register')} style={{ background: 'none', border: 'none', color: '#6366f1', textDecoration: 'underline', cursor: 'pointer', fontSize: 15 }}>Registrieren</button>
              </>
            ) : (
              <>
                Bereits registriert?{' '}
                <button onClick={() => setAuthMode('login')} style={{ background: 'none', border: 'none', color: '#6366f1', textDecoration: 'underline', cursor: 'pointer', fontSize: 15 }}>Login</button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: t.background,
      fontFamily: 'Inter, Arial, sans-serif',
      padding: 0,
      margin: 0,
      transition: 'background 0.3s',
    }}>
      {/* Dark Mode Umschalt-Button + Logout */}
      <div style={{ position: 'fixed', top: 18, right: 18, zIndex: 100, display: 'flex', alignItems: 'center', gap: 10 }}>
        {user && (
          <span style={{ color: t.text, fontWeight: 500, fontSize: 15, marginRight: 8 }}>👤 {user.username}</span>
        )}
        <button
          onClick={handleLogout}
          style={{ background: '#e5e7eb', color: '#222', border: 'none', borderRadius: 18, padding: '7px 14px', fontWeight: 500, fontSize: 15, cursor: 'pointer', marginRight: 6 }}
        >Logout</button>
        <button
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          title={theme === 'light' ? 'Dark Mode aktivieren' : 'Light Mode aktivieren'}
          style={{
            background: t.card,
            color: t.text,
            border: `1.5px solid ${t.border}`,
            borderRadius: 24,
            padding: '7px 16px',
            fontSize: 18,
            fontWeight: 600,
            boxShadow: t.shadow,
            cursor: 'pointer',
            transition: 'background 0.2s, color 0.2s',
            display: 'flex', alignItems: 'center', gap: 8
          }}
        >
          {theme === 'light' ? (
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ctext y='50%25' x='0' font-size='32'%3E%F0%9F%8C%99%3C/text%3E%3C/svg%3E"
              alt="Dark Mode"
              style={{ width: '1em', height: '1em', verticalAlign: 'middle' }}
            />
          ) : (
            <img
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Ctext y='50%25' x='0' font-size='32'%3E%E2%98%80%EF%B8%8F%3C/text%3E%3C/svg%3E"
              alt="Light Mode"
              style={{ width: '1em', height: '1em', verticalAlign: 'middle' }}
            />
          )}
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>
      <div style={{
        maxWidth: '100%',
        width: '100%',
        margin: '0 auto',
        padding: '3vw 1vw',
        boxSizing: 'border-box',
      }}>
        <h1 style={{
          fontSize: 38,
          fontWeight: 800,
          letterSpacing: '-1px',
          color: t.text,
          marginBottom: 8,
          textAlign: 'center',
          transition: 'color 0.2s',
        }}>Personal Finance Dashboard</h1>
        <div style={{marginBottom:28, fontSize:16, textAlign:'center'}}>
          <b>Backend-Status:</b>{' '}
          {(() => {
            if (health) return <span style={{color:'#2ecc40'}}>Verbunden ({health})</span>;
            if (error) return <span style={{color:'#e74c3c'}}>Keine Verbindung: {error}</span>;
            return <span>Prüfe Verbindung...</span>;
          })()}
        </div>

        {/* Summenkarten */}
        <div style={{
          display:'flex',
          gap:'min(3vw, 32px)',
          justifyContent:'center',
          marginBottom:'3vw',
          flexWrap:'wrap',
          width:'100%'
        }}>
          <SummaryCard label="Einnahmen" value={totalIncome} color="#22c55e" icon="▲" />
          <SummaryCard label="Ausgaben" value={totalExpense} color="#e74c3c" icon="▼" />
          <SummaryCard label="Saldo" value={totalBalance} color="#6366f1" icon="Σ" />
        </div>

        <div style={{
          display:'flex',
          gap:'min(3vw, 32px)',
          flexWrap:'wrap',
          alignItems:'flex-start',
          width:'100%',
          boxSizing:'border-box'
        }}>
          {/* Linke Spalte: Neue Transaktion + Filter + Tabelle */}
          <div style={{flex:'2 1 400px', minWidth:260, maxWidth:'100%', width:'100%'}}>
            <div style={{
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 2px 16px 0 #dbeafe55',
              padding: '2vw',
              marginBottom: 28,
              width: '100%',
              maxWidth: 700,
              minWidth: 0,
              boxSizing: 'border-box',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}>
              <h2 style={{fontSize:22, marginBottom:16, color:'#22223b'}}>Neue Transaktion</h2>
              <form onSubmit={handleSubmit} style={mobileFormStyle}>
                <input type="date" name="date" value={form.date} onChange={handleChange} required style={mobileInputStyle} />
                <input type="number" name="amount" value={form.amount} onChange={handleChange} placeholder="Betrag" required step="0.01" style={mobileInputStyle} />
                <input type="text" name="description" value={form.description} onChange={handleChange} placeholder="Beschreibung" required style={mobileInputStyle} />
                <input type="text" name="category" value={form.category} onChange={handleChange} placeholder="Kategorie (optional)" style={mobileInputStyle} />
                <button type="submit" style={mobileButtonStyle}>Hinzufügen</button>
              </form>
              {formError && <div style={{color:'#e74c3c', marginTop:4}}>{formError}</div>}
              {formSuccess && <div style={{color:'#2ecc40', marginTop:4}}>{formSuccess}</div>}
            </div>

            <div style={{
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 2px 16px 0 #dbeafe55',
              padding: '2vw',
              marginBottom: 28,
              width: '100%',
              maxWidth: 700,
              minWidth: 0,
              boxSizing: 'border-box',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}>
              {/* Filter- und Suchleiste */}
              <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18, alignItems: 'stretch', width: '100%' } : { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Suche Beschreibung..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={mobileInputStyle}
                />
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  style={mobileInputStyle}
                >
                  <option value="">Alle Kategorien</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Min. Betrag"
                  value={minAmount}
                  onChange={e => setMinAmount(e.target.value)}
                  style={mobileInputStyle}
                />
                <input
                  type="number"
                  placeholder="Max. Betrag"
                  value={maxAmount}
                  onChange={e => setMaxAmount(e.target.value)}
                  style={mobileInputStyle}
                />
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  style={mobileInputStyle}
                  title="Von Datum"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  style={mobileInputStyle}
                  title="Bis Datum"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearch(''); setFilterCategory(''); setMinAmount(''); setMaxAmount(''); setFromDate(''); setToDate('');
                  }}
                  style={isMobile ? { ...mobileButtonStyle, background: '#e5e7eb', color: '#222', boxShadow: 'none', fontWeight: 400 } : { ...buttonStyle, background: '#e5e7eb', color: '#222', boxShadow: 'none', fontWeight: 400, padding: '7px 14px' }}>
                  Zurücksetzen
                </button>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                <h2 style={{fontSize:22, color:'#22223b', margin:0}}>Transaktionen</h2>
                <div style={{display:'flex', gap:8}}>
                  <button
                    onClick={async () => {
                      // Export mit Auth-Token
                      const res = await fetch('/api/transactions/export', { headers: { Authorization: `Bearer ${token}` } });
                      if (!res.ok) { alert('Fehler beim Export'); return; }
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'transactions.csv';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(url);
                    }}
                    style={{
                      padding: '6px 16px',
                      background: 'linear-gradient(90deg, #60a5fa 0%, #6366f1 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      fontWeight: 500,
                      fontSize: 15,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px 0 #6366f122',
                    }}
                  >CSV-Export</button>
                </div>
              </div>
              {/* CSV-Import-Formular */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const file = formData.get('csvfile');
                  if (!file || !(file instanceof File)) {
                    alert('Bitte eine CSV-Datei auswählen.');
                    return;
                  }
                  const res = await fetch('/api/transactions/import', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}` },
                    body: formData,
                  });
                  if (res.ok) {
                    const data = await res.json();
                    alert(`Import erfolgreich: ${data.imported} Transaktionen importiert.`);
                    // Nach Import neu laden
                    window.location.reload();
                  } else {
                    const err = await res.json();
                    alert('Fehler beim Import: ' + (err.detail || 'Unbekannter Fehler'));
                  }
                }}
                style={{marginBottom:16, display:'flex', alignItems:'center', gap:8}}
              >
                <input type="file" name="csvfile" accept=".csv" style={{fontSize:15}} />
                <button type="submit" style={{padding:'6px 16px', background:'#22c55e', color:'#fff', border:'none', borderRadius:6, fontWeight:500, fontSize:15, cursor:'pointer'}}>CSV-Import</button>
              </form>
              {loading ? <div>Lade...</div> : (
                <div style={{ overflowX: isMobile ? 'visible' : 'auto', width: '100%' }}>
                  <table style={mobileTableStyle}>
                    <thead style={isMobile ? {} : { position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr style={{ background: '#f1f5f9' }}>
                        <th style={thStyle}>Datum</th>
                        <th style={thStyle}>Betrag</th>
                        <th style={thStyle}>Beschreibung</th>
                        <th style={thStyle}>Kategorie</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: 12 }}>Keine Transaktionen vorhanden</td></tr>
                      )}
                      {transactions.map((t, i) => (
                        <tr key={t.id || i} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', cursor: 'pointer', background: i % 2 === 0 ? '#fff' : '#f6f8fa' }}>
                          <td style={tdStyle}>{t.date}</td>
                          <td style={{ ...tdStyle, color: t.amount < 0 ? '#e74c3c' : '#22c55e', fontWeight: 600 }}>{t.amount}</td>
                          <td style={tdStyle}>{t.description}</td>
                          <td style={tdStyle}>{t.category || '-'}</td>
                          <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                            <button onClick={() => setEditTx(t)} title="Bearbeiten" style={isMobile ? { ...mobileButtonStyle, background: '#f1c40f', color: '#222', fontSize: 15, marginRight: 6, padding: '7px 0', minWidth: 0 } : { ...buttonStyle, padding: '4px 10px', fontSize: 13, marginRight: 6, background: '#f1c40f', color: '#222' }}>✎</button>
                            <button onClick={() => handleDelete(t)} title="Löschen" style={isMobile ? { ...mobileButtonStyle, background: '#e74c3c', color: '#fff', fontSize: 15, padding: '7px 0', minWidth: 0 } : { ...buttonStyle, padding: '4px 10px', fontSize: 13, background: '#e74c3c', color: '#fff' }}>🗑</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {/* Editier-Modal */}
            {editTx && (
              <EditModal
                transaction={editTx}
                categories={categories}
                onClose={()=>setEditTx(null)}
                onSave={handleEditSave}
              />
            )}
          </div>
          {/* Rechte Spalte: Diagramm */}
          <div style={{flex:'1 1 340px', minWidth:220, maxWidth:'100%', width:'100%'}}>
            <div style={{background:'#fff', borderRadius:14, boxShadow:'0 2px 16px 0 #dbeafe55', padding:'2vw', marginBottom:28, width:'100%', boxSizing:'border-box'}}>
              <h2 style={{fontSize:22, marginBottom:16, color:'#22223b'}}>Monatliche Summen nach Kategorie</h2>
              {/* Chart-Rendering-Logik entkoppelt für bessere Lesbarkeit (SonarQube) */}
              <div style={{width:'100%', maxWidth:900, minWidth:220, margin:'0 auto'}}>
                {(() => {
                  if (chartLoading) return <div>Lade Diagramm...</div>;
                  if (chartError) return <div style={{color:'#e74c3c'}}>{chartError}</div>;
                  return <MonthlyCategoryChart data={chartData} />;
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
// Summenkarten-Komponente
function SummaryCard({ label, value, color, icon }: Readonly<{ label: string, value: number, color: string, icon: string }>) {
  // Mobile-Optimierung: dynamische Styles
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 700)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      boxShadow: '0 2px 12px 0 #dbeafe33',
      ...(!isMobile ? { padding: '22px 32px', minWidth: 170 } : { padding: '16px 8px', minWidth: 120 }),
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      borderTop: `4px solid ${color}`
    }}>
      <div style={{ fontSize: isMobile ? 22 : 28, color, fontWeight: 700, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: isMobile ? 13 : 15, color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: isMobile ? 17 : 22, fontWeight: 700, color }}>{value.toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</div>
    </div>
  )
}
}

const inputStyle: React.CSSProperties = {
  padding: '7px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: 15,
  outline: 'none',
  background: '#f8fafc',
  transition: 'border 0.2s',
}

const buttonStyle: React.CSSProperties = {
  padding: '8px 18px',
  background: 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
  boxShadow: '0 2px 8px 0 #6366f122',
  transition: 'background 0.2s',
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


// Editier-Modal-Komponente
type EditModalProps = Readonly<{
  transaction: Transaction
  categories: string[]
  onClose: () => void
  onSave: (t: Transaction) => void
}>

function EditModal({ transaction, categories, onClose, onSave }: EditModalProps) {
  const [form, setForm] = useState<Transaction>({...transaction})
  const [error, setError] = useState<string|null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.date || !form.amount || !form.description) {
      setError('Bitte alle Pflichtfelder ausfüllen!')
      return
    }
    onSave(form)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.18)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{background:'#fff', borderRadius:12, boxShadow:'0 2px 16px 0 #dbeafe99', padding:32, minWidth:320, maxWidth:400}}>
        <h3 style={{fontSize:20, marginBottom:18, color:'#22223b'}}>Transaktion bearbeiten</h3>
        <form onSubmit={handleSubmit} style={{display:'flex', flexDirection:'column', gap:12}}>
          <input type="date" name="date" value={form.date} onChange={handleChange} required style={inputStyle} />
          <input type="number" name="amount" value={form.amount} onChange={handleChange} placeholder="Betrag" required step="0.01" style={inputStyle} />
          <input type="text" name="description" value={form.description} onChange={handleChange} placeholder="Beschreibung" required style={inputStyle} />
          <select name="category" value={form.category || ''} onChange={handleChange} style={inputStyle}>
            <option value="">Kategorie wählen</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div style={{display:'flex', gap:10, marginTop:8}}>
            <button type="submit" style={{...buttonStyle, flex:1}}>Speichern</button>
            <button type="button" onClick={onClose} style={{...buttonStyle, background:'#e5e7eb', color:'#222', boxShadow:'none', fontWeight:400}}>Abbrechen</button>
          </div>
          {error && <div style={{color:'#e74c3c', marginTop:4}}>{error}</div>}
        </form>
      </div>
    </div>
  )
}
