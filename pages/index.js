import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

// --- constants ---
const EXPENSE_CATEGORIES = ['Comida', 'Transporte', 'Salud', 'Entretenimiento', 'Educación', 'Hogar', 'Otros'];
const INCOME_CATEGORIES = ['Sueldo', 'Dinero Extra', 'Ventas', 'Inversiones', 'Regalos', 'Intereses', 'Otros'];
const CATEGORY_ICONS = {
  Comida: '🍔', Transporte: '🚌', Sueldo: '💼', Salud: '💊', Entretenimiento: '🎮',
  Educación: '📚', Hogar: '🏠', Otros: '✨', 'Dinero Extra': '💸', Ventas: '🛍️',
  Inversiones: '📈', Regalos: '🎁', Intereses: '🏦'
};

// --- helper ---
const formatCurrency = (v) => {
  const n = Number(v || 0);
  return n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Home() {
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const COLORS = ['#0b66ff', '#0ec27b', '#ffc107', '#ff5b6e', '#6f42c1', '#17a2b8'];

  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState({
    type: 'expense',
    category: 'Comida',
    amount: '',
    date: new Date().toISOString().slice(0,10),
    description: '',
    color: '#0b66ff'
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);

  // --- fetch ---
  const fetchData = async () => {
    try {
      const res = await api.get('/transactions');
      setTransactions(res.data || []);
    } catch (err) {
      console.error(err);
      alert('Error al conectar al backend');
    }
  };
  useEffect(() => { fetchData(); }, []);

  // --- helpers ---
  const monthStr = String(filterMonth).padStart(2,'0');
  const transactionsThisMonth = useMemo(() => transactions.filter(t => t.date && t.date.startsWith(`${filterYear}-${monthStr}`)), [transactions, filterYear, filterMonth]);

  const totalIncome = transactionsThisMonth.filter(t => t.type === 'income').reduce((a,t)=> a + parseFloat(t.amount || 0), 0);
  const totalExpense = transactionsThisMonth.filter(t => t.type === 'expense').reduce((a,t)=> a + parseFloat(t.amount || 0), 0);
  const balance = totalIncome - totalExpense;

  const categoryExpenses = Object.entries(
    transactionsThisMonth
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount || 0); return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const yearlyData = useMemo(() => {
    return months.map((m, i) => {
      const mm = String(i + 1).padStart(2,'0');
      const monthTx = transactions.filter(t => t.date && t.date.startsWith(`${filterYear}-${mm}`));
      const inc = monthTx.filter(t => t.type === 'income').reduce((a,t)=> a + parseFloat(t.amount || 0), 0);
      const exp = monthTx.filter(t => t.type === 'expense').reduce((a,t)=> a + parseFloat(t.amount || 0), 0);
      return { mes: m.slice(0,3), ingresos: inc, gastos: exp };
    });
  }, [transactions, filterYear]);

  const monthFileName = () => `${months[filterMonth-1].slice(0,3)}_${filterYear}`;

  // --- export Excel (adds title row and readable filename) ---
  const exportExcel = () => {
    const data = transactionsThisMonth.map(t => ({
      Fecha: t.date,
      Tipo: t.type === 'income' ? 'Ingreso' : 'Gasto',
      Categoria: t.category,
      Monto: Number(t.amount).toFixed(2),
      Descripcion: t.description
    }));
    const ws = XLSX.utils.json_to_sheet(data, { origin: 'A2' }); // write starting at A2
    // title in A1
    XLSX.utils.sheet_add_aoa(ws, [[`MiGasto - ${months[filterMonth-1]} ${filterYear}`]], { origin: 'A1' });
    ws['!cols'] = [{wpx:110},{wpx:90},{wpx:130},{wpx:90},{wpx:220}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transacciones');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `MiGasto_${monthFileName()}.xlsx`);
  };

  // --- export PDF (readable filename + header) ---
  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule;
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const title = `MiGasto - ${months[filterMonth-1]} ${filterYear}`;
      doc.setFontSize(16);
      doc.text(title, 40, 50);
      const rows = transactionsThisMonth.map(t => [
        t.date,
        t.type === 'income' ? 'Ingreso' : 'Gasto',
        t.category,
        Number(t.amount).toFixed(2),
        t.description || ''
      ]);
      autoTable(doc, { head: [['Fecha','Tipo','Categoría','Monto','Descripción']], body: rows, startY: 80, styles: { fontSize: 9 } });
      doc.save(`MiGasto_${monthFileName()}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error al generar PDF: ' + err.message);
    }
  };

  // --- submit / delete ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        type: form.type,
        category: form.category,
        amount: Number(parseFloat(form.amount || 0).toFixed(2)),
        date: form.date,
        description: form.description.trim()
      };
      await api.post('/transactions', payload);
      await fetchData();
      setForm({ ...form, amount: '', description: '' });
      setActiveTab('dashboard');
    } catch (err) {
      console.error(err);
      alert('Error al guardar');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar transacción?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar');
    }
  };

  // categories visible depending on type
  const visibleCategories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // --- Render ---
  return (
    <div style={styles.page}>
      {/* Global micro-animations and focus styles */}
      <style>{`
        :root { --accent: #0b66ff; --accent-2: #0ec27b; --muted: #6b7280; --card-shadow: 0 10px 30px rgba(16,24,40,0.06); }
        .mg-btn { transition: transform 160ms cubic-bezier(.2,.8,.2,1), box-shadow 200ms, opacity 120ms; }
        .mg-btn:active { transform: translateY(1px) scale(0.995); }
        .mg-fade { transition: opacity 220ms ease, transform 220ms ease; }
        .focus-outline:focus { outline: 3px solid rgba(11,102,255,0.12); outline-offset: 2px; }
        table tbody tr:hover { background: rgba(11,102,255,0.03); }
      `}</style>

      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.brand}>
            <div style={styles.logoBox}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="2" y="2" width="20" height="20" rx="6" fill="#0b66ff" />
                <path d="M7 12h10" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"></path>
              </svg>
            </div>
            <div style={{ marginLeft: 12 }}>
              <h1 style={styles.title}>MiGasto</h1>
              <p style={styles.subtitle}>Panel financiero · corporativo</p>
            </div>
          </div>

          <div style={styles.headerActions}>
            <div style={styles.headerControls}>
              <select aria-label="Año" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} style={styles.smallSelect} className="focus-outline">
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select aria-label="Mes" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} style={styles.smallSelect} className="focus-outline">
                {months.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={exportExcel} title="Exportar a Excel" aria-label="Exportar a Excel" className="mg-btn focus-outline" style={styles.ghostBtn}>
                <span style={{ marginRight: 8 }}>📊</span> Exportar
              </button>

              <button onClick={exportPDF} title="Exportar a PDF" aria-label="Exportar a PDF" className="mg-btn focus-outline" style={styles.ghostBtn}>
                <span style={{ marginRight: 8 }}>📄</span> PDF
              </button>

              <button onClick={() => { setActiveTab('add'); setForm({ ...form, type: 'expense', category: 'Comida' }); }} className="mg-btn focus-outline" style={styles.primaryBtn}>
                <span style={{ marginRight: 8 }}>➕</span> Nueva
              </button>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <nav style={styles.tabs} aria-label="Navegación principal">
          {['dashboard','add','history','compare'].map(tab => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="mg-btn focus-outline"
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : {}),
                }}
                aria-pressed={isActive}
              >
                {tab === 'dashboard' ? 'Resumen' : tab === 'add' ? 'Agregar' : tab === 'history' ? 'Historial' : 'Comparativa'}
              </button>
            );
          })}
        </nav>

        <main style={styles.main}>
          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <>
              <section style={styles.grid3}>
                <div style={{ ...styles.card, borderLeft: `4px solid ${totalIncome >= 0 ? '#0ec27b' : '#ff5b6e'}` }}>
                  <small style={styles.cardLabel}>Total Ingresos</small>
                  <div style={styles.cardValue}>${formatCurrency(totalIncome)}</div>
                  <div style={styles.cardNote}>{transactionsThisMonth.filter(t=>t.type==='income').length} transacciones</div>
                </div>

                <div style={{ ...styles.card, borderLeft: `4px solid ${totalExpense >= 0 ? '#ff5b6e' : '#ff5b6e'}` }}>
                  <small style={styles.cardLabel}>Total Gastos</small>
                  <div style={styles.cardValue}>${formatCurrency(totalExpense)}</div>
                  <div style={styles.cardNote}>{transactionsThisMonth.filter(t=>t.type==='expense').length} transacciones</div>
                </div>

                <div style={{ ...styles.card, borderLeft: '4px solid #0b66ff' }}>
                  <small style={styles.cardLabel}>Balance</small>
                  <div style={{ ...styles.cardValue, color: balance >= 0 ? '#0ec27b' : '#ff5b6e' }}>${formatCurrency(balance)}</div>
                  <div style={styles.cardNote}>Resumen mensual</div>
                </div>
              </section>

              <section style={styles.chartsRow}>
                <div style={styles.chartCard}>
                  <h4 style={styles.chartTitle}>Ingresos vs Gastos</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={[{ name: 'Ingresos', value: totalIncome }, { name: 'Gastos', value: totalExpense }]} dataKey="value" outerRadius={90} label>
                        <Cell fill="#0ec27b" />
                        <Cell fill="#ff5b6e" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div style={styles.chartCard}>
                  <h4 style={styles.chartTitle}>Gastos por Categoría</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={categoryExpenses} dataKey="value" outerRadius={90} label>
                        {categoryExpenses.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => `$${Number(v).toFixed(2)}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </>
          )}

          {/* Add */}
          {activeTab === 'add' && (
            <section style={styles.formCard} className="mg-fade">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Agregar Transacción</h3>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Vista previa: <strong style={{ color: form.type === 'income' ? '#0ec27b' : '#ff5b6e' }}>${formatCurrency((balance || 0) + (form.type === 'income' ? parseFloat(form.amount || 0) : -parseFloat(form.amount || 0)))}</strong></div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {['expense','income'].map(t => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, type: t, category: t === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0] })} className="mg-btn focus-outline" style={{ ...styles.segmentBtn, background: form.type === t ? (t==='income' ? '#0ec27b' : '#ff5b6e') : '#fff', color: form.type === t ? '#fff' : '#0f1724' }}>
                    {t === 'income' ? '💰 Ingreso' : '💸 Gasto'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {visibleCategories.map(cat => (
                    <button key={cat} type="button" onClick={() => setForm({ ...form, category: cat })} className="mg-btn focus-outline" style={{ ...styles.categoryBtn, background: form.category === cat ? '#0b66ff' : '#f6f8ff', color: form.category === cat ? '#fff' : '#0f1724' }}>
                      <span style={{ marginRight: 8 }}>{CATEGORY_ICONS[cat] || '🔖'}</span>{cat}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input placeholder="Otra categoría" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={styles.input} className="focus-outline" />
                  <input type="color" value={form.color || '#0b66ff'} onChange={e => setForm({ ...form, color: e.target.value })} style={styles.colorInput} title="Color de categoría" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 8 }}>
                  <input placeholder="Monto" type="number" inputMode="decimal" value={form.amount} onChange={e => { const v = e.target.value; if (/^\d*\.?\d{0,2}$/.test(v)) setForm({ ...form, amount: v }); }} required style={styles.input} className="focus-outline" />
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} style={styles.input} className="focus-outline" />
                </div>

                <textarea placeholder="Descripción (opcional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={styles.textarea} className="focus-outline" />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: 'var(--muted)' }}>Añadida en: <strong>{months[new Date(form.date).getMonth()]} {new Date(form.date).getFullYear()}</strong></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setForm({ ...form, amount: '', description: '' })} className="mg-btn" style={styles.ghostSmall}>Reset</button>
                    <button type="submit" className="mg-btn" style={styles.primaryBtn}>Guardar</button>
                  </div>
                </div>
              </form>
            </section>
          )}

          {/* History */}
          {activeTab === 'history' && (
            <section style={styles.history}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Historial</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={exportExcel} className="mg-btn" style={styles.ghostSmall}>📊 Exportar</button>
                  <button onClick={exportPDF} className="mg-btn" style={styles.ghostSmall}>📄 PDF</button>
                </div>
              </div>

              <div style={styles.tables}>
                <div style={styles.tableCard}>
                  <h4 style={{ color: '#ff5b6e', textAlign: 'center' }}>💸 Gastos</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead><tr><th>Fecha</th><th>Categoría</th><th>Monto</th><th>Descripción</th><th>Acción</th></tr></thead>
                      <tbody>
                        {transactionsThisMonth.filter(t=>t.type==='expense').sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t=>(
                          <tr key={t.id}>
                            <td style={styles.td}>{t.date}</td>
                            <td style={styles.td}>{t.category}</td>
                            <td style={{ ...styles.td, color: '#ff5b6e' }}>${formatCurrency(t.amount)}</td>
                            <td style={styles.td}>{t.description}</td>
                            <td style={styles.td}><button onClick={()=>handleDelete(t.id)} style={styles.deleteBtn} className="mg-btn">Eliminar</button></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr><td colSpan={2} style={{ textAlign:'right' }}><strong>Total Gastos:</strong></td><td colSpan={3} style={{ color:'#ff5b6e' }}><strong>${formatCurrency(totalExpense)}</strong></td></tr></tfoot>
                    </table>
                  </div>
                </div>

                <div style={styles.tableCard}>
                  <h4 style={{ color: '#0ec27b', textAlign: 'center' }}>💰 Ingresos</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={styles.table}>
                      <thead><tr><th>Fecha</th><th>Categoría</th><th>Monto</th><th>Descripción</th><th>Acción</th></tr></thead>
                      <tbody>
                        {transactionsThisMonth.filter(t=>t.type==='income').sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t=>(
                          <tr key={t.id}>
                            <td style={styles.td}>{t.date}</td>
                            <td style={styles.td}>{t.category}</td>
                            <td style={{ ...styles.td, color: '#0ec27b' }}>${formatCurrency(t.amount)}</td>
                            <td style={styles.td}>{t.description}</td>
                            <td style={styles.td}><button onClick={()=>handleDelete(t.id)} style={styles.deleteBtn} className="mg-btn">Eliminar</button></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot><tr><td colSpan={2} style={{ textAlign:'right' }}><strong>Total Ingresos:</strong></td><td colSpan={3} style={{ color:'#0ec27b' }}><strong>${formatCurrency(totalIncome)}</strong></td></tr></tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Compare */}
          {activeTab === 'compare' && (
            <section style={styles.chartCard}>
              <h3>Comparativa Anual</h3>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={yearlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="ingresos" fill="#0ec27b" />
                  <Bar dataKey="gastos" fill="#ff5b6e" />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

// --- styles (inline single-file) ---
const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
    color: '#0f1724',
    padding: 18
  },
  container: {
    maxWidth: 1200,
    margin: '0 auto'
  },

  /* Header */
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    padding: '12px 6px',
    borderRadius: 10,
    background: '#fff',
    boxShadow: '0 8px 28px rgba(11,34,78,0.04)'
  },
  brand: { display: 'flex', alignItems: 'center' },
  logoBox: {
    width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#eef4ff', borderRadius: 10, boxShadow: 'inset 0 -2px 0 rgba(11,102,255,0.06)'
  },
  title: { margin: 0, fontSize: 18, letterSpacing: -0.2 },
  subtitle: { margin: 0, fontSize: 12, color: '#6b7280' },

  headerActions: { display: 'flex', gap: 12, alignItems: 'center' },
  headerControls: { display: 'flex', gap: 8, alignItems: 'center', marginRight: 6 },
  smallSelect: { padding: '8px 10px', borderRadius: 8, border: '1px solid #e6eefc', background: '#fff', fontSize: 13 },

  /* Buttons */
  primaryBtn: {
    background: 'linear-gradient(90deg,#0b66ff,#0a5fe0)',
    color: '#fff', padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
    boxShadow: '0 10px 26px rgba(11,102,255,0.12)', fontWeight: 600, display: 'inline-flex', alignItems: 'center'
  },
  ghostBtn: {
    background: '#fff', color: '#0f1724', border: '1px solid #e6eefc', padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(11,34,78,0.02)', fontSize: 14, display: 'inline-flex', alignItems: 'center'
  },
  ghostSmall: {
    background: '#fff', color: '#0f1724', border: '1px solid #eef2ff', padding: '8px 12px', borderRadius: 8, cursor: 'pointer'
  },

  /* Tabs */
  tabs: { display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' },
  tab: { padding: '8px 14px', borderRadius: 999, border: '1px solid #eef2ff', background: '#fff', cursor: 'pointer', color: '#374151' },
  tabActive: { background: 'linear-gradient(90deg,#0b66ff,#0a5fe0)', color: '#fff', boxShadow: '0 10px 26px rgba(11,102,255,0.1)' },

  main: { marginTop: 6 },

  /* Cards */
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, marginBottom: 18 },
  card: { background: '#fff', padding: 18, borderRadius: 12, boxShadow: '0 10px 30px rgba(16,24,40,0.04)', textAlign: 'left' },
  cardLabel: { fontSize: 12, color: '#6b7280' },
  cardValue: { fontSize: 22, fontWeight: 800, marginTop: 8 },
  cardNote: { fontSize: 13, color: '#6b7280', marginTop: 8 },

  chartsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 18 },
  chartCard: { background: '#fff', padding: 18, borderRadius: 12, boxShadow: '0 10px 30px rgba(16,24,40,0.04)' },
  chartTitle: { marginTop: 0, marginBottom: 6 },

  /* Form */
  formCard: { background: '#fff', padding: 18, borderRadius: 12, boxShadow: '0 10px 30px rgba(16,24,40,0.04)', marginBottom: 18 },
  typeBtn: { padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer' },
  segmentBtn: { padding: '8px 12px', borderRadius: 10, border: '1px solid #eef2ff', cursor: 'pointer', fontWeight: 600 },
  categoryBtn: { padding: '8px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', fontSize: 13 },

  input: { padding: 12, borderRadius: 10, border: '1px solid #eef2ff', width: '100%', fontSize: 14 },
  colorInput: { width: 44, height: 40, border: 'none', cursor: 'pointer', background: '#fff' },
  textarea: { padding: 12, borderRadius: 10, border: '1px solid #eef2ff', width: '100%', minHeight: 90, resize: 'vertical', fontSize: 14 },

  /* History / tables */
  history: { background: '#fff', padding: 18, borderRadius: 12, boxShadow: '0 10px 30px rgba(16,24,40,0.04)' },
  tables: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 },
  tableCard: { background: '#fff', padding: 12, borderRadius: 12, boxShadow: '0 8px 24px rgba(16,24,40,0.04)' },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  td: { padding: '10px 12px', borderBottom: '1px solid #f1f5f9' },

  deleteBtn: { padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', background: '#fff', cursor: 'pointer', color: '#b91c1c' }
};

