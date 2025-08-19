  // ...existing code...
import React, { useEffect, useState } from 'react'
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
    await fetch(`/api/transactions/${t.id}`, { method: 'DELETE' });
    setFormSuccess('Transaktion gelöscht!');
  }

  async function handleEditSave(updated: Transaction) {
    await fetch(`/api/transactions/${updated.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
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

  // Kategorien für Dropdown (aus Transaktionen extrahieren)
  const categories = Array.from(new Set(transactions.map(t => t.category))).filter((cat): cat is string => typeof cat === 'string')

  // Transaktionen laden (mit Filter)
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.append('q', search)
    if (filterCategory) params.append('category', filterCategory)
    if (minAmount) params.append('min_amount', minAmount)
    if (maxAmount) params.append('max_amount', maxAmount)
    if (fromDate) params.append('from_date', fromDate)
    if (toDate) params.append('to_date', toDate)
    fetch('/api/transactions?' + params.toString())
      .then(res => {
        if (!res.ok) throw new Error('Fehler beim Laden der Transaktionen')
        return res.json()
      })
      .then(data => setTransactions(data))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false))
  }, [formSuccess, search, filterCategory, minAmount, maxAmount, fromDate, toDate])

  // Chart-Daten laden
  useEffect(() => {
    setChartLoading(true)
    fetch('/api/stats/monthly-category')
      .then(res => {
        if (!res.ok) throw new Error('Fehler beim Laden der Diagrammdaten')
        return res.json()
      })
      .then(data => setChartData(data))
      .catch(e => setChartError(e.message))
      .finally(() => setChartLoading(false))
  }, [formSuccess])

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
      headers: { 'Content-Type': 'application/json' },
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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(120deg, #f8fafc 0%, #e0e7ef 100%)',
      fontFamily: 'Inter, Arial, sans-serif',
      padding: 0,
      margin: 0
    }}>
      <div style={{
        maxWidth: 950,
        margin: '0 auto',
        padding: '32px 8px',
      }}>
        <h1 style={{
          fontSize: 38,
          fontWeight: 800,
          letterSpacing: '-1px',
          color: '#22223b',
          marginBottom: 8,
          textAlign: 'center',
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
        <div style={{display:'flex', gap:24, justifyContent:'center', marginBottom:32, flexWrap:'wrap'}}>
          <SummaryCard label="Einnahmen" value={totalIncome} color="#22c55e" icon="▲" />
          <SummaryCard label="Ausgaben" value={totalExpense} color="#e74c3c" icon="▼" />
          <SummaryCard label="Saldo" value={totalBalance} color="#6366f1" icon="Σ" />
        </div>

        <div style={{display:'flex', gap:32, flexWrap:'wrap', alignItems:'flex-start'}}>
          {/* Linke Spalte: Neue Transaktion + Filter + Tabelle */}
          <div style={{flex:2, minWidth:340}}>
            <div style={{
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 2px 16px 0 #dbeafe55',
              padding: 24,
              marginBottom: 28,
            }}>
              <h2 style={{fontSize:22, marginBottom:16, color:'#22223b'}}>Neue Transaktion</h2>
              <form onSubmit={handleSubmit} style={{
                display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', marginBottom:8
              }}>
                <input type="date" name="date" value={form.date} onChange={handleChange} required style={inputStyle} />
                <input type="number" name="amount" value={form.amount} onChange={handleChange} placeholder="Betrag" required step="0.01" style={{...inputStyle, width:90}} />
                <input type="text" name="description" value={form.description} onChange={handleChange} placeholder="Beschreibung" required style={{...inputStyle, width:160}} />
                <input type="text" name="category" value={form.category} onChange={handleChange} placeholder="Kategorie (optional)" style={{...inputStyle, width:120}} />
                <button type="submit" style={buttonStyle}>Hinzufügen</button>
              </form>
              {formError && <div style={{color:'#e74c3c', marginTop:4}}>{formError}</div>}
              {formSuccess && <div style={{color:'#2ecc40', marginTop:4}}>{formSuccess}</div>}
            </div>

            <div style={{
              background: '#fff',
              borderRadius: 14,
              boxShadow: '0 2px 16px 0 #dbeafe55',
              padding: 24,
              marginBottom: 28,
            }}>
              {/* Filter- und Suchleiste */}
              <div style={{display:'flex', flexWrap:'wrap', gap:12, marginBottom:18, alignItems:'center'}}>
                <input
                  type="text"
                  placeholder="Suche Beschreibung..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{...inputStyle, width:180}}
                />
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  style={{...inputStyle, width:140}}
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
                  style={{...inputStyle, width:100}}
                />
                <input
                  type="number"
                  placeholder="Max. Betrag"
                  value={maxAmount}
                  onChange={e => setMaxAmount(e.target.value)}
                  style={{...inputStyle, width:100}}
                />
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  style={{...inputStyle, width:130}}
                  title="Von Datum"
                />
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  style={{...inputStyle, width:130}}
                  title="Bis Datum"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSearch(''); setFilterCategory(''); setMinAmount(''); setMaxAmount(''); setFromDate(''); setToDate('');
                  }}
                  style={{...buttonStyle, background:'#e5e7eb', color:'#222', boxShadow:'none', fontWeight:400, padding:'7px 14px'}}>
                  Zurücksetzen
                </button>
              </div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                <h2 style={{fontSize:22, color:'#22223b', margin:0}}>Transaktionen</h2>
                <div style={{display:'flex', gap:8}}>
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = '/api/transactions/export';
                      link.download = 'transactions.csv';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
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
                <div style={{overflowX:'auto'}}>
                  <table style={{borderCollapse:'collapse', width:'100%', minWidth:500, background:'#f8fafc', borderRadius:8, boxShadow:'0 1px 6px 0 #dbeafe33'}}>
                    <thead style={{position:'sticky', top:0, zIndex:1}}>
                      <tr style={{background:'#f1f5f9'}}>
                        <th style={thStyle}>Datum</th>
                        <th style={thStyle}>Betrag</th>
                        <th style={thStyle}>Beschreibung</th>
                        <th style={thStyle}>Kategorie</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 && (
                        <tr><td colSpan={5} style={{textAlign:'center', color:'#888', padding:12}}>Keine Transaktionen vorhanden</td></tr>
                      )}
                      {transactions.map((t, i) => (
                        <tr key={t.id || i} style={{borderBottom:'1px solid #f1f5f9', transition:'background 0.2s', cursor:'pointer', background: i%2===0?'#fff':'#f6f8fa'}}>
                          <td style={tdStyle}>{t.date}</td>
                          <td style={{...tdStyle, color: t.amount < 0 ? '#e74c3c' : '#22c55e', fontWeight:600}}>{t.amount}</td>
                          <td style={tdStyle}>{t.description}</td>
                          <td style={tdStyle}>{t.category || '-'}</td>
                          <td style={{...tdStyle,whiteSpace:'nowrap'}}>
                            <button onClick={()=>setEditTx(t)} title="Bearbeiten" style={{...buttonStyle,padding:'4px 10px',fontSize:13,marginRight:6, background:'#f1c40f', color:'#222'}}>✎</button>
                            <button onClick={()=>handleDelete(t)} title="Löschen" style={{...buttonStyle,padding:'4px 10px',fontSize:13,background:'#e74c3c',color:'#fff'}}>🗑</button>
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
          <div style={{flex:1, minWidth:320}}>
            <div style={{background:'#fff', borderRadius:14, boxShadow:'0 2px 16px 0 #dbeafe55', padding:24, marginBottom:28}}>
              <h2 style={{fontSize:22, marginBottom:16, color:'#22223b'}}>Monatliche Summen nach Kategorie</h2>
              {/* Chart-Rendering-Logik entkoppelt für bessere Lesbarkeit (SonarQube) */}
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
  )
// Summenkarten-Komponente
function SummaryCard({label, value, color, icon}: Readonly<{label:string, value:number, color:string, icon:string}>) {
  return (
    <div style={{
      background:'#fff',
      borderRadius:12,
      boxShadow:'0 2px 12px 0 #dbeafe33',
      padding:'22px 32px',
      minWidth:170,
      textAlign:'center',
      display:'flex', flexDirection:'column', alignItems:'center',
      borderTop:`4px solid ${color}`
    }}>
      <div style={{fontSize:28, color, fontWeight:700, marginBottom:6}}>{icon}</div>
      <div style={{fontSize:15, color:'#888', marginBottom:2}}>{label}</div>
      <div style={{fontSize:22, fontWeight:700, color}}>{value.toLocaleString('de-DE', {minimumFractionDigits:2})} €</div>
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
