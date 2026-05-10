import React, { useState, useEffect } from 'react';

// ==================== STORAGE ====================
const fls  = (k, d) => { try { return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d; } catch { return d; } };
const flsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));

const FDB = {
  getTransactions:  () => fls('fin_transactions', []),
  saveTransactions: (v) => flsSet('fin_transactions', v),
  getSalaries:      () => fls('fin_salaries', []),
  saveSalaries:     (v) => flsSet('fin_salaries', v),
  getBudgets:       () => fls('fin_budgets', {}),
  saveBudgets:      (v) => flsSet('fin_budgets', v),
  getSession:       () => { try { return JSON.parse(sessionStorage.getItem('fin_session') || 'null'); } catch { return null; } },
  setSession:       (u) => sessionStorage.setItem('fin_session', JSON.stringify(u)),
  clearSession:     () => sessionStorage.removeItem('fin_session'),
};

const FIN_ACCOUNTS = [
  { id:'fa1', name:'عبدالرحمن الحمدان', username:'admin', password:'hamdan2025', role:'manager',  title:'مدير عام' },
  { id:'fa2', name:'النعمان أحمد',        username:'numan', password:'numan2025',  role:'accounts', title:'مدير مالي' },
];

// ==================== UTILS ====================
const uid    = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const today  = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('ar-SA', { day:'2-digit', month:'2-digit', year:'numeric' }) : '';
const fmtN   = (n)   => Number(n || 0).toLocaleString('ar-SA', { minimumFractionDigits:0, maximumFractionDigits:2 });

const CATEGORIES_IN = [
  'إيرادات مشاريع هندسية',
  'إيرادات حولك لوجيستك',
  'رسوم استشارات',
  'عمولات',
  'إيجارات',
  'أخرى - إيرادات',
];
const CATEGORIES_OUT = [
  'رواتب موظفين',
  'إيجار مكتب',
  'مشتريات ومستلزمات',
  'صيانة ومعدات',
  'وقود ومواصلات',
  'تسويق وإعلان',
  'اتصالات وإنترنت',
  'تأمينات',
  'ضرائب ورسوم حكومية',
  'أخرى - مصروفات',
];
const COMPANIES = ['الحمدان للاستشارات الهندسية', 'حولك لوجيستك', 'الحمدان جروب'];
const PAYMENT_METHODS = ['تحويل بنكي', 'نقدي', 'شيك', 'بطاقة ائتمانية'];

// ==================== UI ATOMS ====================
const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled, className = '' }) => {
  const base = 'inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-base' };
  const variants = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow',
    red:     'bg-red-500 hover:bg-red-600 text-white shadow',
    outline: 'border border-emerald-600 text-emerald-600 hover:bg-emerald-50',
    ghost:   'text-slate-600 hover:bg-slate-100',
    amber:   'bg-amber-500 hover:bg-amber-600 text-white shadow',
    dark:    'bg-slate-700 hover:bg-slate-800 text-white shadow',
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 ${className}`}>{children}</div>
);

const Input = ({ label, ...props }) => (
  <div className="space-y-1">
    {label && <label className="block text-xs font-semibold text-slate-600">{label}</label>}
    <input {...props} className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition ${props.className || ''}`} />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div className="space-y-1">
    {label && <label className="block text-xs font-semibold text-slate-600">{label}</label>}
    <select {...props} className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white transition ${props.className || ''}`}>
      {children}
    </select>
  </div>
);

const Modal = ({ open, title, children, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <h3 className="font-bold text-slate-800 text-base">{title}</h3>
          {onClose && (
            <button onClick={onClose}
              className="text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition text-lg">
              ✕
            </button>
          )}
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>
  );
};

// ==================== LOGIN ====================
function FinanceLogin({ onLogin }) {
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');

  const handle = (e) => {
    e.preventDefault();
    const acc = FIN_ACCOUNTS.find(a => a.username === u.trim() && a.password === p.trim());
    if (!acc) { setErr('اسم المستخدم أو كلمة المرور غير صحيحة'); return; }
    FDB.setSession(acc);
    onLogin(acc);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-800 p-4" dir="rtl">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-emerald-500/20 border border-emerald-400/30 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-2xl">
            💰
          </div>
          <h1 className="text-white text-2xl font-bold">إدارة المالية</h1>
          <p className="text-emerald-300/70 text-sm mt-1">الحمدان جروب</p>
        </div>

        <Card className="p-6 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <form onSubmit={handle} className="space-y-4">
            <Input
              label="اسم المستخدم"
              type="text"
              placeholder="username"
              value={u}
              onChange={e => { setU(e.target.value); setErr(''); }}
              required
              autoComplete="username"
            />
            <Input
              label="كلمة المرور"
              type="password"
              placeholder="••••••••"
              value={p}
              onChange={e => { setP(e.target.value); setErr(''); }}
              required
              autoComplete="current-password"
            />
            {err && <p className="text-red-500 text-xs bg-red-50 rounded-lg px-3 py-2">{err}</p>}
            <Btn className="w-full" size="lg">🔐 دخول</Btn>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ==================== TRANSACTION FORM ====================
function TransactionForm({ type, onSave, onClose, editing = null }) {
  const isIn = type === 'in';
  const cats = isIn ? CATEGORIES_IN : CATEGORIES_OUT;
  const empty = {
    date: today(), amount: '', category: cats[0], company: COMPANIES[0],
    description: '', paymentMethod: PAYMENT_METHODS[0], reference: '',
  };
  const [form, setForm] = useState(editing ? { ...empty, ...editing } : empty);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handle = (e) => {
    e.preventDefault();
    if (!form.amount || !form.date) return;
    onSave({
      ...form,
      id: editing?.id || uid(),
      type,
      amount: parseFloat(form.amount),
      createdAt: editing?.createdAt || new Date().toISOString(),
    });
    onClose();
  };

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="التاريخ" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
        <Input label="المبلغ (ر.س)" type="number" min="0" step="0.01" placeholder="0.00"
          value={form.amount} onChange={e => set('amount', e.target.value)} required />
      </div>
      <Select label="التصنيف" value={form.category} onChange={e => set('category', e.target.value)}>
        {cats.map(c => <option key={c}>{c}</option>)}
      </Select>
      <Select label="الشركة / الجهة" value={form.company} onChange={e => set('company', e.target.value)}>
        {COMPANIES.map(c => <option key={c}>{c}</option>)}
      </Select>
      <Input label="الوصف" type="text" placeholder="تفاصيل المعاملة..."
        value={form.description} onChange={e => set('description', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Select label="طريقة الدفع" value={form.paymentMethod} onChange={e => set('paymentMethod', e.target.value)}>
          {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
        </Select>
        <Input label="رقم المرجع" type="text" placeholder="رقم الفاتورة / الحوالة"
          value={form.reference} onChange={e => set('reference', e.target.value)} />
      </div>
      <div className="flex gap-2 pt-2">
        <Btn className="flex-1" variant={isIn ? 'primary' : 'red'}>
          {editing ? '💾 حفظ التعديل' : isIn ? '➕ إضافة إيراد' : '➖ إضافة مصروف'}
        </Btn>
        <Btn type="button" variant="ghost" onClick={onClose}>إلغاء</Btn>
      </div>
    </form>
  );
}

// ==================== SALARY FORM ====================
function SalaryForm({ onSave, onClose, editing = null }) {
  const empty = {
    month: today().slice(0, 7), employeeName: '', company: COMPANIES[0],
    basicSalary: '', allowances: '', deductions: '', notes: '',
  };
  const [form, setForm] = useState(editing ? { ...empty, ...editing } : empty);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const net = (parseFloat(form.basicSalary) || 0) + (parseFloat(form.allowances) || 0) - (parseFloat(form.deductions) || 0);

  const handle = (e) => {
    e.preventDefault();
    if (!form.employeeName || !form.basicSalary) return;
    onSave({
      ...form,
      id: editing?.id || uid(),
      basicSalary: parseFloat(form.basicSalary),
      allowances:  parseFloat(form.allowances)  || 0,
      deductions:  parseFloat(form.deductions)  || 0,
      net,
      createdAt: editing?.createdAt || new Date().toISOString(),
    });
    onClose();
  };

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="الشهر" type="month" value={form.month} onChange={e => set('month', e.target.value)} required />
        <Select label="الشركة" value={form.company} onChange={e => set('company', e.target.value)}>
          {COMPANIES.map(c => <option key={c}>{c}</option>)}
        </Select>
      </div>
      <Input label="اسم الموظف" type="text" placeholder="الاسم الكامل"
        value={form.employeeName} onChange={e => set('employeeName', e.target.value)} required />
      <div className="grid grid-cols-3 gap-2">
        <Input label="الراتب الأساسي" type="number" min="0" placeholder="0"
          value={form.basicSalary} onChange={e => set('basicSalary', e.target.value)} required />
        <Input label="البدلات" type="number" min="0" placeholder="0"
          value={form.allowances} onChange={e => set('allowances', e.target.value)} />
        <Input label="الخصومات" type="number" min="0" placeholder="0"
          value={form.deductions} onChange={e => set('deductions', e.target.value)} />
      </div>
      {/* Net preview */}
      <div className={`rounded-xl p-3 text-center font-bold text-lg ${net >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
        صافي الراتب: {fmtN(net)} ر.س
      </div>
      <Input label="ملاحظات" type="text" placeholder="أي ملاحظات..."
        value={form.notes} onChange={e => set('notes', e.target.value)} />
      <div className="flex gap-2 pt-1">
        <Btn className="flex-1">💾 حفظ الراتب</Btn>
        <Btn type="button" variant="ghost" onClick={onClose}>إلغاء</Btn>
      </div>
    </form>
  );
}

// ==================== STAT CARD ====================
const StatCard = ({ label, value, icon, color = 'green', sub }) => {
  const colors = {
    green:  'bg-emerald-50 text-emerald-700 border-emerald-100',
    red:    'bg-red-50 text-red-600 border-red-100',
    blue:   'bg-blue-50 text-blue-700 border-blue-100',
    amber:  'bg-amber-50 text-amber-700 border-amber-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  };
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${colors[color]}`}>
      <span className="text-2xl">{icon}</span>
      <span className="text-xl font-bold leading-tight">{value}</span>
      <span className="text-xs font-medium opacity-75">{label}</span>
      {sub && <span className="text-xs opacity-60">{sub}</span>}
    </div>
  );
};

// ==================== DASHBOARD ====================
function Dashboard({ transactions, salaries }) {
  const [period, setPeriod] = useState('month');

  const filterByPeriod = (list) => {
    const now = new Date();
    return list.filter(t => {
      const d = new Date(t.date || t.createdAt);
      if (period === 'today') return d.toDateString() === now.toDateString();
      if (period === 'week') return (now - d) / 864e5 <= 7;
      if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      if (period === 'year') return d.getFullYear() === now.getFullYear();
      return true;
    });
  };

  const txns = filterByPeriod(transactions);
  const income = txns.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const expenses = txns.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const net = income - expenses;

  const salPeriod = filterByPeriod(salaries.map(s => ({ ...s, date: s.month + '-01' })));
  const salTotal = salPeriod.reduce((s, x) => s + (x.net || 0), 0);

  // By category
  const byCat = {};
  txns.forEach(t => {
    if (!byCat[t.category]) byCat[t.category] = { in: 0, out: 0, type: t.type };
    byCat[t.category][t.type] += t.amount;
  });

  // By company
  const byComp = {};
  txns.forEach(t => {
    if (!byComp[t.company]) byComp[t.company] = { in: 0, out: 0 };
    byComp[t.company][t.type] += t.amount;
  });

  const periods = [['today','اليوم'],['week','هذا الأسبوع'],['month','هذا الشهر'],['year','هذا العام'],['all','الكل']];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-2 flex-wrap">
        {periods.map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${period === v ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="إجمالي الإيرادات" value={`${fmtN(income)} ر.س`} icon="📈" color="green" />
        <StatCard label="إجمالي المصروفات" value={`${fmtN(expenses)} ر.س`} icon="📉" color="red" />
        <StatCard label="صافي الربح" value={`${fmtN(net)} ر.س`} icon={net >= 0 ? '💹' : '⚠️'} color={net >= 0 ? 'blue' : 'red'} />
        <StatCard label="الرواتب المصروفة" value={`${fmtN(salTotal)} ر.س`} icon="👥" color="amber" />
      </div>

      {/* Profit bar */}
      {income > 0 && (
        <Card className="p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-3">📊 نسبة الأرباح</h3>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-slate-500 w-16">الإيرادات</span>
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
            </div>
            <span className="text-xs font-bold text-emerald-600 w-24 text-left">{fmtN(income)} ر.س</span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-xs text-slate-500 w-16">المصروفات</span>
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(expenses / income * 100, 100)}%` }} />
            </div>
            <span className="text-xs font-bold text-red-500 w-24 text-left">{fmtN(expenses)} ر.س</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-16">الأرباح</span>
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${net >= 0 ? 'bg-blue-500' : 'bg-red-600'}`}
                style={{ width: `${Math.min(Math.abs(net) / income * 100, 100)}%` }} />
            </div>
            <span className={`text-xs font-bold w-24 text-left ${net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtN(net)} ر.س</span>
          </div>
        </Card>
      )}

      {/* By company */}
      {Object.keys(byComp).length > 0 && (
        <Card className="p-4">
          <h3 className="font-bold text-slate-700 text-sm mb-3">🏢 توزيع حسب الشركة</h3>
          <div className="space-y-3">
            {Object.entries(byComp).map(([comp, vals]) => (
              <div key={comp} className="p-3 bg-slate-50 rounded-xl">
                <p className="font-semibold text-slate-700 text-sm mb-1">{comp}</p>
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-600 font-bold">↑ {fmtN(vals.in)} ر.س</span>
                  <span className="text-red-500 font-bold">↓ {fmtN(vals.out)} ر.س</span>
                  <span className={`font-bold ${vals.in - vals.out >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    = {fmtN(vals.in - vals.out)} ر.س
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Recent transactions */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm">🕐 آخر المعاملات</h3>
        </div>
        {txns.length === 0
          ? <p className="text-center text-slate-400 py-8 text-sm">لا توجد معاملات للفترة المحددة</p>
          : (
            <div className="divide-y divide-slate-50">
              {txns.slice().reverse().slice(0, 10).map(t => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0 ${t.type === 'in' ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    {t.type === 'in' ? '📥' : '📤'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{t.category}</p>
                    <p className="text-xs text-slate-400 truncate">{t.description || t.company} · {fmtDate(t.date)}</p>
                  </div>
                  <span className={`font-bold text-sm flex-shrink-0 ${t.type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {t.type === 'in' ? '+' : '-'}{fmtN(t.amount)} ر.س
                  </span>
                </div>
              ))}
            </div>
          )
        }
      </Card>
    </div>
  );
}

// ==================== TRANSACTIONS TAB ====================
function TransactionsTab({ transactions, setTransactions, type }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [delConfirm, setDelConfirm] = useState(null);

  const cats = type === 'in' ? CATEGORIES_IN : CATEGORIES_OUT;
  const list = transactions
    .filter(t => t.type === type)
    .filter(t => !search || t.description?.includes(search) || t.category?.includes(search) || t.reference?.includes(search))
    .filter(t => !catFilter || t.category === catFilter)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const total = list.reduce((s, t) => s + t.amount, 0);

  const save = (tx) => {
    setTransactions(prev => {
      const updated = editing
        ? prev.map(x => x.id === tx.id ? tx : x)
        : [...prev, tx];
      FDB.saveTransactions(updated);
      return updated;
    });
    setEditing(null);
    setModal(false);
  };

  const del = (id) => {
    setTransactions(prev => {
      const updated = prev.filter(t => t.id !== id);
      FDB.saveTransactions(updated);
      return updated;
    });
    setDelConfirm(null);
  };

  const openEdit = (tx) => { setEditing(tx); setModal(true); };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <input
            type="text" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-0 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
            <option value="">كل التصنيفات</option>
            {cats.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <Btn onClick={() => { setEditing(null); setModal(true); }} variant={type === 'in' ? 'primary' : 'red'} size="sm">
          {type === 'in' ? '➕ إضافة إيراد' : '➕ إضافة مصروف'}
        </Btn>
      </div>

      {/* Total */}
      <div className={`rounded-2xl p-4 text-center ${type === 'in' ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
        <p className="text-xs text-slate-500 mb-1">{type === 'in' ? 'إجمالي الإيرادات المعروضة' : 'إجمالي المصروفات المعروضة'}</p>
        <p className={`text-2xl font-bold ${type === 'in' ? 'text-emerald-700' : 'text-red-600'}`}>{fmtN(total)} ر.س</p>
        <p className="text-xs text-slate-400 mt-1">{list.length} معاملة</p>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {list.length === 0
          ? <p className="text-center text-slate-400 py-10 text-sm">لا توجد {type === 'in' ? 'إيرادات' : 'مصروفات'} بعد</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['التاريخ', 'التصنيف', 'الشركة', 'الوصف', 'المرجع', 'طريقة الدفع', 'المبلغ', ''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map(t => (
                    <tr key={t.id} className="border-t border-slate-50 hover:bg-slate-50 transition">
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">{t.category}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{t.company}</td>
                      <td className="px-3 py-2.5 text-slate-500 max-w-[120px] truncate">{t.description || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap font-mono">{t.reference || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{t.paymentMethod}</td>
                      <td className={`px-3 py-2.5 font-bold whitespace-nowrap ${type === 'in' ? 'text-emerald-600' : 'text-red-500'}`}>
                        {fmtN(t.amount)} ر.س
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => openEdit(t)}
                            className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">✏️</button>
                          <button onClick={() => setDelConfirm(t.id)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Card>

      {/* Add/Edit modal */}
      <Modal open={modal} title={editing ? 'تعديل المعاملة' : type === 'in' ? '➕ إضافة إيراد' : '➕ إضافة مصروف'} onClose={() => { setModal(false); setEditing(null); }}>
        <TransactionForm type={type} onSave={save} onClose={() => { setModal(false); setEditing(null); }} editing={editing} />
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!delConfirm} title="تأكيد الحذف" onClose={() => setDelConfirm(null)}>
        <p className="text-slate-600 text-sm">هل أنت متأكد من حذف هذه المعاملة؟ لا يمكن التراجع.</p>
        <div className="flex gap-2 pt-2">
          <Btn variant="red" className="flex-1" onClick={() => del(delConfirm)}>🗑 حذف</Btn>
          <Btn variant="ghost" onClick={() => setDelConfirm(null)}>إلغاء</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ==================== SALARIES TAB ====================
function SalariesTab({ salaries, setSalaries }) {
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [monthFilter, setMonthFilter] = useState('');
  const [compFilter, setCompFilter] = useState('');
  const [delConfirm, setDelConfirm] = useState(null);

  const list = salaries
    .filter(s => !monthFilter || s.month === monthFilter)
    .filter(s => !compFilter || s.company === compFilter)
    .sort((a, b) => b.month.localeCompare(a.month));

  const totalNet = list.reduce((s, x) => s + x.net, 0);

  const save = (sal) => {
    setSalaries(prev => {
      const updated = editing
        ? prev.map(x => x.id === sal.id ? sal : x)
        : [...prev, sal];
      FDB.saveSalaries(updated);
      return updated;
    });
    setEditing(null);
    setModal(false);
  };

  const del = (id) => {
    setSalaries(prev => {
      const updated = prev.filter(s => s.id !== id);
      FDB.saveSalaries(updated);
      return updated;
    });
    setDelConfirm(null);
  };

  const months = [...new Set(salaries.map(s => s.month))].sort().reverse();

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-1 flex-wrap">
          <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          <select value={compFilter} onChange={e => setCompFilter(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
            <option value="">كل الشركات</option>
            {COMPANIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <Btn onClick={() => { setEditing(null); setModal(true); }} size="sm">➕ إضافة راتب</Btn>
      </div>

      {/* Total */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-center">
        <p className="text-xs text-slate-500 mb-1">إجمالي الرواتب المعروضة</p>
        <p className="text-2xl font-bold text-amber-700">{fmtN(totalNet)} ر.س</p>
        <p className="text-xs text-slate-400 mt-1">{list.length} موظف</p>
      </div>

      {/* Cards */}
      {list.length === 0
        ? <Card className="p-10 text-center text-slate-400 text-sm">لا توجد رواتب بعد</Card>
        : (
          <div className="space-y-2">
            {list.map(s => (
              <Card key={s.id} className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-lg flex-shrink-0">
                    👤
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{s.employeeName}</p>
                    <p className="text-xs text-slate-400">{s.company} · {s.month}</p>
                    <div className="flex gap-3 text-xs mt-1">
                      <span className="text-slate-500">أساسي: <span className="font-semibold">{fmtN(s.basicSalary)}</span></span>
                      {s.allowances > 0 && <span className="text-emerald-600">+ بدلات: {fmtN(s.allowances)}</span>}
                      {s.deductions > 0 && <span className="text-red-500">- خصم: {fmtN(s.deductions)}</span>}
                    </div>
                    {s.notes && <p className="text-xs text-slate-400 mt-0.5 italic">{s.notes}</p>}
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="font-bold text-amber-700 text-base">{fmtN(s.net)} ر.س</p>
                    <p className="text-xs text-slate-400">صافي</p>
                    <div className="flex gap-1 mt-1 justify-end">
                      <button onClick={() => { setEditing(s); setModal(true); }}
                        className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition text-sm">✏️</button>
                      <button onClick={() => setDelConfirm(s.id)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition text-sm">🗑</button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      }

      <Modal open={modal} title={editing ? 'تعديل الراتب' : '➕ إضافة راتب'} onClose={() => { setModal(false); setEditing(null); }}>
        <SalaryForm onSave={save} onClose={() => { setModal(false); setEditing(null); }} editing={editing} />
      </Modal>

      <Modal open={!!delConfirm} title="تأكيد الحذف" onClose={() => setDelConfirm(null)}>
        <p className="text-slate-600 text-sm">هل أنت متأكد من حذف هذا السجل؟</p>
        <div className="flex gap-2 pt-2">
          <Btn variant="red" className="flex-1" onClick={() => del(delConfirm)}>🗑 حذف</Btn>
          <Btn variant="ghost" onClick={() => setDelConfirm(null)}>إلغاء</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ==================== REPORTS TAB ====================
function ReportsTab({ transactions, salaries }) {
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return { key: `${year}-${m}`, label: new Date(`${year}-${m}-01`).toLocaleDateString('ar-SA', { month: 'long' }) };
  });

  const getMonthData = (monthKey) => {
    const txns = transactions.filter(t => t.date?.startsWith(monthKey));
    const sals = salaries.filter(s => s.month === monthKey);
    const income = txns.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
    const expenses = txns.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
    const salTotal = sals.reduce((s, x) => s + x.net, 0);
    return { income, expenses, salTotal, net: income - expenses - salTotal };
  };

  const annualIncome = transactions.filter(t => t.type === 'in' && t.date?.startsWith(year)).reduce((s, t) => s + t.amount, 0);
  const annualExpenses = transactions.filter(t => t.type === 'out' && t.date?.startsWith(year)).reduce((s, t) => s + t.amount, 0);
  const annualSal = salaries.filter(s => s.month?.startsWith(year)).reduce((s, x) => s + x.net, 0);
  const annualNet = annualIncome - annualExpenses - annualSal;

  const years = [...new Set([
    ...transactions.map(t => t.date?.slice(0, 4)),
    ...salaries.map(s => s.month?.slice(0, 4)),
    new Date().getFullYear().toString(),
  ].filter(Boolean))].sort().reverse();

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold text-slate-600">السنة:</label>
        <select value={year} onChange={e => setYear(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
          {years.map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Annual summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="إجمالي الإيرادات" value={`${fmtN(annualIncome)} ر.س`} icon="📈" color="green" sub={year} />
        <StatCard label="إجمالي المصروفات" value={`${fmtN(annualExpenses)} ر.س`} icon="📉" color="red" sub={year} />
        <StatCard label="إجمالي الرواتب" value={`${fmtN(annualSal)} ر.س`} icon="👥" color="amber" sub={year} />
        <StatCard label="صافي الربح السنوي" value={`${fmtN(annualNet)} ر.س`} icon={annualNet >= 0 ? '💹' : '⚠️'} color={annualNet >= 0 ? 'blue' : 'red'} sub={year} />
      </div>

      {/* Monthly table */}
      <Card className="overflow-hidden">
        <div className="p-3 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 text-sm">📅 التقرير الشهري — {year}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {['الشهر', 'الإيرادات', 'المصروفات', 'الرواتب', 'الصافي'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-right font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map(({ key, label }) => {
                const d = getMonthData(key);
                const hasData = d.income > 0 || d.expenses > 0 || d.salTotal > 0;
                return (
                  <tr key={key} className={`border-t border-slate-50 ${hasData ? 'hover:bg-slate-50' : 'opacity-40'}`}>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{label}</td>
                    <td className="px-4 py-2.5 text-emerald-600 font-bold">{d.income > 0 ? `${fmtN(d.income)} ر.س` : '—'}</td>
                    <td className="px-4 py-2.5 text-red-500 font-bold">{d.expenses > 0 ? `${fmtN(d.expenses)} ر.س` : '—'}</td>
                    <td className="px-4 py-2.5 text-amber-600 font-bold">{d.salTotal > 0 ? `${fmtN(d.salTotal)} ر.س` : '—'}</td>
                    <td className={`px-4 py-2.5 font-bold ${d.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {hasData ? `${fmtN(d.net)} ر.س` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot className="bg-emerald-50">
              <tr className="font-bold text-sm border-t-2 border-emerald-200">
                <td className="px-4 py-3 text-emerald-800">المجموع</td>
                <td className="px-4 py-3 text-emerald-700">{fmtN(annualIncome)} ر.س</td>
                <td className="px-4 py-3 text-red-600">{fmtN(annualExpenses)} ر.س</td>
                <td className="px-4 py-3 text-amber-700">{fmtN(annualSal)} ر.س</td>
                <td className={`px-4 py-3 ${annualNet >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmtN(annualNet)} ر.س</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ==================== MAIN FINANCE APP ====================
export default function FinanceApp({ onBack }) {
  const [user, setUser] = useState(() => FDB.getSession());
  const [tab, setTab] = useState('dashboard');
  const [transactions, setTransactions] = useState(() => FDB.getTransactions());
  const [salaries, setSalaries] = useState(() => FDB.getSalaries());

  const handleLogin = (u) => setUser(u);
  const handleLogout = () => { FDB.clearSession(); setUser(null); };

  if (!user) return <FinanceLogin onLogin={handleLogin} />;

  const TABS = [
    { id: 'dashboard', label: 'الرئيسية',   icon: '🏠' },
    { id: 'income',    label: 'الإيرادات',   icon: '📈' },
    { id: 'expenses',  label: 'المصروفات',   icon: '📉' },
    { id: 'salaries',  label: 'الرواتب',     icon: '👥' },
    { id: 'reports',   label: 'التقارير',    icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-l from-emerald-700 to-emerald-900 text-white sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3 px-4 py-3 max-w-4xl mx-auto">
          <button onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition text-lg">
            ←
          </button>
          <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center text-xl">💰</div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base leading-none">إدارة المالية</h1>
            <p className="text-emerald-200 text-xs mt-0.5">الحمدان جروب</p>
          </div>
          <div className="text-xs text-emerald-200 text-left hidden sm:block">
            <p className="font-semibold">{user.name}</p>
            <p className="opacity-75">{user.title}</p>
          </div>
          <button onClick={handleLogout}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-semibold transition">
            خروج
          </button>
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto scrollbar-hide border-t border-white/10 max-w-4xl mx-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${tab === t.id ? 'border-white text-white' : 'border-transparent text-emerald-200 hover:text-white'}`}>
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-4 space-y-4 pb-10">
        {tab === 'dashboard' && <Dashboard transactions={transactions} salaries={salaries} />}
        {tab === 'income'    && <TransactionsTab transactions={transactions} setTransactions={setTransactions} type="in" />}
        {tab === 'expenses'  && <TransactionsTab transactions={transactions} setTransactions={setTransactions} type="out" />}
        {tab === 'salaries'  && <SalariesTab salaries={salaries} setSalaries={setSalaries} />}
        {tab === 'reports'   && <ReportsTab transactions={transactions} salaries={salaries} />}
      </main>
    </div>
  );
}
