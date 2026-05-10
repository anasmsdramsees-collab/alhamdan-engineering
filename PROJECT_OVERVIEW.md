# الحمدان جروب — نظرة شاملة على المشروع

> **آخر تحديث:** 2026-05-09  
> **الحالة:** ✅ مبني وجاهز للنشر

---

## 🗂️ هيكل المشروع

```
alhamdan group /
├── src/
│   ├── App.jsx          ← نظام الهندسية + بوابة المجموعة (5300+ سطر)
│   ├── HawlakApp.jsx    ← نظام حولك لوجيستك (جديد)
│   ├── firebase.js      ← اتصال Firebase
│   ├── main.jsx         ← نقطة الدخول
│   └── index.css        ← أنماط عامة (Tajawal font)
├── public/
│   ├── alhamdan-group-logo.png
│   ├── hawlak-logo.jpg
│   └── hamdan-eng-logo.jpg
├── dist/                ← البناء الجاهز للنشر
├── index.html           ← HTML الرئيسية
├── package.json
├── vite.config.js       ← base: '/alhamdan-engineering/'
└── الهندسية/            ← node_modules هنا (symlink)
```

---

## 🏢 الصفحة الرئيسية — بوابة المجموعة

**Component:** `GroupPortal` في `App.jsx`

- خلفية زرقاء داكنة مع تأثير gradient
- شعار الحمدان جروب
- بطاقتان:
  1. **الحمدان للاستشارات الهندسية والتكييف** → نظام الهندسية
  2. **حولك لوجيستك** → نظام حولك

**State Management:**
```js
const [appSection, setAppSection] = useState(() =>
  sessionStorage.getItem('alhamdan_section') || 'portal'
);
// Values: 'portal' | 'engineering' | 'hawlak'
```

---

## 🏗️ نظام الهندسية

**ملف:** `src/App.jsx`  
**مسار GitHub Pages:** `anasmsdramsees-collab.github.io/alhamdan-engineering/`

### أنواع المستخدمين
| الدور | role | الصلاحيات |
|-------|------|-----------|
| مدير عام | `manager` | كل شيء |
| محاسب | `accountant` | المالية، المشاريع، الموردين |
| مهندس | `engineer` | مشاريعه + فواتير أعمال إضافية |

### المميزات الرئيسية
- **المشاريع:** إدارة كاملة — إضافة، تتبع، فواتير، مدفوعات، مخطط المشروع (PDF/صور)
- **العملاء:** قاعدة بيانات العملاء + العملاء المحتملين (CRM)
- **الزيارات:** تسجيل الزيارات الميدانية
- **عروض الأسعار:** عروض التكييف + الهندسية مع PDF
- **كتلوج التكييف:** موردين + منتجات بتسعير مزدوج
- **المالية:** تقارير مالية + ربط ERP
- **الإشعارات:** Firebase Realtime للإشعارات
- **PWA:** قابل للتثبيت على الهاتف

### Firebase Keys (هندسية)
```
hec_users, hec_projects, hec_visits, hec_clients, hec_leads,
hec_suppliers, hec_quotes, hec_eng_quotes, hec_brands,
hec_activity_log, hec_notif_{userId}
```

---

## 🚚 نظام حولك لوجيستك

**ملف:** `src/HawlakApp.jsx`  
**ألوان:** أزرق داكن `#1a2951` + أخضر `#4caf50`

### أنواع المستخدمين

| الدور | role | الوصف |
|-------|------|-------|
| مدير عام | `manager` | كل الصلاحيات |
| مدير تشغيل | `operations` | متابعة السائقين |
| مدير حسابات | `accounts` | التقارير المالية |
| سائق | `driver` | إدخال شحنات + توصيل |

### الحسابات الافتراضية (تجريبية)
```
مدير عام:      admin / admin123
مدير تشغيل:   ops / ops123
مدير حسابات:  accounts / acc123
سائق 1:        driver1 / drv123
سائق 2:        driver2 / drv456
```

### أول دخول للسائق — نموذج البيانات
يُعبّأ مرة واحدة، يُحفظ في `hawlak_profiles` (localStorage):
- الاسم الكامل
- الجنسية
- رقم الإقامة
- نوع العمل (عمل حر / تابع لحولك)
- الشركة المعنية بالتشغيل (ناقل / DHL / AJEX / أراميكس)

> ⚠️ تظهر هذه البيانات في لوحة الإدارة فقط

### شركات الشحن
| الشركة | emoji | مدفوع | COD |
|--------|-------|-------|-----|
| ناقل | 📦 | 6 ر.س | 8 ر.س |
| DHL | 🟡 | — | — |
| AJEX | 🔵 | — | — |
| أراميكس | 🟠 | — | — |

### بيانات الشحنة
- رقم الشحنة (مسح باركود أو يدوي)
- اسم العميل ✅
- رقم جوال العميل
- المتجر الطالب
- عنوان التوصيل ✅
- نوع الدفع (مدفوع / COD) ✅
- صورة البوليصة (اختياري)

### تدفق التوصيل
```
اختيار الشحنة
     ↓
[بدء التوصيل] → يبدأ GPS tracking
     ↓
[وصلت] → يوقف التتبع
     ↓
┌─ ✅ تم التوصيل
└─ ❌ تعذر التوصيل → سبب إلزامي:
      - لم يرد العميل
      - عنوان خاطئ
      - رُفض الاستلام
      - العميل طلب التأجيل
      - غيره (نص)
```

### localStorage Keys (حولك)
```
hawlak_users      ← قائمة المستخدمين
hawlak_profiles   ← ملفات السائقين (keyed by userId)
hawlak_shipments  ← جميع الشحنات
hawlak_locations  ← مواقع GPS الحية (keyed by userId)
hawlak_session    ← sessionStorage: المستخدم الحالي
```

### لوحة إدارة حولك — التبويبات
1. **نظرة عامة** — إحصاءات اليوم + أداء كل سائق + توزيع الشركات
2. **السائقون** — جدول بيانات السائقين الكاملة
3. **الشحنات** — جدول شامل بكل الشحنات
4. **التتبع** — خريطة مواقع السائقين (SVG avatar + GPS)

### أفاتار السائق (SVG)
- رأس: بشرة فاتحة
- قميص: أزرق نيفي `#1a3a5c`
- بنطلون: أبيض `#f0f0f0`
- شارة خضراء على القميص `#4caf50`

---

## 🔧 تقنيات المشروع

| التقنية | الاستخدام |
|---------|----------|
| React 18 | UI framework |
| Vite | Build tool |
| Tailwind CSS (CDN) | Styling |
| Firebase Realtime DB | Cloud sync (هندسية) |
| BarcodeDetector API | مسح الباركود (Chrome) |
| Geolocation API | GPS للسائقين |
| localStorage | تخزين بيانات حولك |
| sessionStorage | جلسات المستخدمين |

---

## 🚀 النشر

### Build
```bash
cd "alhamdan group "
node_modules/.bin/vite build
# تُنسخ الشعارات يدوياً بعد البناء:
cp public/* dist/
```

### GitHub Pages
```bash
cd dist
git init
git add .
git commit -m "Deploy"
git push force https://github.com/anasmsdramsees-collab/alhamdan-engineering gh-pages
```

أو من الـ repo الرئيسي:
```bash
git subtree push --prefix dist origin gh-pages
```

**الرابط الحالي:** `https://anasmsdramsees-collab.github.io/alhamdan-engineering/`

---

## 📂 الملفات المرجعية

| الملف | المسار |
|-------|--------|
| شعار الحمدان جروب | `Desktop/my projects /alhamdan group /ChatGPT Image May 6, 2026 at 01_18_15 PM.png` |
| شعار الحمدان الهندسية | `Desktop/hamdan/PHOTO-2025-12-31-16-27-50.jpg` |
| شعار حولك | `Desktop/hoolak /IDENTITY/IMG_1460.jpg` |
| متاجر الرياض v4 | `Desktop/hoolak /متاجر_الرياض_حولك_v4.xlsx` |
| كلمات المرور | `Desktop/my projects /alhamdan group /كلمات_المرور_الحمدان.docx` |

---

## 📋 المراحل المكتملة

- [x] بوابة المجموعة (Group Portal) — الصفحة الرئيسية
- [x] ربط نظام الهندسية بالبوابة
- [x] نظام تسجيل دخول حولك
- [x] نموذج بيانات السائق (أول دخول)
- [x] لوحة السائق — الإحصاءات + بطاقات الشركات + قائمة الشحنات
- [x] إضافة شحنة (باركود + يدوي)
- [x] تدفق التوصيل الكامل
- [x] زر "بوابة المجموعة" في sidebar الهندسية

## 📌 المراحل القادمة

- [ ] دمج Leaflet.js للخريطة الحية في لوحة الإدارة
- [ ] Firebase Realtime لإرسال مواقع السائقين
- [ ] إضافة متاجر الرياض من ملف Excel
- [ ] تسعيرة DHL / AJEX / أراميكس
- [ ] تقرير الأرباح الشهري للسائقين
- [ ] نظام إضافة مستخدمين جديد (لوحة الإدارة)
- [ ] PWA manifest لحولك
- [ ] نشر الإصدار الجديد على GitHub Pages

---

*آخر تعديل: 2026-05-09 — تم تنفيذ المراحل 1 و 2 بالكامل*
