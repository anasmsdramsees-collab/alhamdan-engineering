import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cloud } from './firebase.js';

// ==================== STORAGE ====================
const hls  = (key, def) => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? def; } catch { return def; } };
const hlsSet = (key, val) => localStorage.setItem(key, JSON.stringify(val));

const HDB = {
  getUsers:          ()  => hls('hawlak_users', []),
  saveUsers:         (v) => { hlsSet('hawlak_users', v);         cloud.saveHawlak('hawlak_users', v); },
  getProfiles:       ()  => hls('hawlak_profiles', {}),   // keyed by userId
  saveProfiles:      (v) => { hlsSet('hawlak_profiles', v);      cloud.saveHawlak('hawlak_profiles', v); },
  getShipments:      ()  => hls('hawlak_shipments', []),
  saveShipments:     (v) => { hlsSet('hawlak_shipments', v);     cloud.saveHawlak('hawlak_shipments', v); },
  getLocations:      ()  => hls('hawlak_locations', {}),  // keyed by userId
  saveLocations:     (v) => hlsSet('hawlak_locations', v),       // locations via setDriverLocation
  getCurrentUser:    ()  => { try { return JSON.parse(sessionStorage.getItem('hawlak_session') || 'null'); } catch { return null; } },
  setCurrentUser:    (u) => sessionStorage.setItem('hawlak_session', JSON.stringify(u)),
  clearCurrentUser:  ()  => sessionStorage.removeItem('hawlak_session'),
  // Join requests
  getJoinRequests:   ()  => hls('hawlak_join_requests', []),
  saveJoinRequests:  (v) => { hlsSet('hawlak_join_requests', v); cloud.saveHawlak('hawlak_join_requests', v); },
};

// Management accounts — source of truth (always enforced)
const MGMT_ACCOUNTS = [
  { id:'hm1', name:'عبدالرحمن الحمدان', username:'admin',    password:'admin123', role:'manager',    title:'مدير عام' },
  { id:'hm2', name:'أنس الإمام',          username:'ops',      password:'ops123',   role:'operations', title:'مدير تشغيل' },
  { id:'hm3', name:'النعمان أحمد',        username:'accounts', password:'acc123',   role:'accounts',   title:'مدير مالي' },
];

function seedAccounts() {
  const existing = HDB.getUsers();
  const drivers = existing.filter(u => u.role === 'driver');
  // Always overwrite management accounts to ensure correct names
  HDB.saveUsers([...drivers, ...MGMT_ACCOUNTS]);
}

// Target based on work type
const getTarget = (workType) => workType === 'عمل حر' ? 4400 : 4800;

// ==================== UTILS ====================
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const today = () => new Date().toISOString().slice(0, 10);
const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('ar-SA', { hour:'2-digit', minute:'2-digit' }) : '';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('ar-SA', { day:'2-digit', month:'2-digit', year:'numeric' }) : '';

// ==================== CONSTANTS ====================
const SHIPPING_COS = [
  { id:'naqel',   name:'ناقل',     color:'#1a3a6e', bg:'#e8ecf5', paidRate:6,    codRate:8,    logo:'logo-naqel.png' },
  { id:'dhl',     name:'DHL',      color:'#D40511', bg:'#fdecea', paidRate:null, codRate:null, logo:'logo-dhl.png' },
  { id:'ajex',    name:'AJEX',     color:'#1a1a1a', bg:'#f5f5f5', paidRate:null, codRate:null, logo:'logo-ajex.png' },
  { id:'aramex',  name:'أراميكس',  color:'#e63946', bg:'#fff0f0', paidRate:null, codRate:null, logo:'logo-aramex.png' },
  { id:'aymakan', name:'أي مكان', color:'#c58a00', bg:'#fffbe8', paidRate:null, codRate:null, logo:'logo-aymakan.png' },
  { id:'noon',    name:'نون',      color:'#f0c000', bg:'#fffde6', paidRate:null, codRate:null, logo:'logo-noon.png' },
];

// ── Delivery platforms (food & quick commerce) ──────────────────

const FOOD_COS = [
  { id:'hungerstation', name:'هنقرستيشن', logo:'logo-hungerstation.png' },
  { id:'keeta',         name:'كيتا',       logo:'logo-keeta.png' },
  { id:'chefz',         name:'الشيفز',      logo:'logo-chefz.png' },
  { id:'ninja',         name:'نينجا',       logo:'logo-ninja.png' },
];

const FAIL_REASONS = ['لم يرد العميل', 'عنوان خاطئ', 'رُفض الاستلام', 'العميل طلب التأجيل', 'غيره'];
const OPERATING_COS = ['ناقل', 'DHL', 'AJEX', 'أراميكس', 'أي مكان', 'نون'];
const DRIVER_GROUP_SIZE = 8; // drivers per group
const WORK_TYPES = ['عمل حر', 'تابع لحولك'];

const isManagement = (u) => ['manager','operations','accounts'].includes(u?.role);
const isDriver = (u) => u?.role === 'driver';
const isFinance = (u) => ['manager','accounts'].includes(u?.role);
const canSeeCompanies = (u) => ['manager','operations','accounts'].includes(u?.role);

// ── BOL image barcode extractor ───────────────────────────────
async function extractBarcodeFromImage(file) {
  return new Promise((resolve) => {
    if (!('BarcodeDetector' in window)) { resolve(null); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const det = new window.BarcodeDetector({
          formats: ['code_128','code_39','ean_13','ean_8','qr_code','data_matrix','itf'],
        });
        const codes = await det.detect(img);
        URL.revokeObjectURL(url);
        resolve(codes.length > 0 ? codes[0].rawValue : null);
      } catch { URL.revokeObjectURL(url); resolve(null); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// ==================== CO LOGO HELPER ====================
const CoLogo = ({ co, size = 'md', className = '' }) => {
  const sz = { sm: 'w-5 h-5', md: 'w-7 h-7', lg: 'w-10 h-10', xl: 'w-14 h-14' }[size] || 'w-7 h-7';
  if (!co) return null;
  if (co.logo) return (
    <img
      src={`${import.meta.env.BASE_URL}${co.logo}`}
      alt={co.name}
      className={`${sz} object-contain rounded ${className}`}
      onError={e => { e.target.style.display='none'; }}
    />
  );
  return <span className={`${sz} flex items-center justify-center text-lg`}>{co.emoji || '📦'}</span>;
};

// ==================== UI ATOMS ====================
const Btn = ({ children, onClick, variant='primary', size='md', disabled, className='' }) => {
  const base = 'inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = { sm:'px-3 py-1.5 text-xs', md:'px-4 py-2 text-sm', lg:'px-6 py-3 text-base' };
  const variants = {
    primary:  'bg-[#1e2d7a] hover:bg-[#172466] text-white shadow',
    green:    'bg-[#3d7c34] hover:bg-[#336b2d] text-white shadow',
    red:      'bg-red-500 hover:bg-red-600 text-white shadow',
    outline:  'border border-[#1e2d7a] text-[#1e2d7a] hover:bg-blue-50',
    ghost:    'text-slate-600 hover:bg-slate-100',
    amber:    'bg-amber-500 hover:bg-amber-600 text-white shadow',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ children, className='' }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 ${className}`}>{children}</div>
);

const Input = ({ label, ...props }) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-semibold text-slate-700">{label}</label>}
    <input {...props} className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7a]/30 focus:border-[#1e2d7a] transition ${props.className||''}`}/>
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div className="space-y-1">
    {label && <label className="block text-sm font-semibold text-slate-700">{label}</label>}
    <select {...props} className={`w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7a]/30 focus:border-[#1e2d7a] bg-white transition ${props.className||''}`}>
      {children}
    </select>
  </div>
);

const Modal = ({ open, title, children, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
          <h3 className="font-bold text-slate-800 text-base">{title}</h3>
          {onClose && <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition">✕</button>}
        </div>
        <div className="p-4 space-y-4">{children}</div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon, color='blue' }) => {
  const colors = {
    blue:   'bg-blue-50 text-blue-600 border-blue-100',
    green:  'bg-green-50 text-green-600 border-green-100',
    red:    'bg-red-50 text-red-500 border-red-100',
    amber:  'bg-amber-50 text-amber-600 border-amber-100',
  };
  return (
    <div className={`rounded-2xl border p-4 flex flex-col gap-1 ${colors[color]}`}>
      <span className="text-2xl">{icon}</span>
      <span className="text-2xl font-bold">{value}</span>
      <span className="text-xs font-medium opacity-80">{label}</span>
    </div>
  );
};

// ==================== BARCODE SCANNER ====================
function BarcodeScanner({ onResult, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let detector;
    let animId;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if ('BarcodeDetector' in window) {
          detector = new window.BarcodeDetector({ formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'data_matrix'] });
          setScanning(true);
          const scan = async () => {
            if (!videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) {
                onResult(codes[0].rawValue);
                stopStream();
                return;
              }
            } catch { /* ignore */ }
            animId = requestAnimationFrame(scan);
          };
          animId = requestAnimationFrame(scan);
        } else {
          setError('المتصفح لا يدعم ماسح الباركود. أدخل رقم الشحنة يدوياً.');
        }
      } catch (err) {
        setError('تعذّر فتح الكاميرا. تحقق من الأذونات.');
      }
    }
    function stopStream() {
      cancelAnimationFrame(animId);
      streamRef.current?.getTracks().forEach(t => t.stop());
    }
    start();
    return stopStream;
  }, [onResult]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3' }}>
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline/>
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-4 border-[#3d7c34] rounded-xl opacity-80 animate-pulse"/>
          </div>
        )}
      </div>
      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      {scanning && <p className="text-slate-500 text-xs text-center">وجّه الكاميرا نحو الباركود...</p>}
      <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
    </div>
  );
}

// ==================== DRIVER PROFILE FORM ====================
function DriverProfileForm({ user, onSave }) {
  const [form, setForm] = useState({
    fullName: user.name || '',
    nationality: '',
    iqamaNo: '',
    workType: 'تابع لحولك',
    operatingCompany: 'ناقل',
    photo: null,
  });
  const [step, setStep]           = useState('form'); // 'form' | 'permissions'
  const [saving, setSaving]       = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const photoInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Permission states: null | 'granted' | 'denied' | 'requesting'
  const [permLocation, setPermLocation]   = useState(null);
  const [permCamera,   setPermCamera]     = useState(null);
  const [permNotif,    setPermNotif]      = useState(null);
  const [permsDone,    setPermsDone]      = useState(false);

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoPreview(ev.target.result);
      setForm(f => ({ ...f, photo: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  // Step 1 → save to storage then go to permissions screen
  const handleSave = () => {
    if (!form.fullName || !form.nationality || !form.iqamaNo) {
      alert('يرجى ملء جميع الحقول الإلزامية');
      return;
    }
    // Persist profile now so it's safe even if user closes browser
    const profiles = HDB.getProfiles();
    profiles[user.id] = { ...form, completedAt: new Date().toISOString() };
    HDB.saveProfiles(profiles);
    setStep('permissions');
  };

  // Request all permissions one by one
  const requestAll = async () => {
    // ── 1. Location ────────────────────────────────────
    setPermLocation('requesting');
    await new Promise(resolve => {
      if (!navigator.geolocation) { setPermLocation('denied'); resolve(); return; }
      navigator.geolocation.getCurrentPosition(
        () => { setPermLocation('granted'); resolve(); },
        () => { setPermLocation('denied');  resolve(); },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    });

    // ── 2. Camera (no audio to avoid mic dialog) ───────
    setPermCamera('requesting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      s.getTracks().forEach(t => t.stop()); // release immediately
      setPermCamera('granted');
    } catch {
      setPermCamera('denied');
    }

    // ── 3. Notifications ───────────────────────────────
    setPermNotif('requesting');
    if ('Notification' in window) {
      const res = await Notification.requestPermission();
      setPermNotif(res === 'granted' ? 'granted' : 'denied');
    } else {
      setPermNotif('denied');
    }

    setPermsDone(true);
  };

  // After permissions, proceed to dashboard
  const finishSetup = () => {
    setSaving(true);
    const profiles = HDB.getProfiles();
    setTimeout(() => onSave(profiles[user.id]), 300);
  };

  // ── Perm badge helper ──────────────────────────────────────────
  const PermRow = ({ label, icon, state }) => {
    const badge =
      state === 'granted'    ? <span className="text-green-600 font-bold text-sm">✅ تم السماح</span>      :
      state === 'denied'     ? <span className="text-red-400 font-bold text-sm">❌ مرفوض</span>             :
      state === 'requesting' ? <span className="text-amber-500 font-bold text-sm animate-pulse">⏳ جاري...</span> :
                               <span className="text-slate-300 text-sm">—</span>;
    return (
      <div className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <span className="text-white font-semibold text-sm">{label}</span>
        </div>
        {badge}
      </div>
    );
  };

  // ── STEP 2: Permissions Screen ──────────────────────────────────
  if (step === 'permissions') {
    return (
      <div className="min-h-screen hawlak-login-bg hawlak-green-glow flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-5">
          {/* Logo */}
          <div className="text-center">
            <img src={`${import.meta.env.BASE_URL}hawlak-logo.jpg`} alt="حولك" className="h-14 mx-auto rounded-xl mb-3 object-contain"/>
            <h2 className="text-white font-bold text-xl">أذونات التطبيق</h2>
            <p className="text-blue-200 text-sm mt-1">نحتاج إذنك لهذه الخدمات حتى يعمل التطبيق بشكل صحيح</p>
          </div>

          {/* Permission rows */}
          <div className="space-y-3">
            <PermRow icon="📍" label="الموقع الجغرافي — لتتبعك أثناء التوصيل"    state={permLocation}/>
            <PermRow icon="📷" label="الكاميرا — لمسح الباركود وتوثيق التسليم"   state={permCamera}/>
            <PermRow icon="🔔" label="الإشعارات — لإعلامك بالشحنات الجديدة"       state={permNotif}/>
          </div>

          {/* Info note */}
          <p className="text-blue-300 text-xs text-center leading-relaxed">
            يمكنك تغيير هذه الأذونات لاحقاً من إعدادات الهاتف
          </p>

          {/* Action buttons */}
          {!permsDone ? (
            <button
              onClick={requestAll}
              disabled={permLocation === 'requesting' || permCamera === 'requesting' || permNotif === 'requesting'}
              className="w-full py-3.5 bg-[#3d7c34] hover:bg-[#336b2d] disabled:opacity-60 text-white font-bold rounded-2xl text-base transition shadow-lg"
            >
              {permLocation === 'requesting' || permCamera === 'requesting' || permNotif === 'requesting'
                ? '⏳ جاري طلب الأذونات...'
                : '🔓 السماح بالأذونات'}
            </button>
          ) : (
            <button
              onClick={finishSetup}
              disabled={saving}
              className="w-full py-3.5 bg-[#3d7c34] hover:bg-[#336b2d] disabled:opacity-60 text-white font-bold rounded-2xl text-base transition shadow-lg"
            >
              {saving ? '⏳ جاري التحميل...' : '🚀 ابدأ العمل'}
            </button>
          )}

          {/* Skip link */}
          {!permsDone && (
            <button onClick={() => setPermsDone(true)} className="w-full text-blue-300 text-xs underline text-center">
              تخطي الآن وإعدادها لاحقاً
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── STEP 1: Profile Form ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1e2d7a] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden my-4">
        {/* Header */}
        <div className="bg-[#1e2d7a] px-6 py-8 text-center">
          <img src={`${import.meta.env.BASE_URL}hawlak-logo.jpg`} alt="حولك" className="h-16 mx-auto rounded-xl mb-3 object-contain"/>
          <h2 className="text-white font-bold text-lg">مرحباً {user.name}</h2>
          <p className="text-blue-200 text-sm mt-1">أكمل بياناتك قبل البدء</p>
        </div>
        {/* Form */}
        <div className="p-6 space-y-4">

          {/* Photo upload */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">📸 الصورة الشخصية</label>
            <div className="flex flex-col items-center gap-3">
              {/* Preview */}
              <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center">
                {photoPreview ? (
                  <img src={photoPreview} className="w-full h-full object-cover"/>
                ) : (
                  <span className="text-4xl">👤</span>
                )}
              </div>
              {/* Buttons */}
              <div className="flex gap-2">
                {/* Camera capture */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#1e2d7a] text-white rounded-xl text-xs font-semibold hover:bg-[#172466] transition"
                >
                  📷 تصوير
                </button>
                {/* File picker */}
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                >
                  🖼️ من المعرض
                </button>
              </div>
              {/* Hidden inputs */}
              <input ref={cameraInputRef} type="file" accept="image/*" capture="user" onChange={handlePhoto} className="hidden"/>
              <input ref={photoInputRef}  type="file" accept="image/*" onChange={handlePhoto} className="hidden"/>
              {photoPreview && (
                <button type="button" onClick={() => { setPhotoPreview(null); setForm(f=>({...f,photo:null})); }}
                  className="text-xs text-red-400 hover:text-red-600">✕ إزالة الصورة</button>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2"/>

          <Input label="الاسم الكامل *" value={form.fullName} onChange={e=>setForm(f=>({...f,fullName:e.target.value}))} placeholder="الاسم الثلاثي"/>
          <Input label="الجنسية *" value={form.nationality} onChange={e=>setForm(f=>({...f,nationality:e.target.value}))} placeholder="مثال: سعودي"/>
          <Input label="رقم الإقامة / الهوية *" value={form.iqamaNo} onChange={e=>setForm(f=>({...f,iqamaNo:e.target.value}))} placeholder="رقم الإقامة أو الهوية الوطنية"/>
          <Select label="نوع العمل" value={form.workType} onChange={e=>setForm(f=>({...f,workType:e.target.value}))}>
            {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select label="الشركة المعنية بالتشغيل" value={form.operatingCompany} onChange={e=>setForm(f=>({...f,operatingCompany:e.target.value}))}>
            {OPERATING_COS.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Btn onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? '⏳ جاري الحفظ...' : '✅ حفظ البيانات والبدء'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ==================== ADD SHIPMENT MODAL ====================
function AddShipmentModal({ open, onClose, onSave, defaultCompany }) {
  const emptyForm = {
    company: defaultCompany || 'naqel',
    shipmentNo: '',
    customerName: '',
    customerPhone: '',
    store: '',
    address: '',
    nationalAddress: '',
    paymentType: 'paid',
    bolPhoto: null,
  };
  const [form, setForm] = useState(emptyForm);
  const [showScanner, setShowScanner] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');

  useEffect(() => { if (open) setForm({ ...emptyForm, company: defaultCompany || 'naqel' }); }, [open]);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleScan = (raw) => {
    // Try to parse common formats or just set as shipment number
    upd('shipmentNo', raw);
    setShowScanner(false);
  };

  const [bolExtracting, setBolExtracting] = useState(false);
  const [bolExtractMsg, setBolExtractMsg] = useState('');

  const handleBol = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Read file for preview/storage
    const reader = new FileReader();
    reader.onload = (ev) => upd('bolPhoto', { name: file.name, data: ev.target.result });
    reader.readAsDataURL(file);

    // Try to extract barcode from the BOL image
    setBolExtracting(true);
    setBolExtractMsg('');
    const code = await extractBarcodeFromImage(file);
    setBolExtracting(false);
    if (code) {
      upd('shipmentNo', code);
      setBolExtractMsg(`✅ استُخرج الباركود: ${code}`);
    } else {
      setBolExtractMsg('لم يُعثر على باركود — أدخل رقم الشحنة يدوياً');
    }
  };

  // Geocode national address using Nominatim (OpenStreetMap — no API key needed)
  const geocodeNationalAddress = async () => {
    const query = form.nationalAddress.trim();
    if (!query) return;
    setGeocoding(true);
    setGeoMsg('');
    try {
      // Try Nominatim with Saudi Arabia context
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ' Saudi Arabia')}&format=json&limit=1&accept-language=ar`,
        { headers: { 'Accept-Language': 'ar' } }
      );
      const data = await res.json();
      if (data && data[0]) {
        const { lat, lon, display_name } = data[0];
        upd('address', display_name.split(',').slice(0,3).join(', '));
        upd('_lat', parseFloat(lat));
        upd('_lng', parseFloat(lon));
        setGeoMsg(`✅ تم تحديد الموقع: ${display_name.slice(0,60)}...`);
      } else {
        // fallback: use address as-is
        upd('address', query);
        setGeoMsg('لم يُعثر على الموقع — سيتم استخدام النص مباشرة');
      }
    } catch {
      upd('address', query);
      setGeoMsg('تعذّر الاتصال — سيتم استخدام النص مباشرة');
    }
    setGeocoding(false);
  };

  const handleSave = () => {
    if (!form.shipmentNo || !form.customerName || (!form.address && !form.nationalAddress)) {
      alert('يرجى ملء الحقول الإلزامية: رقم الشحنة، اسم العميل، العنوان');
      return;
    }
    const co = SHIPPING_COS.find(c => c.id === form.company);
    const earnings = form.paymentType === 'cod' ? (co?.codRate || 0) : (co?.paidRate || 0);
    onSave({
      ...form,
      id: uid(),
      earnings,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Modal open={open} title="📦 إضافة شحنة" onClose={onClose}>
      {showScanner ? (
        <BarcodeScanner onResult={handleScan} onClose={() => setShowScanner(false)}/>
      ) : (
        <>
          <Select label="شركة الشحن" value={form.company} onChange={e => upd('company', e.target.value)}>
            {SHIPPING_COS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-slate-700">رقم الشحنة *</label>
            <div className="flex gap-2">
              <input
                value={form.shipmentNo}
                onChange={e => upd('shipmentNo', e.target.value)}
                placeholder="أدخل رقم الشحنة"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7a]/30"
              />
              <button
                onClick={() => setShowScanner(true)}
                className="px-3 py-2.5 bg-[#1e2d7a] text-white rounded-xl text-xl hover:bg-[#172466] transition"
                title="مسح باركود"
              >📷</button>
            </div>
          </div>

          <Input label="اسم العميل *" value={form.customerName} onChange={e => upd('customerName', e.target.value)} placeholder="اسم المستلم"/>
          <Input label="رقم جوال العميل" value={form.customerPhone} onChange={e => upd('customerPhone', e.target.value)} placeholder="05xxxxxxxx" type="tel"/>
          <Input label="اسم المتجر" value={form.store} onChange={e => upd('store', e.target.value)} placeholder="اسم المتجر"/>

          {/* National Address with geocoding */}
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-slate-700">
              العنوان الوطني
              <span className="text-slate-400 font-normal text-xs"> — يحدد الموقع تلقائياً</span>
            </label>
            <div className="flex gap-2">
              <input
                value={form.nationalAddress}
                onChange={e => { upd('nationalAddress', e.target.value.toUpperCase()); setGeoMsg(''); }}
                placeholder="مثال: RJAS1234"
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#1e2d7a]/30 uppercase"
                maxLength={10}
              />
              <button
                onClick={geocodeNationalAddress}
                disabled={!form.nationalAddress || geocoding}
                className="px-3 py-2.5 bg-[#1e2d7a] disabled:opacity-40 text-white rounded-xl text-sm font-semibold hover:bg-[#172466] transition whitespace-nowrap"
              >{geocoding ? '⏳' : '📍 حدد'}</button>
            </div>
            {geoMsg && (
              <p className={`text-xs px-2 py-1.5 rounded-lg ${geoMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {geoMsg}
              </p>
            )}
          </div>

          <Input label="عنوان التوصيل *" value={form.address} onChange={e => upd('address', e.target.value)} placeholder="الحي، الشارع، المبنى (أو يُملأ من العنوان الوطني)"/>

          <Select label="نوع الدفع" value={form.paymentType} onChange={e => upd('paymentType', e.target.value)}>
            <option value="paid">مدفوع مسبقاً</option>
            <option value="cod">كاش عند التسليم (COD)</option>
          </Select>

          {/* BOL Photo — also extracts barcode automatically */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">
              📎 صورة البوليصة
              <span className="text-slate-400 font-normal text-xs"> — يستخرج الباركود تلقائياً</span>
            </label>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center gap-2 justify-center px-3 py-2.5 border border-slate-200 rounded-xl text-sm cursor-pointer hover:bg-slate-50 transition">
                <span>🖼️</span><span className="text-slate-600">من المعرض</span>
                <input type="file" accept="image/*" onChange={handleBol} className="hidden"/>
              </label>
              <label className="flex-1 flex items-center gap-2 justify-center px-3 py-2.5 border border-slate-200 rounded-xl text-sm cursor-pointer hover:bg-slate-50 transition">
                <span>📷</span><span className="text-slate-600">تصوير البوليصة</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleBol} className="hidden"/>
              </label>
            </div>
            {bolExtracting && (
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                <span className="animate-spin">⏳</span> جاري استخراج الباركود...
              </div>
            )}
            {bolExtractMsg && !bolExtracting && (
              <div className={`text-xs rounded-lg px-3 py-2 ${bolExtractMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {bolExtractMsg}
              </div>
            )}
            {form.bolPhoto && (
              <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
                ✅ <span>{form.bolPhoto.name}</span>
              </div>
            )}
          </div>

          {/* Earnings preview hidden from driver — computed internally */}

          <div className="flex gap-2 pt-2">
            <Btn onClick={handleSave} className="flex-1">✅ إضافة الشحنة</Btn>
            <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Google Maps Embed helpers ─────────────────────────────────────
const gmapDriverSrc = (lat, lng) =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
const gmapAddressSrc = (addr) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(addr + ' السعودية')}&z=15&output=embed`;
const gmapBothSrc = (driverLat, driverLng, destAddr) =>
  `https://maps.google.com/maps/dir/${driverLat},${driverLng}/${encodeURIComponent(destAddr + ' Saudi Arabia')}?output=embed`;

// ==================== DELIVERY FLOW ====================
function DeliveryFlow({ shipment, onDone, onClose }) {
  // Stages: receipt → traveling → arrived → done
  const [stage, setStage]       = useState('receipt');
  const [failReason, setFailReason]   = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [failPhoto, setFailPhoto]     = useState(null);
  const [location, setLocation]       = useState(null);
  const watchRef = useRef(null);
  const mapRef   = useRef(null);

  // Start GPS tracking and move to traveling stage
  const startJourney = () => {
    if (!navigator.geolocation) {
      alert('جهازك لا يدعم تحديد الموقع الجغرافي');
      return;
    }

    const beginWatch = () => {
      setStage('traveling');
      watchRef.current = navigator.geolocation.watchPosition(
        pos => {
          const loc = {
            lat:  pos.coords.latitude,
            lng:  pos.coords.longitude,
            acc:  Math.round(pos.coords.accuracy),
            ts:   Date.now(),
            name: shipment.driverName || '',
            active: true,
            shipmentNo: shipment.shipmentNo || '',
            destAddress: shipment.address || '',
          };
          setLocation(loc);
          // ① Write to Firebase (cross-device — management sees it live)
          if (shipment.driverId) {
            cloud.setDriverLocation(shipment.driverId, loc);
            // ② Fallback: also write to localStorage
            const locs = HDB.getLocations();
            locs[shipment.driverId] = loc;
            HDB.saveLocations(locs);
          }
        },
        err => {
          if (err.code === err.PERMISSION_DENIED) {
            alert('تم رفض إذن الموقع — يرجى السماح بالوصول للموقع من إعدادات الهاتف ثم المحاولة مجدداً');
            setStage('receipt');
          } else {
            console.warn('GPS error:', err.message);
          }
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
      );
    };

    // Check permission state first (modern browsers)
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(perm => {
        if (perm.state === 'denied') {
          alert('إذن الموقع مرفوض — يرجى فتح إعدادات الهاتف والسماح للتطبيق بالوصول للموقع');
          return;
        }
        // 'granted' or 'prompt' → trigger the native permission dialog by calling getCurrentPosition first
        navigator.geolocation.getCurrentPosition(
          () => beginWatch(),
          err => {
            if (err.code === err.PERMISSION_DENIED) {
              alert('يرجى السماح بالوصول للموقع لتفعيل التتبع أثناء التوصيل');
            } else {
              // Permission granted but position failed — still start watch
              beginWatch();
            }
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }).catch(() => {
        // Permissions API not fully supported — fall through to direct call
        navigator.geolocation.getCurrentPosition(
          () => beginWatch(),
          () => alert('يرجى السماح بالوصول للموقع لتفعيل التتبع'),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    } else {
      // Fallback: direct getCurrentPosition triggers the native dialog
      navigator.geolocation.getCurrentPosition(
        () => beginWatch(),
        () => alert('يرجى السماح بالوصول للموقع لتفعيل التتبع'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  };

  const arrive = () => {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    if (shipment.driverId) {
      // Mark inactive in Firebase
      cloud.clearDriverLocation(shipment.driverId);
      // Also update localStorage
      const locs = HDB.getLocations();
      if (locs[shipment.driverId]) { locs[shipment.driverId].active = false; HDB.saveLocations(locs); }
    }
    setStage('arrived');
  };

  const handleDelivered = () => {
    onDone({ status: 'delivered', deliveredAt: new Date().toISOString() });
    setStage('done');
  };

  const handleFailed = () => {
    const reason = failReason === 'غيره' ? otherReason : failReason;
    if (!reason) { alert('يرجى اختيار سبب التعذر'); return; }
    if (failReason === 'غيره' && !otherReason.trim()) { alert('يرجى كتابة السبب'); return; }
    onDone({ status: 'failed', failReason: reason, failPhoto: failPhoto || null, failedAt: new Date().toISOString() });
    setStage('done');
  };

  const co = SHIPPING_COS.find(c => c.id === shipment.company);

  // ── Map iframe src ─────────────────────────────────────────────
  const mapSrc = location
    ? (shipment.address
        ? gmapBothSrc(location.lat, location.lng, shipment.address)
        : gmapDriverSrc(location.lat, location.lng))
    : (shipment.address ? gmapAddressSrc(shipment.address) : null);

  if (stage === 'done') return (
    <Modal open title="✅ تم" onClose={onClose}>
      <div className="text-center py-6 space-y-3">
        <div className="text-5xl">🎉</div>
        <p className="font-bold text-slate-800 text-lg">تم تحديث حالة الشحنة</p>
        <Btn onClick={onClose} className="w-full">إغلاق</Btn>
      </div>
    </Modal>
  );

  return (
    <Modal open title={`🚚 ${shipment.customerName}`} onClose={stage === 'receipt' ? onClose : undefined}>

      {/* ── Shipment Receipt ─────────────────────────────── */}
      <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm border border-slate-100">
        <div className="flex gap-2"><span className="text-slate-400 w-20">الشحنة</span><span className="font-mono font-semibold text-[#1e2d7a]">{shipment.shipmentNo}</span></div>
        <div className="flex gap-2"><span className="text-slate-400 w-20">العميل</span><span className="font-semibold">{shipment.customerName}</span></div>
        {shipment.customerPhone && (
          <div className="flex gap-2">
            <span className="text-slate-400 w-20">الجوال</span>
            <a href={`tel:${shipment.customerPhone}`} className="text-blue-600 font-semibold underline underline-offset-2">{shipment.customerPhone}</a>
          </div>
        )}
        <div className="flex gap-2"><span className="text-slate-400 w-20">العنوان</span><span className="font-semibold">{shipment.address || '—'}</span></div>
        {shipment.nationalAddress && (
          <div className="flex gap-2"><span className="text-slate-400 w-20">العنوان الوطني</span><span className="font-mono font-bold text-[#1e2d7a]">{shipment.nationalAddress}</span></div>
        )}
        <div className="flex gap-2"><span className="text-slate-400 w-20">الدفع</span>
          <span className={`font-bold ${shipment.paymentType==='cod'?'text-amber-600':'text-green-600'}`}>
            {shipment.paymentType==='cod'?'💵 كاش عند التسليم':'✅ مدفوع مسبقاً'}
          </span>
        </div>
        <div className="flex gap-2"><span className="text-slate-400 w-20">قيمة الشحن</span>
          <span className="font-bold text-[#3d7c34]">{shipment.earnings} ريال</span>
        </div>
      </div>

      {/* ── Destination map (always show when address is known) ── */}
      {stage === 'receipt' && shipment.address && (
        <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <div className="bg-[#1e2d7a] px-3 py-1.5 flex items-center gap-2">
            <span className="text-white text-xs font-semibold">📍 موقع التوصيل</span>
            <span className="text-white/50 text-xs ml-auto">{shipment.address}</span>
          </div>
          <iframe
            title="موقع التوصيل"
            src={gmapAddressSrc(shipment.address)}
            width="100%" height="180"
            style={{border:0, display:'block'}}
            loading="lazy"
            allowFullScreen
          />
        </div>
      )}

      {/* ── Live map during journey ─────────────────────── */}
      {stage === 'traveling' && (
        <div className="rounded-xl overflow-hidden border border-[#3d7c34]/30 shadow-sm">
          <div className="hawlak-login-bg px-3 py-1.5 flex items-center gap-2">
            <span className="text-white text-xs font-semibold flex items-center gap-1">
              <span className="w-2 h-2 bg-[#3d7c34] rounded-full animate-pulse inline-block"/>
              التتبع الحي نشط
            </span>
            {location
              ? <span className="text-white/50 text-xs ml-auto">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
              : <span className="text-white/50 text-xs ml-auto">جاري تحديد الموقع...</span>
            }
          </div>
          {mapSrc ? (
            <iframe
              ref={mapRef}
              title="خريطة التوصيل"
              src={mapSrc}
              width="100%" height="220"
              style={{border:0, display:'block'}}
              loading="lazy"
              allowFullScreen
            />
          ) : (
            <div className="h-[220px] bg-slate-100 flex items-center justify-center text-slate-400 text-sm">
              جاري تحميل الخريطة...
            </div>
          )}
          <a
            href={`https://maps.google.com/?q=${encodeURIComponent((shipment.address||'') + ' Saudi Arabia')}`}
            target="_blank" rel="noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 bg-white text-[#1e2d7a] text-xs font-semibold border-t border-slate-100 hover:bg-slate-50 transition"
          >🔗 فتح في تطبيق خرائط Google</a>
        </div>
      )}

      {/* ── Stage actions ───────────────────────────────── */}
      {stage === 'receipt' && (
        <Btn onClick={startJourney} className="w-full" size="lg" variant="green">
          🚀 بدء الرحلة
        </Btn>
      )}

      {stage === 'traveling' && (
        <Btn onClick={arrive} className="w-full" size="lg" variant="amber">
          📍 وصلت للعنوان
        </Btn>
      )}

      {stage === 'arrived' && (
        <div className="space-y-3">
          <p className="text-center font-bold text-slate-700 text-base">ما النتيجة؟</p>

          <Btn onClick={handleDelivered} className="w-full" size="lg" variant="green">✅ تم التوصيل</Btn>

          <div className="border-2 border-red-200 rounded-2xl p-4 space-y-3 bg-red-50">
            <p className="text-red-600 font-bold text-sm">❌ تعذّر التوصيل</p>
            <Select value={failReason} onChange={e => { setFailReason(e.target.value); setOtherReason(''); setFailPhoto(null); }}>
              <option value="">— اختر السبب —</option>
              {FAIL_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </Select>

            {failReason === 'غيره' && (
              <div className="space-y-2">
                <Input
                  placeholder="اكتب السبب بالتفصيل..."
                  value={otherReason}
                  onChange={e => setOtherReason(e.target.value)}
                />
                {/* Photo upload */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-600">📷 صورة توضح المشكلة (اختياري)</label>
                  <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-slate-300 rounded-xl p-3 cursor-pointer hover:border-red-400 hover:bg-red-50/50 transition">
                    <input
                      type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => setFailPhoto(ev.target.result);
                        reader.readAsDataURL(file);
                      }}
                    />
                    {failPhoto
                      ? <img src={failPhoto} className="w-full max-h-32 object-contain rounded-lg"/>
                      : <span className="text-xs text-slate-400">اضغط لالتقاط صورة أو اختيار من المعرض</span>
                    }
                  </label>
                  {failPhoto && (
                    <button onClick={() => setFailPhoto(null)} className="text-xs text-red-400 hover:text-red-600">
                      ✕ حذف الصورة
                    </button>
                  )}
                </div>
              </div>
            )}

            {failReason && (
              <Btn variant="red" onClick={handleFailed} className="w-full">تأكيد التعذر</Btn>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ==================== DRIVER DASHBOARD ====================
function DriverDashboard({ user, profile, onLogout }) {
  const [shipments, setShipments] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCo, setSelectedCo] = useState(null);
  const [deliveryShipment, setDeliveryShipment] = useState(null);
  const [activeTab, setActiveTab] = useState('today'); // today | all
  const bgWatchRef = useRef(null);

  const load = () => setShipments(HDB.getShipments().filter(s => s.driverId === user.id));

  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [user.id]);

  // ── Background GPS: share location whenever app is open ──────
  useEffect(() => {
    if (!navigator.geolocation) return;

    const sendLocation = (pos) => {
      cloud.setDriverLocation(user.id, {
        lat:    pos.coords.latitude,
        lng:    pos.coords.longitude,
        ts:     Date.now(),
        name:   profile?.fullName || user.name,
        phone:  profile?.phone    || user.phone || '',
        active: true,
        online: true,
      });
    };

    // Watch position continuously
    bgWatchRef.current = navigator.geolocation.watchPosition(
      sendLocation,
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );

    // Also send immediately on mount
    navigator.geolocation.getCurrentPosition(sendLocation, () => {}, { enableHighAccuracy: true, timeout: 10000 });

    return () => {
      if (bgWatchRef.current != null) {
        navigator.geolocation.clearWatch(bgWatchRef.current);
        bgWatchRef.current = null;
      }
      // Mark offline but keep last known position
      cloud.clearDriverLocation(user.id);
    };
  }, [user.id]);

  const todayShipments = shipments.filter(s => s.createdAt?.slice(0,10) === today());
  const displayed = activeTab === 'today' ? todayShipments : shipments;

  // Monthly target — count based (800 shipments/month)
  const thisMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; };
  const monthlyDelivered = shipments.filter(s => s.status==='delivered' && s.createdAt?.slice(0,7) === thisMonth());
  const monthlyEarnings  = monthlyDelivered.reduce((a,b) => a+(b.earnings||0), 0);
  const SHIPMENT_TARGET  = 800;
  const monthlyCount     = monthlyDelivered.length;
  const targetPct        = Math.min(100, Math.round(monthlyCount / SHIPMENT_TARGET * 100));

  const stats = {
    total:     todayShipments.length,
    delivered: todayShipments.filter(s => s.status === 'delivered').length,
    failed:    todayShipments.filter(s => s.status === 'failed').length,
    earnings:  todayShipments.filter(s => s.status === 'delivered').reduce((a,b) => a + (b.earnings||0), 0),
  };

  const handleAddShipment = (shipment) => {
    const all = HDB.getShipments();
    const updated = [...all, { ...shipment, driverId: user.id, driverName: user.name }];
    HDB.saveShipments(updated);
    load();
  };

  const handleDeliveryDone = (result) => {
    const all = HDB.getShipments();
    const updated = all.map(s => s.id === deliveryShipment.id ? { ...s, ...result } : s);
    HDB.saveShipments(updated);
    setDeliveryShipment(null);
    load();
  };

  const statusBadge = (s) => {
    if (s.status === 'delivered') return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">✅ موصّل</span>;
    if (s.status === 'failed')    return <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-semibold">❌ متعذر</span>;
    return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">⏳ معلق</span>;
  };

  const co = SHIPPING_COS.find(c => c.id === selectedCo);

  return (
    <div className="min-h-screen bg-[#f0f2f8]" dir="rtl">
      {/* Header */}
      <div className="hawlak-login-bg px-4 py-3.5 flex items-center justify-between shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 hawlak-green-glow pointer-events-none"/>
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/20 shadow">
            <img src={`${import.meta.env.BASE_URL}hawlak-logo.jpg`} alt="حولك" className="w-full h-full object-cover"/>
          </div>
          <div>
            <p className="text-white font-black text-sm tracking-wide" style={{fontFamily:"'Cairo','Poppins',sans-serif"}}>
              {profile.fullName || user.name}
            </p>
            <p className="text-white/50 text-xs" style={{fontFamily:"'Cairo',sans-serif"}}>مندوب توصيل · دايم حولك</p>
          </div>
        </div>
        <button onClick={onLogout} className="relative text-white/60 hover:text-white text-xs px-3 py-1.5 border border-white/20 rounded-lg transition hover:border-white/40 hover:bg-white/10">خروج</button>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">

        {/* Monthly Target Progress — count based */}
        <div className="hawlak-login-bg rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 hawlak-green-glow pointer-events-none"/>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-white font-bold text-sm">🎯 تارجت الشهر</p>
              <p className="text-blue-300 text-xs">الهدف الشهري للشحنات</p>
            </div>
            <div className="text-left">
              <p className="text-white font-bold text-2xl leading-none">
                {monthlyCount}
                <span className="text-blue-300 text-sm font-normal"> / {SHIPMENT_TARGET}</span>
              </p>
              <p className="text-blue-300 text-xs mt-0.5">شحنة هذا الشهر</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-3 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${targetPct}%`,
                background: targetPct >= 100 ? '#3d7c34' : targetPct >= 70 ? '#fbbf24' : '#60a5fa'
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <p className="text-blue-300 text-xs">{targetPct}% مكتمل</p>
            <p className="text-blue-300 text-xs">
              {targetPct < 100
                ? `متبقي ${SHIPMENT_TARGET - monthlyCount} شحنة`
                : '🎉 تم تحقيق التارجت!'}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="إجمالي اليوم" value={stats.total} icon="📦" color="blue"/>
          <StatCard label="ناجحة" value={stats.delivered} icon="✅" color="green"/>
          <StatCard label="مرتجع" value={stats.failed} icon="❌" color="red"/>
          <StatCard label="أرباحي اليوم" value={`${stats.earnings} ر.س`} icon="💰" color="amber"/>
        </div>

        {/* Shipping company selector */}
        <Card className="p-4">
          <h3 className="font-bold text-slate-700 mb-3 text-sm">🚚 شركات الشحن</h3>
          <div className="grid grid-cols-2 gap-2">
            {SHIPPING_COS.map(c => (
              <button
                key={c.id}
                onClick={() => { if (!c.paidRate) return; setSelectedCo(c.id); setShowAdd(true); }}
                disabled={!c.paidRate}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 transition text-left ${c.paidRate ? 'hover:scale-[1.02] active:scale-95' : 'opacity-50 cursor-not-allowed'}`}
                style={{ borderColor: c.color, backgroundColor: c.bg }}
              >
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
                  <CoLogo co={c} size="md" />
                </div>
                <div>
                  <p className="font-bold text-sm" style={{ color: c.color }}>{c.name}</p>
                  {!c.paidRate && <p className="text-xs text-red-400 font-semibold">غير متاح لك</p>}
                </div>
              </button>
            ))}
          </div>
          <h3 className="font-bold text-slate-700 mb-3 mt-4 text-sm">🍔 منصات التوصيل</h3>
          <div className="grid grid-cols-4 gap-2">
            {FOOD_COS.map(c => (
              <div key={c.id} className="flex flex-col items-center p-2 rounded-xl border border-slate-100 bg-slate-50">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white flex items-center justify-center shadow-sm">
                  <CoLogo co={c} size="md" />
                </div>
                <p className="text-xs text-slate-600 mt-1 font-semibold text-center">{c.name}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Shipments list */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-700 text-sm">📋 الشحنات</h3>
            <div className="flex gap-1">
              {['today','all'].map(t => (
                <button key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${activeTab===t ? 'bg-[#1e2d7a] text-white' : 'bg-slate-100 text-slate-600'}`}
                >{t==='today'?'اليوم':'الكل'}</button>
              ))}
            </div>
          </div>

          {displayed.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <div className="text-4xl mb-2">📭</div>
              <p className="text-sm">لا توجد شحنات {activeTab==='today'?'لهذا اليوم':'بعد'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.slice().reverse().map(s => {
                const c = SHIPPING_COS.find(x => x.id === s.company);
                return (
                  <div key={s.id} className="border border-slate-100 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-500">{s.shipmentNo}</span>
                          {c && <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}><CoLogo co={c} size="sm" />{c.name}</span>}
                          {statusBadge(s)}
                        </div>
                        <p className="font-semibold text-slate-800 text-sm mt-1">{s.customerName}</p>
                        <p className="text-xs text-slate-500 truncate">{s.address}</p>
                        <div className="flex gap-3 mt-1 text-xs text-slate-400">
                          <span>{s.paymentType==='cod'?'💵 COD':'✅ مدفوع'}</span>
                          <span>{fmtTime(s.createdAt)}</span>
                        </div>
                        {/* حق الطلب يظهر فقط عند النجاح */}
                        {s.status === 'delivered' && s.earnings > 0 && (
                          <div className="mt-1.5 inline-flex items-center gap-1 bg-green-50 border border-green-100 rounded-lg px-2 py-1">
                            <span className="text-xs text-green-600 font-bold">حق الطلب: {s.earnings} ر.س</span>
                          </div>
                        )}
                        {s.status === 'failed' && s.failReason && (
                          <p className="text-xs text-red-500 mt-1">سبب التعذر: {s.failReason}</p>
                        )}
                      </div>
                      {s.status === 'pending' && (
                        <button
                          onClick={() => setDeliveryShipment(s)}
                          className="shrink-0 px-3 py-2 bg-[#1e2d7a] text-white rounded-xl text-xs font-semibold hover:bg-[#172466] transition"
                        >توصيل</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Add Shipment Modal */}
      <AddShipmentModal
        open={showAdd}
        onClose={() => { setShowAdd(false); setSelectedCo(null); }}
        onSave={handleAddShipment}
        defaultCompany={selectedCo}
      />

      {/* Delivery Flow */}
      {deliveryShipment && (
        <DeliveryFlow
          shipment={deliveryShipment}
          onDone={handleDeliveryDone}
          onClose={() => setDeliveryShipment(null)}
        />
      )}
    </div>
  );
}

// ==================== REASSIGN SHIPMENT MODAL ====================
function ReassignModal({ shipment, drivers, profiles, onSave, onClose }) {
  const [selectedDriver, setSelectedDriver] = useState('');
  if (!shipment) return null;
  return (
    <Modal open title="🔄 نقل الشحنة لسائق آخر" onClose={onClose}>
      <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1 mb-2">
        <p><span className="text-slate-400">رقم الشحنة: </span><span className="font-mono font-semibold">{shipment.shipmentNo}</span></p>
        <p><span className="text-slate-400">العميل: </span><span className="font-semibold">{shipment.customerName}</span></p>
        <p><span className="text-slate-400">السائق الحالي: </span><span className="text-amber-600 font-semibold">{shipment.driverName || '—'}</span></p>
      </div>
      <Select label="اختر السائق الجديد" value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
        <option value="">— اختر —</option>
        {drivers.filter(d => d.id !== shipment.driverId).map(d => {
          const pf = profiles[d.id];
          return <option key={d.id} value={d.id}>{pf?.fullName || d.name} ({pf?.operatingCompany || 'سائق'})</option>;
        })}
      </Select>
      <div className="flex gap-2 pt-2">
        <Btn onClick={() => { if (!selectedDriver) return; onSave(shipment.id, selectedDriver); }} className="flex-1">✅ نقل الشحنة</Btn>
        <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
      </div>
    </Modal>
  );
}

// ==================== EDIT DRIVER MODAL ====================
function EditDriverModal({ driver, profile, onSave, onClose }) {
  const [form, setForm] = useState({
    name:             driver?.name || '',
    fullName:         profile?.fullName || '',
    nationality:      profile?.nationality || '',
    iqamaNo:          profile?.iqamaNo || '',
    workType:         profile?.workType || 'تابع لحولك',
    operatingCompany: profile?.operatingCompany || 'ناقل',
    password:         driver?.password || '',
  });
  return (
    <Modal open title={`✏️ تعديل بيانات ${profile?.fullName || driver.name}`} onClose={onClose}>
      <Input label="الاسم (النظام)" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
      <Input label="الاسم الكامل" value={form.fullName} onChange={e=>setForm(f=>({...f,fullName:e.target.value}))}/>
      <Input label="الجنسية" value={form.nationality} onChange={e=>setForm(f=>({...f,nationality:e.target.value}))}/>
      <Input label="رقم الإقامة / الهوية" value={form.iqamaNo} onChange={e=>setForm(f=>({...f,iqamaNo:e.target.value}))}/>
      <Select label="نوع العمل" value={form.workType} onChange={e=>setForm(f=>({...f,workType:e.target.value}))}>
        {WORK_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
      </Select>
      <Select label="الشركة المعنية" value={form.operatingCompany} onChange={e=>setForm(f=>({...f,operatingCompany:e.target.value}))}>
        {OPERATING_COS.map(c=><option key={c} value={c}>{c}</option>)}
      </Select>
      <Input label="كلمة المرور" type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="اتركها فارغة للإبقاء على القديمة"/>
      <div className="flex gap-2 pt-1">
        <Btn onClick={()=>onSave(driver.id, form)} className="flex-1">💾 حفظ التعديلات</Btn>
        <Btn variant="outline" onClick={onClose}>إلغاء</Btn>
      </div>
    </Modal>
  );
}

// ==================== SCHEDULING (Operations) ====================
const DAYS_AR = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const OFF_DAYS_DEFAULT = [5]; // Friday off by default

function SchedulingPanel({ drivers, profiles }) {
  const [schedule, setSchedule] = useState(() =>
    JSON.parse(localStorage.getItem('hawlak_schedule') || 'null') || {}
  );
  const [holidays, setHolidays] = useState(() =>
    JSON.parse(localStorage.getItem('hawlak_holidays') || '[]')
  );
  const [newHoliday, setNewHoliday] = useState({ date:'', note:'' });
  const [showAddHoliday, setShowAddHoliday] = useState(false);

  const saveSchedule = (s) => { setSchedule(s); localStorage.setItem('hawlak_schedule', JSON.stringify(s)); };
  const saveHolidays = (h) => { setHolidays(h); localStorage.setItem('hawlak_holidays', JSON.stringify(h)); };

  const toggleDay = (driverId, dayIdx) => {
    const cur = schedule[driverId] || { offDays: [...OFF_DAYS_DEFAULT] };
    const offDays = cur.offDays.includes(dayIdx)
      ? cur.offDays.filter(d=>d!==dayIdx)
      : [...cur.offDays, dayIdx];
    saveSchedule({ ...schedule, [driverId]: { ...cur, offDays } });
  };

  const toggleGroup = (driverId, group) => {
    const cur = schedule[driverId] || { offDays: [...OFF_DAYS_DEFAULT], group: 'أ' };
    saveSchedule({ ...schedule, [driverId]: { ...cur, group } });
  };

  // Auto rotation: split drivers into 2 groups, alternate Fridays
  const applyAutoRotation = () => {
    const half = Math.ceil(drivers.length / 2);
    const updated = { ...schedule };
    drivers.forEach((d, i) => {
      updated[d.id] = { ...(updated[d.id]||{}), group: i < half ? 'أ' : 'ب', offDays: [5] };
    });
    saveSchedule(updated);
  };

  const thisWeekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + i);
    return d;
  });

  const isHoliday = (dateStr) => holidays.some(h => h.date === dateStr);
  const todayStr = new Date().toISOString().slice(0,10);

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <h3 className="font-bold text-slate-800">📅 جدولة السائقين</h3>
        <div className="flex gap-2">
          <Btn size="sm" variant="outline" onClick={applyAutoRotation}>🔄 توزيع تلقائي</Btn>
          <Btn size="sm" onClick={()=>setShowAddHoliday(true)}>➕ إجازة رسمية</Btn>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs flex-wrap">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400 inline-block"/>يعمل</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-300 inline-block"/>إجازة</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-300 inline-block"/>عطلة رسمية</span>
        <span className="flex items-center gap-1.5 mr-4 text-slate-500">المجموعة أ = يعملون الجمعة الأولى · ب = يعملون الجمعة الثانية</span>
      </div>

      {/* Weekly grid */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-max">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-right font-semibold text-slate-600 w-32">السائق</th>
                <th className="px-2 py-3 font-semibold text-slate-500 w-8">مج.</th>
                {thisWeekDates.map((d,i) => {
                  const ds = d.toISOString().slice(0,10);
                  const isFri = i===5;
                  const isHol = isHoliday(ds);
                  const isToday = ds === todayStr;
                  return (
                    <th key={i} className={`px-2 py-3 text-center font-semibold min-w-[52px] ${isToday?'bg-blue-50':''}`}>
                      <div className={`${isFri?'text-red-500':isHol?'text-amber-600':'text-slate-600'}`}>{DAYS_AR[i]}</div>
                      <div className={`text-slate-400 font-normal mt-0.5 ${isHol?'line-through':''}`}>{d.getDate()}</div>
                      {isHol && <div className="text-amber-500 text-xs">🏖️</div>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => {
                const pf = profiles[d.id] || {};
                const sc = schedule[d.id] || { offDays: [...OFF_DAYS_DEFAULT], group: '—' };
                return (
                  <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800">{pf.fullName||d.name}</p>
                      <p className="text-slate-400 text-xs">{pf.operatingCompany||'—'}</p>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <select
                        value={sc.group||'أ'}
                        onChange={e=>toggleGroup(d.id, e.target.value)}
                        className="border border-slate-200 rounded-lg px-1 py-0.5 text-xs bg-white"
                      >
                        <option value="أ">أ</option>
                        <option value="ب">ب</option>
                      </select>
                    </td>
                    {thisWeekDates.map((date, dayIdx) => {
                      const ds = date.toISOString().slice(0,10);
                      const isOff = sc.offDays?.includes(dayIdx);
                      const isHol = isHoliday(ds);
                      const isToday = ds === todayStr;
                      return (
                        <td key={dayIdx} className={`px-2 py-2 text-center ${isToday?'bg-blue-50/50':''}`}>
                          <button
                            onClick={()=>!isHol && toggleDay(d.id, dayIdx)}
                            className={`w-8 h-8 rounded-lg font-bold text-xs transition active:scale-90 ${
                              isHol ? 'bg-amber-100 text-amber-600 cursor-default' :
                              isOff ? 'bg-red-100 text-red-500 hover:bg-red-200' :
                                      'bg-green-100 text-green-600 hover:bg-green-200'
                            }`}
                            title={isHol?'عطلة رسمية':isOff?'إجازة — اضغط للتغيير':'يعمل — اضغط للإجازة'}
                          >
                            {isHol ? '🏖️' : isOff ? '✕' : '✓'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {drivers.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">لا يوجد سائقون</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Holidays list */}
      {holidays.length > 0 && (
        <Card className="p-4">
          <h4 className="font-bold text-slate-700 mb-3 text-sm">🏖️ العطل الرسمية المسجّلة</h4>
          <div className="space-y-2">
            {holidays.sort((a,b)=>a.date>b.date?1:-1).map((h,i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-semibold text-slate-700 text-sm">{h.note || 'عطلة رسمية'}</p>
                  <p className="text-xs text-slate-400">{fmtDate(h.date)}</p>
                </div>
                <button
                  onClick={()=>saveHolidays(holidays.filter((_,j)=>j!==i))}
                  className="text-red-400 hover:text-red-600 text-sm px-2 py-1"
                >🗑️</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Add holiday modal */}
      <Modal open={showAddHoliday} title="➕ إضافة عطلة رسمية" onClose={()=>setShowAddHoliday(false)}>
        <Input label="التاريخ" type="date" value={newHoliday.date} onChange={e=>setNewHoliday(f=>({...f,date:e.target.value}))}/>
        <Input label="اسم العطلة" value={newHoliday.note} onChange={e=>setNewHoliday(f=>({...f,note:e.target.value}))} placeholder="مثال: اليوم الوطني"/>
        <div className="flex gap-2">
          <Btn onClick={()=>{
            if (!newHoliday.date) return;
            saveHolidays([...holidays, newHoliday]);
            setNewHoliday({date:'',note:''});
            setShowAddHoliday(false);
          }} className="flex-1">✅ إضافة</Btn>
          <Btn variant="outline" onClick={()=>setShowAddHoliday(false)}>إلغاء</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ==================== MANAGEMENT DASHBOARD ====================
function ManagementDashboard({ user, onLogout }) {
  const [tab, setTab] = useState('overview');
  const [shipments, setShipments] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [locations, setLocations] = useState({});
  const [reassignShipment, setReassignShipment] = useState(null);
  const [archiveConfirm, setArchiveConfirm] = useState(null); // { stage: 1|2, shipment }
  const [archiveReason, setArchiveReason] = useState('');
  const [deleteArchiveId, setDeleteArchiveId] = useState(null); // shipment id to permanently delete
  const [finPeriod, setFinPeriod] = useState('today');
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriver, setNewDriver] = useState({ name:'', username:'', password:'' });
  const [shipFilter, setShipFilter] = useState('all');
  const [shipSearch, setShipSearch] = useState('');
  const [editDriver, setEditDriver] = useState(null); // {driver, profile}
  const [joinRequests, setJoinRequests] = useState([]);
  const [rejectId, setRejectId] = useState(null); // request id being rejected
  const [rejectNote, setRejectNote] = useState('');

  const loadAll = () => {
    setShipments(HDB.getShipments());
    setDrivers(HDB.getUsers().filter(u => u.role === 'driver'));
    setProfiles(HDB.getProfiles());
    setJoinRequests(HDB.getJoinRequests());
    // localStorage fallback for locations (overridden by Firebase listener below)
    setLocations(HDB.getLocations());
  };

  // Approve join request → create driver account
  const handleApproveRequest = (req) => {
    const newUser = {
      id: uid(), name: req.fullName, username: req.username,
      password: req.password, role: 'driver', title: 'سائق',
      phone: req.phone,
    };
    HDB.saveUsers([...HDB.getUsers(), newUser]);
    const updated = HDB.getJoinRequests().map(r =>
      r.id === req.id ? { ...r, status: 'approved', approvedAt: new Date().toISOString(), approvedBy: user.name } : r
    );
    HDB.saveJoinRequests(updated);
    loadAll();
  };

  // Reject join request
  const handleRejectRequest = (reqId, note) => {
    const updated = HDB.getJoinRequests().map(r =>
      r.id === reqId ? { ...r, status: 'rejected', rejectedAt: new Date().toISOString(), rejectedBy: user.name, rejectNote: note } : r
    );
    HDB.saveJoinRequests(updated);
    setRejectId(null);
    setRejectNote('');
    loadAll();
  };

  useEffect(() => {
    // ── 1. Load from Firebase first, then refresh UI ──────────
    cloud.loadHawlak().then(() => loadAll());

    // ── 2. Real-time listener: any device saves → all see it ──
    const unsubHawlak = cloud.subscribeHawlak(() => loadAll());

    // ── 3. Fallback poll every 8s (offline / Firebase off) ───
    const t = setInterval(() => {
      setShipments(HDB.getShipments());
      setDrivers(HDB.getUsers().filter(u => u.role === 'driver'));
      setProfiles(HDB.getProfiles());
    }, 8000);

    // ── 4. Real-time Firebase listener for driver locations ───
    const unsubLocations = cloud.listenDriverLocations(fbLocs => {
      setLocations(prev => ({ ...prev, ...fbLocs }));
    });

    return () => {
      clearInterval(t);
      if (typeof unsubHawlak === 'function') unsubHawlak();
      if (typeof unsubLocations === 'function') unsubLocations();
    };
  }, []);

  // Archive shipment (operations + manager only)
  const handleArchiveConfirm = () => {
    if (!archiveConfirm) return;
    if (archiveConfirm.stage === 1) {
      setArchiveConfirm({ ...archiveConfirm, stage: 2 });
      setArchiveReason('');
    } else {
      if (!archiveReason.trim()) { alert('يرجى كتابة سبب المسح'); return; }
      const all = HDB.getShipments();
      const updated = all.map(s => s.id === archiveConfirm.shipment.id
        ? { ...s, status: 'archived', archiveReason: archiveReason.trim(), archivedAt: new Date().toISOString(), archivedBy: user.name }
        : s
      );
      HDB.saveShipments(updated);
      setArchiveConfirm(null);
      setArchiveReason('');
      loadAll();
    }
  };

  // Permanently delete an archived shipment (operations + manager)
  const handleDeleteArchive = (id) => {
    const all = HDB.getShipments();
    HDB.saveShipments(all.filter(s => s.id !== id));
    setDeleteArchiveId(null);
    loadAll();
  };

  // Period filter helper
  const inPeriod = (iso) => {
    if (!iso) return false;
    const d = new Date(iso); const now = new Date();
    if (finPeriod === 'today') return iso.slice(0,10) === today();
    if (finPeriod === 'week') { const w = new Date(now); w.setDate(now.getDate()-7); return d >= w; }
    if (finPeriod === 'month') { const m = new Date(now); m.setDate(now.getDate()-30); return d >= m; }
    return true;
  };

  const todayAll = shipments.filter(s => s.createdAt?.slice(0,10) === today());
  const stats = {
    totalToday:    todayAll.length,
    deliveredToday: todayAll.filter(s => s.status === 'delivered').length,
    failedToday:   todayAll.filter(s => s.status === 'failed').length,
    earningsToday: todayAll.filter(s => s.status === 'delivered').reduce((a,b) => a + (b.earnings||0), 0),
  };

  // Build tabs based on role
  const tabs = [
    { id:'overview',    label:'نظرة عامة',  icon:'📊' },
    { id:'tracking',    label:'التتبع',      icon:'🗺️' },
    { id:'shipments',   label:'الشحنات',    icon:'📦' },
    { id:'drivers',     label:'السائقون',   icon:'👤', badge: joinRequests.filter(r=>r.status==='pending').length || 0 },
    ...(canSeeCompanies(user) ? [{ id:'companies',  label:'الشركات',  icon:'🚚' }] : []),
    ...(isFinance(user)       ? [{ id:'finance',    label:'المالية',  icon:'💰' }] : []),
    // Scheduling: ops + manager
    ...(['manager','operations'].includes(user.role) ? [{ id:'schedule', label:'الجداول', icon:'📅' }] : []),
  ];

  // Reassign shipment
  const handleReassign = (shipmentId, newDriverId) => {
    const newDriver = drivers.find(d => d.id === newDriverId);
    const pf = profiles[newDriverId];
    const all = HDB.getShipments();
    const updated = all.map(s => s.id === shipmentId
      ? { ...s, driverId: newDriverId, driverName: pf?.fullName || newDriver?.name }
      : s);
    HDB.saveShipments(updated);
    setReassignShipment(null);
    loadAll();
  };

  // Add new driver account
  const handleAddDriver = () => {
    if (!newDriver.name || !newDriver.username || !newDriver.password) { alert('ملء جميع الحقول مطلوب'); return; }
    const users = HDB.getUsers();
    if (users.find(u => u.username === newDriver.username)) { alert('اسم المستخدم موجود مسبقاً'); return; }
    const updated = [...users, { id: uid(), ...newDriver, role: 'driver' }];
    HDB.saveUsers(updated);
    setNewDriver({ name:'', username:'', password:'' });
    setShowAddDriver(false);
    loadAll();
  };

  const handleEditDriverSave = (driverId, form) => {
    // Update user account
    const users = HDB.getUsers().map(u =>
      u.id === driverId
        ? { ...u, name: form.name, ...(form.password ? { password: form.password } : {}) }
        : u
    );
    HDB.saveUsers(users);
    // Update profile
    const profs = HDB.getProfiles();
    profs[driverId] = {
      ...(profs[driverId] || {}),
      fullName:         form.fullName,
      nationality:      form.nationality,
      iqamaNo:          form.iqamaNo,
      workType:         form.workType,
      operatingCompany: form.operatingCompany,
    };
    HDB.saveProfiles(profs);
    setEditDriver(null);
    loadAll();
  };

  // Financial data
  const finShipments = shipments.filter(s => inPeriod(s.createdAt) && s.status === 'delivered');
  const finTotal = finShipments.reduce((a,b) => a+(b.earnings||0), 0);
  const finByDriver = drivers.map(d => {
    const ds = finShipments.filter(s => s.driverId === d.id);
    return { driver: d, profile: profiles[d.id], count: ds.length, earnings: ds.reduce((a,b)=>a+(b.earnings||0),0) };
  }).filter(x => x.count > 0).sort((a,b) => b.earnings - a.earnings);
  const finByCo = SHIPPING_COS.map(c => {
    const cs = finShipments.filter(s => s.company === c.id);
    return { co: c, count: cs.length, earnings: cs.reduce((a,b)=>a+(b.earnings||0),0) };
  }).filter(x => x.count > 0);

  // Filtered shipments
  const filteredShipments = shipments
    .filter(s => shipFilter === 'all' || s.status === shipFilter)
    .filter(s => !shipSearch || s.shipmentNo?.includes(shipSearch) || s.customerName?.includes(shipSearch) || s.driverName?.includes(shipSearch))
    .slice().reverse();

  const statusBadge = (s) => {
    if (s.status==='delivered') return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">✅ موصّل</span>;
    if (s.status==='failed')    return <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-semibold">❌ متعذر</span>;
    return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">⏳ معلق</span>;
  };

  return (
    <div className="min-h-screen bg-[#f0f2f8]" dir="rtl">
      {/* Header */}
      <div className="hawlak-login-bg px-4 py-3 flex items-center justify-between shadow-lg relative overflow-hidden">
        <div className="absolute inset-0 hawlak-green-glow pointer-events-none"/>
        <div className="relative flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/20 shadow">
            <img src={`${import.meta.env.BASE_URL}hawlak-logo.jpg`} alt="حولك" className="w-full h-full object-cover"/>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-white font-black text-sm tracking-wide" style={{fontFamily:"'Cairo','Poppins',sans-serif"}}>HOOLAK</p>
              <span className="text-white/30 text-xs">|</span>
              <p className="text-white/70 text-xs">{user.name}</p>
            </div>
            <p className="text-white/40 text-xs" style={{fontFamily:"'Cairo',sans-serif"}}>{user.title || 'إدارة'} · دايم حولك</p>
          </div>
        </div>
        <button onClick={onLogout} className="relative text-white/60 hover:text-white text-xs px-3 py-1.5 border border-white/20 rounded-lg transition hover:border-white/40 hover:bg-white/10">خروج</button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100 px-2 overflow-x-auto sticky top-0 z-10 shadow-sm">
        <div className="flex gap-0.5 min-w-max">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1 px-3 py-3 text-xs font-semibold border-b-2 transition whitespace-nowrap ${tab===t.id?'border-[#1e2d7a] text-[#1e2d7a]':'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.icon} {t.label}
              {t.badge > 0 && (
                <span className="bg-amber-400 text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 max-w-5xl mx-auto space-y-4">

        {/* ══ OVERVIEW ══ */}
        {tab === 'overview' && <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="شحنات اليوم" value={stats.totalToday} icon="📦" color="blue"/>
            <StatCard label="تم توصيلها" value={stats.deliveredToday} icon="✅" color="green"/>
            <StatCard label="متعذرة" value={stats.failedToday} icon="❌" color="red"/>
            <StatCard label="أرباح اليوم (ر.س)" value={stats.earningsToday} icon="💰" color="amber"/>
          </div>

          <Card className="p-4">
            <h3 className="font-bold text-slate-700 mb-3 text-sm">👤 أداء السائقين اليوم</h3>
            <div className="space-y-2">
              {drivers.map(d => {
                const ds = todayAll.filter(s => s.driverId === d.id);
                const ok = ds.filter(s => s.status === 'delivered').length;
                const earn = ds.filter(s => s.status === 'delivered').reduce((a,b)=>a+(b.earnings||0),0);
                const pf = profiles[d.id];
                const loc = locations[d.id];
                const isActive = loc?.active && (Date.now() - (loc?.ts||0)) < 120000;
                return (
                  <div key={d.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="relative shrink-0">
                      {pf?.photo
                        ? <img src={pf.photo} className="w-10 h-10 rounded-full object-cover"/>
                        : <div className="w-10 h-10 rounded-full bg-[#1e2d7a] flex items-center justify-center text-white font-bold">{(pf?.fullName||d.name).charAt(0)}</div>
                      }
                      {isActive && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white"/>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{pf?.fullName||d.name}</p>
                      <p className="text-xs text-slate-500">{pf?.operatingCompany||'—'} {isActive ? '• 🟢 نشط' : ''}</p>
                    </div>
                    <div className="text-xs text-left shrink-0">
                      <p className="text-slate-600">{ds.length} شحنة / {ok} ✅</p>
                      <p className="text-green-600 font-bold">{earn} ر.س</p>
                    </div>
                  </div>
                );
              })}
              {drivers.length === 0 && <p className="text-slate-400 text-sm text-center py-4">لا يوجد سائقون مسجلون</p>}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-bold text-slate-700 mb-3 text-sm">📦 توزيع اليوم حسب الشركة</h3>
            {todayAll.length === 0
              ? <p className="text-slate-400 text-sm text-center py-4">لا توجد شحنات اليوم</p>
              : SHIPPING_COS.map(c => {
                  const cs = todayAll.filter(s => s.company === c.id);
                  if (!cs.length) return null;
                  const pct = Math.round(cs.length/todayAll.length*100);
                  return (
                    <div key={c.id} className="mb-2 space-y-1">
                      <div className="flex justify-between text-xs font-semibold" style={{color:c.color}}>
                        <span className="flex items-center gap-1"><CoLogo co={c} size="sm" />{c.name}</span>
                        <span>{cs.length} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,backgroundColor:c.color}}/>
                      </div>
                    </div>
                  );
                })
            }
          </Card>
        </>}

        {/* ══ TRACKING ══ */}
        {tab === 'tracking' && (() => {
          const now = Date.now();
          // All drivers with ANY location data
          const driversWithLoc = drivers.filter(d => locations[d.id]?.lat);
          // Online = location updated in last 5 min
          const onlineDrivers = driversWithLoc.filter(d => (now - (locations[d.id]?.ts||0)) < 300000);
          const activeDrivers = onlineDrivers; // alias for map

          // Build Leaflet HTML with all located drivers
          const buildMapHtml = (driverList) => {
            const markers = driverList.map(d => {
              const loc  = locations[d.id];
              const pf   = profiles[d.id];
              const name = pf?.fullName || d.name;
              const phone = pf?.phone || d.phone || '';
              const pending  = todayAll.filter(s => s.driverId === d.id && s.status === 'pending').length;
              const delivered = todayAll.filter(s => s.driverId === d.id && s.status === 'delivered').length;
              const secAgo = Math.floor((now - (loc.ts||0)) / 1000);
              const freshness = secAgo < 30 ? 'live' : secAgo < 120 ? 'recent' : secAgo < 300 ? 'idle' : 'away';
              const ship = loc.shipmentNo || '';
              const dest = loc.destAddress || '';
              return { lat: loc.lat, lng: loc.lng, name, phone, pending, delivered, freshness, ship, dest, secAgo };
            });
            return `<!DOCTYPE html><html dir="rtl"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
  body{margin:0;padding:0;font-family:Cairo,Tajawal,sans-serif;}
  #map{height:100vh;}
  .hw-popup{font-size:13px;direction:rtl;text-align:right;min-width:175px;}
  .hw-popup .dname{color:#1e2d7a;font-size:14px;font-weight:700;}
  .hw-popup .dphone{color:#64748b;font-size:11px;margin-top:1px;}
  .hw-popup .status{display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:600;margin-top:5px;}
  .hw-popup .stats{display:flex;gap:8px;margin-top:5px;font-size:11px;}
  .hw-popup .stat{background:#f1f5f9;border-radius:5px;padding:2px 6px;}
  .hw-popup .ship{color:#3d7c34;font-weight:600;margin-top:4px;font-size:12px;}
  .hw-popup .dest{color:#64748b;font-size:11px;margin-top:2px;}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  @keyframes ring{0%,100%{transform:scale(1);opacity:.6}50%{transform:scale(1.8);opacity:0}}
</style>
</head><body><div id="map"></div><script>
  const map = L.map('map',{zoomControl:true});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
  const drivers = ${JSON.stringify(markers)};
  const bounds = [];
  function makeIcon(f){
    const colors={live:'#22c55e',recent:'#3d7c34',idle:'#f59e0b',away:'#94a3b8'};
    const c=colors[f]||'#94a3b8';
    const anim=f==='live'?'animation:pulse 1s infinite;':'';
    const ring=f==='live'?'<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid '+c+';animation:ring 1.5s infinite;"></div>':'';
    return L.divIcon({
      className:'',
      html:'<div style="position:relative;width:20px;height:20px;">'+ring+'<div style="position:absolute;inset:0;background:'+c+';border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);'+anim+'"></div></div>',
      iconSize:[20,20],iconAnchor:[10,10],popupAnchor:[0,-10]
    });
  }
  drivers.forEach(d=>{
    const marker=L.marker([d.lat,d.lng],{icon:makeIcon(d.freshness)}).addTo(map);
    const sc={live:'background:#dcfce7;color:#15803d',recent:'background:#f0fdf4;color:#16a34a',idle:'background:#fef3c7;color:#d97706',away:'background:#f1f5f9;color:#64748b'};
    const sl={live:'🟢 متصل الآن',recent:'🟢 نشط',idle:'🟡 خامل',away:'⚪ آخر ظهور'};
    const timeStr=d.secAgo<60?d.secAgo+'ث':Math.floor(d.secAgo/60)+'د';
    const popup='<div class="hw-popup"><div class="dname">'+d.name+'</div>'
      +(d.phone?'<div class="dphone">📞 '+d.phone+'</div>':'')
      +'<div><span class="status" style="'+sc[d.freshness]+'">'+sl[d.freshness]+' · '+timeStr+'</span></div>'
      +'<div class="stats"><span class="stat">📦 '+d.pending+' معلقة</span><span class="stat">✅ '+d.delivered+' موصّلة</span></div>'
      +(d.ship?'<div class="ship">🚚 '+d.ship+'</div>':'')
      +(d.dest?'<div class="dest">📍 '+d.dest+'</div>':'')
      +'</div>';
    marker.bindPopup(popup);
    bounds.push([d.lat,d.lng]);
  });
  if(bounds.length===1){map.setView(bounds[0],15);}
  else if(bounds.length>1){map.fitBounds(bounds,{padding:[50,50]});}
  else{map.setView([24.7136,46.6753],11);}
<\/script></body></html>`;
          };

          return (
            <>
              {/* ── Combined map ─────────────────────────────── */}
              <Card className="overflow-hidden p-0">
                <div className="hawlak-login-bg px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-[#3d7c34] rounded-full animate-pulse"/>
                    <span className="text-white text-sm font-bold">خريطة التتبع</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-white/70 text-xs">{onlineDrivers.length} متصل · {drivers.length} إجمالي</span>
                    {activeDrivers.length > 0 && (
                      <a
                        href={`https://maps.google.com/maps?q=${activeDrivers.map(d=>`${locations[d.id].lat},${locations[d.id].lng}`).join('|')}`}
                        target="_blank" rel="noreferrer"
                        className="text-white/70 hover:text-white text-xs underline"
                      >فتح في Google ↗</a>
                    )}
                  </div>
                </div>

                {activeDrivers.length > 0 ? (
                  <iframe
                    key={activeDrivers.map(d=>locations[d.id]?.ts).join('-')}
                    title="خريطة السائقين"
                    srcdoc={buildMapHtml(activeDrivers)}
                    width="100%"
                    height="380"
                    style={{border:0, display:'block'}}
                    sandbox="allow-scripts allow-same-origin"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 bg-slate-50 text-slate-400 gap-2">
                    <div className="text-4xl">🗺️</div>
                    <p className="text-sm font-medium">لا يوجد سائقون متصلون الآن</p>
                    <p className="text-xs">تظهر المؤشرات تلقائياً لما يفتح السائق التطبيق</p>
                  </div>
                )}

                {/* Driver pills */}
                {activeDrivers.length > 0 && (
                  <div className="px-3 py-2 flex flex-wrap gap-2 bg-slate-50 border-t border-slate-100">
                    {activeDrivers.map(d => {
                      const loc = locations[d.id];
                      const pf  = profiles[d.id];
                      const pending = todayAll.filter(s => s.driverId === d.id && s.status === 'pending').length;
                      return (
                        <a key={d.id}
                          href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-[#3d7c34]/30 rounded-full text-xs font-semibold text-[#1e2d7a] hover:bg-[#3d7c34] hover:text-white hover:border-[#3d7c34] transition"
                        >
                          <span className="w-1.5 h-1.5 bg-[#3d7c34] rounded-full"/>
                          {pf?.fullName||d.name}
                          {pending > 0 && <span className="bg-amber-100 text-amber-700 px-1 rounded-full text-[10px]">{pending}</span>}
                        </a>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* ── Driver cards ──────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {drivers.map(d => {
                  const loc = locations[d.id];
                  const pf  = profiles[d.id];
                  const isActive = loc?.lat && (Date.now() - (loc?.ts||0)) < 300000;
                  const pending  = todayAll.filter(s => s.driverId === d.id && s.status === 'pending');
                  return (
                    <Card key={d.id} className="p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-center gap-3">
                        {pf?.photo
                          ? <img src={pf.photo} className="w-10 h-10 rounded-xl object-cover border border-[#1e2d7a]/20 shrink-0"/>
                          : <div className="w-10 h-10 rounded-xl bg-[#1e2d7a] flex items-center justify-center text-white font-bold shrink-0 text-sm">{(pf?.fullName||d.name).charAt(0)}</div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 text-sm truncate">{pf?.fullName||d.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-2 h-2 rounded-full ${isActive?'bg-green-400 animate-pulse':'bg-slate-300'}`}/>
                            <span className={`text-xs font-semibold ${isActive?'text-green-600':'text-slate-400'}`}>
                              {isActive ? 'نشط الآن' : 'غير متصل'}
                            </span>
                          </div>
                        </div>
                        {isActive && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold shrink-0">🟢 Live</span>}
                      </div>

                      {/* Location info */}
                      {loc?.lat ? (
                        <>
                          <div className="flex items-center justify-between text-xs text-slate-400 font-mono bg-slate-50 rounded-lg px-2 py-1.5">
                            <span>📍 {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                            <span>{loc.ts ? new Date(loc.ts).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}) : ''}{loc.acc ? ` ±${loc.acc}م` : ''}</span>
                          </div>
                          {loc.shipmentNo && (
                            <p className="text-xs text-[#1e2d7a] font-semibold">🚚 {loc.shipmentNo}{loc.destAddress ? ` — ${loc.destAddress}` : ''}</p>
                          )}
                          <a
                            href={`https://maps.google.com/?q=${loc.lat},${loc.lng}`}
                            target="_blank" rel="noreferrer"
                            className="w-full flex items-center justify-center gap-2 py-2 bg-[#1e2d7a] text-white rounded-xl text-xs font-semibold hover:bg-[#172466] transition"
                          >🗺️ فتح في خرائط Google</a>
                        </>
                      ) : (
                        <div className="text-center py-4 text-slate-300 text-sm bg-slate-50 rounded-xl">
                          <div className="text-xl mb-1">📡</div>لا يوجد موقع
                        </div>
                      )}

                      {/* Pending shipments */}
                      {pending.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 mb-1">⏳ شحنات معلقة ({pending.length})</p>
                          {pending.slice(0,3).map(s => (
                            <div key={s.id} className="text-xs text-slate-600 truncate py-0.5">• {s.customerName} — {s.address}</div>
                          ))}
                          {pending.length > 3 && <p className="text-xs text-slate-400 mt-0.5">+{pending.length-3} أخرى</p>}
                        </div>
                      )}
                    </Card>
                  );
                })}
                {drivers.length === 0 && (
                  <div className="col-span-2 text-center py-12 text-slate-400">
                    <div className="text-4xl mb-2">🚗</div>
                    <p>لا يوجد سائقون مسجلون</p>
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ══ SHIPMENTS ══ */}
        {tab === 'shipments' && <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <input
              value={shipSearch} onChange={e=>setShipSearch(e.target.value)}
              placeholder="🔍 بحث..."
              className="flex-1 min-w-32 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e2d7a]/20"
            />
            {['all','pending','delivered','failed','archived'].map(f => (
              <button key={f} onClick={()=>setShipFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${shipFilter===f?'bg-[#1e2d7a] text-white':'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {f==='all'?'الكل':f==='pending'?'⏳ معلق':f==='delivered'?'✅ موصّل':f==='failed'?'❌ متعذر':'🗄️ أرشيف'}
              </button>
            ))}
          </div>

          <Card className="overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">الشحنات</h3>
              <span className="text-xs text-slate-500">{filteredShipments.length} شحنة</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs">
                  <tr>
                    {['رقم الشحنة','السائق','العميل','الشركة','الدفع','الحالة','تحصيل','إجراء'].map(h=>(
                      <th key={h} className="px-3 py-3 text-right font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredShipments.map(s => {
                    const c = SHIPPING_COS.find(x=>x.id===s.company);
                    const isArchived = s.status === 'archived';
                    return (
                      <tr key={s.id} className={`border-t border-slate-50 transition ${isArchived ? 'opacity-40 bg-slate-50' : 'hover:bg-slate-50'}`}>
                        <td className="px-3 py-3 font-mono text-xs text-slate-600">{s.shipmentNo}</td>
                        <td className="px-3 py-3 text-slate-700 text-xs">{s.driverName||'—'}</td>
                        <td className="px-3 py-3 font-semibold text-slate-800 text-xs">{s.customerName}</td>
                        <td className="px-3 py-3"><span className="inline-flex items-center gap-1 text-xs font-semibold" style={{color:c?.color}}><CoLogo co={c} size="sm" />{c?.name||'—'}</span></td>
                        <td className="px-3 py-3 text-xs">{s.paymentType==='cod'?'💵 COD':'✅ مدفوع'}</td>
                        <td className="px-3 py-3">
                          {isArchived
                            ? <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-semibold">🗄️ أرشيف</span>
                            : statusBadge(s)
                          }
                        </td>
                        <td className="px-3 py-3 text-green-600 font-semibold text-xs">{s.earnings?`${s.earnings} ر.س`:'—'}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {s.status === 'pending' && (
                              <button onClick={()=>setReassignShipment(s)}
                                className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-semibold hover:bg-amber-100 transition whitespace-nowrap">
                                🔄 نقل
                              </button>
                            )}
                            {['manager','operations'].includes(user.role) && !isArchived && (
                              <button onClick={()=>{ setArchiveConfirm({stage:1, shipment:s}); }}
                                className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition whitespace-nowrap">
                                🗄️ مسح
                              </button>
                            )}
                            {['manager','operations'].includes(user.role) && isArchived && (
                              <button onClick={()=>setDeleteArchiveId(s.id)}
                                className="px-2 py-1 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition whitespace-nowrap">
                                🗑️ حذف
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredShipments.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">لا توجد شحنات</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Archive confirmation modal */}
          {archiveConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
                {archiveConfirm.stage === 1 ? (
                  <>
                    <div className="text-center">
                      <div className="text-4xl mb-2">🗄️</div>
                      <h3 className="font-bold text-slate-800 text-base">تأكيد المسح</h3>
                      <p className="text-slate-500 text-sm mt-1">
                        هل تريد مسح الشحنة <span className="font-mono font-bold text-[#1e2d7a]">{archiveConfirm.shipment.shipmentNo}</span> وإرسالها للأرشيف؟
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleArchiveConfirm} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition">نعم، مسح</button>
                      <button onClick={()=>setArchiveConfirm(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition">إلغاء</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="text-4xl mb-2">✍️</div>
                      <h3 className="font-bold text-slate-800 text-base">سبب المسح (إلزامي)</h3>
                      <p className="text-slate-400 text-xs mt-1">يُحفظ في سجل الأرشيف</p>
                    </div>
                    <textarea
                      value={archiveReason}
                      onChange={e=>setArchiveReason(e.target.value)}
                      placeholder="اكتب سبب المسح بالتفصيل..."
                      rows={3}
                      className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1e2d7a] resize-none"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleArchiveConfirm} disabled={!archiveReason.trim()} className="flex-1 py-2.5 bg-red-500 disabled:opacity-40 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition">تأكيد المسح</button>
                      <button onClick={()=>setArchiveConfirm(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition">إلغاء</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Permanent delete confirmation modal */}
          {deleteArchiveId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 text-center">
                <div className="text-5xl">🗑️</div>
                <h3 className="font-bold text-slate-800 text-base">حذف نهائي من الأرشيف</h3>
                <p className="text-slate-500 text-sm">هذا الإجراء لا يمكن التراجع عنه وسيُحذف السجل نهائياً</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDeleteArchive(deleteArchiveId)}
                    className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition"
                  >
                    تأكيد الحذف
                  </button>
                  <button
                    onClick={() => setDeleteArchiveId(null)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}

          <ReassignModal
            shipment={reassignShipment}
            drivers={drivers}
            profiles={profiles}
            onSave={handleReassign}
            onClose={()=>setReassignShipment(null)}
          />
        </>}

        {/* ══ DRIVERS ══ */}
        {tab === 'drivers' && <>
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-700">السائقون ({drivers.length})</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {Math.ceil(drivers.length / DRIVER_GROUP_SIZE)} مجموعة · كل مجموعة {DRIVER_GROUP_SIZE} سائقين
              </p>
            </div>
            <Btn size="sm" variant="green" onClick={()=>setShowAddDriver(true)}>➕ إضافة سائق</Btn>
          </div>

          {/* ── Join Requests (ops + manager) ───────────────────── */}
          {['manager','operations'].includes(user.role) && (() => {
            const pending  = joinRequests.filter(r => r.status === 'pending');
            const recent   = joinRequests.filter(r => r.status !== 'pending').slice(0, 5);
            if (pending.length === 0 && recent.length === 0) return null;
            return (
              <div className="space-y-3">
                {/* Pending requests */}
                {pending.length > 0 && (
                  <Card className="p-4 border-2 border-amber-200 bg-amber-50/50">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse"/>
                      <h4 className="font-bold text-amber-800 text-sm">طلبات الانضمام ({pending.length})</h4>
                    </div>
                    <div className="space-y-2">
                      {pending.map(req => (
                        <div key={req.id} className="bg-white rounded-xl p-3 border border-amber-100 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-800 text-sm">{req.fullName}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                <span className="text-xs text-slate-400 font-mono">@{req.username}</span>
                                {req.phone      && <span className="text-xs text-slate-400">📱 {req.phone}</span>}
                                {req.nationality && <span className="text-xs text-slate-400">🌍 {req.nationality}</span>}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                {req.iqamaNo   && <span className="text-xs text-slate-400">🪪 إقامة: <span className="font-mono">{req.iqamaNo}</span></span>}
                                {req.licenseNo && <span className="text-xs text-slate-400">🚗 رخصة: <span className="font-mono">{req.licenseNo}</span></span>}
                                {req.residence && <span className="text-xs text-slate-400">🏠 {req.residence}</span>}
                              </div>
                              <p className="text-xs text-slate-300 mt-0.5">{fmtDate(req.submittedAt)}</p>
                            </div>
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold shrink-0">⏳ معلق</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveRequest(req)}
                              className="flex-1 py-2 bg-[#3d7c34] hover:bg-[#336b2d] text-white font-bold rounded-lg text-xs transition"
                            >✅ قبول</button>
                            <button
                              onClick={() => { setRejectId(req.id); setRejectNote(''); }}
                              className="flex-1 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-xs border border-red-200 transition"
                            >❌ رفض</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Recent processed requests */}
                {recent.length > 0 && (
                  <Card className="p-4">
                    <h4 className="font-bold text-slate-500 text-xs mb-2 uppercase tracking-wider">آخر الطلبات المعالجة</h4>
                    <div className="space-y-1.5">
                      {recent.map(req => (
                        <div key={req.id} className="flex items-center justify-between gap-2 py-1">
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-slate-700">{req.fullName}</span>
                            <span className="text-xs text-slate-400 font-mono mr-2">@{req.username}</span>
                          </div>
                          {req.status === 'approved'
                            ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold shrink-0">✅ مقبول</span>
                            : <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold shrink-0">❌ مرفوض</span>
                          }
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            );
          })()}

          {/* Group pills summary */}
          {drivers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: Math.ceil(drivers.length / DRIVER_GROUP_SIZE) }, (_, gi) => {
                const grpDrivers = drivers.slice(gi * DRIVER_GROUP_SIZE, (gi + 1) * DRIVER_GROUP_SIZE);
                const activeCount = grpDrivers.filter(d => {
                  const loc = locations[d.id];
                  return loc?.active && (Date.now()-(loc?.ts||0)) < 120000;
                }).length;
                const label = String.fromCharCode(0x0623 + gi); // أ، ب، ج، د ...
                const groupLetters = ['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
                return (
                  <div key={gi} className="flex items-center gap-2 bg-[#1e2d7a]/8 border border-[#1e2d7a]/20 rounded-xl px-3 py-1.5">
                    <div className="w-6 h-6 rounded-full bg-[#1e2d7a] flex items-center justify-center text-white text-xs font-bold">{groupLetters[gi]||gi+1}</div>
                    <span className="text-xs font-semibold text-[#1e2d7a]">المجموعة {groupLetters[gi]||gi+1}</span>
                    <span className="text-xs text-slate-500">{grpDrivers.length} سائق</span>
                    {activeCount > 0 && <span className="text-xs text-green-600 font-bold">· {activeCount} 🟢</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Grouped driver cards */}
          {(() => {
            const groupLetters = ['أ','ب','ج','د','هـ','و','ز','ح','ط','ي'];
            const groups = Array.from({ length: Math.ceil(drivers.length / DRIVER_GROUP_SIZE) }, (_, gi) =>
              drivers.slice(gi * DRIVER_GROUP_SIZE, (gi + 1) * DRIVER_GROUP_SIZE)
            );
            if (drivers.length === 0) return (
              <div className="text-center py-12 text-slate-400">
                <div className="text-4xl mb-2">👤</div>
                <p>لا يوجد سائقون — أضف أول سائق</p>
              </div>
            );
            return groups.map((grpDrivers, gi) => (
              <div key={gi} className="space-y-3">
                {/* Group header */}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#1e2d7a] flex items-center justify-center text-white text-sm font-bold shadow">{groupLetters[gi]||gi+1}</div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">المجموعة {groupLetters[gi]||gi+1}</h4>
                    <p className="text-xs text-slate-400">السائقون {gi*DRIVER_GROUP_SIZE+1}–{Math.min((gi+1)*DRIVER_GROUP_SIZE, drivers.length)}</p>
                  </div>
                  <div className="flex-1 h-px bg-slate-200 mx-2"/>
                  <span className="text-xs font-semibold text-[#1e2d7a] bg-blue-50 px-2 py-0.5 rounded-full border border-[#1e2d7a]/20">{grpDrivers.length}/{DRIVER_GROUP_SIZE} سائق</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-4 border-r-2 border-[#1e2d7a]/20">
                  {grpDrivers.map((d, dIdx) => {
                    const pf = profiles[d.id] || {};
                    const ds = shipments.filter(s => s.driverId === d.id);
                    const ok = ds.filter(s => s.status === 'delivered').length;
                    const loc = locations[d.id];
                    const isActive = loc?.active && (Date.now()-(loc?.ts||0)) < 120000;
                    return (
                      <Card key={d.id} className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="relative flex-shrink-0">
                            {pf.photo
                              ? <img src={pf.photo} className="w-14 h-14 rounded-2xl object-cover border-2 border-[#1e2d7a]/20"/>
                              : (
                                <div className="w-14 h-14 rounded-2xl bg-[#1e2d7a] flex items-center justify-center text-white text-2xl font-bold">
                                  {(pf.fullName||d.name).charAt(0)}
                                </div>
                              )
                            }
                            {/* Driver number badge */}
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-600 text-white text-xs font-bold flex items-center justify-center">
                              {gi*DRIVER_GROUP_SIZE + dIdx + 1}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800">{pf.fullName||d.name}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className={`w-2 h-2 rounded-full ${isActive?'bg-green-400':'bg-slate-300'}`}/>
                              <span className={`text-xs ${isActive?'text-green-600 font-semibold':'text-slate-400'}`}>{isActive?'نشط':'غير متصل'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-slate-400">الجنسية</p>
                            <p className="font-semibold text-slate-700">{pf.nationality||'—'}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-slate-400">نوع العمل</p>
                            <p className="font-semibold text-slate-700">{pf.workType||'—'}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-slate-400">الشركة</p>
                            <p className="font-semibold text-slate-700">{pf.operatingCompany||'—'}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-slate-400">الإقامة</p>
                            <p className="font-semibold text-slate-700 font-mono text-xs">{pf.iqamaNo||'—'}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2 text-xs text-slate-600 border-t border-slate-100 pt-2">
                          <span className="flex-1">📦 {ds.length} شحنة إجمالي</span>
                          <span className="text-green-600 font-bold">{ok} ✅ موصّل</span>
                        </div>
                        <p className="text-xs font-mono text-slate-300 mt-1">@{d.username}</p>
                        {['manager','operations'].includes(user.role) && (
                          <button
                            onClick={() => setEditDriver({ driver: d, profile: profiles[d.id] || {} })}
                            className="mt-2 w-full py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-[#1e2d7a] hover:text-[#1e2d7a] transition"
                          >✏️ تعديل البيانات</button>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ));
          })()}

          {/* Add driver modal */}
          <Modal open={showAddDriver} title="➕ إضافة سائق جديد" onClose={()=>setShowAddDriver(false)}>
            <Input label="الاسم" value={newDriver.name} onChange={e=>setNewDriver(f=>({...f,name:e.target.value}))} placeholder="اسم السائق"/>
            <Input label="اسم المستخدم" value={newDriver.username} onChange={e=>setNewDriver(f=>({...f,username:e.target.value}))} placeholder="للدخول على التطبيق"/>
            <Input label="كلمة المرور" type="password" value={newDriver.password} onChange={e=>setNewDriver(f=>({...f,password:e.target.value}))} placeholder="كلمة المرور"/>
            <div className="flex gap-2">
              <Btn onClick={handleAddDriver} className="flex-1">✅ إضافة</Btn>
              <Btn variant="outline" onClick={()=>setShowAddDriver(false)}>إلغاء</Btn>
            </div>
          </Modal>
        </>}

        {/* ══ COMPANIES ══ */}
        {tab === 'companies' && canSeeCompanies(user) && (
          <div className="space-y-3">
            <h3 className="font-bold text-slate-700">🚚 شركات الشحن</h3>
            {SHIPPING_COS.map(c => {
              const all = shipments.filter(s => s.company === c.id);
              const delivered = all.filter(s => s.status === 'delivered');
              const earnings = delivered.reduce((a,b)=>a+(b.earnings||0),0);
              return (
                <Card key={c.id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden shadow-sm" style={{background:c.bg}}>
                      <CoLogo co={c} size="lg" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-base">{c.name}</p>
                      {c.paidRate
                        ? <p className="text-xs text-slate-500">مدفوع: {c.paidRate} ر.س · COD: {c.codRate} ر.س</p>
                        : <p className="text-xs text-amber-500">التسعيرة قيد الإعداد</p>
                      }
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 rounded-xl p-2">
                      <p className="text-slate-400">إجمالي</p>
                      <p className="font-bold text-slate-700 text-base">{all.length}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-2">
                      <p className="text-green-400">موصّل</p>
                      <p className="font-bold text-green-700 text-base">{delivered.length}</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-2">
                      <p className="text-amber-400">تحصيل</p>
                      <p className="font-bold text-amber-700 text-base">{earnings} ر.س</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ══ FINANCE ══ */}
        {tab === 'finance' && isFinance(user) && <>
          {/* Period selector */}
          <div className="flex gap-2 flex-wrap">
            {[['today','اليوم'],['week','آخر 7 أيام'],['month','آخر 30 يوم'],['all','الكل']].map(([v,l]) => (
              <button key={v} onClick={()=>setFinPeriod(v)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${finPeriod===v?'bg-[#1e2d7a] text-white':'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="إجمالي التحصيل" value={`${finTotal} ر.س`} icon="💰" color="green"/>
            <StatCard label="شحنات موصّلة" value={finShipments.length} icon="✅" color="blue"/>
            <StatCard label="متوسط/شحنة" value={finShipments.length ? `${(finTotal/finShipments.length).toFixed(1)} ر.س` : '—'} icon="📊" color="amber"/>
            <StatCard label="السائقون النشطون" value={finByDriver.length} icon="👤" color="blue"/>
          </div>

          {/* Per driver */}
          <Card className="p-4">
            <h3 className="font-bold text-slate-700 mb-3 text-sm">💰 أرباح السائقين</h3>
            {finByDriver.length === 0
              ? <p className="text-slate-400 text-sm text-center py-6">لا توجد بيانات للفترة المحددة</p>
              : <div className="space-y-2">
                {finByDriver.map(({ driver: d, profile: pf, count, earnings }) => {
                  const pct = finTotal ? Math.round(earnings/finTotal*100) : 0;
                  return (
                    <div key={d.id} className="p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3 mb-2">
                        {pf?.photo
                          ? <img src={pf.photo} className="w-9 h-9 rounded-full object-cover"/>
                          : <div className="w-9 h-9 rounded-full bg-[#1e2d7a] flex items-center justify-center text-white font-bold text-sm">{(pf?.fullName||d.name).charAt(0)}</div>
                        }
                        <div className="flex-1">
                          <p className="font-semibold text-slate-800 text-sm">{pf?.fullName||d.name}</p>
                          <p className="text-xs text-slate-500">{count} شحنة موصّلة</p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-green-600 text-base">{earnings} ر.س</p>
                          <p className="text-xs text-slate-400">{pct}% من الإجمالي</p>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-400 rounded-full" style={{width:`${pct}%`}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </Card>

          {/* Per company */}
          <Card className="p-4">
            <h3 className="font-bold text-slate-700 mb-3 text-sm">🚚 توزيع التحصيل حسب الشركة</h3>
            {finByCo.length === 0
              ? <p className="text-slate-400 text-sm text-center py-4">لا توجد بيانات</p>
              : <div className="space-y-3">
                {finByCo.map(({ co: c, count, earnings }) => {
                  const pct = finTotal ? Math.round(earnings/finTotal*100) : 0;
                  return (
                    <div key={c.id}>
                      <div className="flex justify-between text-xs font-semibold mb-1" style={{color:c.color}}>
                        <span className="flex items-center gap-1"><CoLogo co={c} size="sm" />{c.name} — {count} شحنة</span>
                        <span>{earnings} ر.س ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{width:`${pct}%`,backgroundColor:c.color}}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            }
          </Card>

          {/* Detailed table */}
          <Card className="overflow-hidden">
            <div className="p-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">📋 تفاصيل الشحنات الموصّلة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['التاريخ','السائق','الشركة','الدفع','تحصيل'].map(h=>(
                      <th key={h} className="px-3 py-2 text-right font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {finShipments.slice().reverse().map(s => {
                    const c = SHIPPING_COS.find(x=>x.id===s.company);
                    return (
                      <tr key={s.id} className="border-t border-slate-50 hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{fmtDate(s.createdAt)}</td>
                        <td className="px-3 py-2 text-slate-700">{s.driverName||'—'}</td>
                        <td className="px-3 py-2"><span className="inline-flex items-center gap-1 font-semibold text-xs" style={{color:c?.color}}><CoLogo co={c} size="sm" />{c?.name||'—'}</span></td>
                        <td className="px-3 py-2">{s.paymentType==='cod'?'💵 COD':'✅ مدفوع'}</td>
                        <td className="px-3 py-2 text-green-600 font-bold">{s.earnings} ر.س</td>
                      </tr>
                    );
                  })}
                  {finShipments.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">لا توجد بيانات</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>}

        {/* ══ SCHEDULE ══ */}
        {tab === 'schedule' && ['manager','operations'].includes(user.role) && (
          <SchedulingPanel drivers={drivers} profiles={profiles}/>
        )}

      </div>

      {/* Edit Driver Modal — rendered only when a driver is selected so useState initialises with fresh data */}
      {editDriver && (
        <EditDriverModal
          driver={editDriver.driver}
          profile={editDriver.profile}
          onSave={handleEditDriverSave}
          onClose={() => setEditDriver(null)}
        />
      )}

      {/* Reject Request Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-2">❌</div>
              <h3 className="font-bold text-slate-800">رفض الطلب</h3>
              <p className="text-slate-400 text-xs mt-1">يمكنك إضافة ملاحظة (اختياري)</p>
            </div>
            <textarea
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              placeholder="سبب الرفض (اختياري)..."
              rows={3}
              className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-red-400 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleRejectRequest(rejectId, rejectNote)}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition"
              >تأكيد الرفض</button>
              <button
                onClick={() => { setRejectId(null); setRejectNote(''); }}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl text-sm hover:bg-slate-50 transition"
              >إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== JOIN REQUEST FORM ====================
function JoinRequestForm({ onBack }) {
  const [step, setStep]     = useState('form'); // 'form' | 'done'
  const [error, setError]   = useState('');
  const [form, setForm] = useState({
    fullName: '', username: '', password: '', phone: '',
    nationality: '', iqamaNo: '', licenseNo: '', residence: '',
  });

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!form.fullName || !form.username || !form.password || !form.phone || !form.iqamaNo || !form.licenseNo) {
      setError('يرجى ملء جميع الحقول الإلزامية (*)'); return;
    }
    if (form.password.length < 4) {
      setError('كلمة المرور يجب أن تكون 4 أحرف على الأقل'); return;
    }
    // Check username not taken
    const existing = HDB.getUsers();
    if (existing.find(u => u.username === form.username.trim())) {
      setError('اسم المستخدم مستخدم مسبقاً، اختر اسماً آخر'); return;
    }
    // Check no duplicate pending request
    const reqs = HDB.getJoinRequests();
    if (reqs.find(r => r.username === form.username.trim() && r.status === 'pending')) {
      setError('يوجد طلب سابق بنفس اسم المستخدم قيد المراجعة'); return;
    }
    // Save request
    const newReq = {
      id: uid(),
      fullName:   form.fullName.trim(),
      username:   form.username.trim(),
      password:   form.password,
      phone:      form.phone.trim(),
      nationality: form.nationality.trim(),
      iqamaNo:    form.iqamaNo.trim(),
      licenseNo:  form.licenseNo.trim(),
      residence:  form.residence.trim(),
      status: 'pending', submittedAt: new Date().toISOString(),
    };
    HDB.saveJoinRequests([...reqs, newReq]);
    setStep('done');
  };

  if (step === 'done') return (
    <div className="hawlak-app min-h-screen hawlak-login-bg flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 hawlak-green-glow pointer-events-none"/>
      <div className="relative z-10 bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 text-center space-y-4">
        <div className="text-6xl">🎉</div>
        <h2 className="font-black text-[#1e2d7a] text-xl">تم إرسال طلبك!</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          سيتم مراجعة طلبك من قِبَل مدير التشغيل وسيتم التواصل معك بعد الموافقة
        </p>
        <div className="bg-[#f0f4ff] rounded-2xl p-4 text-right space-y-1">
          <p className="text-xs text-slate-400">اسم المستخدم المحجوز</p>
          <p className="font-bold text-[#1e2d7a] font-mono">{form.username}</p>
        </div>
        <button onClick={onBack}
          className="w-full py-3 bg-[#1e2d7a] text-white font-bold rounded-xl text-sm hover:bg-[#172466] transition">
          العودة لتسجيل الدخول
        </button>
      </div>
    </div>
  );

  return (
    <div className="hawlak-app min-h-screen hawlak-login-bg flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 hawlak-green-glow pointer-events-none"/>

      <div className="relative z-10 bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#1e2d7a] px-6 pt-8 pb-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 hawlak-green-glow"/>
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto shadow-xl border-2 border-white/20 mb-3">
              <img src={`${import.meta.env.BASE_URL}hawlak-logo.jpg`} alt="حولك" className="w-full h-full object-cover"/>
            </div>
            <h1 className="text-white font-black text-xl" style={{fontFamily:"'Cairo','Poppins',sans-serif"}}>انضم إلينا كسائق</h1>
            <p className="text-white/60 text-xs mt-1">أرسل طلبك وسيتم مراجعته من مدير التشغيل</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-3 overflow-y-auto max-h-[70vh]">

          {/* ── البيانات الشخصية ── */}
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">البيانات الشخصية</p>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500">الاسم الكامل *</label>
            <input type="text" required value={form.fullName} onChange={e=>upd('fullName',e.target.value)}
              placeholder="الاسم الثلاثي"
              className="w-full border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1e2d7a] transition bg-slate-50"/>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500">الجنسية</label>
              <input type="text" value={form.nationality} onChange={e=>upd('nationality',e.target.value)}
                placeholder="مثال: سعودي"
                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1e2d7a] transition bg-slate-50"/>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500">رقم الجوال *</label>
              <input type="tel" required value={form.phone} onChange={e=>upd('phone',e.target.value)}
                placeholder="05xxxxxxxx"
                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1e2d7a] transition bg-slate-50"/>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500">السكن (المدينة / الحي)</label>
            <input type="text" value={form.residence} onChange={e=>upd('residence',e.target.value)}
              placeholder="مثال: الرياض — حي النرجس"
              className="w-full border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1e2d7a] transition bg-slate-50"/>
          </div>

          {/* ── الوثائق الرسمية ── */}
          <div className="h-px bg-slate-100 my-1"/>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">الوثائق الرسمية</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500">رقم الإقامة / الهوية *</label>
              <input type="text" required value={form.iqamaNo} onChange={e=>upd('iqamaNo',e.target.value)}
                placeholder="1xxxxxxxxx"
                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1e2d7a] transition bg-slate-50 font-mono"/>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500">رقم رخصة القيادة *</label>
              <input type="text" required value={form.licenseNo} onChange={e=>upd('licenseNo',e.target.value)}
                placeholder="رقم الرخصة"
                className="w-full border-2 border-slate-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1e2d7a] transition bg-slate-50 font-mono"/>
            </div>
          </div>

          {/* ── بيانات الدخول ── */}
          <div className="h-px bg-slate-100 my-1"/>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">بيانات الدخول للتطبيق</p>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500">اسم المستخدم *</label>
            <input type="text" required value={form.username} onChange={e=>upd('username',e.target.value)}
              placeholder="سيُستخدم لتسجيل الدخول"
              className="w-full border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1e2d7a] transition bg-slate-50"
              autoComplete="off"/>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500">كلمة المرور *</label>
            <input type="password" required value={form.password} onChange={e=>upd('password',e.target.value)}
              placeholder="4 أحرف على الأقل"
              className="w-full border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#1e2d7a] transition bg-slate-50"
              autoComplete="new-password"/>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2 border border-red-100">
              <span>⚠️</span><span>{error}</span>
            </div>
          )}

          <button type="submit"
            className="w-full py-3 bg-[#3d7c34] hover:bg-[#336b2d] text-white font-bold rounded-xl text-sm transition active:scale-95 shadow-lg shadow-[#3d7c34]/30">
            📤 إرسال الطلب
          </button>
          <button type="button" onClick={onBack}
            className="w-full py-2.5 border-2 border-slate-100 text-slate-500 font-semibold rounded-xl text-sm hover:bg-slate-50 transition">
            ← العودة لتسجيل الدخول
          </button>
        </form>
      </div>
    </div>
  );
}

// ==================== LOGIN PAGE ====================
function HawlakLogin({ onLogin }) {
  const [form, setForm]       = useState({ username:'', password:'' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  if (showJoin) return <JoinRequestForm onBack={() => setShowJoin(false)}/>;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    seedAccounts();
    const users = HDB.getUsers();
    const found = users.find(u => u.username === form.username.trim() && u.password === form.password);
    setTimeout(() => {
      if (found) {
        HDB.setCurrentUser(found);
        onLogin(found);
      } else {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="hawlak-app min-h-screen hawlak-login-bg flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* Green glow overlay */}
      <div className="absolute inset-0 hawlak-green-glow pointer-events-none"/>

      {/* Decorative circles */}
      <div className="absolute top-[-80px] left-[-80px] w-64 h-64 rounded-full border border-white/5"/>
      <div className="absolute bottom-[-60px] right-[-60px] w-96 h-96 rounded-full border border-white/5"/>
      <div className="absolute top-1/4 right-[-40px] w-32 h-32 rounded-full bg-[#3d7c34]/10"/>

      {/* Card */}
      <div className="relative z-10 bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Top brand bar */}
        <div className="bg-[#1e2d7a] px-6 pt-10 pb-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 hawlak-green-glow"/>
          {/* Logo */}
          <div className="relative inline-block">
            <div className="w-24 h-24 rounded-2xl overflow-hidden mx-auto shadow-xl border-2 border-white/20">
              <img src={`${import.meta.env.BASE_URL}hawlak-logo.jpg`} alt="حولك" className="w-full h-full object-cover"/>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#3d7c34] rounded-full border-2 border-white flex items-center justify-center">
              <div className="w-2 h-2 bg-white rounded-full"/>
            </div>
          </div>
          {/* Brand name */}
          <h1 className="text-white font-black text-2xl mt-4 tracking-wide" style={{fontFamily:"'Cairo','Poppins',sans-serif"}}>
            HOOLAK
          </h1>
          <p className="text-white/60 text-sm mt-0.5" style={{fontFamily:"'Cairo',sans-serif", letterSpacing:'0.05em'}}>
            دايم حولك ..
          </p>
          {/* Divider */}
          <div className="flex items-center gap-3 mt-4">
            <div className="flex-1 h-px bg-white/15"/>
            <div className="w-1.5 h-1.5 rounded-full bg-[#3d7c34]"/>
            <div className="flex-1 h-px bg-white/15"/>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-slate-500 text-sm text-center -mt-1 mb-2">سجّل دخولك للمتابعة</p>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">اسم المستخدم</label>
            <input
              type="text" required
              value={form.username}
              onChange={e => setForm(f => ({...f, username: e.target.value}))}
              placeholder="أدخل اسم المستخدم"
              className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-0 focus:border-[#1e2d7a] transition bg-slate-50"
              autoComplete="username"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">كلمة المرور</label>
            <input
              type="password" required
              value={form.password}
              onChange={e => setForm(f => ({...f, password: e.target.value}))}
              placeholder="••••••••"
              className="w-full border-2 border-slate-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-0 focus:border-[#1e2d7a] transition bg-slate-50"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 rounded-xl px-3 py-2 border border-red-100">
              <span>⚠️</span><span>{error}</span>
            </div>
          )}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-[#1e2d7a] hover:bg-[#172466] disabled:opacity-60 text-white font-bold rounded-xl text-sm transition active:scale-95 shadow-lg shadow-[#1e2d7a]/30">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                جاري الدخول...
              </span>
            ) : 'دخول ←'}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 pb-5 text-center space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100"/>
            <span className="text-xs text-slate-300">أو</span>
            <div className="flex-1 h-px bg-slate-100"/>
          </div>
          <button
            type="button"
            onClick={() => setShowJoin(true)}
            className="w-full py-2.5 border-2 border-[#3d7c34]/30 text-[#3d7c34] font-bold rounded-xl text-sm hover:bg-[#3d7c34]/5 transition active:scale-95 flex items-center justify-center gap-2"
          >
            🚗 انضم إلينا كسائق
          </button>
          <p className="text-xs text-slate-300">حولك لوجيستك © {new Date().getFullYear()}</p>
        </div>
      </div>

      {/* ── Driver App Download ─────────────────────────────────── */}
      <div className="relative z-10 mt-5 w-full max-w-sm">
        <div className="bg-white/8 backdrop-blur-sm border border-white/10 rounded-2xl p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#3d7c34] rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
              <img src={`${import.meta.env.BASE_URL}hawlak-icon-192.png`} alt="حولك" className="w-full h-full object-cover"/>
            </div>
            <div>
              <p className="text-white font-bold text-sm">تطبيق السائق</p>
              <p className="text-white/50 text-xs">ثبّته على جوالك للعمل بسهولة</p>
            </div>
          </div>

          <div className="h-px bg-white/10"/>

          <div className="space-y-2">
            {/* Install as PWA */}
            <a
              href="https://anasmsdramsees-collab.github.io/alhamdan-engineering/hawlak.html"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 w-full px-4 py-3 bg-[#3d7c34] hover:bg-[#336b2d] rounded-xl transition active:scale-95 group"
            >
              <span className="text-xl">📲</span>
              <div className="flex-1 text-right">
                <p className="text-white font-bold text-sm leading-tight">تثبيت تطبيق السائق</p>
                <p className="text-white/60 text-xs mt-0.5">Chrome ← القائمة ⋮ ← إضافة للشاشة الرئيسية</p>
              </div>
              <span className="text-white/40 group-hover:text-white/80 transition text-sm">↗</span>
            </a>

            {/* Direct APK download */}
            <a
              href="https://github.com/anasmsdramsees-collab/alhamdan-engineering/releases/download/latest-apk/hawlak-driver.apk"
              className="flex items-center gap-3 w-full px-4 py-3 bg-white/10 hover:bg-white/18 border border-white/15 rounded-xl transition active:scale-95 group"
            >
              <span className="text-2xl">⬇️</span>
              <div className="flex-1 text-right">
                <p className="text-white font-bold text-sm leading-tight">تحميل تطبيق السائق — APK</p>
                <p className="text-white/50 text-xs mt-0.5">hawlak-driver.apk · Android</p>
              </div>
              <span className="text-white/40 group-hover:text-white/80 transition text-lg">↓</span>
            </a>
          </div>

          <p className="text-white/30 text-[11px] text-center">
            رابط التطبيق: alhamdan-engineering/hawlak.html
          </p>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN HAWLAK APP ====================
export default function HawlakApp({ onBack }) {
  seedAccounts();
  const [hawlakUser, setHawlakUser] = useState(HDB.getCurrentUser());
  const [driverProfile, setDriverProfile] = useState(null);
  const [syncing, setSyncing] = useState(false);

  // On mount: pull latest data from Firebase so driver sees up-to-date info
  useEffect(() => {
    setSyncing(true);
    cloud.loadHawlak().then(() => {
      seedAccounts(); // re-seed after firebase load
      setSyncing(false);
      if (hawlakUser?.role === 'driver') {
        const profiles = HDB.getProfiles();
        setDriverProfile(profiles[hawlakUser.id] || null);
      }
    }).catch(() => setSyncing(false));
  }, []);

  useEffect(() => {
    if (hawlakUser?.role === 'driver') {
      const profiles = HDB.getProfiles();
      setDriverProfile(profiles[hawlakUser.id] || null);
    }
  }, [hawlakUser]);

  const handleLogin = (u) => {
    // Pull fresh data from Firebase on login
    cloud.loadHawlak().then(() => {
      seedAccounts();
      setHawlakUser(u);
      if (u.role === 'driver') {
        const profiles = HDB.getProfiles();
        setDriverProfile(profiles[u.id] || null);
      }
    });
  };

  const handleLogout = () => {
    // Clear driver's live location from Firebase on logout
    if (hawlakUser?.role === 'driver') {
      cloud.clearDriverLocation(hawlakUser.id);
    }
    HDB.clearCurrentUser();
    setHawlakUser(null);
    setDriverProfile(null);
  };

  const handleProfileSaved = (profile) => {
    setDriverProfile(profile);
  };

  // Not logged in
  if (!hawlakUser) return (
    <div>
      {/* Back to portal button */}
      <div className="fixed top-4 right-4 z-50">
        <button onClick={onBack} className="px-3 py-2 bg-white/20 backdrop-blur-sm text-white rounded-xl text-sm font-semibold hover:bg-white/30 transition border border-white/20">
          ← المجموعة
        </button>
      </div>
      {syncing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#1e2d7a]/90">
          <div className="text-center text-white">
            <div className="text-4xl mb-3 animate-spin">🔄</div>
            <p className="text-sm font-semibold">جارٍ التزامن...</p>
          </div>
        </div>
      )}
      <HawlakLogin onLogin={handleLogin}/>
    </div>
  );

  // Driver — first login (no profile yet)
  if (hawlakUser.role === 'driver' && !driverProfile) {
    return (
      <div>
        <DriverProfileForm user={hawlakUser} onSave={handleProfileSaved}/>
      </div>
    );
  }

  // Driver dashboard
  if (hawlakUser.role === 'driver') {
    return <div className="hawlak-app"><DriverDashboard user={hawlakUser} profile={driverProfile} onLogout={handleLogout}/></div>;
  }

  // Management dashboard
  return <div className="hawlak-app"><ManagementDashboard user={hawlakUser} onLogout={handleLogout}/></div>;
}
