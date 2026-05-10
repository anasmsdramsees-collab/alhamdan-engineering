import React, { useState, useEffect, useRef, useCallback } from "react";
import { cloud } from './firebase.js';
import HawlakApp from './HawlakApp.jsx';
import FinanceApp from './FinanceApp.jsx';

// ==================== CONSTANTS ====================
const SERVICE_TYPES = [
  { id:'license', label:'اصدار رخص' },
  { id:'supervision', label:'اشراف هندسي' },
  { id:'correction', label:'تصحيح وضع قائم' },
  { id:'plans', label:'اعداد مخططات' },
  { id:'renovation_license', label:'اصدار رخصة ترميم' },
  { id:'license_renewal', label:'تجديد رخصة' },
  { id:'subdivision', label:'تجزئة' },
  { id:'merge', label:'دمج' },
  { id:'interior_design', label:'تصميم داخلي' },
  { id:'construction_license', label:'رخصة تشييد موقع' },
  { id:'ac_works', label:'أعمال تكييف' },
];
const DEPARTMENTS = [
  { id:'consulting', label:'استشاري' },
  { id:'engineering', label:'هندسي' },
  { id:'ac', label:'تكييف' },
];
const PROJECT_STATUSES = [
  { id:'new', label:'جديد' },
  { id:'in_progress', label:'قيد التنفيذ' },
  { id:'pending_client', label:'انتظار موافقة العميل' },
  { id:'pending_authority', label:'انتظار الجهة' },
  { id:'completed', label:'منتهي' },
  { id:'cancelled', label:'ملغي' },
];
const AC_TYPES = [
  { id:'split', label:'سبليت' },
  { id:'central', label:'مركزي' },
  { id:'mini_split', label:'ميني سبليت' },
  { id:'cassette', label:'كاسيت' },
  { id:'window', label:'شباك' },
  { id:'chiller', label:'تشيلر' },
  { id:'vrf', label:'VRF / VRV' },
  { id:'ahu', label:'معالج هواء (AHU)' },
  { id:'duct', label:'مكيف مجاري هواء (Duct)' },
  { id:'floor', label:'أرضي' },
];
const AC_SERVICES = [
  { id:'install', label:'تركيب' },
  { id:'maintenance', label:'صيانة دورية' },
  { id:'cleaning', label:'تنظيف وغسيل' },
  { id:'freon', label:'شحن فريون' },
  { id:'repair', label:'تصليح أعطال' },
  { id:'inspection', label:'فحص وتشخيص' },
  { id:'ducting', label:'تمديدات مجاري الهواء' },
  { id:'insulation', label:'عزل مواسير' },
  { id:'control', label:'أنظمة تحكم وتشغيل' },
  { id:'ventilation', label:'تهوية وتخليص' },
];
// خدمات قسم التكييف (تستبدل SERVICE_TYPES عند اختيار قسم التكييف)
const AC_SERVICE_TYPES = [
  { id:'ac_central',    label:'أنظمة التكييف المركزية' },
  { id:'ac_split',      label:'أنظمة التكييف المنفصلة' },
  { id:'ac_multi_zone', label:'أنظمة التكييف متعددة المناطق' },
  { id:'ac_water',      label:'أنظمة التبريد بالماء' },
  { id:'ac_om',         label:'خدمات التشغيل والصيانة' },
  { id:'ac_foundation', label:'خدمات التأسيس' },
  { id:'ac_design',     label:'التصميم ما قبل البدء' },
];
const ALL_SERVICE_TYPES = [...SERVICE_TYPES, ...AC_SERVICE_TYPES];
const getServiceTypes = (dept) => dept === 'ac' ? AC_SERVICE_TYPES : SERVICE_TYPES;
const getProjectTypeLabel = (type, dept) =>
  dept === 'ac'
    ? (type === 'new' ? 'مشروع جديد' : 'مشروع قائم')
    : (type === 'new' ? 'جديد' : 'قديم');
const LEAD_STATUSES = [
  { id:'contacted',  label:'تم التواصل',     color:'blue' },
  { id:'interested', label:'مهتم',            color:'green' },
  { id:'not_interested', label:'غير مهتم',   color:'slate' },
  { id:'follow_up',  label:'يحتاج متابعة',   color:'amber' },
];
const UNIT_TYPES = [
  { id:'piece',   label:'قطعة' },
  { id:'meter',   label:'متر' },
  { id:'ton',     label:'طن' },
  { id:'roll',    label:'لفة' },
  { id:'carton',  label:'كرتونة' },
  { id:'kg',      label:'كيلو' },
  { id:'liter',   label:'لتر' },
  { id:'set',     label:'سواء' },
];
const PLAN_STATUSES = [
  { id:'not_started', label:'لم يبدأ' },
  { id:'in_progress', label:'قيد الإعداد' },
  { id:'submitted', label:'تم التسليم' },
  { id:'approved', label:'معتمد' },
  { id:'rejected', label:'مرفوض' },
];

// ==================== STORAGE ====================
// localStorage = primary (fast, sync). Firebase = cloud sync (async, background).
const ls = (key, def) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? def; } catch { return def; } };
const lsSet = (key, val) => { localStorage.setItem(key, JSON.stringify(val)); cloud.save(key, val); };

const DB = {
  getUsers:     () => ls('hec_users',      []),
  saveUsers:    (u) => lsSet('hec_users',      u),
  getProjects:  () => ls('hec_projects',   []),
  saveProjects: (p) => lsSet('hec_projects',   p),
  getVisits:    () => ls('hec_visits',     []),
  saveVisits:   (v) => lsSet('hec_visits',     v),
  getClients:   () => ls('hec_clients',    []),
  saveClients:  (c) => lsSet('hec_clients',    c),
  getLeads:     () => ls('hec_leads',      []),
  saveLeads:    (l) => lsSet('hec_leads',      l),
  getSuppliers: () => ls('hec_suppliers',  []),
  saveSuppliers:(s) => lsSet('hec_suppliers',  s),
  getQuotes:    () => ls('hec_quotes',     []),
  saveQuotes:   (q) => lsSet('hec_quotes',     q),
  getEngQuotes: () => ls('hec_eng_quotes', []),
  saveEngQuotes:(q) => lsSet('hec_eng_quotes', q),
  getBrands:    () => ls('hec_brands',     null),
  saveBrands:   (b) => lsSet('hec_brands',     b),
  // Session (device-local — intentional, keeps logins separate per device)
  getCurrentUser: () => { try { return JSON.parse(sessionStorage.getItem('hec_current') || 'null'); } catch { return null; } },
  setCurrentUser: (u) => sessionStorage.setItem('hec_current', JSON.stringify(u)),
  clearCurrentUser: () => sessionStorage.removeItem('hec_current'),
};

// ─── Activity + Notification Helpers ─────────────────────────

const ENTITY_LABELS = {
  project: 'مشروع', client: 'عميل', lead: 'عميل محتمل',
  supplier: 'مورد', ac_quote: 'عرض تكييف', eng_quote: 'عرض هندسي',
  visit: 'زيارة',
};
const ACTION_LABELS = {
  added: 'أضاف', updated: 'عدّل', deleted: 'حذف',
  approved: 'اعتمد', rejected: 'رفض', status_changed: 'غيّر حالة',
};

function logActivity(currentUser, action, entityType, entityName, details = '') {
  if (!currentUser) return;
  cloud.logActivity({
    timestamp: new Date().toISOString(),
    userId: currentUser.id,
    userName: currentUser.name,
    department: currentUser.department || '',
    action,
    entityType,
    entityName: entityName || '',
    details,
  });
}

function notifyUsers(targetUserIds, message, entityType, entityId, fromUser) {
  if (!targetUserIds?.length) return;
  const notif = { message, entityType, entityId: entityId || '', fromUser: fromUser || '' };
  targetUserIds.forEach(uid => cloud.addNotification(uid, notif));
}

function notifyManagers(message, entityType, entityId, fromUser) {
  notifyUsers(['1'], message, entityType, entityId, fromUser);
}

// ─── Real-time sync hook ────────────────────────────────────────────────────
// Dispatch 'hec-sync' from the Firebase subscribe callback → pages auto-reload
function useRealTimeSync(reloadFn) {
  useEffect(() => {
    const handler = () => { try { reloadFn(); } catch {} };
    window.addEventListener('hec-sync', handler);
    return () => window.removeEventListener('hec-sync', handler);
  }, []); // intentionally no deps — reloadFn uses closure refs
}

// Master users list — always kept in sync
const MASTER_USERS = [
  { id:'1', name:'م. عبدالرحمن الحمدان', username:'admin',      password:'Admin@Hamdan25',  role:'manager',     department:'consulting' },
  { id:'2', name:'م. الخطيب',            username:'alkhatib',   password:'Khatib@2025',     role:'engineer',    department:'consulting' },
  { id:'3', name:'م. طارق',              username:'tariq',      password:'Tariq@2025',      role:'engineer',    department:'engineering', title:'مدير القسم الهندسي' },
  { id:'4', name:'م. علاء',              username:'alaa',       password:'Alaa@2025',       role:'engineer',    department:'engineering' },
  { id:'5', name:'م. أحمد',              username:'ahmed',      password:'Ahmed@2025',      role:'engineer',    department:'engineering' },
  { id:'6', name:'م. محمد',              username:'mohammed',   password:'Mohammed@2025',   role:'engineer',    department:'engineering' },
  { id:'7', name:'م. الزبير',            username:'alzubair',   password:'Zubair@2025',     role:'engineer',    department:'engineering' },
  { id:'8', name:'م. محمد كنيش',         username:'mkunish',    password:'Kunish@2025',     role:'engineer',    department:'ac',         title:'مدير قسم التكييف' },
  { id:'9', name:'النعمان أحمد',          username:'numan',      password:'Numan@2025',      role:'accountant',  department:'consulting' },
];

function seedData() {
  // Upsert: merge master users into stored users by id
  const stored = DB.getUsers();
  const merged = [...stored];
  MASTER_USERS.forEach(mu => {
    const idx = merged.findIndex(u => u.id === mu.id);
    if (idx === -1) merged.push(mu);          // new user → add
    else merged[idx] = { ...merged[idx], ...mu }; // existing → update name/pass/role
  });
  DB.saveUsers(merged);
  if (!localStorage.getItem('hec_projects')) DB.saveProjects([]);
  if (!localStorage.getItem('hec_visits'))   DB.saveVisits([]);
}
seedData();

// ==================== HELPERS ====================
const fmt = (n) => Number(n||0).toLocaleString('ar-SA');
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-SA') : '-';
const uid = () => Math.random().toString(36).substr(2,9);
const getLabelById = (arr, id) => arr.find(x=>x.id===id)?.label || id;
const statusClass = (s) => `status-${s}`;

// ==================== LOGO SVG ====================
function Logo({ size = 60, showText = true }) {
  return (
    <svg width={size} height={showText ? size * 1.5 : size} viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" className="logo-shape">
      <defs>
        <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60a5fa"/>
          <stop offset="50%" stopColor="#3b82f6"/>
          <stop offset="100%" stopColor="#1d4ed8"/>
        </linearGradient>
        <linearGradient id="grayGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#cbd5e1"/>
          <stop offset="50%" stopColor="#94a3b8"/>
          <stop offset="100%" stopColor="#64748b"/>
        </linearGradient>
        <linearGradient id="darkBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e40af"/>
          <stop offset="100%" stopColor="#1e3a8a"/>
        </linearGradient>
      </defs>
      {/* Left cube - gray */}
      <polygon points="55,30 100,5 100,75 55,100" fill="url(#grayGrad)" opacity="0.9"/>
      <polygon points="55,30 10,55 10,125 55,100" fill="#78909C" opacity="0.85"/>
      <polygon points="55,100 10,125 55,150 100,125" fill="#90A4AE" opacity="0.8"/>
      {/* Right cube - blue */}
      <polygon points="100,5 145,30 145,100 100,75" fill="url(#blueGrad)" opacity="0.9"/>
      <polygon points="145,30 190,55 190,125 145,100" fill="#1e40af" opacity="0.85"/>
      <polygon points="100,75 145,100 100,125 55,100" fill="url(#darkBlueGrad)" opacity="0.9"/>
      {/* Center overlap highlight */}
      <polygon points="100,5 100,75 55,100 100,125 145,100 100,75" fill="url(#blueGrad)" opacity="0.3"/>
      {showText && (
        <>
          <text x="100" y="195" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1e40af" fontFamily="Tajawal,sans-serif">الحمدان للاستشارات</text>
          <text x="100" y="218" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1e40af" fontFamily="Tajawal,sans-serif">الهندسية</text>
          <text x="100" y="245" textAnchor="middle" fontSize="10" fill="#64748b" fontFamily="Tajawal,sans-serif">Alhamdan For Consulting Engineering</text>
        </>
      )}
    </svg>
  );
}

// ==================== COMPONENTS ====================
function Badge({ status }) {
  const s = PROJECT_STATUSES.find(x=>x.id===status);
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${statusClass(status)}`}>{s?.label||status}</span>;
}

function Card({ title, value, sub, icon, color='blue' }) {
  const colors = { blue:'from-blue-500 to-blue-700', green:'from-emerald-500 to-emerald-700', amber:'from-amber-500 to-amber-600', purple:'from-purple-500 to-purple-700', slate:'from-slate-500 to-slate-700' };
  return (
    <div className="bg-white rounded-2xl card-shadow p-5 flex items-center gap-4">
      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-white text-2xl flex-shrink-0`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-sm font-medium text-slate-600">{title}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children, size='md' }) {
  if (!open) return null;
  const sizes = { sm:'max-w-sm', md:'max-w-lg', lg:'max-w-2xl', xl:'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay bg-black/40" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Input({ label, required, ...props }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}{required && <span className="text-red-500 mr-1">*</span>}</label>
      <input className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition" {...props}/>
    </div>
  );
}

function Select({ label, required, children, ...props }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}{required && <span className="text-red-500 mr-1">*</span>}</label>
      <select className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition bg-white" {...props}>{children}</select>
    </div>
  );
}

function Textarea({ label, required, ...props }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}{required && <span className="text-red-500 mr-1">*</span>}</label>
      <textarea className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition resize-none" rows="3" {...props}/>
    </div>
  );
}

function Btn({ children, variant='primary', size='md', className='', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition focus:outline-none ';
  const variants = {
    primary: 'gradient-blue text-white hover:opacity-90 shadow-md shadow-blue-500/20',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100',
    ghost: 'text-slate-600 hover:bg-slate-100',
    success: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/20',
  };
  const sizes = { sm:'px-3 py-1.5 text-sm', md:'px-5 py-2.5 text-sm', lg:'px-6 py-3 text-base' };
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
}

// ==================== LOGIN ====================
function Login({ onLogin }) {
  const [form, setForm] = useState({ username:'', password:'' });
  const [error, setError] = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handle = (e) => {
    e.preventDefault();
    const users = DB.getUsers();
    const user = users.find(u => u.username === form.username && u.password === form.password);
    if (user) { DB.setCurrentUser(user); onLogin(user); }
    else setError('اسم المستخدم أو كلمة المرور غير صحيحة');
  };

  return (
    <div className="min-h-screen gradient-header flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 fade-in">
        <div className="flex flex-col items-center mb-8">
          <Logo size={80} showText={false}/>
          <h1 className="text-xl font-bold text-slate-800 mt-4">الحمدان للاستشارات الهندسية</h1>
          <p className="text-slate-500 text-sm mt-1">نظام إدارة المشاريع الهندسية</p>
        </div>
        <form onSubmit={handle} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm text-center">{error}</div>}
          <Input label="اسم المستخدم" value={form.username} onChange={e=>set('username',e.target.value)} placeholder="أدخل اسم المستخدم" required/>
          <Input label="كلمة المرور" type="password" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="أدخل كلمة المرور" required/>
          <Btn type="submit" className="w-full" size="lg">تسجيل الدخول</Btn>
        </form>
      </div>
    </div>
  );
}

// ==================== SIDEBAR ====================
function Sidebar({ user, active, setActive, onLogout, onGoPortal, isOpen, onClose }) {
  const managerNav = [
    { id:'dashboard',     icon:'📊', label:'لوحة التحكم' },
    { id:'engineers',     icon:'👷', label:'المهندسين' },
    { id:'projects',      icon:'📋', label:'جميع المشاريع' },
    { id:'clients',       icon:'🏢', label:'العملاء' },
    { id:'leads',         icon:'🎯', label:'العملاء المحتملين' },
    { id:'suppliers',     icon:'📦', label:'الموردين' },
    { id:'ac_quotes',     icon:'❄️', label:'عروض أسعار التكييف' },
    { id:'eng_quotes',    icon:'📐', label:'عروض الأسعار الهندسية' },
    { id:'visits',        icon:'🗺️', label:'الزيارات الميدانية' },
    { id:'finance',       icon:'💰', label:'التقارير المالية' },
    { id:'acc_dashboard', icon:'🧾', label:'لوحة المحاسب' },
    { id:'activity_log',  icon:'📋', label:'سجل النشاط' },
    { id:'settings',      icon:'⚙️', label:'الإعدادات' },
  ];
  const engineerNav = [
    { id:'my_projects', icon:'📋', label:'مشاريعي' },
    { id:'my_visits', icon:'🗺️', label:'زياراتي الميدانية' },
    { id:'add_project', icon:'➕', label:'إضافة مشروع' },
  ];
  const accountantNav = [
    { id:'acc_dashboard', icon:'📊', label:'لوحة المحاسب' },
    { id:'acc_projects',  icon:'📋', label:'المشاريع' },
    { id:'acc_finance',   icon:'💰', label:'المالية والفواتير' },
    { id:'suppliers',     icon:'📦', label:'الموردين' },
    { id:'ac_quotes',     icon:'❄️', label:'عروض أسعار التكييف' },
    { id:'eng_quotes',    icon:'📐', label:'عروض الأسعار الهندسية' },
    { id:'acc_erp',       icon:'🔗', label:'ربط النظام المالي' },
  ];
  const isEngHead = user.department === 'engineering' && (user.title||'').includes('مدير');
  const acEngineerExtra = user.department === 'ac' ? [
    { id:'suppliers',  icon:'📦', label:'الموردين' },
    { id:'ac_quotes',  icon:'❄️', label:'عروض أسعار التكييف' },
  ] : [];
  const engEngineerExtra = user.department === 'engineering' ? [
    ...(isEngHead ? [{ id:'suppliers', icon:'📦', label:'الموردين' }] : []),
    { id:'eng_quotes', icon:'📐', label:'عروض الأسعار الهندسية' },
  ] : [];
  const nav = user.role==='manager' ? managerNav : user.role==='accountant' ? accountantNav : [...engineerNav, ...acEngineerExtra, ...engEngineerExtra];
  const dept = DEPARTMENTS.find(d=>d.id===user.department);
  const roleLabel = user.role==='manager'?'مدير عام':user.role==='accountant'?'محاسب':dept?.label||'';

  const handleNav = (id) => { setActive(id); onClose && onClose(); };

  const sidebarContent = (
    <div className="w-64 bg-slate-900 h-full flex flex-col">
      <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={44} showText={false}/>
          <div>
            <div className="text-white font-bold text-sm leading-tight">الحمدان للاستشارات</div>
            <div className="text-blue-400 text-xs">الهندسية</div>
          </div>
        </div>
        <button onClick={onClose} className="md:hidden text-slate-400 hover:text-white p-1">✕</button>
      </div>
      <div className="p-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full gradient-blue flex items-center justify-center text-white font-bold text-sm">{user.name.charAt(0)}</div>
          <div>
            <div className="text-white text-sm font-semibold">{user.name}</div>
            <div className="text-slate-400 text-xs">{roleLabel}</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map(item => (
          <button key={item.id} onClick={()=>handleNav(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${active===item.id?'sidebar-active text-white shadow-lg':'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-700/50 space-y-1">
        {onGoPortal && (
          <button onClick={onGoPortal} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-blue-300 hover:bg-slate-800 transition">
            <span>🏢</span><span>بوابة المجموعة</span>
          </button>
        )}
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition">
          <span>🚪</span><span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-64 min-h-screen flex-shrink-0">{sidebarContent}</div>
      {/* Mobile drawer */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={onClose}/>
          <div className="relative w-64 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}

// ==================== MANAGER DASHBOARD ====================
function ManagerDashboard({ user }) {
  const projects = DB.getProjects();
  const engineers = DB.getUsers().filter(u=>u.role==='engineer');
  const visits = DB.getVisits();
  const totalBudget = projects.reduce((s,p)=>s+Number(p.budget||0),0);
  const totalCollected = projects.reduce((s,p)=>s+(p.invoices||[]).filter(i=>i.collected).reduce((a,i)=>a+Number(i.amount),0),0);
  const totalRemaining = projects.reduce((s,p)=>s+(p.payments||[]).filter(pp=>!pp.paid).reduce((a,pp)=>a+Number(pp.amount),0),0);
  const byStatus = (s) => projects.filter(p=>p.status===s).length;

  return (
    <div className="fade-in space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">لوحة التحكم</h2>
        <p className="text-slate-500 text-sm mt-1">نظرة عامة على جميع المشاريع والمهندسين</p>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="إجمالي المشاريع" value={projects.length} icon="📋" color="blue"/>
        <Card title="المهندسين النشطين" value={engineers.length} icon="👷" color="slate"/>
        <Card title="الزيارات الميدانية" value={visits.length} icon="🗺️" color="purple"/>
        <Card title="مشاريع قيد التنفيذ" value={byStatus('in_progress')} icon="⚡" color="amber"/>
      </div>
      {/* Finance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="إجمالي الميزانيات" value={`${fmt(totalBudget)} ر.س`} icon="💼" color="blue"/>
        <Card title="المبالغ المحصلة" value={`${fmt(totalCollected)} ر.س`} icon="✅" color="green"/>
        <Card title="المبالغ المتبقية" value={`${fmt(totalRemaining)} ر.س`} icon="⏳" color="amber"/>
      </div>
      {/* Projects by status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl card-shadow p-5">
          <h3 className="font-bold text-slate-700 mb-4">حالة المشاريع</h3>
          <div className="space-y-3">
            {PROJECT_STATUSES.map(s => {
              const cnt = byStatus(s.id);
              const pct = projects.length ? Math.round(cnt/projects.length*100) : 0;
              return (
                <div key={s.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-600">{s.label}</span>
                    <span className="text-slate-500">{cnt} مشروع ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full gradient-blue transition-all" style={{width:`${pct}%`}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-5">
          <h3 className="font-bold text-slate-700 mb-4">المهندسون</h3>
          <div className="space-y-3">
            {engineers.map(eng => {
              const myProjects = projects.filter(p=>p.engineerId===eng.id);
              const dept = DEPARTMENTS.find(d=>d.id===eng.department);
              return (
                <div key={eng.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full gradient-blue flex items-center justify-center text-white font-bold text-sm">{eng.name.charAt(0)}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-700 text-sm">{eng.name}</div>
                    <div className="text-xs text-slate-400">{dept?.label} · {myProjects.length} مشروع</div>
                  </div>
                  <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{myProjects.filter(p=>p.status==='in_progress').length} نشط</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Recent projects */}
      <div className="bg-white rounded-2xl card-shadow p-5">
        <h3 className="font-bold text-slate-700 mb-4">آخر المشاريع</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs text-slate-500 border-b border-slate-100">
                <th className="pb-3 font-semibold">رقم المشروع</th>
                <th className="pb-3 font-semibold">العميل</th>
                <th className="pb-3 font-semibold">الخدمة</th>
                <th className="pb-3 font-semibold">الحالة</th>
                <th className="pb-3 font-semibold">الميزانية</th>
              </tr>
            </thead>
            <tbody>
              {projects.slice(0,5).map(p=>(
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="py-3 font-mono text-xs text-slate-500">{p.projectNo}</td>
                  <td className="py-3 font-medium">{p.clientName}</td>
                  <td className="py-3 text-slate-500">{getLabelById(ALL_SERVICE_TYPES,p.serviceType)}</td>
                  <td className="py-3"><Badge status={p.status}/></td>
                  <td className="py-3 font-semibold text-slate-700">{fmt(p.budget)} ر.س</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== ENGINEERS PAGE ====================
function EngineersPage({ onEdit }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:'', username:'', password:'', department:'consulting', phone:'', email:'' });
  const [engineers, setEngineers] = useState(DB.getUsers().filter(u=>u.role==='engineer'));
  const [err, setErr] = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = () => {
    if (!form.name||!form.username||!form.password) { setErr('يرجى ملء جميع الحقول المطلوبة'); return; }
    const all = DB.getUsers();
    if (all.find(u=>u.username===form.username)) { setErr('اسم المستخدم مستخدم مسبقاً'); return; }
    const newUser = { id:uid(), ...form, role:'engineer' };
    DB.saveUsers([...all, newUser]);
    setEngineers(DB.getUsers().filter(u=>u.role==='engineer'));
    setShowAdd(false);
    setForm({ name:'', username:'', password:'', department:'consulting', phone:'', email:'' });
    setErr('');
  };

  const remove = (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المهندس؟')) return;
    DB.saveUsers(DB.getUsers().filter(u=>u.id!==id));
    setEngineers(DB.getUsers().filter(u=>u.role==='engineer'));
  };

  return (
    <div className="fade-in space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">المهندسون</h2>
          <p className="text-slate-500 text-sm mt-1">إدارة حسابات المهندسين</p>
        </div>
        <Btn onClick={()=>setShowAdd(true)}>➕ إضافة مهندس</Btn>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {engineers.map(eng => {
          const projects = DB.getProjects().filter(p=>p.engineerId===eng.id);
          const dept = DEPARTMENTS.find(d=>d.id===eng.department);
          return (
            <div key={eng.id} className="bg-white rounded-2xl card-shadow p-5">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl gradient-blue flex items-center justify-center text-white font-bold text-xl">{eng.name.replace('م.','').trim().charAt(0)}</div>
                <div className="flex-1">
                  <div className="font-bold text-slate-800">{eng.name}</div>
                  <div className="text-sm text-slate-500">{dept?.label}</div>
                  {eng.phone && <div className="text-xs text-slate-400 mt-1">📞 {eng.phone}</div>}
                  {eng.email && <div className="text-xs text-slate-400">✉️ {eng.email}</div>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
                <div className="text-center">
                  <div className="font-bold text-slate-700">{projects.length}</div>
                  <div className="text-xs text-slate-400">مشروع</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-blue-600">{projects.filter(p=>p.status==='in_progress').length}</div>
                  <div className="text-xs text-slate-400">نشط</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-emerald-600">{projects.filter(p=>p.status==='completed').length}</div>
                  <div className="text-xs text-slate-400">منتهي</div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={()=>remove(eng.id)} className="flex-1 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition">حذف</button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="إضافة مهندس جديد">
        <div className="space-y-4">
          {err && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{err}</div>}
          <Input label="الاسم الكامل" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="م. اسم المهندس" required/>
          <div className="grid grid-cols-2 gap-3">
            <Input label="اسم المستخدم" value={form.username} onChange={e=>set('username',e.target.value)} placeholder="username" required/>
            <Input label="كلمة المرور" type="password" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="••••••" required/>
          </div>
          <Select label="القسم" value={form.department} onChange={e=>set('department',e.target.value)} required>
            {DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="رقم الجوال" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="05xxxxxxxx"/>
            <Input label="البريد الإلكتروني" value={form.email} onChange={e=>set('email',e.target.value)} placeholder="email@example.com"/>
          </div>
          <div className="flex gap-3 pt-2">
            <Btn onClick={save} className="flex-1">حفظ</Btn>
            <Btn variant="secondary" onClick={()=>setShowAdd(false)} className="flex-1">إلغاء</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ==================== PROJECTS LIST ====================
function ProjectsList({ user, onSelectProject, onAddProject }) {
  const [projects, setProjects] = useState(DB.getProjects());
  const [filter, setFilter] = useState({ status:'', department:'', serviceType:'', type:'', engineerId:'' });
  const engineers = DB.getUsers().filter(u=>u.role==='engineer');

  const myProjects = user.role==='engineer' ? projects.filter(p=>p.engineerId===user.id) : projects;
  const filtered = myProjects.filter(p=>{
    if (filter.status && p.status!==filter.status) return false;
    if (filter.department && p.department!==filter.department) return false;
    if (filter.serviceType && p.serviceType!==filter.serviceType) return false;
    if (filter.type && p.type!==filter.type) return false;
    if (filter.engineerId && p.engineerId!==filter.engineerId) return false;
    return true;
  });

  const getEngineer = (id) => engineers.find(e=>e.id===id);

  return (
    <div className="fade-in space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{user.role==='manager'?'جميع المشاريع':'مشاريعي'}</h2>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} مشروع</p>
        </div>
        {(user.role==='engineer' || user.role==='manager') && <Btn onClick={onAddProject}>➕ مشروع جديد</Btn>}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl card-shadow p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm" value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))}>
            <option value="">كل الحالات</option>
            {PROJECT_STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm" value={filter.department} onChange={e=>setFilter(f=>({...f,department:e.target.value}))}>
            <option value="">كل الأقسام</option>
            {DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm" value={filter.serviceType} onChange={e=>setFilter(f=>({...f,serviceType:e.target.value}))}>
            <option value="">كل الخدمات</option>
            <optgroup label="الخدمات الهندسية">{SERVICE_TYPES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>
            <optgroup label="خدمات التكييف">{AC_SERVICE_TYPES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>
          </select>
          <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm" value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))}>
            <option value="">جديد وقديم</option>
            <option value="new">جديد</option>
            <option value="old">قديم</option>
          </select>
          {user.role==='manager' && (
            <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm" value={filter.engineerId} onChange={e=>setFilter(f=>({...f,engineerId:e.target.value}))}>
              <option value="">كل المهندسين</option>
              {engineers.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length===0 && <div className="bg-white rounded-2xl card-shadow text-center py-12 text-slate-400">لا توجد مشاريع</div>}
        {filtered.map(p=>(
          <div key={p.id} className="bg-white rounded-2xl card-shadow p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-bold text-slate-800">{p.clientName}</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">{p.projectNo}</div>
              </div>
              <Badge status={p.status}/>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-slate-400">الخدمة</div>
                <div className="font-medium text-slate-700 mt-0.5">{getLabelById(ALL_SERVICE_TYPES,p.serviceType)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-slate-400">القسم</div>
                <div className="font-medium text-slate-700 mt-0.5">{getLabelById(DEPARTMENTS,p.department)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-slate-400">الميزانية</div>
                <div className="font-bold text-blue-600 mt-0.5">{fmt(p.budget)} ر.س</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-slate-400">موافقة العميل</div>
                <div className="mt-0.5">{p.clientApproval?'✅ موافق':'⭕ لم يوافق'}</div>
              </div>
            </div>
            {user.role==='manager' && <div className="text-xs text-slate-500 mb-3">👷 {getEngineer(p.engineerId)?.name||'-'}</div>}
            <div className="flex gap-2">
              <button onClick={()=>onSelectProject(p)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-semibold">عرض التفاصيل</button>
              {user.role==='manager' && (
                <button onClick={()=>{
                  if(!confirm(`حذف مشروع "${p.clientName}"؟`)) return;
                  DB.saveProjects(DB.getProjects().filter(x=>x.id!==p.id));
                  DB.saveVisits(DB.getVisits().filter(v=>v.projectId!==p.id));
                  setProjects(DB.getProjects());
                }} className="px-3 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-semibold">🗑️</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl card-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-right text-xs text-slate-500">
                <th className="px-4 py-3 font-semibold">رقم المشروع</th>
                <th className="px-4 py-3 font-semibold">العميل</th>
                <th className="px-4 py-3 font-semibold">الخدمة</th>
                <th className="px-4 py-3 font-semibold">القسم</th>
                {user.role==='manager' && <th className="px-4 py-3 font-semibold">المهندس</th>}
                <th className="px-4 py-3 font-semibold">النوع</th>
                <th className="px-4 py-3 font-semibold">الحالة</th>
                <th className="px-4 py-3 font-semibold">موافقة العميل</th>
                <th className="px-4 py-3 font-semibold">الميزانية</th>
                <th className="px-4 py-3 font-semibold">تفاصيل</th>
                {user.role==='manager' && <th className="px-4 py-3 font-semibold">حذف</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 && (
                <tr><td colSpan="11" className="text-center py-12 text-slate-400">لا توجد مشاريع</td></tr>
              )}
              {filtered.map(p=>(
                <tr key={p.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.projectNo}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{p.clientName}</td>
                  <td className="px-4 py-3 text-slate-600">{getLabelById(ALL_SERVICE_TYPES,p.serviceType)}</td>
                  <td className="px-4 py-3 text-slate-500">{getLabelById(DEPARTMENTS,p.department)}</td>
                  {user.role==='manager' && <td className="px-4 py-3 text-slate-600">{getEngineer(p.engineerId)?.name||'-'}</td>}
                  <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.type==='new'?'bg-blue-50 text-blue-600':'bg-amber-50 text-amber-600'}`}>{getProjectTypeLabel(p.type,p.department)}</span></td>
                  <td className="px-4 py-3"><Badge status={p.status}/></td>
                  <td className="px-4 py-3">{p.clientApproval ? <span className="text-emerald-500 text-base">✅</span> : <span className="text-slate-300 text-base">⭕</span>}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(p.budget)} <span className="text-xs text-slate-400">ر.س</span></td>
                  <td className="px-4 py-3"><button onClick={()=>onSelectProject(p)} className="text-blue-500 hover:text-blue-700 text-xs font-medium underline">عرض</button></td>
                  {user.role==='manager' && (
                    <td className="px-4 py-3">
                      <button onClick={()=>{
                        if(!confirm(`هل أنت متأكد من حذف مشروع "${p.clientName}"؟\nسيتم حذف جميع فواتيره وزياراته أيضاً.`)) return;
                        DB.saveProjects(DB.getProjects().filter(x=>x.id!==p.id));
                        DB.saveVisits(DB.getVisits().filter(v=>v.projectId!==p.id));
                        setProjects(DB.getProjects());
                      }} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition text-base" title="حذف المشروع">🗑️</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==================== PROJECT DETAIL ====================
function ProjectDetail({ projectId, user, onBack }) {
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('info');
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});
  const [showInvoice, setShowInvoice] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showVisit, setShowVisit] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ engineerId:'', phase:'', notes:'' });
  const [invForm, setInvForm] = useState({ amount:'', date:'', description:'', collected:false, invType:'عادية' });
  const [payForm, setPayForm] = useState({ amount:'', dueDate:'', description:'', paid:false });
  const [visitForm, setVisitForm] = useState({ date:'', time:'', location:'', purpose:'', notes:'' });
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ supplierId:'', name:'', supplyType:'', unitType:'piece', qty:'', pricePerUnit:'', notes:'' });
  const setSupFld = (k,v) => setSupplierForm(f=>({...f,[k]:v}));

  const load = () => {
    const p = DB.getProjects().find(x=>x.id===projectId);
    setProject(p);
    setForm(p ? {...p} : {});
  };
  useEffect(load, [projectId]);

  const engineer = project ? DB.getUsers().find(u=>u.id===project.engineerId) : null;
  const visits = DB.getVisits().filter(v=>v.projectId===projectId);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const canEdit              = user.role==='manager' || (user.role==='engineer' && project?.engineerId===user.id);
  const canFinance           = canEdit || user.role==='accountant';
  const canAddExtraInvoice   = canFinance || user.role==='engineer';

  const saveProject = () => {
    const projs = DB.getProjects().map(p=>p.id===projectId?{...form,updatedAt:new Date().toISOString().slice(0,10)}:p);
    DB.saveProjects(projs);
    setEditMode(false);
    load();
  };

  const addInvoice = () => {
    if (!invForm.amount||!invForm.date) return;
    const inv = {...invForm, id:uid()};
    const updated = {...project, invoices:[...(project.invoices||[]),inv], updatedAt:new Date().toISOString().slice(0,10)};
    DB.saveProjects(DB.getProjects().map(p=>p.id===projectId?updated:p));
    setShowInvoice(false);
    setInvForm({amount:'',date:'',description:'',collected:false,invType:'عادية'});
    load();
  };

  const toggleInvoice = (id) => {
    const updated = {...project, invoices:(project.invoices||[]).map(i=>i.id===id?{...i,collected:!i.collected}:i)};
    DB.saveProjects(DB.getProjects().map(p=>p.id===projectId?updated:p));
    load();
  };

  const deleteInvoice = (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;
    const updated = {...project, invoices:(project.invoices||[]).filter(i=>i.id!==id)};
    DB.saveProjects(DB.getProjects().map(p=>p.id===projectId?updated:p));
    load();
  };

  const addPayment = () => {
    if (!payForm.amount||!payForm.dueDate) return;
    const pay = {...payForm, id:uid()};
    const updated = {...project, payments:[...(project.payments||[]),pay], updatedAt:new Date().toISOString().slice(0,10)};
    DB.saveProjects(DB.getProjects().map(p=>p.id===projectId?updated:p));
    setShowPayment(false);
    setPayForm({amount:'',dueDate:'',description:'',paid:false});
    load();
  };

  const togglePayment = (id) => {
    const updated = {...project, payments:(project.payments||[]).map(pp=>pp.id===id?{...pp,paid:!pp.paid}:pp)};
    DB.saveProjects(DB.getProjects().map(p=>p.id===projectId?updated:p));
    load();
  };

  const addVisit = () => {
    if (!visitForm.date||!visitForm.location) return;
    const visit = {...visitForm, id:uid(), projectId, engineerId:user.id, createdAt:new Date().toISOString().slice(0,10)};
    DB.saveVisits([...DB.getVisits(), visit]);
    setShowVisit(false);
    setVisitForm({date:'',time:'',location:'',purpose:'',notes:''});
    load();
  };

  const transferProject = () => {
    if (!transferForm.engineerId) return;
    const rec = { id:uid(), fromEngineerId:project.engineerId, toEngineerId:transferForm.engineerId,
      phase:transferForm.phase, notes:transferForm.notes, date:new Date().toISOString().slice(0,10), by:user.name };
    const updated = { ...project, engineerId:transferForm.engineerId,
      transfers:[...(project.transfers||[]), rec], updatedAt:new Date().toISOString().slice(0,10) };
    DB.saveProjects(DB.getProjects().map(p=>p.id===projectId?updated:p));
    setShowTransfer(false);
    setTransferForm({engineerId:'',phase:'',notes:''});
    load();
  };

  const uploadFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10*1024*1024) { alert('الملف أكبر من 10MB'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const att = { id:uid(), name:file.name, type:file.type, size:file.size,
        data:ev.target.result, uploadedAt:new Date().toISOString().slice(0,10), uploadedBy:user.name };
      const updated = { ...project, attachments:[...(project.attachments||[]), att],
        updatedAt:new Date().toISOString().slice(0,10) };
      DB.saveProjects(DB.getProjects().map(p=>p.id===projectId?updated:p));
      load();
    };
    reader.readAsDataURL(file);
    e.target.value='';
  };

  const deleteFile = (fid) => {
    if (!confirm('حذف الملف؟')) return;
    const updated = { ...project, attachments:(project.attachments||[]).filter(a=>a.id!==fid) };
    DB.saveProjects(DB.getProjects().map(p=>p.id===projectId?updated:p));
    load();
  };

  const fmtSize = (b) => b>1024*1024 ? (b/1024/1024).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB';

  const addProjSupplier = () => {
    if (!supplierForm.name && !supplierForm.supplierId) return;
    let entry = { ...supplierForm, id: uid(), qty: Number(supplierForm.qty)||0, pricePerUnit: Number(supplierForm.pricePerUnit)||0 };
    if (supplierForm.supplierId) {
      const gs = DB.getSuppliers().find(s=>s.id===supplierForm.supplierId);
      if (gs) { entry.name = gs.name; entry.supplyType = entry.supplyType||gs.supplyType; entry.unitType = entry.unitType||gs.unitType; if(!entry.pricePerUnit) entry.pricePerUnit = Number(gs.pricePerUnit)||0; }
    }
    const updated = { ...project, projSuppliers: [...(project.projSuppliers||[]), entry] };
    DB.saveProjects(DB.getProjects().map(p=>p.id===projectId?updated:p));
    setSupplierForm({ supplierId:'', name:'', supplyType:'', unitType:'piece', qty:'', pricePerUnit:'', notes:'' });
    setShowAddSupplier(false); load();
  };

  const removeProjSupplier = (sid) => {
    if (!confirm('إزالة المورد من المشروع؟')) return;
    const updated = { ...project, projSuppliers: (project.projSuppliers||[]).filter(s=>s.id!==sid) };
    DB.saveProjects(DB.getProjects().map(p=>p.id===projectId?updated:p));
    load();
  };

  const exportQuote = () => {
    const ps = project.projSuppliers||[];
    const total = ps.reduce((s,r)=>s+(r.qty*r.pricePerUnit),0);
    const rows = ps.map((r,i)=>`
      <tr>
        <td>${i+1}</td><td>${r.name}</td><td>${r.supplyType||'-'}</td>
        <td>${r.qty}</td><td>${getLabelById(UNIT_TYPES,r.unitType)||r.unitType}</td>
        <td>${r.pricePerUnit.toLocaleString('ar-SA')} ر.س</td>
        <td><strong>${(r.qty*r.pricePerUnit).toLocaleString('ar-SA')} ر.س</strong></td>
      </tr>`).join('');
    const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
      <title>عرض سعر - ${project.clientName}</title>
      <style>
        body{font-family:Tajawal,Arial,sans-serif;margin:30px;color:#1e293b;direction:rtl}
        h1{color:#1e3a5f;font-size:22px;margin-bottom:4px}
        .meta{color:#64748b;font-size:13px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;font-size:14px}
        th{background:#1e3a5f;color:#fff;padding:10px 12px;text-align:right}
        td{padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right}
        tr:nth-child(even) td{background:#f8fafc}
        .total-row td{background:#eff6ff;font-weight:bold;color:#1e3a5f;font-size:15px}
        .footer{margin-top:30px;font-size:12px;color:#94a3b8;text-align:center}
        @media print{body{margin:15px}}
      </style></head><body>
      <h1>الحمدان للاستشارات الهندسية</h1>
      <div class="meta">
        عرض سعر للمشروع: <strong>${project.clientName}</strong> &nbsp;|&nbsp;
        رقم المشروع: ${project.projectNo} &nbsp;|&nbsp;
        التاريخ: ${new Date().toLocaleDateString('ar-SA')}
      </div>
      <table>
        <thead><tr><th>#</th><th>المورد</th><th>المواد / الخدمة</th><th>الكمية</th><th>الوحدة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
        <tbody>${rows}
          <tr class="total-row"><td colspan="6" style="text-align:left">الإجمالي الكلي</td><td>${total.toLocaleString('ar-SA')} ر.س</td></tr>
        </tbody>
      </table>
      <div class="footer">الحمدان للاستشارات الهندسية — وثيقة عرض سعر</div>
      <` + `script>window.onload=()=>window.print();<` + `/script>
      </body></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close();
  };

  if (!project) return <div className="text-center py-20 text-slate-400">جاري التحميل...</div>;

  const totalCollected = (project.invoices||[]).filter(i=>i.collected).reduce((s,i)=>s+Number(i.amount),0);
  const totalRemaining = (project.payments||[]).filter(pp=>!pp.paid).reduce((s,pp)=>s+Number(pp.amount),0);
  const isAC = project.department === 'ac';

  const tabs = [
    {id:'info',label:'معلومات المشروع'},
    {id:'finance',label:'المالية'},
    {id:'visits',label:`الزيارات الميدانية (${visits.length})`},
    {id:'files',label:`الملفات ${(project.attachments||[]).length>0?'('+project.attachments.length+')':''}`},
    ...(isAC ? [{id:'suppliers',label:`الموردين وعروض الأسعار ${(project.projSuppliers||[]).length>0?'('+(project.projSuppliers.length)+')':''}`}] : []),
  ];

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center bg-white rounded-xl card-shadow text-slate-500 hover:text-slate-700 transition">←</button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-800">{project.clientName}</h2>
            <Badge status={project.status}/>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${project.type==='new'?'bg-blue-50 text-blue-600':'bg-amber-50 text-amber-600'}`}>{getProjectTypeLabel(project.type,project.department)}</span>
          </div>
          <div className="text-slate-500 text-sm mt-1">{project.projectNo} · {getLabelById(ALL_SERVICE_TYPES,project.serviceType)} · {getLabelById(DEPARTMENTS,project.department)}</div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {editMode ? (
              <>
                <Btn onClick={saveProject}>💾 حفظ</Btn>
                <Btn variant="secondary" onClick={()=>{setEditMode(false);setForm({...project});}}>إلغاء</Btn>
              </>
            ) : (
              <>
                <Btn variant="secondary" onClick={()=>setEditMode(true)}>✏️ تعديل</Btn>
                <Btn variant="secondary" onClick={()=>setShowTransfer(true)}>🔄 تسليم المرحلة</Btn>
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl card-shadow p-4 text-center">
          <div className="text-xl font-bold text-blue-600">{fmt(project.budget)}</div>
          <div className="text-xs text-slate-500 mt-1">الميزانية (ر.س)</div>
        </div>
        <div className="bg-white rounded-xl card-shadow p-4 text-center">
          <div className="text-xl font-bold text-emerald-600">{fmt(totalCollected)}</div>
          <div className="text-xs text-slate-500 mt-1">محصل (ر.س)</div>
        </div>
        <div className="bg-white rounded-xl card-shadow p-4 text-center">
          <div className="text-xl font-bold text-amber-600">{fmt(totalRemaining)}</div>
          <div className="text-xs text-slate-500 mt-1">متبقي (ر.س)</div>
        </div>
        <div className="bg-white rounded-xl card-shadow p-4 text-center">
          <div className="text-xl font-bold text-slate-700">{visits.length}</div>
          <div className="text-xs text-slate-500 mt-1">زيارة ميدانية</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab===t.id?'bg-white text-blue-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab==='info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-2xl card-shadow p-5 space-y-4">
            <h3 className="font-bold text-slate-700">معلومات المشروع</h3>
            {editMode ? (
              <div className="space-y-3">
                <Input label="اسم العميل" value={form.clientName} onChange={e=>set('clientName',e.target.value)} required/>
                <Input label="جوال العميل" value={form.clientPhone||''} onChange={e=>set('clientPhone',e.target.value)}/>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="نوع المشروع" value={form.type} onChange={e=>set('type',e.target.value)}>
                    {form.department==='ac'
                      ? <><option value="new">مشروع جديد</option><option value="old">مشروع قائم</option></>
                      : <><option value="new">جديد</option><option value="old">قديم</option></>
                    }
                  </Select>
                  <Select label="القسم" value={form.department} onChange={e=>{set('department',e.target.value); set('serviceType','');}}>
                    {DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
                  </Select>
                </div>
                <Select label="نوع الخدمة" value={form.serviceType} onChange={e=>set('serviceType',e.target.value)}>
                  <option value="">اختر الخدمة</option>
                  {getServiceTypes(form.department).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
                <Select label="حالة المشروع" value={form.status} onChange={e=>set('status',e.target.value)}>
                  {PROJECT_STATUSES.filter(s=>s.id!=='completed'||user?.role==='manager').map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
                <Select label="حالة المخطط" value={form.planStatus} onChange={e=>set('planStatus',e.target.value)}>
                  {PLAN_STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="clientApproval" checked={form.clientApproval} onChange={e=>set('clientApproval',e.target.checked)} className="w-4 h-4"/>
                  <label htmlFor="clientApproval" className="text-sm font-medium text-slate-700">موافقة العميل</label>
                </div>
                <Input label="الميزانية الإجمالية (ر.س)" type="number" value={form.budget} onChange={e=>set('budget',e.target.value)}/>
                {form.department==='ac' && (
                  <div className="border border-blue-100 bg-blue-50/50 rounded-2xl p-4 space-y-4">
                    <div className="font-semibold text-blue-700 text-sm">❄️ تفاصيل أعمال التكييف</div>
                    <Select label="نوع التكييف" value={form.acType||''} onChange={e=>set('acType',e.target.value)}>
                      <option value="">اختر نوع التكييف</option>
                      {AC_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                    </Select>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">الخدمات الجانبية</label>
                      <div className="grid grid-cols-2 gap-2">
                        {AC_SERVICES.map(s=>(
                          <label key={s.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition">
                            <input type="checkbox" checked={(form.acServices||[]).includes(s.id)}
                              onChange={e=>{ const cur=form.acServices||[]; set('acServices',e.target.checked?[...cur,s.id]:cur.filter(x=>x!==s.id)); }}
                              className="w-4 h-4 accent-blue-600"/>
                            <span className="text-sm text-slate-700">{s.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <Input label="عدد الوحدات" type="number" value={form.acUnits||''} onChange={e=>set('acUnits',e.target.value)} placeholder="عدد وحدات التكييف"/>
                    <Input label="السعة (طن / BTU)" value={form.acCapacity||''} onChange={e=>set('acCapacity',e.target.value)} placeholder="مثال: 2 طن / 24000 BTU"/>
                  </div>
                )}
                <Textarea label="ملاحظات" value={form.notes||''} onChange={e=>set('notes',e.target.value)}/>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  ['العميل', project.clientName],
                  ['جوال العميل', project.clientPhone||'-'],
                  ['نوع المشروع', getProjectTypeLabel(project.type, project.department)],
                  ['القسم', getLabelById(DEPARTMENTS,project.department)],
                  ['نوع الخدمة', getLabelById(ALL_SERVICE_TYPES,project.serviceType)],
                  ['حالة المشروع', getLabelById(PROJECT_STATUSES,project.status)],
                  ['حالة المخطط', getLabelById(PLAN_STATUSES,project.planStatus||'not_started')],
                  ['موافقة العميل', project.clientApproval?'✅ موافق':'⭕ لم يوافق بعد'],
                  ['الميزانية الإجمالية', `${fmt(project.budget)} ر.س`],
                  ['تاريخ الإنشاء', fmtDate(project.createdAt)],
                  ['آخر تحديث', fmtDate(project.updatedAt)],
                ].map(([k,v])=>(
                  <div key={k} className="flex justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-slate-500 text-sm">{k}</span>
                    <span className="font-medium text-slate-700 text-sm text-left">{v}</span>
                  </div>
                ))}
                {project.department==='ac' && (project.acType||project.acServices?.length||project.acUnits||project.acCapacity) && (
                  <div className="bg-blue-50 rounded-2xl p-4 space-y-2 mt-2">
                    <div className="font-semibold text-blue-700 text-sm mb-3">❄️ تفاصيل أعمال التكييف</div>
                    {project.acType && (
                      <div className="flex justify-between py-1 border-b border-blue-100">
                        <span className="text-slate-500 text-sm">نوع التكييف</span>
                        <span className="font-medium text-slate-700 text-sm">{getLabelById(AC_TYPES,project.acType)}</span>
                      </div>
                    )}
                    {project.acUnits && (
                      <div className="flex justify-between py-1 border-b border-blue-100">
                        <span className="text-slate-500 text-sm">عدد الوحدات</span>
                        <span className="font-medium text-slate-700 text-sm">{project.acUnits} وحدة</span>
                      </div>
                    )}
                    {project.acCapacity && (
                      <div className="flex justify-between py-1 border-b border-blue-100">
                        <span className="text-slate-500 text-sm">السعة</span>
                        <span className="font-medium text-slate-700 text-sm">{project.acCapacity}</span>
                      </div>
                    )}
                    {project.acServices?.length > 0 && (
                      <div className="pt-1">
                        <div className="text-slate-500 text-sm mb-2">الخدمات الجانبية</div>
                        <div className="flex flex-wrap gap-2">
                          {project.acServices.map(sid=>(
                            <span key={sid} className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-medium">{getLabelById(AC_SERVICES,sid)}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {project.notes && (
                  <div className="bg-blue-50 rounded-xl p-3 text-sm text-slate-600">
                    <div className="font-semibold text-blue-700 mb-1">ملاحظات:</div>
                    {project.notes}
                  </div>
                )}
                {project.planFile && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm flex items-center gap-3">
                    <span className="text-2xl">📎</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-amber-800">مخطط المشروع</div>
                      <div className="text-amber-600 text-xs truncate">{project.planFile.name} ({(project.planFile.size/1024).toFixed(0)} KB)</div>
                    </div>
                    <button onClick={()=>{
                      try {
                        const parts = project.planFile.data.split(',');
                        const mime = parts[0].match(/:(.*?);/)[1];
                        const bytes = atob(parts[1]);
                        const buf = new Uint8Array(bytes.length);
                        for(let i=0;i<bytes.length;i++) buf[i]=bytes.charCodeAt(i);
                        const blob = new Blob([buf],{type:mime});
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href=url; a.download=project.planFile.name; a.click();
                        setTimeout(()=>URL.revokeObjectURL(url),1000);
                      } catch { window.open(project.planFile.data,'_blank'); }
                    }} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shrink-0 transition">
                      ⬇️ تحميل
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl card-shadow p-5">
            <h3 className="font-bold text-slate-700 mb-4">المهندس المسؤول</h3>
            {engineer && (
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                <div className="w-14 h-14 rounded-2xl gradient-blue flex items-center justify-center text-white font-bold text-xl">{engineer.name.charAt(0)}</div>
                <div>
                  <div className="font-bold text-slate-800">{engineer.name}</div>
                  <div className="text-slate-500 text-sm">{getLabelById(DEPARTMENTS,engineer.department)}</div>
                  {engineer.phone && <div className="text-xs text-slate-400 mt-1">📞 {engineer.phone}</div>}
                  {engineer.email && <div className="text-xs text-slate-400">✉️ {engineer.email}</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab==='finance' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Invoices */}
          <div className="bg-white rounded-2xl card-shadow p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700">الفواتير المحصلة</h3>
              <div className="flex gap-2">
                {canFinance && <Btn size="sm" onClick={()=>{ setInvForm(f=>({...f,invType:'عادية'})); setShowInvoice(true); }}>➕ فاتورة</Btn>}
                {canAddExtraInvoice && <Btn size="sm" variant="secondary" onClick={()=>{ setInvForm(f=>({...f,invType:'أعمال إضافية'})); setShowInvoice(true); }}>⚡ أعمال إضافية</Btn>}
              </div>
            </div>
            {(project.invoices||[]).length===0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">لا توجد فواتير</div>
            ) : (
              <div className="space-y-3">
                {(project.invoices||[]).map(inv=>(
                  <div key={inv.id} className={`flex items-center gap-3 p-3 rounded-xl border ${inv.collected?'border-emerald-200 bg-emerald-50':'border-slate-200 bg-slate-50'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 text-sm">{inv.description||'فاتورة'}</span>
                        {inv.invType && inv.invType !== 'عادية' && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">{inv.invType}</span>}
                      </div>
                      <div className="text-xs text-slate-400">{fmtDate(inv.date)}</div>
                    </div>
                    <div className="font-bold text-slate-700">{fmt(inv.amount)} ر.س</div>
                    {canFinance && (
                      <button onClick={()=>toggleInvoice(inv.id)} className={`text-xs px-2 py-1 rounded-lg font-medium transition ${inv.collected?'bg-emerald-100 text-emerald-700 hover:bg-emerald-200':'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                        {inv.collected?'✅ محصلة':'⭕ غير محصلة'}
                      </button>
                    )}
                    {(user.role==='manager'||user.role==='accountant') && (
                      <button onClick={()=>deleteInvoice(inv.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition" title="حذف الفاتورة">🗑️</button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-slate-100 font-bold text-sm">
                  <span>إجمالي المحصل</span>
                  <span className="text-emerald-600">{fmt(totalCollected)} ر.س</span>
                </div>
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="bg-white rounded-2xl card-shadow p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-700">جدول الدفعات</h3>
              {canFinance && <Btn size="sm" onClick={()=>setShowPayment(true)}>➕ دفعة</Btn>}
            </div>
            {(project.payments||[]).length===0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">لا توجد دفعات مجدولة</div>
            ) : (
              <div className="space-y-3">
                {(project.payments||[]).map(pp=>(
                  <div key={pp.id} className={`flex items-center gap-3 p-3 rounded-xl border ${pp.paid?'border-blue-200 bg-blue-50':'border-amber-200 bg-amber-50'}`}>
                    <div className="flex-1">
                      <div className="font-semibold text-slate-700 text-sm">{pp.description||'دفعة'}</div>
                      <div className="text-xs text-slate-400">موعد الاستحقاق: {fmtDate(pp.dueDate)}</div>
                    </div>
                    <div className="font-bold text-slate-700">{fmt(pp.amount)} ر.س</div>
                    {canFinance && (
                      <button onClick={()=>togglePayment(pp.id)} className={`text-xs px-2 py-1 rounded-lg font-medium transition ${pp.paid?'bg-blue-100 text-blue-700 hover:bg-blue-200':'bg-amber-100 text-amber-700 hover:bg-amber-200'}`}>
                        {pp.paid?'✅ مدفوعة':'⏳ معلقة'}
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-slate-100 font-bold text-sm">
                  <span>إجمالي المتبقي</span>
                  <span className="text-amber-600">{fmt(totalRemaining)} ر.س</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab==='visits' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-700">الزيارات الميدانية</h3>
            {canEdit && <Btn onClick={()=>setShowVisit(true)}>➕ تسجيل زيارة</Btn>}
          </div>
          {visits.length===0 ? (
            <div className="bg-white rounded-2xl card-shadow text-center py-12 text-slate-400">لا توجد زيارات ميدانية</div>
          ) : (
            <div className="space-y-3">
              {visits.map(v=>(
                <div key={v.id} className="bg-white rounded-2xl card-shadow p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">🗺️</div>
                    <div className="flex-1">
                      <div className="flex gap-3 items-center flex-wrap">
                        <span className="font-semibold text-slate-700">{v.location}</span>
                        <span className="text-xs text-slate-400">{fmtDate(v.date)} {v.time && `الساعة ${v.time}`}</span>
                      </div>
                      {v.purpose && <div className="text-sm text-slate-600 mt-1">الغرض: {v.purpose}</div>}
                      {v.notes && <div className="text-sm text-slate-500 mt-1 bg-slate-50 rounded-lg p-2">{v.notes}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Files Tab */}
      {tab==='files' && (
        <div className="space-y-4">
          {/* Upload */}
          {canEdit && (
            <div className="bg-white rounded-2xl card-shadow p-5">
              <h3 className="font-bold text-slate-700 mb-4">📎 رفع ملف</h3>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-blue-200 rounded-2xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition">
                <div className="text-center">
                  <div className="text-3xl mb-1">⬆️</div>
                  <div className="text-sm font-medium text-blue-600">اضغط لرفع ملف</div>
                  <div className="text-xs text-slate-400 mt-1">تصميم، رخصة، مخططات — حد أقصى 10MB</div>
                </div>
                <input type="file" className="hidden" onChange={uploadFile} accept=".pdf,.jpg,.jpeg,.png,.dwg,.doc,.docx,.xls,.xlsx"/>
              </label>
            </div>
          )}

          {/* Files list */}
          {(project.attachments||[]).length === 0 ? (
            <div className="bg-white rounded-2xl card-shadow p-10 text-center text-slate-400">
              <div className="text-4xl mb-2">📁</div>
              <div>لا توجد ملفات مرفقة بعد</div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl card-shadow p-5 space-y-3">
              <h3 className="font-bold text-slate-700 mb-2">الملفات المرفقة</h3>
              {(project.attachments||[]).map(att=>{
                const isImg = att.type?.startsWith('image/');
                const isPdf = att.type==='application/pdf';
                const icon = isPdf?'📄':isImg?'🖼️':'📎';
                return (
                  <div key={att.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition">
                    <div className="text-2xl">{icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-700 text-sm truncate">{att.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{fmtSize(att.size)} · {att.uploadedAt} · {att.uploadedBy}</div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <a href={att.data} download={att.name}
                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium">تنزيل</a>
                      {canEdit && (
                        <button onClick={()=>deleteFile(att.id)}
                          className="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition font-medium">حذف</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Transfer history */}
          {(project.transfers||[]).length > 0 && (
            <div className="bg-white rounded-2xl card-shadow p-5">
              <h3 className="font-bold text-slate-700 mb-3">🔄 سجل تسليم المراحل</h3>
              <div className="space-y-3">
                {(project.transfers||[]).map((tr, idx)=>{
                  const from = DB.getUsers().find(u=>u.id===tr.fromEngineerId);
                  const to   = DB.getUsers().find(u=>u.id===tr.toEngineerId);
                  return (
                    <div key={tr.id} className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
                      <div className="w-7 h-7 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{idx+1}</div>
                      <div className="flex-1">
                        <div className="text-sm font-bold text-slate-700 mb-1">{tr.phase||'مرحلة'}</div>
                        <div className="text-sm text-slate-600">
                          سلّم: <span className="font-medium text-amber-700">{from?.name||'-'}</span>
                          <span className="mx-2 text-slate-300">←</span>
                          استلم: <span className="font-medium text-emerald-700">{to?.name||'-'}</span>
                        </div>
                        {tr.notes && <div className="text-xs text-slate-500 mt-1 bg-white rounded-lg p-2">{tr.notes}</div>}
                        <div className="text-xs text-slate-400 mt-1">{tr.date} · {tr.by}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suppliers & Quotation Tab */}
      {tab==='suppliers' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-700">📦 الموردين المرتبطين بالمشروع</h3>
              <p className="text-xs text-slate-400 mt-0.5">أضف الموردين والكميات لإنشاء عرض سعر</p>
            </div>
            <div className="flex gap-2">
              {(project.projSuppliers||[]).length>0 && (
                <button onClick={exportQuote} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition">🖨️ طباعة عرض السعر</button>
              )}
              {canEdit && (
                <Btn onClick={()=>{setSupplierForm({supplierId:'',name:'',supplyType:'',unitType:'piece',qty:'',pricePerUnit:'',notes:''});setShowAddSupplier(true);}}>➕ إضافة مورد</Btn>
              )}
            </div>
          </div>

          {(project.projSuppliers||[]).length===0 ? (
            <div className="bg-white rounded-2xl card-shadow p-10 text-center text-slate-400">
              <div className="text-4xl mb-2">📦</div>
              <div>لم يُضف أي مورد لهذا المشروع بعد</div>
              <div className="text-xs mt-1">أضف الموردين مع الكميات والأسعار لتتمكن من طباعة عرض سعر</div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl card-shadow overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-100">
                <div className="col-span-3">المورد</div>
                <div className="col-span-2">المواد / الخدمة</div>
                <div className="col-span-1">الكمية</div>
                <div className="col-span-1">الوحدة</div>
                <div className="col-span-2">سعر الوحدة</div>
                <div className="col-span-2">الإجمالي</div>
                <div className="col-span-1"></div>
              </div>
              {(project.projSuppliers||[]).map(r=>{
                const lineTotal = (Number(r.qty)||0)*(Number(r.pricePerUnit)||0);
                return (
                  <div key={r.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 px-5 py-4 border-b border-slate-50 hover:bg-slate-50/50 transition items-center">
                    <div className="md:col-span-3 font-semibold text-slate-800 text-sm">{r.name}</div>
                    <div className="md:col-span-2 text-sm text-slate-600">{r.supplyType||'-'}</div>
                    <div className="md:col-span-1 text-sm font-medium">{r.qty}</div>
                    <div className="md:col-span-1"><span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">{getLabelById(UNIT_TYPES,r.unitType)||r.unitType}</span></div>
                    <div className="md:col-span-2 text-sm text-blue-700 font-medium">{fmt(r.pricePerUnit)} ر.س</div>
                    <div className="md:col-span-2 text-sm font-bold text-emerald-700">{fmt(lineTotal)} ر.س</div>
                    <div className="md:col-span-1 flex justify-end">
                      {canEdit && <button onClick={()=>removeProjSupplier(r.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition text-sm">🗑️</button>}
                    </div>
                    {r.notes && <div className="md:col-span-12 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-1.5">{r.notes}</div>}
                  </div>
                );
              })}
              <div className="px-5 py-4 bg-blue-50 border-t-2 border-blue-200 flex justify-between items-center">
                <span className="font-bold text-slate-700">الإجمالي الكلي</span>
                <span className="text-xl font-bold text-blue-700">{fmt((project.projSuppliers||[]).reduce((s,r)=>s+(Number(r.qty)||0)*(Number(r.pricePerUnit)||0),0))} ر.س</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Supplier to Project Modal */}
      <Modal open={showAddSupplier} onClose={()=>setShowAddSupplier(false)} title="إضافة مورد للمشروع">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">اختر من قائمة الموردين (اختياري)</label>
            <select className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={supplierForm.supplierId}
              onChange={e=>{
                const sid=e.target.value; setSupFld('supplierId',sid);
                if(sid){ const gs=DB.getSuppliers().find(s=>s.id===sid); if(gs){ setSupplierForm(f=>({...f,supplierId:sid,name:gs.name,supplyType:gs.supplyType||'',unitType:gs.unitType||'piece',pricePerUnit:gs.pricePerUnit||''})); } }
              }}>
              <option value="">— إدخال يدوي أو اختر مورد —</option>
              {DB.getSuppliers().map(s=><option key={s.id} value={s.id}>{s.name} — {s.supplyType||'—'}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="اسم المورد" value={supplierForm.name} onChange={e=>setSupFld('name',e.target.value)} required/>
            <Input label="المواد / الخدمة" value={supplierForm.supplyType} onChange={e=>setSupFld('supplyType',e.target.value)}/>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="الكمية" type="number" value={supplierForm.qty} onChange={e=>setSupFld('qty',e.target.value)} placeholder="0"/>
            <Select label="الوحدة" value={supplierForm.unitType} onChange={e=>setSupFld('unitType',e.target.value)}>
              {UNIT_TYPES.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}
            </Select>
            <Input label="سعر الوحدة (ر.س)" type="number" value={supplierForm.pricePerUnit} onChange={e=>setSupFld('pricePerUnit',e.target.value)} placeholder="0"/>
          </div>
          {(Number(supplierForm.qty)||0)>0 && (Number(supplierForm.pricePerUnit)||0)>0 && (
            <div className="bg-blue-50 rounded-xl px-4 py-3 text-sm font-bold text-blue-700">
              الإجمالي: {fmt((Number(supplierForm.qty))*(Number(supplierForm.pricePerUnit)))} ر.س
            </div>
          )}
          <Textarea label="ملاحظات" value={supplierForm.notes} onChange={e=>setSupFld('notes',e.target.value)} placeholder="شروط الدفع، موعد التسليم..."/>
          <div className="flex gap-3">
            <Btn onClick={addProjSupplier} className="flex-1">✅ إضافة</Btn>
            <Btn variant="secondary" onClick={()=>setShowAddSupplier(false)} className="flex-1">إلغاء</Btn>
          </div>
        </div>
      </Modal>

      {/* Modals */}
      <Modal open={showInvoice} onClose={()=>setShowInvoice(false)} title={invForm.invType==='أعمال إضافية' ? '⚡ فاتورة أعمال إضافية' : '➕ إضافة فاتورة'}>
        <div className="space-y-4">
          <Select label="نوع الفاتورة" value={invForm.invType} onChange={e=>setInvForm(f=>({...f,invType:e.target.value}))}>
            <option value="عادية">عادية</option>
            <option value="أعمال إضافية">أعمال إضافية</option>
            <option value="دفعة أولى">دفعة أولى</option>
            <option value="دفعة نهائية">دفعة نهائية</option>
          </Select>
          <Input label="المبلغ (ر.س)" type="number" value={invForm.amount} onChange={e=>setInvForm(f=>({...f,amount:e.target.value}))} required/>
          <Input label="التاريخ" type="date" value={invForm.date} onChange={e=>setInvForm(f=>({...f,date:e.target.value}))} required/>
          <Input label="الوصف" value={invForm.description} onChange={e=>setInvForm(f=>({...f,description:e.target.value}))} placeholder="تفاصيل الفاتورة..."/>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="collected" checked={invForm.collected} onChange={e=>setInvForm(f=>({...f,collected:e.target.checked}))} className="w-4 h-4"/>
            <label htmlFor="collected" className="text-sm font-medium">تم التحصيل</label>
          </div>
          <div className="flex gap-3"><Btn onClick={addInvoice} className="flex-1">إضافة</Btn><Btn variant="secondary" onClick={()=>setShowInvoice(false)} className="flex-1">إلغاء</Btn></div>
        </div>
      </Modal>

      <Modal open={showPayment} onClose={()=>setShowPayment(false)} title="إضافة دفعة مجدولة">
        <div className="space-y-4">
          <Input label="المبلغ (ر.س)" type="number" value={payForm.amount} onChange={e=>setPayForm(f=>({...f,amount:e.target.value}))} required/>
          <Input label="موعد الاستحقاق" type="date" value={payForm.dueDate} onChange={e=>setPayForm(f=>({...f,dueDate:e.target.value}))} required/>
          <Input label="الوصف" value={payForm.description} onChange={e=>setPayForm(f=>({...f,description:e.target.value}))}/>
          <div className="flex gap-3"><Btn onClick={addPayment} className="flex-1">إضافة</Btn><Btn variant="secondary" onClick={()=>setShowPayment(false)} className="flex-1">إلغاء</Btn></div>
        </div>
      </Modal>

      <Modal open={showVisit} onClose={()=>setShowVisit(false)} title="تسجيل زيارة ميدانية">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="التاريخ" type="date" value={visitForm.date} onChange={e=>setVisitForm(f=>({...f,date:e.target.value}))} required/>
            <Input label="الوقت" type="time" value={visitForm.time} onChange={e=>setVisitForm(f=>({...f,time:e.target.value}))}/>
          </div>
          <Input label="الموقع" value={visitForm.location} onChange={e=>setVisitForm(f=>({...f,location:e.target.value}))} placeholder="المدينة - الحي" required/>
          <Input label="الغرض من الزيارة" value={visitForm.purpose} onChange={e=>setVisitForm(f=>({...f,purpose:e.target.value}))}/>
          <Textarea label="ملاحظات" value={visitForm.notes} onChange={e=>setVisitForm(f=>({...f,notes:e.target.value}))}/>
          <div className="flex gap-3"><Btn onClick={addVisit} className="flex-1">تسجيل</Btn><Btn variant="secondary" onClick={()=>setShowVisit(false)} className="flex-1">إلغاء</Btn></div>
        </div>
      </Modal>

      {/* Transfer / Phase Handoff Modal */}
      <Modal open={showTransfer} onClose={()=>setShowTransfer(false)} title="🔄 تسليم مرحلة وتحويل المشروع">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800 space-y-1">
            <div className="font-bold mb-1">كيف يعمل التسليم؟</div>
            <div>• المهندس الحالي ينهي مرحلته ويسلّمها</div>
            <div>• يختار المهندس الذي سيكمل المرحلة التالية</div>
            <div>• يسجل السيستم سجل كامل لكل التسليمات</div>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">
            المهندس الحالي (المُسلِّم): <span className="font-bold">{DB.getUsers().find(u=>u.id===project?.engineerId)?.name||'-'}</span>
          </div>
          <Input label="المرحلة المنتهية" value={transferForm.phase} onChange={e=>setTransferForm(f=>({...f,phase:e.target.value}))} placeholder="مثال: مرحلة التصميم، إعداد المخططات، الإشراف الميداني..." required/>
          <Select label="يستلم المرحلة التالية" value={transferForm.engineerId} onChange={e=>setTransferForm(f=>({...f,engineerId:e.target.value}))} required>
            <option value="">اختر المهندس المستلم</option>
            {DB.getUsers().filter(u=>u.role==='engineer'&&u.id!==project?.engineerId).map(e=>(
              <option key={e.id} value={e.id}>{e.name} — {getLabelById(DEPARTMENTS,e.department)}</option>
            ))}
          </Select>
          <Textarea label="ملاحظات التسليم" value={transferForm.notes} onChange={e=>setTransferForm(f=>({...f,notes:e.target.value}))} placeholder="تعليمات للمهندس المستلم، ما تم إنجازه، ما تبقى..."/>
          <div className="flex gap-3">
            <Btn onClick={transferProject} className="flex-1" disabled={!transferForm.engineerId||!transferForm.phase}>✅ تأكيد التسليم</Btn>
            <Btn variant="secondary" onClick={()=>setShowTransfer(false)} className="flex-1">إلغاء</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ==================== ADD PROJECT ====================
function AddProject({ user, onSave, onCancel }) {
  const engineers = DB.getUsers().filter(u=>u.role==='engineer');
  const [form, setForm] = useState({
    projectNo:`HEC-${String(DB.getProjects().length+1).padStart(3,'0')}`,
    clientName:'', clientPhone:'', type:'new',
    department: user.role==='engineer' ? user.department : 'consulting',
    serviceType: (user.role==='engineer' && user.department==='ac') ? '' : 'license',
    status:'new', planStatus:'not_started',
    clientApproval:false, budget:'', notes:'',
    engineerId: user.role==='engineer' ? user.id : '',
  });
  const [err, setErr] = useState('');
  const [planFile, setPlanFile] = useState(null); // { name, type, size, data(base64) }
  const [planLoading, setPlanLoading] = useState(false);

  const handlePlanFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('الملف كبير جداً — الحد الأقصى 10 ميجا'); return; }
    setPlanLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPlanFile({ name: file.name, type: file.type, size: file.size, data: ev.target.result });
      setPlanLoading(false);
    };
    reader.readAsDataURL(file);
  };
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const save = () => {
    if (!form.clientName||!form.serviceType||!form.budget) { setErr('يرجى ملء جميع الحقول المطلوبة'); return; }
    if (!form.engineerId) { setErr('يرجى اختيار المهندس المسؤول'); return; }
    const newProj = {
      id:uid(), ...form,
      budget:Number(form.budget),
      invoices:[], payments:[],
      planFile: planFile || null,
      createdAt:new Date().toISOString().slice(0,10),
      updatedAt:new Date().toISOString().slice(0,10),
    };
    DB.saveProjects([...DB.getProjects(), newProj]);
    logActivity(user, 'added', 'project', form.clientName, form.projectNo);
    onSave(newProj);
  };

  return (
    <div className="fade-in space-y-5">
      <div className="flex items-center gap-4">
        <button onClick={onCancel} className="w-9 h-9 flex items-center justify-center bg-white rounded-xl card-shadow text-slate-500 hover:text-slate-700">←</button>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إضافة مشروع جديد</h2>
        </div>
      </div>
      <div className="bg-white rounded-2xl card-shadow p-6 max-w-3xl">
        <div className="space-y-5">
          {err && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{err}</div>}
          <div className="grid grid-cols-2 gap-4">
            <Input label="رقم المشروع" value={form.projectNo} onChange={e=>set('projectNo',e.target.value)} required/>
            <Select label="نوع المشروع" value={form.type} onChange={e=>set('type',e.target.value)} required>
              {form.department==='ac'
                ? <><option value="new">مشروع جديد</option><option value="old">مشروع قائم</option></>
                : <><option value="new">جديد</option><option value="old">قديم</option></>
              }
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="اسم العميل" value={form.clientName} onChange={e=>set('clientName',e.target.value)} required/>
            <Input label="جوال العميل" value={form.clientPhone} onChange={e=>set('clientPhone',e.target.value)}/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="القسم" value={form.department} onChange={e=>{set('department',e.target.value); set('serviceType','');}} required>
              {DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.label}</option>)}
            </Select>
            <Select label="نوع الخدمة" value={form.serviceType} onChange={e=>set('serviceType',e.target.value)} required>
              <option value="">اختر الخدمة</option>
              {getServiceTypes(form.department).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </div>
          {user.role==='manager' && (
            <Select label="المهندس المسؤول" value={form.engineerId} onChange={e=>set('engineerId',e.target.value)} required>
              <option value="">اختر المهندس</option>
              {engineers.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Select label="حالة المشروع" value={form.status} onChange={e=>set('status',e.target.value)}>
              {PROJECT_STATUSES.filter(s=>s.id!=='completed'||user?.role==='manager').map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <Select label="حالة المخطط" value={form.planStatus} onChange={e=>set('planStatus',e.target.value)}>
              {PLAN_STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
          </div>
          <Input label="الميزانية الإجمالية (ر.س)" type="number" value={form.budget} onChange={e=>set('budget',e.target.value)} required/>
          {/* AC-specific fields */}
          {form.department==='ac' && (
            <div className="border border-blue-100 bg-blue-50/50 rounded-2xl p-4 space-y-4">
              <div className="font-semibold text-blue-700 text-sm flex items-center gap-2">❄️ تفاصيل أعمال التكييف</div>
              <Select label="نوع التكييف" value={form.acType||''} onChange={e=>set('acType',e.target.value)}>
                <option value="">اختر نوع التكييف</option>
                {AC_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">الخدمات الجانبية</label>
                <div className="grid grid-cols-2 gap-2">
                  {AC_SERVICES.map(s=>(
                    <label key={s.id} className="flex items-center gap-2 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:border-blue-300 transition">
                      <input type="checkbox" checked={(form.acServices||[]).includes(s.id)}
                        onChange={e=>{
                          const cur = form.acServices||[];
                          set('acServices', e.target.checked ? [...cur,s.id] : cur.filter(x=>x!==s.id));
                        }} className="w-4 h-4 accent-blue-600"/>
                      <span className="text-sm text-slate-700">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Input label="عدد الوحدات" type="number" value={form.acUnits||''} onChange={e=>set('acUnits',e.target.value)} placeholder="عدد وحدات التكييف"/>
              <Input label="السعة (طن / BTU)" value={form.acCapacity||''} onChange={e=>set('acCapacity',e.target.value)} placeholder="مثال: 2 طن / 24000 BTU"/>
            </div>
          )}
          <div className="flex items-center gap-3">
            <input type="checkbox" id="newClientApproval" checked={form.clientApproval} onChange={e=>set('clientApproval',e.target.checked)} className="w-4 h-4"/>
            <label htmlFor="newClientApproval" className="text-sm font-medium text-slate-700">العميل وافق على المشروع</label>
          </div>
          <Textarea label="ملاحظات" value={form.notes} onChange={e=>set('notes',e.target.value)}/>
          {/* مخطط المشروع - اختياري */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">📎 مخطط المشروع <span className="text-slate-400 font-normal">(اختياري)</span></label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.dwg" onChange={handlePlanFile}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm file:ml-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:cursor-pointer cursor-pointer"/>
            {planLoading && <div className="text-xs text-blue-500 flex items-center gap-1">⏳ جاري تحميل الملف...</div>}
            {planFile && (
              <div className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2">
                ✅ <span className="font-medium">{planFile.name}</span> <span className="text-slate-400">({(planFile.size/1024).toFixed(0)} KB)</span>
                <button onClick={()=>setPlanFile(null)} className="mr-auto text-red-400 hover:text-red-600">✕</button>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Btn onClick={save} size="lg" className="flex-1">💾 حفظ المشروع</Btn>
            <Btn variant="secondary" onClick={onCancel} size="lg" className="flex-1">إلغاء</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== VISITS PAGE ====================
function VisitsPage({ user }) {
  const [allProjects, setAllProjects] = useState(DB.getProjects());
  const engineers = DB.getUsers().filter(u=>u.role==='engineer');
  const [allVisits, setAllVisits] = useState(DB.getVisits());
  useRealTimeSync(() => { setAllProjects(DB.getProjects()); setAllVisits(DB.getVisits()); });
  const [showAdd, setShowAdd] = useState(false);
  const [visitForm, setVisitForm] = useState({ projectId:'', date:'', time:'', location:'', purpose:'', notes:'' });
  const [err, setErr] = useState('');

  const visits = user.role==='engineer' ? allVisits.filter(v=>v.engineerId===user.id) : allVisits;
  const myProjects = user.role==='engineer' ? allProjects.filter(p=>p.engineerId===user.id) : allProjects;

  const reload = () => { setAllVisits(DB.getVisits()); setAllProjects(DB.getProjects()); };

  const getProject = (id) => allProjects.find(p=>p.id===id);
  const getEngineer = (id) => engineers.find(e=>e.id===id);

  const addVisit = () => {
    if (!visitForm.date || !visitForm.location) { setErr('يرجى تعبئة التاريخ والموقع'); return; }
    const visit = { ...visitForm, id:uid(), engineerId:user.id, createdAt:new Date().toISOString().slice(0,10) };
    DB.saveVisits([...DB.getVisits(), visit]);
    reload();
    setShowAdd(false);
    setVisitForm({ projectId:'', date:'', time:'', location:'', purpose:'', notes:'' });
    setErr('');
  };

  return (
    <div className="fade-in space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{user.role==='engineer'?'زياراتي الميدانية':'الزيارات الميدانية'}</h2>
          <p className="text-slate-500 text-sm mt-1">{visits.length} زيارة مسجلة</p>
        </div>
        {user.role==='engineer' && <Btn onClick={()=>setShowAdd(true)}>➕ تسجيل زيارة</Btn>}
      </div>

      {visits.length===0 ? (
        <div className="bg-white rounded-2xl card-shadow text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">🗺️</div>
          <div>لا توجد زيارات ميدانية مسجلة</div>
          {user.role==='engineer' && <button onClick={()=>setShowAdd(true)} className="mt-3 text-blue-500 text-sm underline">سجّل أول زيارة</button>}
        </div>
      ) : (
        <div className="space-y-3">
          {visits.sort((a,b)=>b.date.localeCompare(a.date)).map(v=>{
            const proj = getProject(v.projectId);
            const eng = getEngineer(v.engineerId);
            return (
              <div key={v.id} className="bg-white rounded-2xl card-shadow p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">🗺️</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-slate-700">{v.location}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{fmtDate(v.date)}{v.time && ` - ${v.time}`}</span>
                    </div>
                    <div className="text-sm text-slate-500 mt-1">
                      {proj ? <span>مشروع: <span className="text-blue-600 font-medium">{proj.clientName}</span> ({proj.projectNo})</span> : v.projectId ? null : <span className="text-slate-400">بدون مشروع محدد</span>}
                      {user.role==='manager' && eng && <span> · {eng.name}</span>}
                    </div>
                    {v.purpose && <div className="text-sm text-slate-600 mt-1">الغرض: {v.purpose}</div>}
                    {v.notes && <div className="text-sm text-slate-500 mt-2 bg-slate-50 rounded-xl p-3">{v.notes}</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="تسجيل زيارة ميدانية">
        <div className="space-y-4">
          {err && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">{err}</div>}
          <Select label="المشروع (اختياري)" value={visitForm.projectId} onChange={e=>setVisitForm(f=>({...f,projectId:e.target.value}))}>
            <option value="">بدون مشروع محدد</option>
            {myProjects.map(p=><option key={p.id} value={p.id}>{p.clientName} - {p.projectNo}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="التاريخ" type="date" value={visitForm.date} onChange={e=>setVisitForm(f=>({...f,date:e.target.value}))} required/>
            <Input label="الوقت" type="time" value={visitForm.time} onChange={e=>setVisitForm(f=>({...f,time:e.target.value}))}/>
          </div>
          <Input label="الموقع" value={visitForm.location} onChange={e=>setVisitForm(f=>({...f,location:e.target.value}))} placeholder="المدينة - الحي - العنوان" required/>
          <Input label="الغرض من الزيارة" value={visitForm.purpose} onChange={e=>setVisitForm(f=>({...f,purpose:e.target.value}))} placeholder="مثال: معاينة الموقع، متابعة التنفيذ..."/>
          <Textarea label="ملاحظات" value={visitForm.notes} onChange={e=>setVisitForm(f=>({...f,notes:e.target.value}))} placeholder="أي تفاصيل إضافية..."/>
          <div className="flex gap-3 pt-1">
            <Btn onClick={addVisit} className="flex-1">✅ تسجيل الزيارة</Btn>
            <Btn variant="secondary" onClick={()=>setShowAdd(false)} className="flex-1">إلغاء</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ==================== CLIENTS PAGE ====================
function ClientsPage({ onSelectProject }) {
  const [clients, setClients] = useState(DB.getClients());
  const [projects, setProjects] = useState(DB.getProjects());
  useRealTimeSync(() => { setClients(DB.getClients()); setProjects(DB.getProjects()); });
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name:'', phone:'', email:'', company:'', notes:'' });
  const [search, setSearch] = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  // Auto-sync clients from projects
  useEffect(() => {
    const stored = DB.getClients();
    const allProjs = DB.getProjects();
    let updated = [...stored];
    allProjs.forEach(p => {
      if (p.clientName && !updated.find(c => c.name === p.clientName)) {
        updated.push({ id: uid(), name: p.clientName, phone: p.clientPhone||'', email:'', company:'', notes:'', createdAt: p.createdAt||new Date().toISOString().slice(0,10) });
      }
    });
    if (updated.length !== stored.length) { DB.saveClients(updated); setClients(updated); }
  }, []);

  const addClient = () => {
    if (!form.name) return;
    const c = { ...form, id: uid(), createdAt: new Date().toISOString().slice(0,10) };
    const updated = [...DB.getClients(), c];
    DB.saveClients(updated); setClients(updated);
    logActivity(DB.getCurrentUser(), 'added', 'client', form.name, '');
    setForm({ name:'', phone:'', email:'', company:'', notes:'' }); setShowAdd(false);
  };

  const deleteClient = (id) => {
    if (!confirm('حذف العميل؟')) return;
    const updated = DB.getClients().filter(c=>c.id!==id);
    DB.saveClients(updated); setClients(updated);
  };

  const filtered = clients.filter(c => !search || c.name.includes(search) || (c.phone||'').includes(search));

  const getClientProjects = (name) => projects.filter(p => p.clientName === name);

  return (
    <div className="fade-in space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">🏢 العملاء</h2>
          <p className="text-slate-500 text-sm mt-1">{clients.length} عميل مسجل</p>
        </div>
        <Btn onClick={()=>setShowAdd(true)}>➕ عميل جديد</Btn>
      </div>

      <input className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        placeholder="بحث باسم العميل أو رقم الجوال..." value={search} onChange={e=>setSearch(e.target.value)}/>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-10 text-center text-slate-400">
          <div className="text-4xl mb-2">🏢</div><div>لا يوجد عملاء بعد</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(c => {
            const cProjects = getClientProjects(c.name);
            const totalBudget = cProjects.reduce((s,p)=>s+Number(p.budget||0),0);
            return (
              <div key={c.id} className="bg-white rounded-2xl card-shadow p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">{c.name.charAt(0)}</div>
                    <div>
                      <div className="font-bold text-slate-800">{c.name}</div>
                      {c.company && <div className="text-xs text-slate-400">{c.company}</div>}
                    </div>
                  </div>
                  <button onClick={()=>deleteClient(c.id)} className="text-slate-300 hover:text-red-400 transition text-sm p-1">🗑️</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  {c.phone && <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">📞 </span>{c.phone}</div>}
                  {c.email && <div className="bg-slate-50 rounded-lg p-2 truncate"><span className="text-slate-400">✉️ </span>{c.email}</div>}
                </div>
                <div className="border-t border-slate-50 pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-slate-500">المشاريع ({cProjects.length})</span>
                    {totalBudget>0 && <span className="text-xs font-bold text-blue-600">{fmt(totalBudget)} ر.س</span>}
                  </div>
                  {cProjects.length === 0 ? (
                    <div className="text-xs text-slate-300 text-center py-2">لا توجد مشاريع</div>
                  ) : (
                    <div className="space-y-1.5">
                      {cProjects.slice(0,3).map(p=>(
                        <button key={p.id} onClick={()=>onSelectProject(p)}
                          className="w-full flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 hover:bg-blue-50 transition">
                          <span className="text-slate-600 font-medium">{p.projectNo} — {getLabelById(ALL_SERVICE_TYPES,p.serviceType)}</span>
                          <Badge status={p.status}/>
                        </button>
                      ))}
                      {cProjects.length>3 && <div className="text-xs text-slate-400 text-center">+{cProjects.length-3} مشاريع أخرى</div>}
                    </div>
                  )}
                </div>
                {c.notes && <div className="mt-2 text-xs text-slate-400 bg-slate-50 rounded-lg p-2">{c.notes}</div>}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={()=>setShowAdd(false)} title="إضافة عميل جديد">
        <div className="space-y-4">
          <Input label="اسم العميل" value={form.name} onChange={e=>set('name',e.target.value)} required/>
          <div className="grid grid-cols-2 gap-3">
            <Input label="رقم الجوال" value={form.phone} onChange={e=>set('phone',e.target.value)}/>
            <Input label="البريد الإلكتروني" value={form.email} onChange={e=>set('email',e.target.value)}/>
          </div>
          <Input label="اسم الشركة / المنشأة" value={form.company} onChange={e=>set('company',e.target.value)}/>
          <Textarea label="ملاحظات" value={form.notes} onChange={e=>set('notes',e.target.value)}/>
          <div className="flex gap-3">
            <Btn onClick={addClient} className="flex-1">✅ حفظ</Btn>
            <Btn variant="secondary" onClick={()=>setShowAdd(false)} className="flex-1">إلغاء</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ==================== LEADS PAGE ====================
function LeadsPage() {
  const [leads, setLeads] = useState(DB.getLeads());
  useRealTimeSync(() => setLeads(DB.getLeads()));
  const [showAdd, setShowAdd] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ name:'', phone:'', company:'', serviceInterest:'', status:'contacted', notes:'', followUpDate:'' });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const reload = () => setLeads(DB.getLeads());

  const statusColors = { contacted:'bg-blue-50 text-blue-700 border-blue-200', interested:'bg-green-50 text-green-700 border-green-200', not_interested:'bg-slate-100 text-slate-500 border-slate-200', follow_up:'bg-amber-50 text-amber-700 border-amber-200' };

  const saveLead = () => {
    if (!form.name) return;
    if (editLead) {
      const updated = DB.getLeads().map(l=>l.id===editLead ? {...l,...form,updatedAt:new Date().toISOString().slice(0,10)} : l);
      DB.saveLeads(updated);
    } else {
      DB.saveLeads([...DB.getLeads(), {...form, id:uid(), createdAt:new Date().toISOString().slice(0,10)}]);
    }
    reload(); setShowAdd(false); setEditLead(null);
    setForm({ name:'', phone:'', company:'', serviceInterest:'', status:'contacted', notes:'', followUpDate:'' });
  };

  const openEdit = (l) => { setForm({...l}); setEditLead(l.id); setShowAdd(true); };

  const deleteLead = (id) => {
    if (!confirm('حذف العميل المحتمل؟')) return;
    DB.saveLeads(DB.getLeads().filter(l=>l.id!==id)); reload();
  };

  const updateStatus = (id, status) => {
    DB.saveLeads(DB.getLeads().map(l=>l.id===id?{...l,status,updatedAt:new Date().toISOString().slice(0,10)}:l));
    reload();
  };

  const filtered = filterStatus ? leads.filter(l=>l.status===filterStatus) : leads;
  const counts = LEAD_STATUSES.reduce((a,s)=>({...a,[s.id]:leads.filter(l=>l.status===s.id).length}),{});

  return (
    <div className="fade-in space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">🎯 العملاء المحتملين</h2>
          <p className="text-slate-500 text-sm mt-1">{leads.length} عميل محتمل</p>
        </div>
        <Btn onClick={()=>{setEditLead(null);setForm({name:'',phone:'',company:'',serviceInterest:'',status:'contacted',notes:'',followUpDate:''});setShowAdd(true);}}>➕ إضافة</Btn>
      </div>

      {/* Status filter cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {LEAD_STATUSES.map(s=>(
          <button key={s.id} onClick={()=>setFilterStatus(filterStatus===s.id?'':s.id)}
            className={`rounded-xl p-3 text-right border transition ${filterStatus===s.id?'ring-2 ring-blue-500':''} ${statusColors[s.id]||'bg-white border-slate-200'}`}>
            <div className="text-xl font-bold">{counts[s.id]||0}</div>
            <div className="text-xs font-medium mt-0.5">{s.label}</div>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-10 text-center text-slate-400">
          <div className="text-4xl mb-2">🎯</div><div>لا يوجد عملاء محتملين</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-100">
            <div className="col-span-3">الاسم</div><div className="col-span-2">الجوال</div>
            <div className="col-span-2">الخدمة المطلوبة</div><div className="col-span-2">الحالة</div>
            <div className="col-span-2">متابعة</div><div className="col-span-1"></div>
          </div>
          {filtered.map(l=>(
            <div key={l.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 px-5 py-4 border-b border-slate-50 hover:bg-slate-50/50 transition items-center">
              <div className="md:col-span-3">
                <div className="font-semibold text-slate-800 text-sm">{l.name}</div>
                {l.company && <div className="text-xs text-slate-400">{l.company}</div>}
              </div>
              <div className="md:col-span-2 text-sm text-slate-600">{l.phone||'-'}</div>
              <div className="md:col-span-2 text-xs text-slate-500">{l.serviceInterest||'-'}</div>
              <div className="md:col-span-2">
                <select value={l.status} onChange={e=>updateStatus(l.id,e.target.value)}
                  className={`text-xs px-2 py-1 rounded-lg border font-medium w-full ${statusColors[l.status]||''}`}>
                  {LEAD_STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 text-xs text-slate-500">{l.followUpDate?fmtDate(l.followUpDate):'-'}</div>
              <div className="md:col-span-1 flex gap-1 justify-end">
                <button onClick={()=>openEdit(l)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition text-sm">✏️</button>
                <button onClick={()=>deleteLead(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition text-sm">🗑️</button>
              </div>
              {l.notes && <div className="md:col-span-12 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-1.5 mt-1">{l.notes}</div>}
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={()=>{setShowAdd(false);setEditLead(null);}} title={editLead?'تعديل العميل المحتمل':'إضافة عميل محتمل'}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="الاسم" value={form.name} onChange={e=>set('name',e.target.value)} required/>
            <Input label="رقم الجوال" value={form.phone} onChange={e=>set('phone',e.target.value)}/>
          </div>
          <Input label="الشركة / المنشأة" value={form.company} onChange={e=>set('company',e.target.value)}/>
          <Input label="الخدمة التي يطلبها" value={form.serviceInterest} onChange={e=>set('serviceInterest',e.target.value)} placeholder="مثال: إشراف هندسي، تكييف مركزي..."/>
          <div className="grid grid-cols-2 gap-3">
            <Select label="الحالة" value={form.status} onChange={e=>set('status',e.target.value)}>
              {LEAD_STATUSES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </Select>
            <Input label="تاريخ المتابعة" type="date" value={form.followUpDate} onChange={e=>set('followUpDate',e.target.value)}/>
          </div>
          <Textarea label="ملاحظات" value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="تفاصيل الاستفسار أو الاتصال..."/>
          <div className="flex gap-3">
            <Btn onClick={saveLead} className="flex-1">✅ حفظ</Btn>
            <Btn variant="secondary" onClick={()=>{setShowAdd(false);setEditLead(null);}} className="flex-1">إلغاء</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ==================== SUPPLIERS PAGE ====================

// AC brands list for multi-select in AC supplier form
const AC_BRANDS_LIST = [
  'ميديا (Media)', 'توشيبا (Toshiba)', 'جري (Gree)', 'كاريير (Carrier)',
  'يورك (York)', 'داكين (Daikin)', 'ميتسوبيشي (Mitsubishi)', 'سامسونج (Samsung)',
  'ال جي (LG)', 'هيتاشي (Hitachi)', 'باناسونيك (Panasonic)', 'جنرال (General)',
  'كولر (Cooler Master)', 'أريستون (Ariston)',
];

const EMPTY_AC_SUP  = { category:'ac_brand', name:'', phone:'', email:'', products:[], commercialReg:'', paymentTerms:'', notes:'' };
const EMPTY_MAT_SUP = { category:'material', name:'', phone:'', email:'', products:[], paymentTerms:'', notes:'' };
const EMPTY_GEN_SUP = { category:'general',  name:'', phone:'', email:'', products:[], paymentTerms:'', notes:'' };

function SupplierCard({ s, onEdit, onDelete }) {
  const isAC = s.category === 'ac_brand';
  const products = s.products || [];
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 hover:shadow-md transition space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold text-slate-800 text-sm">{s.name}</div>
          {s.phone && <div className="text-xs text-slate-400 mt-0.5">📞 {s.phone}</div>}
          {s.email && <div className="text-xs text-slate-400">✉️ {s.email}</div>}
        </div>
        <div className="flex gap-1">
          <button onClick={()=>onEdit(s)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 text-sm transition">✏️</button>
          <button onClick={()=>onDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 text-sm transition">🗑️</button>
        </div>
      </div>

      {isAC ? (
        products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-blue-50 text-blue-700">
                  <th className="px-2 py-1 text-right font-semibold">الماركة</th>
                  <th className="px-2 py-1 text-right font-semibold">النوع</th>
                  <th className="px-2 py-1 text-right font-semibold">السعة</th>
                  <th className="px-2 py-1 text-right font-semibold">سعر التوريد</th>
                  <th className="px-2 py-1 text-right font-semibold">سعر البيع</th>
                  <th className="px-2 py-1 text-right font-semibold">ربح %</th>
                  <th className="px-2 py-1 text-right font-semibold">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p,i) => {
                  const profitPct = p.supplyPrice > 0 ? ((Number(p.salePrice||0)-Number(p.supplyPrice))/Number(p.supplyPrice)*100).toFixed(1) : null;
                  const profitColor = profitPct >= 20 ? 'text-emerald-600' : profitPct >= 10 ? 'text-amber-600' : 'text-red-500';
                  return (
                    <tr key={p.id||i} className={i%2===0?'bg-white':'bg-slate-50'}>
                      <td className="px-2 py-1 font-medium text-slate-700">{p.brand}</td>
                      <td className="px-2 py-1 text-slate-500">{p.acType||'-'}</td>
                      <td className="px-2 py-1 text-slate-500">{p.tons ? p.tons+' طن' : '-'}</td>
                      <td className="px-2 py-1 text-orange-700 font-semibold">{p.supplyPrice ? Number(p.supplyPrice).toLocaleString()+' ر.س' : '-'}</td>
                      <td className="px-2 py-1 text-blue-700 font-semibold">{p.salePrice ? Number(p.salePrice).toLocaleString()+' ر.س' : '-'}</td>
                      <td className={`px-2 py-1 font-bold ${profitColor}`}>{profitPct !== null ? profitPct+'%' : '-'}</td>
                      <td className="px-2 py-1 text-slate-400">{p.model||''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic bg-slate-50 rounded-lg px-3 py-2">لا توجد منتجات مضافة</div>
        )
      ) : (
        products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className="px-2 py-1 text-right font-semibold">البند</th>
                  <th className="px-2 py-1 text-right font-semibold">الوحدة</th>
                  <th className="px-2 py-1 text-right font-semibold">سعر التوريد</th>
                  <th className="px-2 py-1 text-right font-semibold">سعر البيع</th>
                  <th className="px-2 py-1 text-right font-semibold">ربح %</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p,i) => {
                  const profitPct = p.supplyPrice > 0 ? ((Number(p.salePrice||0)-Number(p.supplyPrice))/Number(p.supplyPrice)*100).toFixed(1) : null;
                  const profitColor = profitPct >= 20 ? 'text-emerald-600' : profitPct >= 10 ? 'text-amber-600' : 'text-red-500';
                  return (
                    <tr key={p.id||i} className={i%2===0?'bg-white':'bg-slate-50'}>
                      <td className="px-2 py-1 font-medium text-slate-700">{p.name}</td>
                      <td className="px-2 py-1 text-slate-500">{p.unit||'-'}</td>
                      <td className="px-2 py-1 text-orange-700 font-semibold">{p.supplyPrice ? Number(p.supplyPrice).toLocaleString()+' ر.س' : '-'}</td>
                      <td className="px-2 py-1 text-blue-700 font-semibold">{p.salePrice ? Number(p.salePrice).toLocaleString()+' ر.س' : '-'}</td>
                      <td className={`px-2 py-1 font-bold ${profitColor}`}>{profitPct !== null ? profitPct+'%' : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-slate-400 italic bg-slate-50 rounded-lg px-3 py-2">لا توجد منتجات مضافة</div>
        )
      )}

      {s.paymentTerms && <div className="text-xs text-slate-500 bg-amber-50 rounded-lg px-2 py-1">💳 {s.paymentTerms}</div>}
      {s.notes && <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-2 py-1">{s.notes}</div>}
    </div>
  );
}

function SuppliersPage({ user }) {
  // Determine which tabs this user can see
  const canSeeGeneral  = !user || user.role === 'manager' || user.role === 'accountant';
  const isACDept       = user?.department === 'ac';
  const isEngHead      = user?.department === 'engineering' && (user?.title||'').includes('مدير');
  const canSeeMaterials = canSeeGeneral || isACDept || isEngHead;

  const [suppliers, setSuppliers] = useState(DB.getSuppliers());
  const [tab, setTab]             = useState('ac_brand'); // 'ac_brand' | 'material' | 'general'
  const [showAdd, setShowAdd]     = useState(false);
  const [editId, setEditId]       = useState(null);
  useRealTimeSync(() => setSuppliers(DB.getSuppliers()));
  const [search, setSearch]       = useState('');
  const [form, setForm]           = useState({ ...EMPTY_AC_SUP });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const reload = () => setSuppliers(DB.getSuppliers());

  const emptyForTab = (t) =>
    t === 'ac_brand' ? { ...EMPTY_AC_SUP } :
    t === 'material' ? { ...EMPTY_MAT_SUP } :
                       { ...EMPTY_GEN_SUP };

  const openNew = () => {
    setEditId(null);
    setForm(emptyForTab(tab));
    setShowAdd(true);
  };

  const openEdit = (s) => {
    setForm({ ...s });
    setEditId(s.id);
    setShowAdd(true);
  };

  const saveSupplier = () => {
    if (!form.name.trim()) return;
    const all = DB.getSuppliers();
    if (editId) {
      DB.saveSuppliers(all.map(s => s.id === editId ? { ...s, ...form } : s));
    } else {
      DB.saveSuppliers([...all, { ...form, id: uid(), createdAt: new Date().toISOString().slice(0,10) }]);
    }
    reload(); setShowAdd(false); setEditId(null);
  };

  const deleteSupplier = (id) => {
    if (!confirm('حذف المورد؟')) return;
    DB.saveSuppliers(DB.getSuppliers().filter(s => s.id !== id)); reload();
  };

  const addProduct = () => {
    const p = { id: uid(), brand:'', acType:'', tons:'', model:'', supplyPrice:'', salePrice:'' };
    set('products', [...(form.products||[]), p]);
  };
  const updateProduct = (id, field, val) => {
    set('products', (form.products||[]).map(p => p.id===id ? {...p,[field]:val} : p));
  };
  const removeProduct = (id) => {
    set('products', (form.products||[]).filter(p => p.id!==id));
  };

  const addMatProduct = () => {
    const p = { id: uid(), name:'', unit:'قطعة', supplyPrice:'', salePrice:'', notes:'' };
    set('products', [...(form.products||[]), p]);
  };
  const updateMatProduct = (id, field, val) => {
    set('products', (form.products||[]).map(p => p.id===id ? {...p,[field]:val} : p));
  };
  const removeMatProduct = (id) => {
    set('products', (form.products||[]).filter(p => p.id!==id));
  };

  const acSuppliers  = suppliers.filter(s => s.category === 'ac_brand' || !s.category);
  const matSuppliers = suppliers.filter(s => s.category === 'material');
  const genSuppliers = suppliers.filter(s => s.category === 'general');

  const listForTab = tab === 'ac_brand' ? acSuppliers : tab === 'material' ? matSuppliers : genSuppliers;
  const filtered = listForTab.filter(s =>
    !search || s.name.includes(search) || (s.supplyType||'').includes(search) || (s.brands||[]).some(b=>b.includes(search))
  );

  const tabBtn = (id, label, icon, count) => (
    <button onClick={()=>{ setTab(id); setSearch(''); }}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition border-2 ${tab===id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-transparent bg-white text-slate-500 hover:bg-slate-50 card-shadow'}`}>
      <span>{icon}</span><span>{label}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tab===id?'bg-blue-500 text-white':'bg-slate-100 text-slate-500'}`}>{count}</span>
    </button>
  );

  const isAC = form.category === 'ac_brand';

  return (
    <div className="fade-in space-y-5">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">📦 الموردين</h2>
          <p className="text-slate-500 text-sm mt-1">{suppliers.length} مورد مسجل</p>
        </div>
        <Btn onClick={openNew}>➕ مورد جديد</Btn>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 flex-wrap">
        {tabBtn('ac_brand', 'موردو شركات التكييف', '❄️', acSuppliers.length)}
        {canSeeMaterials && tabBtn('material', 'موردو المواد', '🔩', matSuppliers.length)}
        {canSeeGeneral && tabBtn('general', 'توريدات عامة', '📦', genSuppliers.length)}
      </div>

      {/* Search */}
      <input
        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        placeholder={tab==='ac_brand' ? 'بحث باسم الشركة أو الماركة...' : 'بحث باسم المورد أو نوع المواد...'}
        value={search} onChange={e=>setSearch(e.target.value)}/>

      {/* Section Header */}
      {(() => {
        const cfg = {
          ac_brand: { icon:'❄️', color:'bg-blue-50 border-blue-100', text:'text-blue-800', label:'موردو شركات التكييف',  sub:'شركات توريد وحدات وأجهزة التكييف حسب الماركة' },
          material: { icon:'🔩', color:'bg-slate-50 border-slate-100', text:'text-slate-700', label:'موردو المواد',         sub:'موردو المواد والقطع الإنشائية والكهربائية وخلافه' },
          general:  { icon:'📦', color:'bg-amber-50 border-amber-100', text:'text-amber-800', label:'التوريدات العامة',     sub:'موردو اللوازم والأدوات العامة للشركة' },
        };
        const c = cfg[tab];
        return (
          <div className={`rounded-xl p-3 flex items-center gap-3 border ${c.color}`}>
            <span className="text-2xl">{c.icon}</span>
            <div>
              <div className={`font-bold text-sm ${c.text}`}>{c.label}</div>
              <div className="text-xs text-slate-400">{c.sub}</div>
            </div>
          </div>
        );
      })()}

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-14 text-center text-slate-400">
          <div className="text-5xl mb-3">{tab==='ac_brand'?'❄️':tab==='material'?'🔩':'📦'}</div>
          <div className="font-medium">لا يوجد موردين في هذه الفئة بعد</div>
          <div className="mt-4"><Btn onClick={openNew}>➕ إضافة أول مورد</Btn></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => (
            <SupplierCard key={s.id} s={s} onEdit={openEdit} onDelete={deleteSupplier}/>
          ))}
        </div>
      )}

      {/* Modal */}
      <Modal open={showAdd} onClose={()=>{setShowAdd(false);setEditId(null);}}
        title={editId ? 'تعديل مورد' : (tab==='ac_brand'?'إضافة مورد شركة تكييف':tab==='material'?'إضافة مورد مواد':'إضافة توريدات عامة')}
        size="lg">
        <div className="space-y-4">

          {/* Category toggle (only when adding new) */}
          {!editId && (
            <div className={`flex gap-1 p-1 bg-slate-100 rounded-xl ${canSeeGeneral?'':'hidden-general'}`}>
              <button onClick={()=>setForm({...EMPTY_AC_SUP})}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${form.category==='ac_brand'?'bg-blue-600 text-white shadow':'text-slate-500 hover:text-slate-700'}`}>
                ❄️ شركة تكييف
              </button>
              <button onClick={()=>setForm({...EMPTY_MAT_SUP})}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${form.category==='material'?'bg-blue-600 text-white shadow':'text-slate-500 hover:text-slate-700'}`}>
                🔩 مواد
              </button>
              {canSeeGeneral && (
                <button onClick={()=>setForm({...EMPTY_GEN_SUP})}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${form.category==='general'?'bg-blue-600 text-white shadow':'text-slate-500 hover:text-slate-700'}`}>
                  📦 توريدات عامة
                </button>
              )}
            </div>
          )}

          {/* Common fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="اسم الشركة / المورد" value={form.name} onChange={e=>set('name',e.target.value)} required/>
            <Input label="رقم الجوال" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="05xxxxxxxx"/>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="البريد الإلكتروني" value={form.email||''} onChange={e=>set('email',e.target.value)} placeholder="email@example.com"/>
            {isAC && <Input label="السجل التجاري" value={form.commercialReg||''} onChange={e=>set('commercialReg',e.target.value)} placeholder="رقم السجل التجاري"/>}
          </div>

          {/* AC Brand: product catalog editor */}
          {isAC && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-500 font-semibold">كتالوج المنتجات</label>
                <button type="button" onClick={addProduct}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium">
                  ➕ إضافة منتج
                </button>
              </div>
              {(form.products||[]).length === 0 ? (
                <div className="text-xs text-slate-400 italic bg-slate-50 rounded-xl px-4 py-3 text-center">لا توجد منتجات — اضغط "إضافة منتج" للبدء</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600">
                        <th className="px-2 py-1.5 text-right font-semibold">الماركة</th>
                        <th className="px-2 py-1.5 text-right font-semibold">النوع</th>
                        <th className="px-2 py-1.5 text-right font-semibold">السعة (طن)</th>
                        <th className="px-2 py-1.5 text-right font-semibold">الموديل</th>
                        <th className="px-2 py-1.5 text-right font-semibold">سعر التوريد 🔒</th>
                        <th className="px-2 py-1.5 text-right font-semibold">سعر البيع</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-emerald-600">ربح %</th>
                        <th className="px-2 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(form.products||[]).map((p,i) => {
                        const profitPct = p.supplyPrice > 0 ? ((Number(p.salePrice||0)-Number(p.supplyPrice))/Number(p.supplyPrice)*100).toFixed(1) : null;
                        const profitColor = profitPct >= 20 ? 'bg-emerald-100 text-emerald-700' : profitPct >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
                        return (
                        <tr key={p.id} className={i%2===0?'bg-white':'bg-slate-50'}>
                          <td className="px-1 py-1">
                            <input value={p.brand} onChange={e=>updateProduct(p.id,'brand',e.target.value)}
                              placeholder="مثال: ميديا"
                              className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="px-1 py-1">
                            <input value={p.acType||''} onChange={e=>updateProduct(p.id,'acType',e.target.value)}
                              placeholder="مثال: سبليت"
                              className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="px-1 py-1">
                            <input value={p.tons||''} onChange={e=>updateProduct(p.id,'tons',e.target.value)}
                              placeholder="مثال: 1.5"
                              className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="px-1 py-1">
                            <input value={p.model||''} onChange={e=>updateProduct(p.id,'model',e.target.value)}
                              placeholder="اختياري"
                              className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" min="0" value={p.supplyPrice||''} onChange={e=>updateProduct(p.id,'supplyPrice',e.target.value)}
                              placeholder="0"
                              className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-xs bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30"/>
                          </td>
                          <td className="px-1 py-1">
                            <input type="number" min="0" value={p.salePrice||''} onChange={e=>updateProduct(p.id,'salePrice',e.target.value)}
                              placeholder="0"
                              className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="px-2 py-1 text-center">
                            {profitPct !== null
                              ? <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${profitColor}`}>{profitPct}%</span>
                              : <span className="text-slate-300 text-xs">-</span>}
                          </td>
                          <td className="px-1 py-1">
                            <button type="button" onClick={()=>removeProduct(p.id)}
                              className="text-red-400 hover:text-red-600 px-1 transition">🗑️</button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="text-xs text-slate-400 bg-blue-50 rounded-lg px-3 py-1.5">
                💡 سعر التوريد داخلي فقط — لا يظهر للعميل. سعر البيع هو ما يظهر في عرض السعر.
              </div>
            </div>
          )}

          {/* Material / General: product catalog editor */}
          {!isAC && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs text-slate-500 font-semibold">كتالوج المنتجات</label>
                <button type="button" onClick={addMatProduct}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium">
                  ➕ إضافة منتج
                </button>
              </div>
              {(form.products||[]).length === 0 ? (
                <div className="text-xs text-slate-400 italic bg-slate-50 rounded-xl px-4 py-3 text-center">لا توجد منتجات — اضغط "إضافة منتج" للبدء</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600">
                        <th className="px-2 py-1.5 text-right font-semibold">اسم المنتج</th>
                        <th className="px-2 py-1.5 text-right font-semibold">الوحدة</th>
                        <th className="px-2 py-1.5 text-right font-semibold">سعر التوريد 🔒</th>
                        <th className="px-2 py-1.5 text-right font-semibold">سعر البيع</th>
                        <th className="px-2 py-1.5 text-right font-semibold text-emerald-600">ربح %</th>
                        <th className="px-2 py-1.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(form.products||[]).map((p,i) => {
                        const profitPct = p.supplyPrice > 0 ? ((Number(p.salePrice||0)-Number(p.supplyPrice))/Number(p.supplyPrice)*100).toFixed(1) : null;
                        const profitColor = profitPct >= 20 ? 'bg-emerald-100 text-emerald-700' : profitPct >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
                        return (
                          <tr key={p.id} className={i%2===0?'bg-white':'bg-slate-50'}>
                            <td className="px-1 py-1">
                              <input value={p.name||''} onChange={e=>updateMatProduct(p.id,'name',e.target.value)}
                                placeholder="اسم المنتج"
                                className="w-32 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                            </td>
                            <td className="px-1 py-1">
                              <input value={p.unit||''} onChange={e=>updateMatProduct(p.id,'unit',e.target.value)}
                                placeholder="قطعة"
                                className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                            </td>
                            <td className="px-1 py-1">
                              <input type="number" min="0" value={p.supplyPrice||''} onChange={e=>updateMatProduct(p.id,'supplyPrice',e.target.value)}
                                placeholder="0"
                                className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-xs bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500/30"/>
                            </td>
                            <td className="px-1 py-1">
                              <input type="number" min="0" value={p.salePrice||''} onChange={e=>updateMatProduct(p.id,'salePrice',e.target.value)}
                                placeholder="0"
                                className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                            </td>
                            <td className="px-2 py-1 text-center">
                              {profitPct !== null
                                ? <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${profitColor}`}>{profitPct}%</span>
                                : <span className="text-slate-300 text-xs">-</span>}
                            </td>
                            <td className="px-1 py-1">
                              <button type="button" onClick={()=>removeMatProduct(p.id)}
                                className="text-red-400 hover:text-red-600 px-1 transition">🗑️</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="text-xs text-slate-400 bg-blue-50 rounded-lg px-3 py-1.5">
                💡 سعر التوريد داخلي فقط — لا يظهر للعميل.
              </div>
            </div>
          )}

          <Input label="شروط الدفع" value={form.paymentTerms||''} onChange={e=>set('paymentTerms',e.target.value)} placeholder="مثال: 30 يوم، دفع فوري، أقساط..."/>
          <Textarea label="ملاحظات" value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="أي ملاحظات إضافية..."/>

          <div className="flex gap-3 pt-1">
            <Btn onClick={saveSupplier} className="flex-1">✅ حفظ</Btn>
            <Btn variant="secondary" onClick={()=>{setShowAdd(false);setEditId(null);}} className="flex-1">إلغاء</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ==================== AC QUOTE BUILDER ====================

// Default brand catalog with typical AC prices
// hiddenPrice / cassettePrice = سعر البيع للعميل
// hiddenSupplyPrice / cassetteSupplyPrice = سعر التوريد من المورد (داخلي فقط)
const DEFAULT_BRANDS = [
  {
    id:'media', name:'ميديا (Media)',
    units:[
      {tons:1.5,  hiddenSupplyPrice:1350, hiddenPrice:1800,  cassetteSupplyPrice:1650, cassettePrice:2200},
      {tons:2,    hiddenSupplyPrice:1650, hiddenPrice:2200,  cassetteSupplyPrice:2025, cassettePrice:2700},
      {tons:2.5,  hiddenSupplyPrice:2025, hiddenPrice:2700,  cassetteSupplyPrice:2400, cassettePrice:3200},
      {tons:3,    hiddenSupplyPrice:2400, hiddenPrice:3200,  cassetteSupplyPrice:2850, cassettePrice:3800},
      {tons:4,    hiddenSupplyPrice:3150, hiddenPrice:4200,  cassetteSupplyPrice:3750, cassettePrice:5000},
      {tons:5,    hiddenSupplyPrice:3900, hiddenPrice:5200,  cassetteSupplyPrice:4650, cassettePrice:6200},
    ]
  },
  {
    id:'toshiba', name:'توشيبا (Toshiba)',
    units:[
      {tons:1.5,  hiddenSupplyPrice:1575, hiddenPrice:2100,  cassetteSupplyPrice:1950, cassettePrice:2600},
      {tons:2,    hiddenSupplyPrice:1950, hiddenPrice:2600,  cassetteSupplyPrice:2325, cassettePrice:3100},
      {tons:2.5,  hiddenSupplyPrice:2325, hiddenPrice:3100,  cassetteSupplyPrice:2775, cassettePrice:3700},
      {tons:3,    hiddenSupplyPrice:2775, hiddenPrice:3700,  cassetteSupplyPrice:3300, cassettePrice:4400},
      {tons:4,    hiddenSupplyPrice:3600, hiddenPrice:4800,  cassetteSupplyPrice:4350, cassettePrice:5800},
      {tons:5,    hiddenSupplyPrice:4500, hiddenPrice:6000,  cassetteSupplyPrice:5400, cassettePrice:7200},
    ]
  },
  {
    id:'gree', name:'جري (Gree)',
    units:[
      {tons:1.5,  hiddenSupplyPrice:1425, hiddenPrice:1900,  cassetteSupplyPrice:1725, cassettePrice:2300},
      {tons:2,    hiddenSupplyPrice:1763, hiddenPrice:2350,  cassetteSupplyPrice:2138, cassettePrice:2850},
      {tons:2.5,  hiddenSupplyPrice:2138, hiddenPrice:2850,  cassetteSupplyPrice:2550, cassettePrice:3400},
      {tons:3,    hiddenSupplyPrice:2550, hiddenPrice:3400,  cassetteSupplyPrice:3038, cassettePrice:4050},
      {tons:4,    hiddenSupplyPrice:3338, hiddenPrice:4450,  cassetteSupplyPrice:3975, cassettePrice:5300},
      {tons:5,    hiddenSupplyPrice:4125, hiddenPrice:5500,  cassetteSupplyPrice:4950, cassettePrice:6600},
    ]
  },
];

const DEFAULT_ACCESSORIES = [
  { id:'install_hidden',   label:'تركيب وحدة مخفية',          unit:'قطعة', price:350 },
  { id:'install_cassette', label:'تركيب وحدة كاسيت',          unit:'قطعة', price:450 },
  { id:'foundation',       label:'أعمال تأسيس وتمديد مواسير', unit:'نقطة', price:600 },
  { id:'copper_14',        label:'أنبوب نحاس 1/4 بوصة',       unit:'متر',  price:18  },
  { id:'copper_38',        label:'أنبوب نحاس 3/8 بوصة',       unit:'متر',  price:24  },
  { id:'copper_12',        label:'أنبوب نحاس 1/2 بوصة',       unit:'متر',  price:32  },
  { id:'copper_58',        label:'أنبوب نحاس 5/8 بوصة',       unit:'متر',  price:42  },
  { id:'duct_8x8',         label:'مجرى هواء 8×8 بوصة',        unit:'متر',  price:85  },
  { id:'duct_10x8',        label:'مجرى هواء 10×8 بوصة',       unit:'متر',  price:110 },
  { id:'duct_12x8',        label:'مجرى هواء 12×8 بوصة',       unit:'متر',  price:135 },
  { id:'duct_16x8',        label:'مجرى هواء 16×8 بوصة',       unit:'متر',  price:160 },
  { id:'flex_6',           label:'فليكسبل داكت 6 بوصة',       unit:'متر',  price:22  },
  { id:'flex_8',           label:'فليكسبل داكت 8 بوصة',       unit:'متر',  price:28  },
  { id:'flex_10',          label:'فليكسبل داكت 10 بوصة',      unit:'متر',  price:35  },
  { id:'flex_12',          label:'فليكسبل داكت 12 بوصة',      unit:'متر',  price:44  },
  { id:'grille_10x6',      label:'فتحة هواء 10×6 بوصة',       unit:'قطعة', price:55  },
  { id:'grille_12x6',      label:'فتحة هواء 12×6 بوصة',       unit:'قطعة', price:65  },
  { id:'grille_18x6',      label:'فتحة هواء 18×6 بوصة',       unit:'قطعة', price:80  },
  { id:'elec_conn',        label:'توصيل كهرباء',               unit:'نقطة', price:120 },
  { id:'drain',            label:'تمديد تصريف مكثفات',         unit:'متر',  price:30  },
  { id:'insulation',       label:'عزل حراري للمواسير',         unit:'متر',  price:20  },
];

const PAYMENT_SCHEDULES = [
  { label:'الدفعة الأولى - عند التعاقد',    pct:10 },
  { label:'الدفعة الثانية - بداية التنفيذ', pct:20 },
  { label:'الدفعة الثالثة - منتصف التنفيذ', pct:45 },
  { label:'الدفعة الرابعة - عند الاستلام',  pct:25 },
];

// ---- Contract terms defaults ----
const AC_CONTRACT_TERMS_DEFAULT = [
  'توريد وتركيب وحدات التكييف المحددة في العرض',
  'تمديد مواسير النحاس مع العزل الحراري اللازم',
  'تمديد شبكة تصريف مياه المكثفات',
  'التوصيلات الكهربائية لكل وحدة من لوحة التوزيع',
  'اختبار وتشغيل وضبط جميع الوحدات',
  'تنظيف الموقع عند الانتهاء من التركيب',
  'ضمان سنة كاملة على الأعمال والتركيب',
];

const ENG_CONTRACT_TERMS_BY_SERVICE = {
  license:            ['استخراج رخصة البناء من البلدية','إعداد جميع الملفات والمستندات المطلوبة','زيارات الموقع اللازمة','متابعة الجهات الحكومية حتى إصدار الرخصة'],
  supervision:        ['زيارات إشراف دورية على الموقع','إعداد تقارير الإشراف الشهرية','متابعة تنفيذ المواصفات الهندسية','التحقق من جودة مواد البناء','محضر الاستلام النهائي'],
  plans:              ['إعداد المخططات المعمارية','إعداد المخططات الإنشائية','إعداد مخططات الكهرباء والإنارة','إعداد مخططات الصرف الصحي','ختم المخططات من مكتب هندسي معتمد'],
  correction:         ['فحص الوضع القائم وتوثيقه','إعداد مخططات الوضع القائم','متابعة إجراءات التصحيح مع الجهات المختصة'],
  renovation_license: ['تقييم أعمال الترميم','إعداد ملف رخصة الترميم','متابعة البلدية حتى إصدار الرخصة'],
  license_renewal:    ['مراجعة ملف الرخصة الحالية','إعداد وثائق التجديد','متابعة إجراءات التجديد'],
  interior_design:    ['التصميم المعماري الداخلي 2D','المجسمات ثلاثية الأبعاد 3D','نماذج المواد والألوان','الإشراف على التنفيذ'],
  subdivision:        ['الرفع المساحي للأرض','إعداد مخططات التجزئة','متابعة اعتماد التجزئة من الجهات المختصة'],
  merge:              ['الرفع المساحي للقطع','إعداد مخططات الدمج','متابعة إجراءات الاعتماد'],
  construction_license:['معاينة الموقع','إعداد المخططات اللازمة','متابعة رخصة التشييد'],
  other:              ['الاستشارة الهندسية المطلوبة','إعداد التقارير اللازمة'],
};

const MANAGER_NAME = 'م. عبدالرحمن الحمدان';
const COMPANY_WHATSAPP = '0539460440'; // رقم واتساب الشركة الرسمي

// Shared logo SVG string for PDFs
const PDF_LOGO_SVG = `<svg width="70" height="70" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="50%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#64748b"/>
    </linearGradient>
  </defs>
  <polygon points="55,15 100,5 100,75 55,85" fill="url(#gg)" opacity="0.9"/>
  <polygon points="55,15 10,40 10,110 55,85" fill="#78909C" opacity="0.85"/>
  <polygon points="55,85 10,110 55,135 100,110" fill="#90A4AE" opacity="0.8"/>
  <polygon points="100,5 145,15 145,85 100,75" fill="url(#bg)" opacity="0.9"/>
  <polygon points="145,15 190,40 190,110 145,85" fill="#1e40af" opacity="0.85"/>
  <polygon points="100,75 145,85 100,110 55,85" fill="#1d4ed8" opacity="0.9"/>
</svg>`;

const PDF_SHARED_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700;800&display=swap');
  *{font-family:'Tajawal',Arial,sans-serif;box-sizing:border-box;margin:0;padding:0;}
  body{background:white;color:#1e293b;font-size:13px;}
  .page{width:210mm;min-height:297mm;padding:14mm 12mm;margin:0 auto;}
  .header{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:3px solid #1e40af;margin-bottom:12px;}
  .company-name{font-size:19px;font-weight:800;color:#1e40af;line-height:1.3;}
  .company-sub{font-size:11px;color:#64748b;}
  .header-contact{text-align:left;font-size:11px;color:#475569;line-height:1.8;}
  .header-contact strong{color:#1e40af;}
  .quote-title-bar{background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;text-align:center;padding:9px;font-size:16px;font-weight:800;border-radius:6px;margin-bottom:12px;}
  .intro-box{background:#f0f7ff;border-right:4px solid #3b82f6;padding:10px 14px;margin-bottom:12px;font-size:12px;color:#1e3a8a;line-height:1.8;}
  .client-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:12px;display:grid;grid-template-columns:1fr 1fr;gap:7px;}
  .field{display:flex;gap:6px;font-size:12px;}
  .field-label{color:#64748b;min-width:85px;}
  .field-value{font-weight:600;color:#1e293b;}
  .quote-meta{display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-bottom:12px;padding:7px 12px;background:#f1f5f9;border-radius:6px;}
  .brand-section{margin-bottom:18px;}
  .brand-title{font-size:14px;font-weight:700;color:#1e40af;background:#eff6ff;border-right:4px solid #1e40af;padding:7px 12px;margin-bottom:8px;border-radius:0 6px 6px 0;}
  .brand-supplier{font-size:11px;color:#64748b;margin-bottom:6px;padding-right:4px;}
  table{width:100%;border-collapse:collapse;margin-bottom:10px;}
  thead tr{background:#1e40af;color:white;}
  th{padding:7px 10px;text-align:right;font-size:12px;font-weight:600;}
  td{padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:right;}
  tbody tr:nth-child(even){background:#f8fafc;}
  .subtotal-row td{background:#f1f5f9;font-weight:600;color:#475569;}
  .vat-row td{background:#fef3c7;font-weight:600;color:#d97706;}
  .total-row td{background:#1e40af;color:white;font-size:13px;font-weight:700;}
  .pay-table thead tr{background:#0f172a;}
  .terms-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 14px;margin-bottom:10px;}
  .terms-box strong{display:block;color:#14532d;margin-bottom:6px;font-size:12px;}
  .terms-box ul{padding-right:18px;margin:0;}
  .terms-box li{font-size:11px;color:#166534;margin-bottom:3px;}
  .scope-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:9px 12px;margin-bottom:10px;font-size:12px;color:#1e40af;}
  .scope-box strong{display:block;margin-bottom:4px;color:#1e3a8a;}
  .notes-box{background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 12px;margin-top:8px;font-size:11px;color:#78350f;}
  .notes-box strong{display:block;margin-bottom:5px;color:#92400e;}
  .footer{margin-top:18px;border-top:2px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between;align-items:flex-end;}
  .signature-box{text-align:center;min-width:130px;}
  .signature-line{border-top:1px solid #94a3b8;width:130px;margin:32px auto 5px;}
  .sig-name{font-size:11px;font-weight:600;color:#1e293b;}
  .sig-role{font-size:10px;color:#64748b;}
  .page-break{page-break-after:always;}
  @media print{body{background:white;}.page{padding:10mm;}}
`;

function buildQuoteHTML({ quote, brands, type = 'ac' }) {
  const vat = 0.15;
  const selectedBrandIds = quote.selectedBrands || [];
  const contractTerms = (quote.contractTerms || []).filter(t => t.checked);
  const supplierMap  = quote.brandSupplierMap || {};

  const buildBrandTable = (brand) => {
    const units = (quote.acUnits || []).filter(u => u.qty > 0);
    const accessories = (quote.accessories || []).filter(a => a.qty > 0);
    const supplierName = supplierMap[brand.id]?.supplierName || '';

    const unitRows = units.map(u => {
      const bp = brand.units.find(b => b.tons === u.tons);
      const unitPrice = u.type === 'cassette' ? (bp?.cassettePrice||0) : (bp?.hiddenPrice||0);
      return `<tr><td>${u.qty} × ${u.tons} طن ${u.type==='cassette'?'كاسيت':u.type==='split'?'سبليت':'مخفي'}</td><td>${unitPrice.toLocaleString()}</td><td>${u.qty}</td><td>${(unitPrice*u.qty).toLocaleString()}</td></tr>`;
    }).join('');

    const accRows = accessories.map(a =>
      `<tr><td>${a.label}</td><td>${Number(a.price).toLocaleString()}</td><td>${a.qty}</td><td>${(a.price*a.qty).toLocaleString()}</td></tr>`
    ).join('');

    const subtotal = units.reduce((s,u)=>{ const bp=brand.units.find(b=>b.tons===u.tons); return s+(u.type==='cassette'?(bp?.cassettePrice||0):(bp?.hiddenPrice||0))*u.qty; },0)
                   + accessories.reduce((s,a)=>s+a.price*a.qty,0);
    const vatAmt = subtotal*vat, total = subtotal+vatAmt;

    const payScheduleArr = quote.paySchedule || PAYMENT_SCHEDULES;
    const payRows = payScheduleArr.map(p=>
      `<tr><td>${p.label} (${p.pct}%)</td><td>${Math.round(total*p.pct/100).toLocaleString()} ر.س</td></tr>`
    ).join('');

    return `<div class="brand-section">
      <h3 class="brand-title">عرض سعر — ${brand.name}</h3>
      ${supplierName ? `<div class="brand-supplier">🏭 المورد: <strong>${supplierName}</strong></div>` : ''}
      <table><thead><tr><th>البيان</th><th>سعر الوحدة (ر.س)</th><th>الكمية</th><th>الإجمالي (ر.س)</th></tr></thead>
      <tbody>${unitRows}${accRows}
        <tr class="subtotal-row"><td colspan="3">المجموع قبل الضريبة</td><td>${subtotal.toLocaleString()} ر.س</td></tr>
        <tr class="vat-row"><td colspan="3">ضريبة القيمة المضافة 15%</td><td>${vatAmt.toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س</td></tr>
        <tr class="total-row"><td colspan="3"><strong>الإجمالي النهائي</strong></td><td><strong>${total.toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س</strong></td></tr>
      </tbody></table>
      <table class="pay-table"><thead><tr><th colspan="2">جدول الدفعات</th></tr></thead><tbody>${payRows}</tbody></table>
    </div>`;
  };

  const brandsHTML = selectedBrandIds.map(bid=>brands.find(b=>b.id===bid)).filter(Boolean).map(buildBrandTable).join('<div class="page-break"></div>');

  const isAC = type === 'ac';
  const companyName = isAC ? 'الحمدان للتكييف' : 'الحمدان للاستشارات الهندسية';
  const companyNameEn = isAC ? 'Alhamdan Air Conditioning Co.' : 'Alhamdan Consulting Engineering Co.';
  const introText = isAC
    ? `تتشرف شركة <strong>الحمدان للتكييف</strong> بتقديم هذا العرض لسيادتكم، متضمناً توريد وتركيب وحدات التكييف وجميع الأعمال المرتبطة بها وفق أعلى معايير الجودة والكفاءة. نأمل أن يلقى العرض قبولكم الكريم.`
    : `تتشرف شركة <strong>الحمدان للاستشارات الهندسية</strong> بتقديم هذا العرض لسيادتكم، متضمناً الخدمات الهندسية المطلوبة وفق أعلى المعايير المهنية المعتمدة. نأمل أن يلقى العرض قبولكم الكريم.`;

  const termsListHTML = contractTerms.length > 0
    ? `<div class="terms-box"><strong>✅ ما يشمله العقد:</strong><ul>${contractTerms.map(t=>`<li>${t.label}</li>`).join('')}</ul></div>` : '';

  const itemsHTML = type === 'eng' ? (() => {
    const items = (quote.items||[]).filter(i=>i.qty>0||i.price>0);
    const subtotal = items.reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||0),0);
    const vatAmt = subtotal*vat, total = subtotal+vatAmt;
    const sched = quote.paySchedule || ENG_PAYMENT_SCHEDULES;
    return `<table><thead><tr><th>البند</th><th>الوحدة</th><th>سعر الوحدة (ر.س)</th><th>الكمية</th><th>الإجمالي (ر.س)</th></tr></thead>
    <tbody>${items.map(i=>`<tr><td>${i.label}</td><td>${i.unit||'-'}</td><td>${Number(i.price||0).toLocaleString()}</td><td>${i.qty}</td><td>${(Number(i.price||0)*Number(i.qty||0)).toLocaleString()}</td></tr>`).join('')}
      <tr class="subtotal-row"><td colspan="4">المجموع قبل الضريبة</td><td>${subtotal.toLocaleString()} ر.س</td></tr>
      <tr class="vat-row"><td colspan="4">ضريبة القيمة المضافة 15%</td><td>${vatAmt.toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س</td></tr>
      <tr class="total-row"><td colspan="4"><strong>الإجمالي النهائي</strong></td><td><strong>${total.toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س</strong></td></tr>
    </tbody></table>
    <table class="pay-table"><thead><tr><th colspan="2">جدول الدفعات</th></tr></thead>
    <tbody>${sched.map(p=>`<tr><td>${p.label} (${p.pct}%)</td><td>${Math.round(total*p.pct/100).toLocaleString()} ر.س</td></tr>`).join('')}</tbody></table>`;
  })() : brandsHTML;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>عرض سعر — ${quote.clientName||''}</title>
<style>${PDF_SHARED_STYLES}</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      ${PDF_LOGO_SVG}
      <div>
        <div class="company-name">${companyName}</div>
        <div class="company-sub">${companyNameEn}</div>
      </div>
    </div>
    <div class="header-contact">
      <strong>المملكة العربية السعودية</strong><br>
      📞 واتساب: ${COMPANY_WHATSAPP}<br>
      📧 info@alhamdangroups.com<br>
      🌐 www.alhamdangroups.com<br>
      رقم ضريبي: 3xxxxxxxxxx
    </div>
  </div>

  <div class="quote-title-bar">عرض سعر — ${quote.serviceLabel || (isAC?'أعمال التكييف':'خدمة هندسية')}</div>

  <div class="quote-meta">
    <span>رقم العرض: <strong>${quote.quoteNo||''}</strong></span>
    <span>تاريخ الإصدار: <strong>${new Date(quote.date||Date.now()).toLocaleDateString('ar-SA')}</strong></span>
    <span>صالح لمدة: <strong>30 يوم</strong></span>
  </div>

  <div class="intro-box">${introText}</div>

  <div class="client-box">
    <div class="field"><span class="field-label">العميل الكريم:</span><span class="field-value">${quote.clientName||'-'}</span></div>
    <div class="field"><span class="field-label">رقم الجوال:</span><span class="field-value">${quote.clientPhone||'-'}</span></div>
    <div class="field"><span class="field-label">الخدمة:</span><span class="field-value">${quote.serviceLabel||'-'}</span></div>
    <div class="field"><span class="field-label">الموقع:</span><span class="field-value">${quote.location||'-'}</span></div>
  </div>

  ${quote.scope ? `<div class="scope-box"><strong>نطاق العمل:</strong> ${quote.scope}</div>` : ''}
  ${termsListHTML}
  ${itemsHTML}
  ${quote.notes ? `<div class="notes-box"><strong>ملاحظات:</strong> ${quote.notes}</div>` : ''}

  <div class="notes-box" style="margin-top:8px;">
    <strong>الشروط العامة:</strong>
    • الأسعار شاملة ضريبة القيمة المضافة 15% &nbsp;•&nbsp; الضمان سنة على الأعمال والتركيب<br>
    • أي تعديل في نطاق العمل يستلزم مراجعة السعر &nbsp;•&nbsp; هذا العرض غير ملزم إلا بعد التعاقد والدفعة الأولى
  </div>

  <div class="footer">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="sig-name">${MANAGER_NAME}</div>
      <div class="sig-role">مدير الشركة</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="sig-role">اعتماد العميل</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="sig-role">المهندس المسؤول</div>
    </div>
  </div>
</div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`;
}

function buildFlexACQuoteHTML({ quote }) {
  const vat = 0.15;
  const items = quote.quoteItems || [];
  const laborItemsList = quote.laborItems || [];
  const contractTerms = (quote.contractTerms || []).filter(t => t.checked);

  const itemsSubtotal = items.reduce((s, item) => s + Number(item.salePrice||0) * Number(item.qty||1), 0);
  const laborSubtotal = laborItemsList.reduce((s, item) => s + Number(item.unitPrice||0) * Number(item.qty||1), 0);
  const subtotal = itemsSubtotal + laborSubtotal;
  const vatAmt = subtotal * vat;
  const total = subtotal + vatAmt;

  const itemRows = items.map((item, idx) => {
    const desc = item.description || '';
    const brandInfo = [item.brand, item.acType ? getLabelById(AC_TYPES, item.acType) : '', item.tons ? item.tons + ' طن' : '', item.model || ''].filter(Boolean).join(' / ');
    const qty = Number(item.qty || 1);
    const unit = item.unit || 'قطعة';
    const salePrice = Number(item.salePrice || 0);
    const lineTotal = salePrice * qty;
    return `<tr>
      <td>${idx + 1}</td>
      <td>${desc}</td>
      <td>${brandInfo}</td>
      <td style="text-align:center">${qty}</td>
      <td style="text-align:center">${unit}</td>
      <td>${salePrice.toLocaleString()}</td>
      <td>${lineTotal.toLocaleString()}</td>
    </tr>`;
  }).join('');

  const laborRows = laborItemsList.map((item, idx) => {
    const qty = Number(item.qty || 1);
    const unitPrice = Number(item.unitPrice || 0);
    return `<tr>
      <td>${idx + 1}</td>
      <td>${item.description || ''}</td>
      <td></td>
      <td style="text-align:center">${qty}</td>
      <td style="text-align:center">${item.unit || 'بند'}</td>
      <td>${unitPrice.toLocaleString()}</td>
      <td>${(unitPrice * qty).toLocaleString()}</td>
    </tr>`;
  }).join('');

  const payScheduleArr = quote.paySchedule || PAYMENT_SCHEDULES;
  const payRows = payScheduleArr.map(p =>
    `<tr><td>${p.label} (${p.pct}%)</td><td>${Math.round(total * p.pct / 100).toLocaleString()} ر.س</td></tr>`
  ).join('');

  const termsListHTML = contractTerms.length > 0
    ? `<div class="terms-box"><strong>✅ ما يشمله العقد:</strong><ul>${contractTerms.map(t => `<li>${t.label}</li>`).join('')}</ul></div>` : '';

  const specsHTML = quote.specs ? `<div class="scope-box" style="margin-bottom:10px;"><strong>📐 المواصفات الفنية:</strong><br/><span style="white-space:pre-line;color:#1e293b;">${quote.specs}</span></div>` : '';
  const warrantyHTML = quote.warranty ? `<div class="terms-box" style="margin-bottom:10px;"><strong>🛡️ بنود الضمان:</strong><br/><span style="white-space:pre-line;">${quote.warranty}</span></div>` : '';

  const laborSectionHTML = laborItemsList.length > 0 ? `
    <div style="margin-top:14px;">
      <div class="brand-title">👷 العمالة</div>
      <table>
        <thead><tr><th>#</th><th>الوصف</th><th>الماركة / التفاصيل</th><th style="text-align:center">الكمية</th><th style="text-align:center">الوحدة</th><th>سعر الوحدة (ر.س)</th><th>الإجمالي (ر.س)</th></tr></thead>
        <tbody>${laborRows}
          <tr class="subtotal-row"><td colspan="6">مجموع أعمال العمالة</td><td>${laborSubtotal.toLocaleString()} ر.س</td></tr>
        </tbody>
      </table>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>عرض سعر — ${quote.clientName || ''}</title>
<style>${PDF_SHARED_STYLES}</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      ${PDF_LOGO_SVG}
      <div>
        <div class="company-name">الحمدان للتكييف</div>
        <div class="company-sub">Alhamdan Air Conditioning Co.</div>
      </div>
    </div>
    <div class="header-contact">
      <strong>المملكة العربية السعودية</strong><br>
      📞 واتساب: ${COMPANY_WHATSAPP}<br>
      📧 info@alhamdangroups.com<br>
      🌐 www.alhamdangroups.com<br>
      رقم ضريبي: 3xxxxxxxxxx
    </div>
  </div>

  <div class="quote-title-bar">عرض سعر — ${quote.serviceLabel || 'أعمال التكييف'}</div>

  <div class="quote-meta">
    <span>رقم العرض: <strong>${quote.quoteNo || ''}</strong></span>
    <span>تاريخ الإصدار: <strong>${new Date(quote.date || Date.now()).toLocaleDateString('ar-SA')}</strong></span>
    <span>صالح لمدة: <strong>30 يوم</strong></span>
  </div>

  <div class="intro-box">تتشرف شركة <strong>الحمدان للتكييف</strong> بتقديم هذا العرض لسيادتكم، متضمناً توريد وتركيب وحدات التكييف وجميع الأعمال المرتبطة بها وفق أعلى معايير الجودة والكفاءة. نأمل أن يلقى العرض قبولكم الكريم.</div>

  <div class="client-box">
    <div class="field"><span class="field-label">العميل الكريم:</span><span class="field-value">${quote.clientName || '-'}</span></div>
    <div class="field"><span class="field-label">رقم الجوال:</span><span class="field-value">${quote.clientPhone || '-'}</span></div>
    <div class="field"><span class="field-label">الخدمة:</span><span class="field-value">${quote.serviceLabel || '-'}</span></div>
    <div class="field"><span class="field-label">الموقع:</span><span class="field-value">${quote.location || '-'}</span></div>
  </div>

  ${termsListHTML}

  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>البيان</th>
        <th>الماركة / النوع / السعة</th>
        <th style="width:50px;text-align:center">الكمية</th>
        <th style="width:50px;text-align:center">الوحدة</th>
        <th>سعر الوحدة (ر.س)</th>
        <th>الإجمالي (ر.س)</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${laborItemsList.length > 0 ? '' : `<tr class="subtotal-row"><td colspan="6">المجموع قبل الضريبة</td><td>${itemsSubtotal.toLocaleString()} ر.س</td></tr>`}
    </tbody>
  </table>

  ${laborSectionHTML}

  ${specsHTML}
  ${warrantyHTML}

  <table style="margin-top:10px;">
    <tbody>
      ${laborItemsList.length > 0 ? `<tr class="subtotal-row"><td colspan="6">المجموع الإجمالي قبل الضريبة</td><td>${subtotal.toLocaleString()} ر.س</td></tr>` : ''}
      <tr class="vat-row"><td colspan="6">ضريبة القيمة المضافة 15%</td><td>${vatAmt.toLocaleString('ar-SA', {minimumFractionDigits:2, maximumFractionDigits:2})} ر.س</td></tr>
      <tr class="total-row"><td colspan="6"><strong>الإجمالي النهائي</strong></td><td><strong>${total.toLocaleString('ar-SA', {minimumFractionDigits:2, maximumFractionDigits:2})} ر.س</strong></td></tr>
    </tbody>
  </table>

  <table class="pay-table">
    <thead><tr><th colspan="2">جدول الدفعات</th></tr></thead>
    <tbody>${payRows}</tbody>
  </table>

  ${quote.notes ? `<div class="notes-box"><strong>ملاحظات:</strong> ${quote.notes}</div>` : ''}

  <div class="notes-box" style="margin-top:8px;">
    <strong>الشروط العامة:</strong>
    • الأسعار شاملة ضريبة القيمة المضافة 15% &nbsp;•&nbsp; الضمان سنة على الأعمال والتركيب<br>
    • أي تعديل في نطاق العمل يستلزم مراجعة السعر &nbsp;•&nbsp; هذا العرض غير ملزم إلا بعد التعاقد والدفعة الأولى
  </div>

  <div class="footer">
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="sig-name">${MANAGER_NAME}</div>
      <div class="sig-role">مدير الشركة</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="sig-role">اعتماد العميل</div>
    </div>
    <div class="signature-box">
      <div class="signature-line"></div>
      <div class="sig-role">المهندس المسؤول</div>
    </div>
  </div>
</div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`;
}

function QuotePDF({ quote, brands }) {
  const html = quote.quoteItems ? buildFlexACQuoteHTML({ quote }) : buildQuoteHTML({ quote, brands, type:'ac' });
  const win = window.open('','_blank');
  if (win) { win.document.write(html); win.document.close(); }
  return null;
}

function QuoteBuilderPage({ user }) {
  const clients = DB.getClients();
  const storedBrands = DB.getBrands();
  const [brands, setBrands] = useState(storedBrands || DEFAULT_BRANDS);
  const [quotes, setQuotes] = useState(DB.getQuotes());
  const [view, setView] = useState('list'); // list | new | edit | brand_catalog
  const [editingQuote, setEditingQuote] = useState(null);
  const [printQuote, setPrintQuote] = useState(null);
  useRealTimeSync(() => { if (view === 'list') setQuotes(DB.getQuotes()); });

  // Quote form state
  const [clientId, setClientId] = useState('');
  const [customClient, setCustomClient] = useState({ name:'', phone:'', location:'' });
  const [serviceType, setServiceType] = useState('ac_central');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState('');
  const [quoteNo, setQuoteNo] = useState('QT-' + Date.now().toString().slice(-6));
  const [contractTerms, setContractTerms] = useState(AC_CONTRACT_TERMS_DEFAULT.map((l,i)=>({id:'ct'+i,label:l,checked:true})));
  const [customTermInput, setCustomTermInput] = useState('');

  // Payment schedule state
  const AC_DEFAULT_SCHEDULE = [
    { id: uid(), label:'الدفعة الأولى — عند التعاقد', pct:50 },
    { id: uid(), label:'الدفعة الثانية — عند التسليم', pct:50 },
  ];
  const [paySchedule, setPaySchedule] = useState(AC_DEFAULT_SCHEDULE);

  // New flex line-item state
  const [quoteItems, setQuoteItems] = useState([]); // { id, source, description, brand, acType, tons, model, qty, unit, supplyPrice, salePrice, supplierId, supplierName }
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSupplierId, setCatalogSupplierId] = useState('');
  const [catalogQtys, setCatalogQtys] = useState({}); // { productId: qty }
  const [catalogSelected, setCatalogSelected] = useState({}); // { productId: bool }
  const [previewListQ, setPreviewListQ] = useState(null); // quote to preview in list modal
  const [addInvQuote, setAddInvQuote] = useState(null);   // quote for additional invoice modal
  const [addInvForm, setAddInvForm]   = useState({ description:'', amount:'' });

  // Specs, warranty, labor items (Changes 4 & 5)
  const [specs, setSpecs] = useState('');
  const [warranty, setWarranty] = useState('');
  const [laborItems, setLaborItems] = useState([]); // { id, description, qty, unit, unitPrice }
  const [showLaborSection, setShowLaborSection] = useState(false);

  // Profit modal (Change 6)
  const [showProfitModal, setShowProfitModal] = useState(false);
  const [savedQuoteProfit, setSavedQuoteProfit] = useState(null);

  // Brand catalog editing
  const [editBrand, setEditBrand] = useState(null);

  // Supplier lookup for AC brands
  const acBrandSuppliers = DB.getSuppliers().filter(s => s.category === 'ac_brand');

  const approveACQuote = (id) => {
    const all = DB.getQuotes();
    const approvedQ = all.find(q=>q.id===id);
    DB.saveQuotes(all.map(q=>q.id===id?{...q,approvalStatus:'approved'}:q));
    setQuotes(DB.getQuotes());
    logActivity(user, 'approved', 'ac_quote', approvedQ?.quoteNo||id, '');
    const creator = DB.getUsers().find(u=>u.name===approvedQ?.createdBy);
    if (creator) notifyUsers([creator.id], `تم اعتماد عرض السعر ${approvedQ?.quoteNo} بواسطة ${user?.name}`, 'ac_quote', id, user?.name);
  };
  const rejectACQuote = (id) => {
    const reason = prompt('سبب الرفض (اختياري):') || '';
    const rejQ = DB.getQuotes().find(q=>q.id===id);
    DB.saveQuotes(DB.getQuotes().map(q=>q.id===id?{...q,approvalStatus:'rejected',approvalNote:reason}:q));
    setQuotes(DB.getQuotes());
    logActivity(user, 'rejected', 'ac_quote', rejQ?.quoteNo||id, reason);
    const creator = DB.getUsers().find(u=>u.name===rejQ?.createdBy);
    if (creator) notifyUsers([creator.id], `تم رفض عرض السعر ${rejQ?.quoteNo}: ${reason||''}`, 'ac_quote', id, user?.name);
  };

  const addAdditionalInvoice = (qId) => {
    const amt = Number(addInvForm.amount);
    if (!addInvForm.description.trim() || !amt) return;
    const inv = { id:uid(), date:new Date().toISOString().slice(0,10), description:addInvForm.description.trim(), amount:amt, addedBy:user?.name||'' };
    const updated = DB.getQuotes().map(q=>q.id===qId?{...q, additionalInvoices:[...(q.additionalInvoices||[]), inv]}:q);
    DB.saveQuotes(updated);
    setQuotes(updated);
    setAddInvForm({ description:'', amount:'' });
  };

  const deleteAdditionalInvoice = (qId, invId) => {
    if (!confirm('حذف هذه الفاتورة الإضافية؟')) return;
    const updated = DB.getQuotes().map(q=>q.id===qId?{...q, additionalInvoices:(q.additionalInvoices||[]).filter(i=>i.id!==invId)}:q);
    DB.saveQuotes(updated);
    setQuotes(updated);
    // update modal quote ref
    const fresh = DB.getQuotes().find(q=>q.id===qId);
    if (addInvQuote?.id===qId) setAddInvQuote(fresh||null);
  };

  const saveQuote = () => {
    const client = clientId ? clients.find(c=>c.id===clientId) : null;
    const isManagerUser = user?.role === 'manager';
    const q = {
      id: editingQuote?.id || uid(),
      quoteNo,
      date: new Date().toISOString().slice(0,10),
      clientId,
      clientName: client?.name || customClient.name,
      clientPhone: client?.phone || customClient.phone,
      location: location || client?.address || customClient.location,
      serviceLabel: AC_SERVICE_TYPES.find(s=>s.id===serviceType)?.label || serviceType,
      quoteItems,
      laborItems,
      paySchedule,
      specs,
      warranty,
      notes, contractTerms,
      createdBy: user?.name || '',
      // Manager: preserve existing status (or auto-approve). Engineer: always pending (needs re-approval after any save/edit)
      approvalStatus: isManagerUser ? (editingQuote?.approvalStatus || 'approved') : 'pending',
      approvalNote: isManagerUser ? (editingQuote?.approvalNote || '') : '',
    };
    const existing = DB.getQuotes();
    const updated = editingQuote
      ? existing.map(x=>x.id===editingQuote.id?q:x)
      : [...existing, q];
    DB.saveQuotes(updated);
    setQuotes(updated);
    logActivity(user, editingQuote ? 'updated' : 'added', 'ac_quote', q.quoteNo, q.clientName);
    if (!editingQuote) notifyManagers(`${user?.name||''} أضاف عرض سعر تكييف جديد: ${q.quoteNo} للعميل ${q.clientName}`, 'ac_quote', q.id, user?.name);
    setEditingQuote(null);

    // Show profit modal if supply prices exist
    const itemsWithCost = quoteItems.filter(i => Number(i.supplyPrice||0) > 0);
    if (itemsWithCost.length > 0 || laborItems.length > 0) {
      const revenue = quoteItems.reduce((s,i) => s + Number(i.salePrice||0)*Number(i.qty||1), 0)
                    + laborItems.reduce((s,i) => s + Number(i.unitPrice||0)*Number(i.qty||1), 0);
      const cost = quoteItems.reduce((s,i) => s + Number(i.supplyPrice||0)*Number(i.qty||1), 0);
      const profit = revenue - cost;
      const profitPct = cost > 0 ? (profit/cost*100).toFixed(1) : null;
      setSavedQuoteProfit({ revenue, cost, profit, profitPct, quoteNo: q.quoteNo });
      setShowProfitModal(true);
    } else {
      setView('list');
    }
  };

  const deleteQuote = (id) => {
    if (!confirm('حذف عرض السعر؟')) return;
    const updated = DB.getQuotes().filter(q=>q.id!==id);
    DB.saveQuotes(updated);
    setQuotes(updated);
  };

  const startNew = () => {
    setEditingQuote(null);
    setClientId(''); setCustomClient({name:'',phone:'',location:''});
    setServiceType('ac_central');
    setContractTerms(AC_CONTRACT_TERMS_DEFAULT.map((l,i)=>({id:'ct'+i,label:l,checked:true})));
    setNotes(''); setLocation('');
    setQuoteNo('QT-' + Date.now().toString().slice(-6));
    setQuoteItems([]);
    setPaySchedule([{id:uid(),label:'الدفعة الأولى — عند التعاقد',pct:50},{id:uid(),label:'الدفعة الثانية — عند التسليم',pct:50}]);
    setSpecs(''); setWarranty('');
    setLaborItems([]); setShowLaborSection(false);
    setShowCatalogModal(false); setCatalogSupplierId(''); setCatalogQtys({}); setCatalogSelected({});
    setView('new');
  };

  const startEdit = (q) => {
    setEditingQuote(q);
    setClientId(q.clientId||'');
    setCustomClient({name:q.clientName||'',phone:q.clientPhone||'',location:q.location||''});
    setServiceType(q.serviceLabel||'ac_central');
    setNotes(q.notes||''); setLocation(q.location||'');
    setQuoteNo(q.quoteNo||'');
    setContractTerms(q.contractTerms || AC_CONTRACT_TERMS_DEFAULT.map((l,i)=>({id:'ct'+i,label:l,checked:true})));
    setQuoteItems(q.quoteItems || []);
    setPaySchedule(q.paySchedule || [{id:uid(),label:'الدفعة الأولى — عند التعاقد',pct:50},{id:uid(),label:'الدفعة الثانية — عند التسليم',pct:50}]);
    setSpecs(q.specs||''); setWarranty(q.warranty||'');
    setLaborItems(q.laborItems||[]); setShowLaborSection((q.laborItems||[]).length>0);
    setShowCatalogModal(false); setCatalogSupplierId(''); setCatalogQtys({}); setCatalogSelected({});
    setView('new');
  };

  const saveBrandCatalog = () => {
    DB.saveBrands(brands);
    setBrands([...brands]);
    alert('تم حفظ كتالوج الماركات');
  };

  const doPrint = (q) => {
    const client = clientId ? clients.find(c=>c.id===clientId) : null;
    const printData = q || {
      quoteNo, date: new Date().toISOString().slice(0,10),
      clientName: client?.name || customClient.name,
      clientPhone: client?.phone || customClient.phone,
      location: location || client?.address || customClient.location,
      serviceLabel: AC_SERVICE_TYPES.find(s=>s.id===serviceType)?.label || serviceType,
      quoteItems, contractTerms, notes,
      paySchedule, specs, warranty, laborItems,
    };
    setPrintQuote(printData);
    setTimeout(() => setPrintQuote(null), 500);
  };

  const waLink = (q) => {
    const phone = (q.clientPhone||'').replace(/\D/g,'');
    const msg = encodeURIComponent(`السلام عليكم ${q.clientName||''},\nنرفق لكم عرض السعر رقم ${q.quoteNo} من شركة الحمدان للاستشارات الهندسية.\nيُرجى مراجعة العرض والتواصل معنا لأي استفسار.\n📞 واتساب: ${COMPANY_WHATSAPP}`);
    return `https://wa.me/966${phone.slice(-9)}?text=${msg}`;
  };

  const acIsViewer    = user?.role === 'manager' || user?.role === 'accountant'; // can see all quotes
  const acIsManager   = acIsViewer; // kept as alias for non-approval logic (edit/delete/alerts)
  const acCanApprove  = user?.role === 'manager'; // approval only for manager
  const acPending     = quotes.filter(q=>q.approvalStatus==='pending').length;
  const acStatusBadge = (s) => {
    const map = {pending:'bg-amber-100 text-amber-700', approved:'bg-emerald-100 text-emerald-700', rejected:'bg-red-100 text-red-600'};
    const lbl = {pending:'⏳ بانتظار الاعتماد', approved:'✅ معتمد', rejected:'❌ مرفوض'};
    return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${map[s]||'bg-slate-100 text-slate-500'}`}>{lbl[s]||s}</span>;
  };

  // ---- RENDER: Quote List ----
  if (view === 'list') return (
    <div className="fade-in space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">❄️ عروض أسعار التكييف</h2>
          <p className="text-slate-500 text-sm mt-1">{quotes.length} عرض سعر مسجل</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="secondary" onClick={()=>setView('brand_catalog')}>🏷️ كتالوج الماركات</Btn>
          {!acIsManager && <Btn onClick={startNew}>➕ عرض سعر جديد</Btn>}
          {user?.role === 'manager' && <Btn onClick={startNew}>➕ عرض سعر جديد</Btn>}
        </div>
      </div>

      {/* Pending approval alert for manager */}
      {acCanApprove && acPending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <div>
            <div className="font-bold text-amber-800">يوجد {acPending} عرض سعر تكييف بانتظار اعتمادك</div>
            <div className="text-xs text-amber-600 mt-0.5">راجع العروض واعتمد أو ارفض قبل إرسالها للعميل</div>
          </div>
        </div>
      )}
      {!acIsManager && quotes.some(q=>q.approvalStatus==='approved') && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <div className="font-bold text-emerald-800">لديك عروض أسعار معتمدة وجاهزة للإرسال</div>
          </div>
        </div>
      )}

      {quotes.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-16 text-center text-slate-400">
          <div className="text-5xl mb-3">❄️</div>
          <div className="text-lg font-medium">لا توجد عروض أسعار بعد</div>
          <div className="text-sm mt-1">اضغط "عرض سعر جديد" للبدء</div>
          {!acIsManager && <div className="mt-5"><Btn onClick={startNew}>➕ إنشاء أول عرض سعر</Btn></div>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-100">
            <div className="col-span-2">رقم العرض</div>
            <div className="col-span-2">العميل</div>
            <div className="col-span-2">البنود</div>
            <div className="col-span-2">الحالة</div>
            <div className="col-span-2">المهندس</div>
            <div className="col-span-2"></div>
          </div>
          {quotes.map(q => (
            <div key={q.id} className={`grid grid-cols-1 md:grid-cols-12 gap-2 px-5 py-4 border-b border-slate-50 transition items-start ${q.approvalStatus==='pending'?'bg-amber-50/40':''}`}>
              <div className="md:col-span-2">
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">{q.quoteNo}</span>
                <div className="text-xs text-slate-400 mt-1">{q.date}</div>
              </div>
              <div className="md:col-span-2">
                <div className="font-semibold text-slate-800 text-sm">{q.clientName}</div>
                <div className="text-xs text-slate-400">{q.clientPhone}</div>
              </div>
              <div className="md:col-span-2 text-xs text-slate-500 pt-0.5">
                {q.quoteItems ? `${q.quoteItems.length} بند` : (q.selectedBrands||[]).join(' / ')}
              </div>
              <div className="md:col-span-2">
                {acStatusBadge(q.approvalStatus||'pending')}
                {q.approvalStatus==='rejected' && q.approvalNote && <div className="text-xs text-red-500 mt-1">{q.approvalNote}</div>}
              </div>
              <div className="md:col-span-2 text-xs text-slate-500 pt-0.5">{q.createdBy||'-'}</div>
              <div className="md:col-span-2 flex gap-2 flex-wrap pt-0.5">
                {/* Preview - manager sees all, engineers see their own */}
                {(acCanApprove || q.createdBy===user?.name || user?.role==='accountant') && (
                  <button onClick={()=>setPreviewListQ(q)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">👁️ معاينة</button>
                )}
                {/* Approve/Reject - manager only */}
                {acCanApprove && q.approvalStatus==='pending' && (
                  <>
                    <button onClick={()=>approveACQuote(q.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-lg font-semibold transition">✅ اعتماد</button>
                    <button onClick={()=>rejectACQuote(q.id)} className="bg-red-100 hover:bg-red-200 text-red-600 text-xs px-2 py-1 rounded-lg font-semibold transition">❌ رفض</button>
                  </>
                )}
                <button onClick={()=>doPrint(q)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">🖨️ طباعة</button>
                {q.approvalStatus==='approved' && (
                  <a href={waLink(q)} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">💬 إرسال</a>
                )}
                {(user?.role==='manager' || q.createdBy===user?.name) && (
                  <>
                    <button onClick={()=>startEdit(q)} className="text-amber-600 hover:text-amber-800 text-xs font-medium">✏️</button>
                    <button onClick={()=>deleteQuote(q.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">🗑️</button>
                  </>
                )}
                {/* Additional invoice button - manager only */}
                {user?.role==='manager' && (
                  <button onClick={()=>{setAddInvQuote(q);setAddInvForm({description:'',amount:''}); }} className="text-purple-600 hover:text-purple-800 text-xs font-medium">➕ فاتورة</button>
                )}
              </div>
              {/* Additional invoices summary */}
              {(q.additionalInvoices||[]).length > 0 && (
                <div className="md:col-span-12 mt-1 space-y-1 pr-2">
                  {q.additionalInvoices.map(inv=>(
                    <div key={inv.id} className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-lg px-3 py-1.5 text-xs">
                      <span className="text-purple-500">📋</span>
                      <span className="text-slate-600 flex-1">{inv.description}</span>
                      <span className="font-bold text-purple-700">+{Number(inv.amount).toLocaleString()} ر.س</span>
                      <span className="text-slate-400">{inv.date}</span>
                      {user?.role==='manager' && <button onClick={()=>deleteAdditionalInvoice(q.id,inv.id)} className="text-red-400 hover:text-red-600">✕</button>}
                    </div>
                  ))}
                  <div className="flex justify-end gap-3 text-xs px-3 py-1 bg-slate-50 rounded-lg">
                    <span className="text-slate-500">مجموع الفواتير الإضافية:</span>
                    <span className="font-bold text-purple-700">+{(q.additionalInvoices||[]).reduce((s,i)=>s+Number(i.amount),0).toLocaleString()} ر.س</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Additional invoice modal */}
      {addInvQuote && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setAddInvQuote(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">➕ فاتورة تعديل — {addInvQuote.quoteNo}</h3>
              <button onClick={()=>setAddInvQuote(null)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Existing additional invoices */}
              {(quotes.find(q=>q.id===addInvQuote.id)?.additionalInvoices||[]).length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">الفواتير الإضافية</div>
                  {(quotes.find(q=>q.id===addInvQuote.id)?.additionalInvoices||[]).map(inv=>(
                    <div key={inv.id} className="flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2 text-sm">
                      <span className="flex-1 text-slate-700">{inv.description}</span>
                      <span className="font-bold text-purple-700">+{Number(inv.amount).toLocaleString()} ر.س</span>
                      <span className="text-xs text-slate-400">{inv.date}</span>
                      <button onClick={()=>deleteAdditionalInvoice(addInvQuote.id, inv.id)} className="text-red-400 hover:text-red-600 text-xs">🗑️</button>
                    </div>
                  ))}
                  <div className="text-left text-xs font-bold text-purple-700 px-3">
                    المجموع الإضافي: +{(quotes.find(q=>q.id===addInvQuote.id)?.additionalInvoices||[]).reduce((s,i)=>s+Number(i.amount),0).toLocaleString()} ر.س
                  </div>
                </div>
              )}
              {/* Add new invoice */}
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">إضافة فاتورة جديدة</div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">وصف التعديل / الإضافة</label>
                  <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    placeholder="مثال: أعمال إضافية في الدور الثاني..." value={addInvForm.description}
                    onChange={e=>setAddInvForm(p=>({...p,description:e.target.value}))}/>
                </div>
                <div>
                  <label className="text-xs text-slate-500 font-medium">المبلغ الإضافي (ر.س) — قبل الضريبة</label>
                  <input type="number" min="0" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    placeholder="0" value={addInvForm.amount}
                    onChange={e=>setAddInvForm(p=>({...p,amount:e.target.value}))}/>
                  {Number(addInvForm.amount) > 0 && (
                    <div className="text-xs text-slate-500 mt-1">شامل ضريبة 15%: <strong>{(Number(addInvForm.amount)*1.15).toLocaleString('ar-SA',{minimumFractionDigits:2})} ر.س</strong></div>
                  )}
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <Btn variant="secondary" onClick={()=>setAddInvQuote(null)}>إلغاء</Btn>
                  <Btn onClick={()=>addAdditionalInvoice(addInvQuote.id)}>💾 إضافة الفاتورة</Btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal for manager */}
      {previewListQ && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setPreviewListQ(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col" style={{maxHeight:'90vh'}} onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">👁️ معاينة — {previewListQ.quoteNo}</h3>
              <div className="flex gap-2">
                {previewListQ.approvalStatus==='pending' && (
                  <>
                    <button onClick={()=>{approveACQuote(previewListQ.id);setPreviewListQ(null);}} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition">✅ اعتماد</button>
                    <button onClick={()=>{rejectACQuote(previewListQ.id);setPreviewListQ(null);}} className="bg-red-100 hover:bg-red-200 text-red-600 text-xs px-3 py-1.5 rounded-lg font-semibold transition">❌ رفض</button>
                  </>
                )}
                <button onClick={()=>doPrint(previewListQ)} className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2">🖨️</button>
                <button onClick={()=>setPreviewListQ(null)} className="text-slate-400 hover:text-slate-700 text-lg leading-none px-2">✕</button>
              </div>
            </div>
            <iframe srcDoc={previewListQ.quoteItems ? buildFlexACQuoteHTML({quote:previewListQ}) : buildQuoteHTML({quote:previewListQ, brands, type:'ac'})} style={{flex:1,border:'none',minHeight:'70vh'}} title="معاينة عرض السعر"/>
          </div>
        </div>
      )}
    </div>
  );

  // ---- RENDER: Brand Catalog ----
  if (view === 'brand_catalog') return (
    <div className="fade-in space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">🏷️ كتالوج الماركات والأسعار</h2>
          <p className="text-slate-500 text-sm mt-1">إدارة أسعار الوحدات لكل ماركة</p>
        </div>
        <div className="flex gap-2">
          <Btn variant="secondary" onClick={()=>setView('list')}>← رجوع</Btn>
          <Btn onClick={saveBrandCatalog}>💾 حفظ الكتالوج</Btn>
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700">
        💡 سعر التوريد يُستخدم داخلياً لحساب هامش الربح — <strong>لا يظهر للعميل</strong>. سعر البيع هو المبلغ الظاهر في عرض السعر.
      </div>
      {brands.map((brand, bi) => (
        <div key={brand.id} className="bg-white rounded-2xl card-shadow p-5">
          <h3 className="font-bold text-slate-700 text-lg mb-4">🏷️ {brand.name}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs">
                  <th className="p-2 text-right text-slate-500 w-16">الطن</th>
                  <th colSpan={3} className="p-2 text-center bg-slate-100 rounded-r text-slate-600 border-r border-slate-200">🔒 مخفي (وحدة سبليت)</th>
                  <th colSpan={3} className="p-2 text-center bg-slate-100 text-slate-600">📦 كاسيت</th>
                </tr>
                <tr className="bg-slate-50 text-slate-500 text-xs">
                  <th className="p-2"></th>
                  <th className="p-2 text-right">توريد (ر.س)</th>
                  <th className="p-2 text-right">بيع (ر.س)</th>
                  <th className="p-2 text-right text-emerald-600">ربح %</th>
                  <th className="p-2 text-right border-r border-slate-200">توريد (ر.س)</th>
                  <th className="p-2 text-right">بيع (ر.س)</th>
                  <th className="p-2 text-right text-emerald-600">ربح %</th>
                </tr>
              </thead>
              <tbody>
                {brand.units.map((u, ui) => {
                  const hMargin = u.hiddenSupplyPrice > 0 ? Math.round((u.hiddenPrice - u.hiddenSupplyPrice) / u.hiddenSupplyPrice * 100) : 0;
                  const cMargin = u.cassetteSupplyPrice > 0 ? Math.round((u.cassettePrice - u.cassetteSupplyPrice) / u.cassetteSupplyPrice * 100) : 0;
                  const upd = (field, val) => { const nb=brands.map((b,i)=>i===bi?{...b,units:b.units.map((x,j)=>j===ui?{...x,[field]:Number(val)}:x)}:b); setBrands(nb); };
                  return (
                    <tr key={u.tons} className="border-t border-slate-100 hover:bg-slate-50/50">
                      <td className="p-2 font-semibold text-slate-700">{u.tons} طن</td>
                      <td className="p-1.5">
                        <input type="number" min="0" value={u.hiddenSupplyPrice||0} onChange={e=>upd('hiddenSupplyPrice',e.target.value)}
                          className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-orange-50"/>
                      </td>
                      <td className="p-1.5">
                        <input type="number" min="0" value={u.hiddenPrice} onChange={e=>upd('hiddenPrice',e.target.value)}
                          className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                      </td>
                      <td className="p-2 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${hMargin>=20?'bg-emerald-100 text-emerald-700':hMargin>=10?'bg-amber-100 text-amber-700':'bg-red-100 text-red-600'}`}>{hMargin}%</span>
                      </td>
                      <td className="p-1.5 border-r border-slate-100">
                        <input type="number" min="0" value={u.cassetteSupplyPrice||0} onChange={e=>upd('cassetteSupplyPrice',e.target.value)}
                          className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-orange-50"/>
                      </td>
                      <td className="p-1.5">
                        <input type="number" min="0" value={u.cassettePrice} onChange={e=>upd('cassettePrice',e.target.value)}
                          className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                      </td>
                      <td className="p-2 text-center">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cMargin>=20?'bg-emerald-100 text-emerald-700':cMargin>=10?'bg-amber-100 text-amber-700':'bg-red-100 text-red-600'}`}>{cMargin}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );

  // ---- RENDER: Preview ----
  if (view === 'preview') {
    const cl = clientId ? clients.find(c=>c.id===clientId) : null;
    const prevQuote = {
      quoteNo, date: new Date().toISOString().slice(0,10),
      clientName: cl?.name||customClient.name, clientPhone: cl?.phone||customClient.phone,
      location: location||cl?.address||customClient.location,
      serviceLabel: AC_SERVICE_TYPES.find(s=>s.id===serviceType)?.label||serviceType,
      quoteItems, contractTerms, notes,
      paySchedule, specs, warranty, laborItems,
    };
    const html = buildFlexACQuoteHTML({ quote: prevQuote });
    return (
      <div className="fade-in space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">👁️ معاينة عرض السعر</h2>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={()=>setView('new')}>← تعديل</Btn>
            <Btn onClick={()=>doPrint(null)}>🖨️ طباعة</Btn>
          </div>
        </div>
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <iframe srcDoc={html} style={{width:'100%',height:'80vh',border:'none'}} title="معاينة عرض السعر"/>
        </div>
      </div>
    );
  }

  // ---- RENDER: New / Edit Quote Form ----
  const selectedClient = clientId ? clients.find(c=>c.id===clientId) : null;
  const clientName = selectedClient?.name || customClient.name;
  const clientPhone = selectedClient?.phone || customClient.phone;

  return (
    <div className="fade-in space-y-5">
      {printQuote && <QuotePDF quote={printQuote} brands={brands} onClose={()=>setPrintQuote(null)}/>}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">{editingQuote ? '✏️ تعديل عرض السعر' : '➕ عرض سعر جديد'}</h2>
        <Btn variant="secondary" onClick={()=>setView('list')}>← رجوع</Btn>
      </div>

      {/* Notice: editing approved quote resets to pending */}
      {editingQuote && user?.role !== 'manager' && editingQuote.approvalStatus === 'approved' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span>هذا العرض كان معتمداً — بعد الحفظ سيحتاج اعتماداً جديداً من المدير</span>
        </div>
      )}

      {/* Step 1: Quote Info */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-4">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">📋 معلومات العرض</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500 font-medium">رقم العرض</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={quoteNo} onChange={e=>setQuoteNo(e.target.value)}/>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">نوع الخدمة</label>
            <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={serviceType} onChange={e=>setServiceType(e.target.value)}>
              {AC_SERVICE_TYPES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">الموقع / المشروع</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="اسم الموقع أو المشروع" value={location} onChange={e=>setLocation(e.target.value)}/>
          </div>
        </div>
      </div>

      {/* Step 2: Client */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-4">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">🏢 بيانات العميل</h3>
        <div>
          <label className="text-xs text-slate-500 font-medium">اختر من قائمة العملاء (أو اتركه فارغاً للإدخال اليدوي)</label>
          <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            value={clientId} onChange={e=>setClientId(e.target.value)}>
            <option value="">-- إدخال يدوي --</option>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name} {c.phone ? '- '+c.phone : ''}</option>)}
          </select>
        </div>
        {!clientId && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium">اسم العميل</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="اسم العميل" value={customClient.name} onChange={e=>setCustomClient(p=>({...p,name:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">رقم الجوال</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="05xxxxxxxx" value={customClient.phone} onChange={e=>setCustomClient(p=>({...p,phone:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">العنوان</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="العنوان" value={customClient.location} onChange={e=>setCustomClient(p=>({...p,location:e.target.value}))}/>
            </div>
          </div>
        )}
        {selectedClient && (
          <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
            ✅ {selectedClient.name} — {selectedClient.phone} — {selectedClient.address || ''}
          </div>
        )}
      </div>

      {/* Quote Items Section */}
      {(() => {
        const sub = quoteItems.reduce((s,item)=>s+Number(item.salePrice||0)*Number(item.qty||1),0);
        const vat = sub*0.15;
        const total = sub+vat;
        const catalogSupplier = acBrandSuppliers.find(s=>s.id===catalogSupplierId);
        const catalogProducts = catalogSupplier?.products || [];

        const addManualItem = () => {
          setQuoteItems(prev=>[...prev,{ id:uid(), source:'manual', description:'', brand:'', acType:'', tons:'', model:'', qty:1, unit:'قطعة', supplyPrice:'', salePrice:'' }]);
        };

        const updateItem = (id, field, val) => {
          setQuoteItems(prev=>prev.map(item=>item.id===id?{...item,[field]:val}:item));
        };

        const removeItem = (id) => {
          setQuoteItems(prev=>prev.filter(item=>item.id!==id));
        };

        const addFromCatalog = () => {
          const newItems = catalogProducts
            .filter(p=>catalogSelected[p.id])
            .map(p=>({
              id: uid(),
              source: 'catalog',
              description: '',
              brand: p.brand,
              acType: p.acType,
              tons: p.tons,
              model: p.model||'',
              qty: Number(catalogQtys[p.id]||1),
              unit: 'قطعة',
              supplyPrice: p.supplyPrice||'',
              salePrice: p.salePrice||'',
              supplierId: catalogSupplier.id,
              supplierName: catalogSupplier.name,
            }));
          setQuoteItems(prev=>[...prev,...newItems]);
          setShowCatalogModal(false);
          setCatalogSelected({});
          setCatalogQtys({});
        };

        return (
          <div className="bg-white rounded-2xl card-shadow p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-700">📋 بنود عرض السعر</h3>
              <div className="flex gap-2">
                <button onClick={()=>setShowCatalogModal(true)}
                  className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition font-medium">
                  🏭 إضافة من كتالوج المورد
                </button>
                <button onClick={addManualItem}
                  className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition font-medium">
                  ➕ إضافة بند يدوي
                </button>
              </div>
            </div>

            {quoteItems.length === 0 ? (
              <div className="text-center text-slate-400 py-8 text-sm">
                <div className="text-3xl mb-2">📋</div>
                <div>لا توجد بنود بعد — أضف من الكتالوج أو أدخل بنداً يدوياً</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs">
                      <th className="p-2 text-right">#</th>
                      <th className="p-2 text-right">البيان</th>
                      <th className="p-2 text-right">الماركة/النوع/السعة</th>
                      <th className="p-2 text-right">الكمية</th>
                      <th className="p-2 text-right">الوحدة</th>
                      <th className="p-2 text-right">سعر البيع</th>
                      <th className="p-2 text-right">الإجمالي</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quoteItems.map((item,idx)=>{
                      const lineTotal = Number(item.salePrice||0)*Number(item.qty||1);
                      const brandInfo = [item.brand, item.acType ? getLabelById(AC_TYPES,item.acType) : '', item.tons ? item.tons+' طن' : ''].filter(Boolean).join(' / ');
                      return (
                        <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                          <td className="p-2 text-slate-400 text-xs">{idx+1}</td>
                          <td className="p-1.5">
                            <input value={item.description||''} onChange={e=>updateItem(item.id,'description',e.target.value)}
                              placeholder="وصف البند..."
                              className="w-full min-w-32 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="p-2 text-xs text-slate-500">{brandInfo||'-'}</td>
                          <td className="p-1.5">
                            <input type="number" min="1" value={item.qty||1} onChange={e=>updateItem(item.id,'qty',Number(e.target.value))}
                              className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="p-1.5">
                            <input value={item.unit||'قطعة'} onChange={e=>updateItem(item.id,'unit',e.target.value)}
                              className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="p-1.5">
                            <input type="number" min="0" value={item.salePrice||''} onChange={e=>updateItem(item.id,'salePrice',e.target.value)}
                              placeholder="0"
                              className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="p-2 font-semibold text-blue-700 text-xs">{lineTotal>0?lineTotal.toLocaleString()+' ر.س':'-'}</td>
                          <td className="p-1.5">
                            <button onClick={()=>removeItem(item.id)} className="text-red-400 hover:text-red-600 transition">🗑️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Summary */}
            {(quoteItems.length > 0 || laborItems.length > 0) && (
              <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
                {laborItems.length > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>مجموع البنود الأساسية</span>
                    <span className="font-medium">{sub.toLocaleString()} ر.س</span>
                  </div>
                )}
                {laborItems.length > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>مجموع العمالة</span>
                    <span className="font-medium">{laborItems.reduce((s,i)=>s+Number(i.unitPrice||0)*Number(i.qty||1),0).toLocaleString()} ر.س</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>المجموع قبل الضريبة</span>
                  <span className="font-medium">{(sub + laborItems.reduce((s,i)=>s+Number(i.unitPrice||0)*Number(i.qty||1),0)).toLocaleString()} ر.س</span>
                </div>
                <div className="flex justify-between text-amber-600">
                  <span>ضريبة القيمة المضافة 15%</span>
                  <span className="font-medium">{((sub + laborItems.reduce((s,i)=>s+Number(i.unitPrice||0)*Number(i.qty||1),0))*0.15).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س</span>
                </div>
                <div className="flex justify-between text-blue-800 font-bold text-base pt-2 border-t border-blue-100">
                  <span>الإجمالي النهائي</span>
                  <span>{((sub + laborItems.reduce((s,i)=>s+Number(i.unitPrice||0)*Number(i.qty||1),0))*1.15).toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س</span>
                </div>
              </div>
            )}

            {/* Catalog Modal */}
            {showCatalogModal && (
              <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setShowCatalogModal(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e=>e.stopPropagation()}>
                  <div className="flex justify-between items-center px-5 py-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800">🏭 إضافة من كتالوج المورد</h3>
                    <button onClick={()=>setShowCatalogModal(false)} className="text-slate-400 hover:text-slate-700 text-xl">✕</button>
                  </div>
                  <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div>
                      <label className="text-xs text-slate-500 font-medium block mb-1">اختر المورد</label>
                      <select value={catalogSupplierId} onChange={e=>{setCatalogSupplierId(e.target.value);setCatalogSelected({});setCatalogQtys({});}}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                        <option value="">-- اختر مورد --</option>
                        {acBrandSuppliers.map(s=><option key={s.id} value={s.id}>{s.name}{(s.products||[]).length>0?' ('+s.products.length+' منتج)':''}</option>)}
                      </select>
                    </div>

                    {catalogSupplierId && catalogProducts.length === 0 && (
                      <div className="text-center text-slate-400 py-6 text-sm">لا توجد منتجات في كتالوج هذا المورد</div>
                    )}

                    {catalogProducts.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-slate-500">منتجات المورد — اختر ما تريد إضافته</div>
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-slate-600">
                              <th className="px-2 py-1.5 w-8"></th>
                              <th className="px-2 py-1.5 text-right">الماركة</th>
                              <th className="px-2 py-1.5 text-right">النوع</th>
                              <th className="px-2 py-1.5 text-right">السعة</th>
                              <th className="px-2 py-1.5 text-right">سعر البيع</th>
                              <th className="px-2 py-1.5 text-right">الكمية</th>
                            </tr>
                          </thead>
                          <tbody>
                            {catalogProducts.map((p,i)=>(
                              <tr key={p.id||i} className={`${i%2===0?'bg-white':'bg-slate-50'} ${catalogSelected[p.id]?'bg-blue-50':''}`}>
                                <td className="px-2 py-1.5 text-center">
                                  <input type="checkbox" checked={!!catalogSelected[p.id]}
                                    onChange={e=>setCatalogSelected(prev=>({...prev,[p.id]:e.target.checked}))}
                                    className="w-4 h-4 accent-blue-600"/>
                                </td>
                                <td className="px-2 py-1.5 font-medium text-slate-700">{p.brand}</td>
                                <td className="px-2 py-1.5 text-slate-500">{getLabelById(AC_TYPES,p.acType)||p.acType}</td>
                                <td className="px-2 py-1.5 text-slate-500">{p.tons} طن</td>
                                <td className="px-2 py-1.5 text-blue-700 font-semibold">{p.salePrice?Number(p.salePrice).toLocaleString()+' ر.س':'-'}</td>
                                <td className="px-2 py-1.5">
                                  <input type="number" min="1" value={catalogQtys[p.id]||1}
                                    onChange={e=>setCatalogQtys(prev=>({...prev,[p.id]:Number(e.target.value)}))}
                                    disabled={!catalogSelected[p.id]}
                                    className="w-16 border border-slate-200 rounded-lg px-2 py-0.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-40"/>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
                    <button onClick={addFromCatalog}
                      disabled={!Object.values(catalogSelected).some(Boolean)}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-2 rounded-xl text-sm font-semibold transition">
                      ✅ إضافة المحدد ({Object.values(catalogSelected).filter(Boolean).length} منتج)
                    </button>
                    <button onClick={()=>setShowCatalogModal(false)}
                      className="px-5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition">إلغاء</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Labor Items Section */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-3">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h3 className="font-bold text-slate-700">👷 بنود العمالة</h3>
          <button onClick={()=>setShowLaborSection(s=>!s)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium">
            {showLaborSection ? '▲ إخفاء' : '▼ إظهار / إضافة'}
          </button>
        </div>
        {showLaborSection && (
          <div className="space-y-3">
            <button onClick={()=>setLaborItems(prev=>[...prev,{id:uid(),description:'',qty:1,unit:'بند',unitPrice:''}])}
              className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition font-medium">
              ➕ إضافة بند عمالة
            </button>
            {laborItems.length === 0 ? (
              <div className="text-center text-slate-400 py-4 text-sm">لا توجد بنود عمالة بعد</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs">
                      <th className="p-2 text-right">الوصف</th>
                      <th className="p-2 text-right">الكمية</th>
                      <th className="p-2 text-right">الوحدة</th>
                      <th className="p-2 text-right">سعر الوحدة</th>
                      <th className="p-2 text-right">الإجمالي</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborItems.map((item)=>{
                      const lineTotal = Number(item.unitPrice||0)*Number(item.qty||1);
                      return (
                        <tr key={item.id} className="border-t border-slate-100">
                          <td className="p-1.5">
                            <input value={item.description||''} onChange={e=>setLaborItems(prev=>prev.map(x=>x.id===item.id?{...x,description:e.target.value}:x))}
                              placeholder="وصف العمل..."
                              className="w-full min-w-32 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="p-1.5">
                            <input type="number" min="1" value={item.qty||1} onChange={e=>setLaborItems(prev=>prev.map(x=>x.id===item.id?{...x,qty:Number(e.target.value)}:x))}
                              className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="p-1.5">
                            <input value={item.unit||'بند'} onChange={e=>setLaborItems(prev=>prev.map(x=>x.id===item.id?{...x,unit:e.target.value}:x))}
                              className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="p-1.5">
                            <input type="number" min="0" value={item.unitPrice||''} onChange={e=>setLaborItems(prev=>prev.map(x=>x.id===item.id?{...x,unitPrice:e.target.value}:x))}
                              placeholder="0"
                              className="w-24 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                          </td>
                          <td className="p-2 font-semibold text-emerald-700 text-xs">{lineTotal>0?lineTotal.toLocaleString()+' ر.س':'-'}</td>
                          <td className="p-1.5">
                            <button onClick={()=>setLaborItems(prev=>prev.filter(x=>x.id!==item.id))} className="text-red-400 hover:text-red-600 transition">🗑️</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {laborItems.length > 0 && (
              <div className="text-left text-sm font-bold text-emerald-700 px-2">
                إجمالي العمالة: {laborItems.reduce((s,i)=>s+Number(i.unitPrice||0)*Number(i.qty||1),0).toLocaleString()} ر.س
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Schedule */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-3">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">💳 جدول الدفعات</h3>
        {(() => {
          const grandTotal = (quoteItems.reduce((s,i)=>s+Number(i.salePrice||0)*Number(i.qty||1),0) + laborItems.reduce((s,i)=>s+Number(i.unitPrice||0)*Number(i.qty||1),0)) * 1.15;
          const totalPct = paySchedule.reduce((s,p)=>s+Number(p.pct||0),0);
          return (
            <div className="space-y-3">
              {totalPct !== 100 && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ مجموع النسب: {totalPct}% (يجب أن يكون 100%)
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs">
                      <th className="p-2 text-right">وصف الدفعة</th>
                      <th className="p-2 text-right">النسبة %</th>
                      <th className="p-2 text-right">المبلغ (ر.س)</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paySchedule.map((p)=>(
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="p-1.5">
                          <input value={p.label||''} onChange={e=>setPaySchedule(prev=>prev.map(x=>x.id===p.id?{...x,label:e.target.value}:x))}
                            className="w-full min-w-40 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                        </td>
                        <td className="p-1.5">
                          <input type="number" min="0" max="100" value={p.pct||''} onChange={e=>setPaySchedule(prev=>prev.map(x=>x.id===p.id?{...x,pct:Number(e.target.value)}:x))}
                            className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"/>
                        </td>
                        <td className="p-2 text-xs font-semibold text-blue-700">
                          {grandTotal > 0 ? Math.round(grandTotal*Number(p.pct||0)/100).toLocaleString()+' ر.س' : '-'}
                        </td>
                        <td className="p-1.5">
                          <button onClick={()=>setPaySchedule(prev=>prev.filter(x=>x.id!==p.id))} className="text-red-400 hover:text-red-600 transition">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={()=>setPaySchedule(prev=>[...prev,{id:uid(),label:'دفعة جديدة',pct:0}])}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg transition font-medium">
                ➕ إضافة دفعة
              </button>
            </div>
          );
        })()}
      </div>

      {/* Specs */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-3">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">📐 المواصفات الفنية</h3>
        <textarea
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          rows={4} placeholder="أدخل المواصفات الفنية للمواد والمعدات..."
          value={specs} onChange={e=>setSpecs(e.target.value)}/>
        <p className="text-xs text-slate-400">تظهر في عرض السعر المطبوع تحت جدول البنود</p>
      </div>

      {/* Warranty */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-3">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">🛡️ بنود الضمان</h3>
        <textarea
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          rows={3} placeholder="مثال: ضمان سنة على قطع الغيار، ضمان سنتين على العمالة..."
          value={warranty} onChange={e=>setWarranty(e.target.value)}/>
      </div>

      {/* Contract Terms */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-3">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h3 className="font-bold text-slate-700">✅ ما يشمله العقد</h3>
          <span className="text-xs text-slate-400">{contractTerms.filter(t=>t.checked).length} بند محدد</span>
        </div>
        <div className="space-y-2">
          {contractTerms.map(t=>(
            <label key={t.id} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded-lg px-2 py-1.5 transition">
              <input type="checkbox" checked={t.checked} onChange={e=>setContractTerms(prev=>prev.map(x=>x.id===t.id?{...x,checked:e.target.checked}:x))}
                className="w-4 h-4 accent-blue-600"/>
              <span className="text-sm text-slate-700">{t.label}</span>
              <button onClick={()=>setContractTerms(prev=>prev.filter(x=>x.id!==t.id))} className="mr-auto text-red-400 hover:text-red-600 text-xs opacity-50 hover:opacity-100 transition">✕</button>
            </label>
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <input className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="أضف بنداً جديداً..." value={customTermInput} onChange={e=>setCustomTermInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter'&&customTermInput.trim()){ setContractTerms(prev=>[...prev,{id:uid(),label:customTermInput.trim(),checked:true}]); setCustomTermInput(''); }}}/>
          <Btn size="sm" onClick={()=>{ if(customTermInput.trim()){ setContractTerms(prev=>[...prev,{id:uid(),label:customTermInput.trim(),checked:true}]); setCustomTermInput(''); }}}>➕ إضافة</Btn>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl card-shadow p-5">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3">📝 ملاحظات إضافية</h3>
        <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          rows={3} placeholder="أي ملاحظات أو شروط إضافية..." value={notes} onChange={e=>setNotes(e.target.value)}/>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Btn onClick={saveQuote}>💾 حفظ عرض السعر</Btn>
        <Btn variant="secondary" onClick={()=>setView('preview')}>👁️ معاينة</Btn>
        <Btn variant="secondary" onClick={()=>doPrint(null)}>🖨️ طباعة PDF</Btn>
        {(clientPhone || customClient.phone) && (
          <a href={waLink({clientName:clientName,clientPhone:clientPhone||customClient.phone,quoteNo})}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition">
            💬 إرسال عبر واتساب
          </a>
        )}
        <Btn variant="secondary" onClick={()=>setView('list')}>إلغاء</Btn>
      </div>

      {/* Profit Modal (Change 6) */}
      {showProfitModal && savedQuoteProfit && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="text-center">
              <div className="text-2xl mb-2">🔒</div>
              <h3 className="font-bold text-slate-800 text-lg">تحليل الربحية — {savedQuoteProfit.quoteNo}</h3>
              <div className="text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-2">
                داخلي فقط — هذه الأرقام سرية ولا تظهر في عرض السعر المرسل للعميل
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 text-sm">إجمالي المبيعات</span>
                <span className="font-semibold text-slate-800">{savedQuoteProfit.revenue.toLocaleString()} ر.س</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 text-sm">إجمالي التكاليف</span>
                <span className="font-semibold text-orange-700">{savedQuoteProfit.cost.toLocaleString()} ر.س</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500 text-sm">صافي الربح</span>
                <span className="font-bold text-emerald-700">{savedQuoteProfit.profit.toLocaleString()} ر.س</span>
              </div>
              {savedQuoteProfit.profitPct !== null && (
                <div className="flex justify-between py-2">
                  <span className="text-slate-500 text-sm">نسبة الربح</span>
                  <span className={`font-bold text-xl px-3 py-0.5 rounded-full ${
                    savedQuoteProfit.profitPct >= 20 ? 'bg-emerald-100 text-emerald-700' :
                    savedQuoteProfit.profitPct >= 10 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-600'
                  }`}>{savedQuoteProfit.profitPct}%</span>
                </div>
              )}
            </div>
            <Btn onClick={()=>{ setShowProfitModal(false); setSavedQuoteProfit(null); setView('list'); }} className="w-full">
              ✅ تم — الانتقال للقائمة
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== ENGINEERING QUOTE BUILDER ====================

const ENG_SERVICES = [
  { id:'license',            label:'استخراج رخصة بناء' },
  { id:'supervision',        label:'إشراف هندسي' },
  { id:'plans',              label:'إعداد مخططات هندسية' },
  { id:'correction',         label:'تصحيح وضع قائم' },
  { id:'renovation_license', label:'رخصة ترميم' },
  { id:'license_renewal',    label:'تجديد رخصة' },
  { id:'interior_design',    label:'تصميم داخلي' },
  { id:'subdivision',        label:'تجزئة أرض' },
  { id:'merge',              label:'دمج قطع' },
  { id:'construction_license',label:'رخصة تشييد' },
  { id:'other',              label:'أخرى' },
];

// Default items per engineering service
const ENG_DEFAULT_ITEMS = {
  license:           [
    { label:'زيارة الموقع والمعاينة',         unit:'زيارة', price:500,  qty:1 },
    { label:'إعداد ملف الرخصة والمستندات',    unit:'ملف',   price:800,  qty:1 },
    { label:'متابعة البلدية حتى الإصدار',     unit:'شهر',   price:600,  qty:2 },
    { label:'رسوم البلدية (على العميل)',       unit:'رسوم',  price:0,    qty:1 },
  ],
  supervision:       [
    { label:'زيارات إشراف أسبوعية',           unit:'زيارة', price:400,  qty:4 },
    { label:'إعداد تقارير الإشراف الشهرية',   unit:'تقرير', price:500,  qty:1 },
    { label:'متابعة المقاولين والموردين',      unit:'شهر',   price:1000, qty:1 },
    { label:'محضر الاستلام النهائي',          unit:'محضر',  price:600,  qty:1 },
  ],
  plans:             [
    { label:'المخططات المعمارية',             unit:'مجموعة',price:2000, qty:1 },
    { label:'المخططات الإنشائية',             unit:'مجموعة',price:2500, qty:1 },
    { label:'مخططات الكهرباء والإنارة',       unit:'مجموعة',price:1500, qty:1 },
    { label:'مخططات الصرف الصحي',            unit:'مجموعة',price:1500, qty:1 },
    { label:'مخطط الموقع العام',              unit:'مجموعة',price:800,  qty:1 },
  ],
  correction:        [
    { label:'فحص الوضع القائم وتوثيقه',       unit:'يوم',   price:800,  qty:1 },
    { label:'إعداد مخططات الوضع القائم',      unit:'مجموعة',price:1800, qty:1 },
    { label:'متابعة إجراءات التصحيح',         unit:'شهر',   price:1200, qty:2 },
  ],
  renovation_license:[
    { label:'زيارة الموقع وتقييم الترميم',    unit:'زيارة', price:500,  qty:1 },
    { label:'إعداد ملف رخصة الترميم',        unit:'ملف',   price:700,  qty:1 },
    { label:'متابعة البلدية حتى الإصدار',     unit:'شهر',   price:600,  qty:2 },
  ],
  license_renewal:   [
    { label:'مراجعة ملف الرخصة الحالية',     unit:'ملف',   price:300,  qty:1 },
    { label:'إعداد وثائق التجديد',            unit:'ملف',   price:500,  qty:1 },
    { label:'متابعة إجراءات التجديد',         unit:'شهر',   price:400,  qty:1 },
  ],
  interior_design:   [
    { label:'التصميم الداخلي 2D',             unit:'مجموعة',price:3000, qty:1 },
    { label:'مجسمات ثلاثية الأبعاد 3D',      unit:'مجموعة',price:2500, qty:1 },
    { label:'إشراف على التنفيذ',              unit:'شهر',   price:1500, qty:2 },
  ],
  subdivision:       [
    { label:'رفع مساحي للأرض',               unit:'رفع',   price:1200, qty:1 },
    { label:'إعداد مخططات التجزئة',           unit:'مجموعة',price:1500, qty:1 },
    { label:'متابعة اعتماد التجزئة',           unit:'شهر',   price:700,  qty:2 },
  ],
  merge:             [
    { label:'رفع مساحي للقطع',               unit:'رفع',   price:1200, qty:1 },
    { label:'إعداد مخططات الدمج',            unit:'مجموعة',price:1500, qty:1 },
    { label:'متابعة إجراءات الاعتماد',        unit:'شهر',   price:700,  qty:2 },
  ],
  construction_license:[
    { label:'معاينة الموقع',                  unit:'زيارة', price:600,  qty:1 },
    { label:'إعداد المخططات اللازمة',         unit:'مجموعة',price:3000, qty:1 },
    { label:'متابعة رخصة التشييد',            unit:'شهر',   price:800,  qty:3 },
  ],
  other:             [
    { label:'استشارة هندسية',                 unit:'ساعة',  price:300,  qty:1 },
  ],
};

const ENG_PAYMENT_SCHEDULES = [
  { label:'عند التعاقد',      pct:30 },
  { label:'منتصف التنفيذ',   pct:40 },
  { label:'عند الاستلام',     pct:30 },
];

function EngQuotePDF({ quote }) {
  const html = buildQuoteHTML({ quote, brands: [], type: 'eng' });
  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
  return null;
}

function EngineeringQuoteBuilderPage({ user }) {
  // who can CREATE quotes
  const canCreate = user?.role === 'engineer' || user?.role === 'manager';
  // manager/accountant see all, engineers see own dept
  const [quotes, setQuotes]     = useState(DB.getEngQuotes());
  const [view, setView]         = useState('list');
  const [editingQ, setEditingQ] = useState(null);
  const [triggerPrint, setTriggerPrint] = useState(null);
  useRealTimeSync(() => { if (view === 'list') setQuotes(DB.getEngQuotes()); });

  // Form state
  const [clientId,     setClientId]     = useState('');
  const [customClient, setCustomClient] = useState({ name:'', phone:'', location:'' });
  const [serviceId,    setServiceId]    = useState('license');
  const [location,     setLocation]     = useState('');
  const [scope,        setScope]        = useState('');
  const [notes,        setNotes]        = useState('');
  const [quoteNo,      setQuoteNo]      = useState('');
  const [items,        setItems]        = useState([]);
  const [paySchedule,  setPaySchedule]  = useState([...ENG_PAYMENT_SCHEDULES]);
  const [engTerms,     setEngTerms]     = useState([]);
  const [engTermInput, setEngTermInput] = useState('');

  const clients = DB.getClients();

  const resetForm = (svcId) => {
    const svc = svcId || 'license';
    setServiceId(svc);
    setItems((ENG_DEFAULT_ITEMS[svc] || ENG_DEFAULT_ITEMS.other).map((it)=>({...it, id:uid()})));
    setPaySchedule([...ENG_PAYMENT_SCHEDULES]);
    setClientId(''); setCustomClient({name:'',phone:'',location:''});
    setLocation(''); setScope(''); setNotes('');
    setQuoteNo('EQ-' + Date.now().toString().slice(-6));
    const defaultTerms = (ENG_CONTRACT_TERMS_BY_SERVICE[svc]||ENG_CONTRACT_TERMS_BY_SERVICE.other);
    setEngTerms(defaultTerms.map((l,i)=>({id:'et'+i,label:l,checked:true})));
  };

  const startNew = () => { resetForm('license'); setEditingQ(null); setView('new'); };

  const startEdit = (q) => {
    setEditingQ(q);
    setClientId(q.clientId||'');
    setCustomClient({name:q.clientName||'',phone:q.clientPhone||'',location:q.location||''});
    setServiceId(q.serviceId||'license');
    setLocation(q.location||'');
    setScope(q.scope||'');
    setNotes(q.notes||'');
    setQuoteNo(q.quoteNo||'');
    setItems((q.items||[]).map(it=>({...it, id:it.id||uid()})));
    setPaySchedule(q.paySchedule||[...ENG_PAYMENT_SCHEDULES]);
    const svc = q.serviceId||'license';
    setEngTerms(q.contractTerms || (ENG_CONTRACT_TERMS_BY_SERVICE[svc]||ENG_CONTRACT_TERMS_BY_SERVICE.other).map((l,i)=>({id:'et'+i,label:l,checked:true})));
    setView('new');
  };

  const saveQuote = () => {
    const cl = clientId ? clients.find(c=>c.id===clientId) : null;
    const isManager = user?.role === 'manager';
    const q = {
      id: editingQ?.id || uid(),
      quoteNo,
      date: new Date().toISOString().slice(0,10),
      clientId,
      clientName:  cl?.name  || customClient.name,
      clientPhone: cl?.phone || customClient.phone,
      location:    location  || cl?.address || customClient.location,
      serviceId,
      serviceLabel: ENG_SERVICES.find(s=>s.id===serviceId)?.label || serviceId,
      scope, notes, items, paySchedule,
      contractTerms: engTerms,
      createdBy: user?.name || '',
      // Manager: preserve existing status (or auto-approve). Engineer: always pending (needs re-approval after any save/edit)
      approvalStatus: (user?.role==='manager') ? (editingQ?.approvalStatus || 'approved') : 'pending',
      approvalNote: (user?.role==='manager') ? (editingQ?.approvalNote || '') : '',
    };
    const all = DB.getEngQuotes();
    DB.saveEngQuotes(editingQ ? all.map(x=>x.id===editingQ.id?q:x) : [...all, q]);
    setQuotes(DB.getEngQuotes());
    logActivity(user, editingQ ? 'updated' : 'added', 'eng_quote', q.quoteNo, q.clientName||'');
    if (!editingQ) notifyManagers(`${user?.name||''} أضاف عرض سعر هندسي: ${q.quoteNo}`, 'eng_quote', q.id, user?.name);
    setView('list'); setEditingQ(null);
  };

  const deleteQuote = (id) => {
    if (!confirm('حذف عرض السعر؟')) return;
    DB.saveEngQuotes(DB.getEngQuotes().filter(q=>q.id!==id));
    setQuotes(DB.getEngQuotes());
  };

  const approveQuote = (id) => {
    const all = DB.getEngQuotes();
    const approvedQ = all.find(q=>q.id===id);
    DB.saveEngQuotes(all.map(q=>q.id===id?{...q,approvalStatus:'approved',approvalNote:''}:q));
    setQuotes(DB.getEngQuotes());
    logActivity(user, 'approved', 'eng_quote', approvedQ?.quoteNo||id, '');
    const creator = DB.getUsers().find(u=>u.name===approvedQ?.createdBy);
    if (creator) notifyUsers([creator.id], `تم اعتماد عرض السعر الهندسي ${approvedQ?.quoteNo} بواسطة ${user?.name}`, 'eng_quote', id, user?.name);
  };

  const rejectQuote = (id) => {
    const reason = prompt('سبب الرفض (اختياري):') || '';
    const all = DB.getEngQuotes();
    const rejQ = all.find(q=>q.id===id);
    DB.saveEngQuotes(all.map(q=>q.id===id?{...q,approvalStatus:'rejected',approvalNote:reason}:q));
    setQuotes(DB.getEngQuotes());
    logActivity(user, 'rejected', 'eng_quote', rejQ?.quoteNo||id, reason);
    const creator = DB.getUsers().find(u=>u.name===rejQ?.createdBy);
    if (creator) notifyUsers([creator.id], `تم رفض عرض السعر الهندسي ${rejQ?.quoteNo}: ${reason||''}`, 'eng_quote', id, user?.name);
  };

  const buildCurrentQuoteObj = () => {
    const cl = clientId ? clients.find(c=>c.id===clientId) : null;
    return {
      quoteNo, date: new Date().toISOString().slice(0,10),
      clientName: cl?.name||customClient.name, clientPhone: cl?.phone||customClient.phone,
      location: location||cl?.address||customClient.location,
      serviceLabel: ENG_SERVICES.find(s=>s.id===serviceId)?.label||serviceId,
      scope, notes, items, paySchedule,
      contractTerms: engTerms,
    };
  };

  const doPrint = (q) => {
    if (q) { EngQuotePDF({ quote: q }); return; }
    EngQuotePDF({ quote: buildCurrentQuoteObj() });
  };

  const waLink = (q) => {
    const phone = (q.clientPhone||'').replace(/\D/g,'');
    const msg = encodeURIComponent(`السلام عليكم ${q.clientName||''},\nنرفق لكم عرض السعر رقم ${q.quoteNo} من شركة الحمدان للاستشارات الهندسية بخصوص ${q.serviceLabel||'الخدمة الهندسية'}.\nيُرجى التواصل معنا للاستفسار.\n📞 واتساب: ${COMPANY_WHATSAPP}`);
    return `https://wa.me/966${phone.slice(-9)}?text=${msg}`;
  };

  // Item table helpers
  const addItem = () => setItems(p=>[...p, {id:uid(), label:'', unit:'بند', price:0, qty:1}]);
  const removeItem = (id) => setItems(p=>p.filter(i=>i.id!==id));
  const updateItem = (id, k, v) => setItems(p=>p.map(i=>i.id===id?{...i,[k]:k==='price'||k==='qty'?Number(v):v}:i));

  const subtotal  = items.reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||0),0);
  const vatAmt    = subtotal * 0.15;
  const totalAmt  = subtotal + vatAmt;

  const isViewer    = user?.role === 'manager' || user?.role === 'accountant'; // see all quotes
  const isManager   = isViewer; // alias for non-approval UI
  const canApproveEng = user?.role === 'manager'; // approval: manager only
  const [previewEngQ, setPreviewEngQ] = useState(null); // list-view preview modal
  const pendingCount = quotes.filter(q=>q.approvalStatus==='pending').length;

  const statusBadge = (s) => {
    const map = {
      pending:  'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-600',
      sent:     'bg-blue-100 text-blue-700',
    };
    const lbl = {pending:'⏳ بانتظار الاعتماد', approved:'✅ معتمد', rejected:'❌ مرفوض', sent:'📤 تم الإرسال'};
    return <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${map[s]||'bg-slate-100 text-slate-500'}`}>{lbl[s]||s}</span>;
  };

  // ---- LIST VIEW ----
  if (view === 'list') return (
    <div className="fade-in space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">📐 عروض الأسعار الهندسية</h2>
          <p className="text-slate-500 text-sm mt-1">{quotes.length} عرض سعر مسجل</p>
        </div>
        {canCreate && !isManager && <Btn onClick={startNew}>➕ عرض سعر جديد</Btn>}
        {canCreate && user?.role === 'manager' && <Btn onClick={startNew}>➕ عرض سعر جديد</Btn>}
      </div>

      {/* Manager pending approval alert */}
      {canApproveEng && pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <div>
            <div className="font-bold text-amber-800">يوجد {pendingCount} عرض سعر بانتظار اعتمادك</div>
            <div className="text-xs text-amber-600 mt-0.5">راجع العروض أدناه واعتمد أو ارفض قبل إرسالها للعميل</div>
          </div>
        </div>
      )}

      {/* Engineer approved notification */}
      {!isManager && quotes.some(q=>q.approvalStatus==='approved') && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <div className="font-bold text-emerald-800">لديك عروض أسعار معتمدة وجاهزة للإرسال</div>
            <div className="text-xs text-emerald-600 mt-0.5">يمكنك الآن طباعتها وإرسالها للعميل عبر واتساب</div>
          </div>
        </div>
      )}

      {quotes.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-16 text-center text-slate-400">
          <div className="text-5xl mb-3">📐</div>
          <div className="text-lg font-medium">لا توجد عروض أسعار هندسية بعد</div>
          {canCreate && <div className="mt-5"><Btn onClick={startNew}>➕ إنشاء أول عرض</Btn></div>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-2 px-5 py-3 bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-100">
            <div className="col-span-2">رقم العرض</div>
            <div className="col-span-2">العميل</div>
            <div className="col-span-2">الخدمة</div>
            <div className="col-span-2">الحالة</div>
            <div className="col-span-2">المهندس</div>
            <div className="col-span-2"></div>
          </div>
          {quotes.map(q=>(
            <div key={q.id} className={`grid grid-cols-1 md:grid-cols-12 gap-2 px-5 py-4 border-b border-slate-50 transition items-start ${q.approvalStatus==='pending'?'bg-amber-50/40':q.approvalStatus==='approved'?'hover:bg-emerald-50/20 hover:bg-slate-50/50':''}`}>
              <div className="md:col-span-2">
                <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full font-semibold">{q.quoteNo}</span>
                <div className="text-xs text-slate-400 mt-1">{q.date}</div>
              </div>
              <div className="md:col-span-2">
                <div className="font-semibold text-slate-800 text-sm">{q.clientName}</div>
                <div className="text-xs text-slate-400">{q.clientPhone}</div>
              </div>
              <div className="md:col-span-2 text-xs text-slate-600 pt-0.5">{q.serviceLabel}</div>
              <div className="md:col-span-2">
                {statusBadge(q.approvalStatus||'pending')}
                {q.approvalStatus==='rejected' && q.approvalNote && (
                  <div className="text-xs text-red-500 mt-1">{q.approvalNote}</div>
                )}
              </div>
              <div className="md:col-span-2 text-xs text-slate-500 pt-0.5">{q.createdBy||'-'}</div>
              <div className="md:col-span-2 flex gap-2 flex-wrap pt-0.5">
                {/* Preview - manager sees all, engineers see their own */}
                {(canApproveEng || q.createdBy===user?.name || user?.role==='accountant') && (
                  <button onClick={()=>setPreviewEngQ(q)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">👁️ معاينة</button>
                )}
                {/* Approve/Reject - manager only */}
                {canApproveEng && q.approvalStatus==='pending' && (
                  <>
                    <button onClick={()=>approveQuote(q.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-2 py-1 rounded-lg font-semibold transition">✅ اعتماد</button>
                    <button onClick={()=>rejectQuote(q.id)} className="bg-red-100 hover:bg-red-200 text-red-600 text-xs px-2 py-1 rounded-lg font-semibold transition">❌ رفض</button>
                  </>
                )}
                {/* Print - always available */}
                <button onClick={()=>doPrint(q)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">🖨️ طباعة</button>
                {/* WhatsApp - only when approved */}
                {q.approvalStatus==='approved' && (
                  <a href={waLink(q)} target="_blank" rel="noreferrer" className="text-emerald-600 hover:text-emerald-800 text-xs font-medium">💬 إرسال</a>
                )}
                {/* Edit/Delete - engineer who created + manager */}
                {(user?.role==='manager' || q.createdBy===user?.name) && (
                  <>
                    <button onClick={()=>startEdit(q)} className="text-amber-600 hover:text-amber-800 text-xs font-medium">✏️</button>
                    <button onClick={()=>deleteQuote(q.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">🗑️</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal for manager */}
      {previewEngQ && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={()=>setPreviewEngQ(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col" style={{maxHeight:'90vh'}} onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">👁️ معاينة — {previewEngQ.quoteNo}</h3>
              <div className="flex gap-2">
                {previewEngQ.approvalStatus==='pending' && (
                  <>
                    <button onClick={()=>{approveQuote(previewEngQ.id);setPreviewEngQ(null);}} className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition">✅ اعتماد</button>
                    <button onClick={()=>{rejectQuote(previewEngQ.id);setPreviewEngQ(null);}} className="bg-red-100 hover:bg-red-200 text-red-600 text-xs px-3 py-1.5 rounded-lg font-semibold transition">❌ رفض</button>
                  </>
                )}
                <button onClick={()=>doPrint(previewEngQ)} className="text-blue-600 hover:text-blue-800 text-xs font-medium px-2">🖨️</button>
                <button onClick={()=>setPreviewEngQ(null)} className="text-slate-400 hover:text-slate-700 text-lg leading-none px-2">✕</button>
              </div>
            </div>
            <iframe srcDoc={buildQuoteHTML({quote:previewEngQ, brands:[], type:'eng'})} style={{flex:1,border:'none',minHeight:'70vh'}} title="معاينة عرض السعر"/>
          </div>
        </div>
      )}
    </div>
  );

  // ---- PREVIEW VIEW ----
  if (view === 'preview') {
    const html = buildQuoteHTML({ quote: buildCurrentQuoteObj(), brands: [], type: 'eng' });
    return (
      <div className="fade-in space-y-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <h2 className="text-2xl font-bold text-slate-800">👁️ معاينة عرض السعر</h2>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={()=>setView('new')}>← تعديل</Btn>
            <Btn onClick={()=>doPrint(null)}>🖨️ طباعة PDF</Btn>
          </div>
        </div>
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          <iframe srcDoc={html} style={{width:'100%',height:'80vh',border:'none'}} title="معاينة عرض السعر"/>
        </div>
      </div>
    );
  }

  // ---- FORM VIEW ----
  const selClient = clientId ? clients.find(c=>c.id===clientId) : null;

  return (
    <div className="fade-in space-y-5">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">{editingQ?'✏️ تعديل عرض السعر':'➕ عرض سعر هندسي جديد'}</h2>
        <Btn variant="secondary" onClick={()=>setView('list')}>← رجوع</Btn>
      </div>

      {/* Notice: editing approved quote resets to pending */}
      {editingQ && user?.role !== 'manager' && editingQ.approvalStatus === 'approved' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <span>هذا العرض كان معتمداً — بعد الحفظ سيحتاج اعتماداً جديداً من المدير</span>
        </div>
      )}

      {/* Quote info */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-4">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">📋 معلومات العرض</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500 font-medium">رقم العرض</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={quoteNo} onChange={e=>setQuoteNo(e.target.value)}/>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">نوع الخدمة</label>
            <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              value={serviceId} onChange={e=>{ const sv=e.target.value; setServiceId(sv); setItems((ENG_DEFAULT_ITEMS[sv]||ENG_DEFAULT_ITEMS.other).map(it=>({...it,id:uid()}))); const dt=(ENG_CONTRACT_TERMS_BY_SERVICE[sv]||ENG_CONTRACT_TERMS_BY_SERVICE.other); setEngTerms(dt.map((l,i)=>({id:'et'+i,label:l,checked:true}))); }}>
              {ENG_SERVICES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-medium">الموقع / المشروع</label>
            <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="اسم الموقع أو المشروع" value={location} onChange={e=>setLocation(e.target.value)}/>
          </div>
        </div>
      </div>

      {/* Client */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-4">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">🏢 بيانات العميل</h3>
        <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          value={clientId} onChange={e=>setClientId(e.target.value)}>
          <option value="">-- إدخال يدوي --</option>
          {clients.map(c=><option key={c.id} value={c.id}>{c.name}{c.phone?' - '+c.phone:''}</option>)}
        </select>
        {!clientId && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium">اسم العميل</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={customClient.name} onChange={e=>setCustomClient(p=>({...p,name:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">رقم الجوال</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                placeholder="05xxxxxxxx" value={customClient.phone} onChange={e=>setCustomClient(p=>({...p,phone:e.target.value}))}/>
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">العنوان</label>
              <input className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={customClient.location} onChange={e=>setCustomClient(p=>({...p,location:e.target.value}))}/>
            </div>
          </div>
        )}
        {selClient && <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">✅ {selClient.name} — {selClient.phone}</div>}
      </div>

      {/* Scope */}
      <div className="bg-white rounded-2xl card-shadow p-5">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3">📝 نطاق العمل</h3>
        <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          rows={3} placeholder="وصف نطاق الأعمال المطلوب تنفيذها..." value={scope} onChange={e=>setScope(e.target.value)}/>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
          <h3 className="font-bold text-slate-700">📊 بنود العرض</h3>
          <Btn size="sm" onClick={addItem}>➕ إضافة بند</Btn>
        </div>
        <div className="overflow-x-auto table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs">
                <th className="p-2 text-right w-5/12">البند</th>
                <th className="p-2 text-right w-1/12">الوحدة</th>
                <th className="p-2 text-right w-2/12">السعر (ر.س)</th>
                <th className="p-2 text-right w-1/12">الكمية</th>
                <th className="p-2 text-right w-2/12">الإجمالي</th>
                <th className="p-2 w-1/12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it)=>(
                <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                  <td className="p-1.5">
                    <input className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={it.label} onChange={e=>updateItem(it.id,'label',e.target.value)} placeholder="وصف البند"/>
                  </td>
                  <td className="p-1.5">
                    <input className="w-20 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={it.unit} onChange={e=>updateItem(it.id,'unit',e.target.value)}/>
                  </td>
                  <td className="p-1.5">
                    <input type="number" min="0" className="w-24 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={it.price} onChange={e=>updateItem(it.id,'price',e.target.value)}/>
                  </td>
                  <td className="p-1.5">
                    <input type="number" min="0" className="w-16 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      value={it.qty} onChange={e=>updateItem(it.id,'qty',e.target.value)}/>
                  </td>
                  <td className="p-1.5 font-semibold text-blue-700 text-sm whitespace-nowrap">
                    {(Number(it.price)*Number(it.qty)).toLocaleString()} ر.س
                  </td>
                  <td className="p-1.5 text-center">
                    <button onClick={()=>removeItem(it.id)} className="text-red-400 hover:text-red-600 transition text-sm">🗑️</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400 text-sm">لا يوجد بنود — اضغط "إضافة بند"</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-full md:w-80 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600 py-1 border-b border-slate-100">
              <span>المجموع قبل الضريبة</span>
              <span className="font-semibold">{subtotal.toLocaleString()} ر.س</span>
            </div>
            <div className="flex justify-between text-amber-600 py-1 border-b border-slate-100">
              <span>ضريبة القيمة المضافة 15%</span>
              <span className="font-semibold">{vatAmt.toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س</span>
            </div>
            <div className="flex justify-between text-blue-800 font-bold text-base py-1">
              <span>الإجمالي النهائي</span>
              <span>{totalAmt.toLocaleString('ar-SA',{minimumFractionDigits:2,maximumFractionDigits:2})} ر.س</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment schedule */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-3">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">💳 جدول الدفعات</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {paySchedule.map((p,i)=>(
            <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-2">
              <input className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                value={p.label} onChange={e=>setPaySchedule(prev=>prev.map((x,j)=>j===i?{...x,label:e.target.value}:x))}/>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="100" className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  value={p.pct} onChange={e=>setPaySchedule(prev=>prev.map((x,j)=>j===i?{...x,pct:Number(e.target.value)}:x))}/>
                <span className="text-xs text-slate-500">%</span>
                <span className="text-xs font-bold text-blue-700 mr-auto">{Math.round(totalAmt*p.pct/100).toLocaleString()} ر.س</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contract Terms */}
      <div className="bg-white rounded-2xl card-shadow p-5 space-y-3">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2">✅ ما يشمله العقد</h3>
        {engTerms.map(t=>(
          <label key={t.id} className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" checked={t.checked}
              onChange={e=>setEngTerms(prev=>prev.map(x=>x.id===t.id?{...x,checked:e.target.checked}:x))}
              className="w-4 h-4 rounded text-blue-600 cursor-pointer"/>
            <span className={`flex-1 text-sm ${t.checked?'text-slate-700':'text-slate-400 line-through'}`}>{t.label}</span>
            <button onClick={()=>setEngTerms(prev=>prev.filter(x=>x.id!==t.id))}
              className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition text-xs">✕</button>
          </label>
        ))}
        <div className="flex gap-2 pt-1">
          <input className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="أضف بنداً جديداً..." value={engTermInput} onChange={e=>setEngTermInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&engTermInput.trim()){setEngTerms(p=>[...p,{id:'et'+Date.now(),label:engTermInput.trim(),checked:true}]);setEngTermInput('');}}}/>
          <Btn size="sm" onClick={()=>{if(engTermInput.trim()){setEngTerms(p=>[...p,{id:'et'+Date.now(),label:engTermInput.trim(),checked:true}]);setEngTermInput('');}}}>➕ إضافة</Btn>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-2xl card-shadow p-5">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3">📝 ملاحظات إضافية</h3>
        <textarea className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          rows={3} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="شروط إضافية أو ملاحظات خاصة بهذا العرض..."/>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Btn onClick={saveQuote}>💾 حفظ عرض السعر</Btn>
        <Btn variant="secondary" onClick={()=>setView('preview')}>👁️ معاينة</Btn>
        <Btn variant="secondary" onClick={()=>doPrint(null)}>🖨️ طباعة PDF</Btn>
        {(selClient?.phone || customClient.phone) && (
          <a href={waLink({clientName:selClient?.name||customClient.name, clientPhone:selClient?.phone||customClient.phone, quoteNo, serviceLabel:ENG_SERVICES.find(s=>s.id===serviceId)?.label||''})}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition">
            💬 إرسال عبر واتساب
          </a>
        )}
        <Btn variant="secondary" onClick={()=>setView('list')}>إلغاء</Btn>
      </div>
    </div>
  );
}

// ==================== ACCOUNTANT DASHBOARD ====================
function AccountantDashboard({ onGoFinance, onGoProjects }) {
  const projects = DB.getProjects();
  const totalBudget    = projects.reduce((s,p)=>s+Number(p.budget||0),0);
  const totalCollected = projects.reduce((s,p)=>s+(p.invoices||[]).filter(i=>i.collected).reduce((a,i)=>a+Number(i.amount),0),0);
  const totalPending   = projects.reduce((s,p)=>s+(p.invoices||[]).filter(i=>!i.collected).reduce((a,i)=>a+Number(i.amount),0),0);
  const totalDue       = projects.reduce((s,p)=>s+(p.payments||[]).filter(pp=>!pp.paid).reduce((a,pp)=>a+Number(pp.amount),0),0);
  const activeProjects = projects.filter(p=>p.status==='in_progress').length;
  const overduePayments = projects.flatMap(p=>(p.payments||[]).filter(pp=>!pp.paid && pp.dueDate < new Date().toISOString().slice(0,10)));

  return (
    <div className="fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">لوحة المحاسب</h2>
        <p className="text-slate-500 text-sm mt-1">النعمان أحمد — نظرة مالية شاملة</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="إجمالي العقود" value={`${fmt(totalBudget)} ر.س`} icon="💼" color="blue"/>
        <Card title="إجمالي المحصل" value={`${fmt(totalCollected)} ر.س`} icon="✅" color="green"/>
        <Card title="فواتير معلقة" value={`${fmt(totalPending)} ر.س`} icon="📄" color="amber"/>
        <Card title="دفعات مستحقة" value={`${fmt(totalDue)} ر.س`} icon="⏳" color="purple"/>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl card-shadow p-5">
          <div className="text-xs text-slate-400 mb-1">نسبة التحصيل الكلية</div>
          <div className="text-2xl font-bold text-emerald-600">{totalBudget?Math.round(totalCollected/totalBudget*100):0}%</div>
          <div className="mt-3 h-2 bg-slate-100 rounded-full"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{width:`${totalBudget?Math.round(totalCollected/totalBudget*100):0}%`}}/></div>
        </div>
        <div className="bg-white rounded-2xl card-shadow p-5">
          <div className="text-xs text-slate-400 mb-1">مشاريع نشطة</div>
          <div className="text-2xl font-bold text-blue-600">{activeProjects}</div>
          <div className="text-xs text-slate-400 mt-1">من إجمالي {projects.length} مشروع</div>
        </div>
        <div className={`rounded-2xl card-shadow p-5 ${overduePayments.length>0?'bg-red-50 border border-red-200':'bg-white'}`}>
          <div className="text-xs text-slate-400 mb-1">دفعات متأخرة</div>
          <div className={`text-2xl font-bold ${overduePayments.length>0?'text-red-600':'text-slate-400'}`}>{overduePayments.length}</div>
          <div className="text-xs text-slate-400 mt-1">{overduePayments.length>0?'⚠️ تحتاج متابعة فورية':'لا توجد دفعات متأخرة'}</div>
        </div>
      </div>

      {/* Overdue alert */}
      {overduePayments.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="font-bold text-red-700 mb-3">⚠️ دفعات متأخرة ({overduePayments.length})</div>
          <div className="space-y-2">
            {overduePayments.slice(0,5).map(pp=>{
              const proj = projects.find(p=>(p.payments||[]).some(x=>x.id===pp.id));
              return (
                <div key={pp.id} className="flex justify-between items-center bg-white rounded-xl p-3 border border-red-100">
                  <div>
                    <div className="text-sm font-medium text-slate-700">{proj?.clientName||'-'} — {pp.description||'دفعة'}</div>
                    <div className="text-xs text-red-500">استحق: {fmtDate(pp.dueDate)}</div>
                  </div>
                  <div className="font-bold text-red-600">{fmt(pp.amount)} ر.س</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={onGoFinance} className="bg-white rounded-2xl card-shadow p-5 text-right hover:bg-blue-50 transition group">
          <div className="text-2xl mb-2">💰</div>
          <div className="font-bold text-slate-700 group-hover:text-blue-700">التقارير المالية والفواتير</div>
          <div className="text-xs text-slate-400 mt-1">عرض وإدارة الفواتير والتحصيل</div>
        </button>
        <button onClick={onGoProjects} className="bg-white rounded-2xl card-shadow p-5 text-right hover:bg-blue-50 transition group">
          <div className="text-2xl mb-2">📋</div>
          <div className="font-bold text-slate-700 group-hover:text-blue-700">جميع المشاريع</div>
          <div className="text-xs text-slate-400 mt-1">عرض المشاريع وبيانات العقود</div>
        </button>
      </div>
    </div>
  );
}

// ==================== ERP INTEGRATION ====================
function ERPIntegration() {
  const ERP_KEY = 'hec_erp_config';
  const [cfg, setCfg] = useState(()=>JSON.parse(localStorage.getItem(ERP_KEY)||'{"url":"","apiKey":"","companyCode":"","syncInvoices":true,"syncPayments":true,"autoSync":false}'));
  const [msg, setMsg] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(localStorage.getItem('hec_erp_last_sync')||'');

  const save = (newCfg) => { setCfg(newCfg); localStorage.setItem(ERP_KEY, JSON.stringify(newCfg)); };
  const set = (k,v) => save({...cfg,[k]:v});

  const syncNow = () => {
    if (!cfg.url || !cfg.apiKey) { setMsg('⚠️ أدخل رابط النظام ومفتاح API أولاً'); return; }
    setSyncing(true); setMsg('');
    setTimeout(()=>{
      const projects = DB.getProjects();
      const invoices = projects.flatMap(p=>(p.invoices||[]).map(i=>({...i,projectNo:p.projectNo,clientName:p.clientName})));
      const payments = projects.flatMap(p=>(p.payments||[]).map(pp=>({...pp,projectNo:p.projectNo,clientName:p.clientName})));
      const ts = new Date().toLocaleString('ar-SA');
      localStorage.setItem('hec_erp_last_sync', ts);
      setLastSync(ts);
      setSyncing(false);
      setMsg(`✅ تمت المزامنة — ${invoices.length} فاتورة، ${payments.length} دفعة`);
    }, 1800);
  };

  const exportJSON = () => {
    const projects = DB.getProjects();
    const data = { exportDate: new Date().toISOString(), projects: projects.map(p=>({
      projectNo:p.projectNo, clientName:p.clientName, department:p.department,
      budget:p.budget, status:p.status, invoices:p.invoices, payments:p.payments
    }))};
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='HEC_Finance_Export.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in space-y-5 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">🔗 ربط النظام المالي (ERP)</h2>
        <p className="text-slate-500 text-sm mt-1">إعدادات الربط مع النظام المالي الخارجي للشركة</p>
      </div>

      {msg && <div className={`rounded-xl p-3 text-sm font-medium ${msg.startsWith('✅')?'bg-green-50 text-green-700 border border-green-200':'bg-amber-50 text-amber-700 border border-amber-200'}`}>{msg}</div>}

      {/* Connection settings */}
      <div className="bg-white rounded-2xl card-shadow p-6 space-y-4">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-3">⚙️ إعدادات الاتصال</h3>
        <Input label="رابط نظام ERP (Endpoint URL)" value={cfg.url} onChange={e=>set('url',e.target.value)} placeholder="https://erp.company.com/api/v1"/>
        <Input label="مفتاح API" value={cfg.apiKey} onChange={e=>set('apiKey',e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" type="password"/>
        <Input label="كود الشركة" value={cfg.companyCode} onChange={e=>set('companyCode',e.target.value)} placeholder="HEC-001"/>
        <div className="grid grid-cols-2 gap-4 pt-1">
          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
            <input type="checkbox" checked={cfg.syncInvoices} onChange={e=>set('syncInvoices',e.target.checked)} className="w-4 h-4 accent-blue-600"/>
            <span className="text-sm font-medium text-slate-700">مزامنة الفواتير</span>
          </label>
          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
            <input type="checkbox" checked={cfg.syncPayments} onChange={e=>set('syncPayments',e.target.checked)} className="w-4 h-4 accent-blue-600"/>
            <span className="text-sm font-medium text-slate-700">مزامنة الدفعات</span>
          </label>
        </div>
        <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl cursor-pointer border border-blue-100">
          <input type="checkbox" checked={cfg.autoSync} onChange={e=>set('autoSync',e.target.checked)} className="w-4 h-4 accent-blue-600"/>
          <div>
            <div className="text-sm font-medium text-slate-700">مزامنة تلقائية</div>
            <div className="text-xs text-slate-400">ترسل البيانات للنظام المالي تلقائياً عند إضافة فاتورة أو دفعة</div>
          </div>
        </label>
      </div>

      {/* Sync actions */}
      <div className="bg-white rounded-2xl card-shadow p-6 space-y-4">
        <h3 className="font-bold text-slate-700 border-b border-slate-100 pb-3">🔄 المزامنة والتصدير</h3>
        {lastSync && <div className="text-xs text-slate-400">آخر مزامنة: {lastSync}</div>}
        <div className="flex flex-col sm:flex-row gap-3">
          <Btn onClick={syncNow} className="flex-1" disabled={syncing}>
            {syncing ? '⏳ جاري المزامنة...' : '🔄 مزامنة الآن مع ERP'}
          </Btn>
          <Btn variant="secondary" onClick={exportJSON} className="flex-1">
            📥 تصدير JSON
          </Btn>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-500 space-y-1">
          <div className="font-semibold text-slate-600 mb-2">البيانات التي ترسل للنظام المالي:</div>
          <div>• أرقام المشاريع وبيانات العملاء</div>
          <div>• الفواتير (المحصلة وغير المحصلة)</div>
          <div>• جدول الدفعات والمستحقات</div>
          <div>• ميزانيات العقود والتقارير المالية</div>
        </div>
      </div>
    </div>
  );
}

// ==================== ACTIVITY LOG PAGE ====================
function ActivityLogPage() {
  const [log, setLog] = useState([]);
  const [filter, setFilter] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    const unsub = cloud.listenActivityLog(entries => setLog(entries));
    return unsub;
  }, []);

  const users = [...new Set(log.map(e => e.userName).filter(Boolean))];
  const types = [...new Set(log.map(e => e.entityType).filter(Boolean))];

  const filtered = log.filter(e =>
    (!filter || e.entityName?.includes(filter) || e.details?.includes(filter) || e.userName?.includes(filter)) &&
    (!filterUser || e.userName === filterUser) &&
    (!filterType || e.entityType === filterType)
  );

  const actionIcon = (a) => ({ added:'➕', updated:'✏️', deleted:'🗑️', approved:'✅', rejected:'❌', status_changed:'🔄' })[a] || '📌';

  const entityBadge = (t) => {
    const map = { project:'bg-blue-100 text-blue-700', client:'bg-emerald-100 text-emerald-700', lead:'bg-amber-100 text-amber-700', supplier:'bg-purple-100 text-purple-700', ac_quote:'bg-cyan-100 text-cyan-700', eng_quote:'bg-indigo-100 text-indigo-700', visit:'bg-orange-100 text-orange-700' };
    return map[t] || 'bg-slate-100 text-slate-600';
  };

  const fmtTime = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString('ar-SA', { dateStyle:'short', timeStyle:'short' });
  };

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">📋 سجل النشاط</h2>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} حدث</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl card-shadow p-4 flex flex-wrap gap-3">
        <input
          className="flex-1 min-w-40 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          placeholder="🔍 بحث..." value={filter} onChange={e => setFilter(e.target.value)}/>
        <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterUser} onChange={e=>setFilterUser(e.target.value)}>
          <option value="">كل المستخدمين</option>
          {users.map(u=><option key={u} value={u}>{u}</option>)}
        </select>
        <select className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none" value={filterType} onChange={e=>setFilterType(e.target.value)}>
          <option value="">كل الأنواع</option>
          {types.map(t=><option key={t} value={t}>{ENTITY_LABELS[t]||t}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl card-shadow p-16 text-center text-slate-400">
          <div className="text-5xl mb-3">📋</div>
          <div className="font-medium">لا يوجد نشاط مسجل بعد</div>
          <div className="text-sm mt-1">ستظهر هنا كل العمليات التي يقوم بها المستخدمون</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl card-shadow overflow-hidden">
          {filtered.map((e, i) => (
            <div key={e.id||i} className="flex items-start gap-4 px-5 py-3 border-b border-slate-50 hover:bg-slate-50/50 transition">
              <div className="text-xl mt-0.5 w-7 text-center">{actionIcon(e.action)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">{e.userName || '—'}</span>
                  <span className="text-slate-500 text-sm">{ACTION_LABELS[e.action]||e.action}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entityBadge(e.entityType)}`}>{ENTITY_LABELS[e.entityType]||e.entityType}</span>
                  <span className="font-medium text-slate-700 text-sm truncate">{e.entityName}</span>
                </div>
                {e.details && <div className="text-xs text-slate-400 mt-0.5">{e.details}</div>}
              </div>
              <div className="text-xs text-slate-400 whitespace-nowrap mt-0.5">{fmtTime(e.timestamp)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== FINANCE REPORT ====================
function FinanceReport() {
  const projects = DB.getProjects();
  const totalBudget = projects.reduce((s,p)=>s+Number(p.budget||0),0);
  const totalCollected = projects.reduce((s,p)=>s+(p.invoices||[]).filter(i=>i.collected).reduce((a,i)=>a+Number(i.amount),0),0);
  const totalPending = projects.reduce((s,p)=>s+(p.invoices||[]).filter(i=>!i.collected).reduce((a,i)=>a+Number(i.amount),0),0);
  const totalRemaining = projects.reduce((s,p)=>s+(p.payments||[]).filter(pp=>!pp.paid).reduce((a,pp)=>a+Number(pp.amount),0),0);

  const byDept = DEPARTMENTS.map(d=>{
    const dProjects = projects.filter(p=>p.department===d.id);
    return {
      dept:d.label,
      count:dProjects.length,
      budget:dProjects.reduce((s,p)=>s+Number(p.budget||0),0),
      collected:dProjects.reduce((s,p)=>s+(p.invoices||[]).filter(i=>i.collected).reduce((a,i)=>a+Number(i.amount),0),0),
    };
  });

  return (
    <div className="fade-in space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">التقارير المالية</h2>
        <p className="text-slate-500 text-sm mt-1">نظرة عامة على الوضع المالي</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="إجمالي الميزانيات" value={`${fmt(totalBudget)} ر.س`} icon="💼" color="blue"/>
        <Card title="إجمالي المحصل" value={`${fmt(totalCollected)} ر.س`} icon="✅" color="green"/>
        <Card title="فواتير غير محصلة" value={`${fmt(totalPending)} ر.س`} icon="📄" color="amber"/>
        <Card title="دفعات متبقية" value={`${fmt(totalRemaining)} ر.س`} icon="⏳" color="purple"/>
      </div>

      <div className="bg-white rounded-2xl card-shadow p-5">
        <h3 className="font-bold text-slate-700 mb-4">تقرير حسب القسم</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-right text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">القسم</th>
                <th className="px-4 py-3 font-semibold">عدد المشاريع</th>
                <th className="px-4 py-3 font-semibold">إجمالي الميزانيات</th>
                <th className="px-4 py-3 font-semibold">المحصل</th>
                <th className="px-4 py-3 font-semibold">نسبة التحصيل</th>
              </tr>
            </thead>
            <tbody>
              {byDept.map(r=>(
                <tr key={r.dept} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold">{r.dept}</td>
                  <td className="px-4 py-3">{r.count}</td>
                  <td className="px-4 py-3">{fmt(r.budget)} ر.س</td>
                  <td className="px-4 py-3 text-emerald-600 font-medium">{fmt(r.collected)} ر.س</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full">
                        <div className="h-full rounded-full bg-emerald-400" style={{width:`${r.budget?Math.round(r.collected/r.budget*100):0}%`}}/>
                      </div>
                      <span className="text-xs text-slate-500">{r.budget?Math.round(r.collected/r.budget*100):0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming payments */}
      <div className="bg-white rounded-2xl card-shadow p-5">
        <h3 className="font-bold text-slate-700 mb-4">الدفعات القادمة</h3>
        <div className="space-y-3">
          {projects.flatMap(p=>(p.payments||[]).filter(pp=>!pp.paid).map(pp=>({...pp,project:p}))).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,10).map(pp=>(
            <div key={pp.id} className="flex items-center gap-4 p-3 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex-1">
                <div className="font-medium text-slate-700 text-sm">{pp.project.clientName} - {pp.description||'دفعة'}</div>
                <div className="text-xs text-slate-400">{pp.project.projectNo} · استحقاق: {fmtDate(pp.dueDate)}</div>
              </div>
              <div className="font-bold text-amber-700">{fmt(pp.amount)} ر.س</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== SETTINGS ====================
function Settings() {
  const [users, setUsers] = useState(DB.getUsers());
  const [msg, setMsg] = useState('');

  const resetData = () => {
    if (confirm('هل أنت متأكد من إعادة تهيئة البيانات؟ سيتم حذف جميع البيانات!')) {
      localStorage.clear();
      seedData();
      setMsg('تم إعادة تهيئة البيانات بنجاح');
      setTimeout(()=>setMsg(''),3000);
    }
  };

  return (
    <div className="fade-in space-y-5">
      <h2 className="text-2xl font-bold text-slate-800">الإعدادات</h2>
      {msg && <div className="bg-emerald-50 text-emerald-700 rounded-xl p-3 text-sm">{msg}</div>}
      <div className="bg-white rounded-2xl card-shadow p-5 max-w-lg">
        <h3 className="font-bold text-slate-700 mb-4">إعدادات النظام</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <div className="font-medium text-slate-700">إعادة تهيئة البيانات</div>
              <div className="text-xs text-slate-400 mt-0.5">حذف جميع البيانات وإعادة البيانات التجريبية</div>
            </div>
            <Btn variant="danger" size="sm" onClick={resetData}>إعادة تهيئة</Btn>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl">
            <div className="font-medium text-blue-700 mb-2">معلومات النظام</div>
            <div className="text-sm text-slate-600 space-y-1">
              <div>إجمالي المهندسين: {users.filter(u=>u.role==='engineer').length}</div>
              <div>إجمالي المشاريع: {DB.getProjects().length}</div>
              <div>إجمالي الزيارات: {DB.getVisits().length}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================
// ==================== GROUP PORTAL ====================
function GroupPortal({ onSelectEngineering, onSelectHawlak, onSelectFinance }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-[#1a2951] to-slate-800" dir="rtl">
      {/* Animated background blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"/>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse" style={{animationDelay:'1s'}}/>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl animate-pulse" style={{animationDelay:'2s'}}/>
      </div>

      {/* Group Logo */}
      <div className="relative z-10 text-center mb-10">
        <img
          src={`${import.meta.env.BASE_URL}alhamdan-group-logo.png`}
          alt="الحمدان جروب"
          className="h-24 mx-auto mb-4 object-contain drop-shadow-2xl rounded-2xl"
          onError={e => { e.target.style.display='none'; }}
        />
        <h1 className="text-white text-3xl font-bold tracking-tight">الحمدان جروب</h1>
        <p className="text-blue-300 text-sm mt-2">اختر النظام للدخول إليه</p>
      </div>

      {/* Company cards */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl">
        {/* Engineering card */}
        <button
          onClick={onSelectEngineering}
          className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/30 rounded-3xl p-6 text-right transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-95 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <img
              src={`${import.meta.env.BASE_URL}hamdan-eng-logo.jpg`}
              alt="الهندسية"
              className="w-12 h-12 rounded-2xl object-cover shadow-lg"
              onError={e => { e.target.style.display='none'; }}
            />
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition">🏗️</div>
          </div>
          <h2 className="text-white font-bold text-base leading-snug">الحمدان للاستشارات<br/>الهندسية والتكييف</h2>
          <p className="text-blue-300 text-xs mt-2">نظام إدارة المشاريع والعملاء</p>
          <div className="mt-4 flex items-center gap-2 text-blue-400 text-sm font-semibold group-hover:text-white transition">
            <span>دخول</span>
            <span className="group-hover:translate-x-[-4px] transition-transform">←</span>
          </div>
        </button>

        {/* Hawlak card */}
        <button
          onClick={onSelectHawlak}
          className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#4caf50]/50 rounded-3xl p-6 text-right transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-95 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <img
              src={`${import.meta.env.BASE_URL}hawlak-logo.jpg`}
              alt="حولك"
              className="w-12 h-12 rounded-2xl object-cover shadow-lg"
              onError={e => { e.target.style.display='none'; }}
            />
            <div className="w-10 h-10 rounded-2xl bg-green-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition">🚚</div>
          </div>
          <h2 className="text-white font-bold text-base leading-snug">حولك لوجيستك</h2>
          <p className="text-[#4caf50]/80 text-xs mt-2">منصة إدارة التوصيل والشحنات</p>
          <div className="mt-4 flex items-center gap-2 text-[#4caf50] text-sm font-semibold group-hover:text-white transition">
            <span>دخول</span>
            <span className="group-hover:translate-x-[-4px] transition-transform">←</span>
          </div>
        </button>

        {/* Finance card */}
        <button
          onClick={onSelectFinance}
          className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/50 rounded-3xl p-6 text-right transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl active:scale-95 backdrop-blur-sm"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600/30 border border-emerald-400/20 flex items-center justify-center text-2xl shadow-lg">💰</div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-xl group-hover:scale-110 transition">📊</div>
          </div>
          <h2 className="text-white font-bold text-base leading-snug">إدارة المالية</h2>
          <p className="text-emerald-300/80 text-xs mt-2">الإيرادات والمصروفات والرواتب</p>
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm font-semibold group-hover:text-white transition">
            <span>دخول</span>
            <span className="group-hover:translate-x-[-4px] transition-transform">←</span>
          </div>
        </button>
      </div>

      <p className="relative z-10 text-white/20 text-xs mt-10">© 2026 الحمدان جروب — جميع الحقوق محفوظة</p>
    </div>
  );
}

// ==================== MAIN APP ====================
function App() {
  // appSection: 'portal' | 'engineering' | 'hawlak' | 'finance'
  const [appSection, setAppSection] = useState(() => {
    // URL param ?app=hawlak → opens Hawlak directly (used by driver APK)
    const params = new URLSearchParams(window.location.search);
    if (params.get('app') === 'hawlak') return 'hawlak';
    if (params.get('app') === 'finance') return 'finance';
    // Remember last section across page reloads
    return sessionStorage.getItem('alhamdan_section') || 'portal';
  });

  const setSection = (s) => { sessionStorage.setItem('alhamdan_section', s); setAppSection(s); };

  const [user, setUser] = useState(DB.getCurrentUser());
  const [active, setActive] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [addingProject, setAddingProject] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cloudReady, setCloudReady] = useState(!cloud.enabled); // if cloud disabled, skip loading
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstallBanner(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // On mount: pull latest data from Firebase then render
  useEffect(() => {
    if (!cloud.enabled) return;
    cloud.loadAll().then(() => setCloudReady(true));
    // Real-time listener: update in background whenever another user saves
    const unsub = cloud.subscribe(() => {
      // Dispatch custom event → every page with useRealTimeSync re-loads its data
      window.dispatchEvent(new CustomEvent('hec-sync'));
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const unsub = cloud.listenNotifications(user.id, setNotifications);
    return unsub;
  }, [user?.id]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    if (user?.id) cloud.markAllRead(user.id);
    setNotifications(prev => prev.map(n => ({...n, read: true})));
  };

  const markOneRead = (notifId) => {
    if (user?.id) cloud.markRead(user.id, notifId);
    setNotifications(prev => prev.map(n => n.id === notifId ? {...n, read: true} : n));
  };

  const defaultPage = (u) => u.role==='manager'?'dashboard':u.role==='accountant'?'acc_dashboard':'my_projects';
  useEffect(()=>{ if(user) setActive(defaultPage(user)); },[user]);

  const handleLogin = (u) => { setUser(u); setActive(defaultPage(u)); };
  const handleLogout = () => { DB.clearCurrentUser(); setUser(null); setActive(null); setSelectedProject(null); setAddingProject(false); };
  const handleSelectProject = (p) => { setSelectedProject(p.id); setAddingProject(false); };
  const handleAddProject = () => { setAddingProject(true); setSelectedProject(null); };
  const handleProjectSaved = (proj) => { setAddingProject(false); setSelectedProject(proj.id); };

  // ── Section routing ──────────────────────────────────────────
  if (appSection === 'portal') {
    return (
      <GroupPortal
        onSelectEngineering={() => setSection('engineering')}
        onSelectHawlak={() => setSection('hawlak')}
        onSelectFinance={() => setSection('finance')}
      />
    );
  }

  if (appSection === 'hawlak') {
    return <HawlakApp onBack={() => setSection('portal')}/>;
  }

  if (appSection === 'finance') {
    return <FinanceApp onBack={() => setSection('portal')}/>;
  }

  // Engineering section below ──────────────────────────────────

  // Cloud loading screen
  if (!cloudReady) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-slate-500">
      <div className="text-5xl animate-spin">🔄</div>
      <div className="text-lg font-semibold">جاري التزامن مع السحابة...</div>
      <div className="text-xs text-slate-400">يتم تحميل البيانات من Firebase</div>
    </div>
  );

  if (!user) return (
    <div>
      {/* Back to portal */}
      <div className="fixed top-4 right-4 z-50">
        <button onClick={() => setSection('portal')} className="px-3 py-2 bg-slate-800/80 backdrop-blur-sm text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition border border-slate-600">
          ← المجموعة
        </button>
      </div>
      <Login onLogin={handleLogin}/>
    </div>
  );

  const renderContent = () => {
    if (selectedProject) return <ProjectDetail projectId={selectedProject} user={user} onBack={()=>setSelectedProject(null)}/>;
    if (addingProject) return <AddProject user={user} onSave={handleProjectSaved} onCancel={()=>setAddingProject(false)}/>;
    switch(active) {
      case 'dashboard':     return <ManagerDashboard user={user}/>;
      case 'engineers':     return <EngineersPage/>;
      case 'projects':      return <ProjectsList user={user} onSelectProject={handleSelectProject} onAddProject={handleAddProject}/>;
      case 'my_projects':   return <ProjectsList user={user} onSelectProject={handleSelectProject} onAddProject={handleAddProject}/>;
      case 'visits':        return <VisitsPage user={user}/>;
      case 'my_visits':     return <VisitsPage user={user}/>;
      case 'finance':       return <FinanceReport/>;
      case 'add_project':   return <AddProject user={user} onSave={handleProjectSaved} onCancel={()=>setActive('my_projects')}/>;
      case 'clients':       return <ClientsPage onSelectProject={handleSelectProject}/>;
      case 'leads':         return <LeadsPage/>;
      case 'suppliers':     return <SuppliersPage user={user}/>;
      case 'ac_quotes':     return <QuoteBuilderPage user={user}/>;
      case 'eng_quotes':    return <EngineeringQuoteBuilderPage user={user}/>;
      case 'settings':      return <Settings/>;
      case 'activity_log':  return <ActivityLogPage/>;
      // Accountant routes
      case 'acc_dashboard': return <AccountantDashboard onGoFinance={()=>handleNav('acc_finance')} onGoProjects={()=>handleNav('acc_projects')}/>;
      case 'acc_projects':  return <ProjectsList user={user} onSelectProject={handleSelectProject} onAddProject={null}/>;
      case 'acc_finance':   return <FinanceReport/>;
      case 'acc_erp':       return <ERPIntegration/>;
      default: return user.role==='accountant'?<AccountantDashboard onGoFinance={()=>handleNav('acc_finance')} onGoProjects={()=>handleNav('acc_projects')}/>:<ManagerDashboard user={user}/>;
    }
  };

  const handleNav = (id) => { setActive(id); setSelectedProject(null); setAddingProject(false); setSidebarOpen(false); };

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar user={user} active={active} setActive={handleNav} onLogout={handleLogout} onGoPortal={()=>setSection('portal')} isOpen={sidebarOpen} onClose={()=>setSidebarOpen(false)}/>
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b border-slate-100 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            {/* Hamburger - mobile only */}
            <button onClick={()=>setSidebarOpen(true)} className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 text-xl">☰</button>
            <div className="hidden sm:block text-sm text-slate-500">
              {new Date().toLocaleDateString('ar-SA', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}
            </div>
            <div className="sm:hidden text-sm font-semibold text-slate-700">الحمدان الهندسية</div>
          </div>
          <div className="flex items-center gap-2">
            {showInstallBanner && (
              <button
                onClick={async () => {
                  if (!installPrompt) return;
                  installPrompt.prompt();
                  await installPrompt.userChoice;
                  setInstallPrompt(null);
                  setShowInstallBanner(false);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow transition"
                title="تثبيت التطبيق على جهازك"
              >
                <span>📲</span>
                <span className="hidden sm:inline">تثبيت التطبيق</span>
              </button>
            )}
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifPanel(p => !p); if (unreadCount > 0) markAllRead(); }}
                className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition">
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {/* Notification Panel */}
              {showNotifPanel && (
                <div className="absolute left-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
                    <span className="font-bold text-slate-800 text-sm">🔔 الإشعارات</span>
                    <button onClick={() => setShowNotifPanel(false)} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-sm">لا توجد إشعارات</div>
                    ) : (
                      notifications.slice(0, 30).map(n => (
                        <div key={n.id} className={`px-4 py-3 border-b border-slate-50 text-sm transition hover:bg-slate-50 ${n.read ? 'opacity-60' : 'bg-blue-50/40'}`}>
                          <div className="text-slate-700">{n.message}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{n.timestamp ? new Date(n.timestamp).toLocaleString('ar-SA', {dateStyle:'short',timeStyle:'short'}) : ''}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="w-8 h-8 rounded-full gradient-blue flex items-center justify-center text-white font-bold text-sm">{user.name.charAt(0)}</div>
            <span className="hidden sm:block text-sm font-medium text-slate-700">{user.name}</span>
          </div>
        </div>
        {/* Notification overlay to close panel on outside click */}
        {showNotifPanel && (
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifPanel(false)}/>
        )}
        {/* Content */}
        <div className="p-4 md:p-6 max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}


export default App;
