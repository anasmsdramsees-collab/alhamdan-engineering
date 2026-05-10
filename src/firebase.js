import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue, push, update } from 'firebase/database';

// ============================================================
// 🔥 Firebase Config
// ============================================================
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCsTzOVLQHirawIFbAPeVZ0Ll2cdXb_NuI",
  authDomain:        "alhamdan-system.firebaseapp.com",
  databaseURL:       "https://alhamdan-system-default-rtdb.firebaseio.com",
  projectId:         "alhamdan-system",
  storageBucket:     "alhamdan-system.firebasestorage.app",
  messagingSenderId: "491584344734",
  appId:             "1:491584344734:web:8acd74512b4ad6e97da18f",
};

// Keys that get synced to the cloud
export const CLOUD_KEYS = [
  'hec_projects', 'hec_visits', 'hec_invoices', 'hec_plans',
  'hec_clients',  'hec_leads',  'hec_suppliers',
  'hec_quotes',   'hec_eng_quotes', 'hec_brands',
  'hec_users',
];

const isConfigured = !FIREBASE_CONFIG.apiKey.includes('__');

let firebaseDB = null;
if (isConfigured) {
  const app = initializeApp(FIREBASE_CONFIG);
  firebaseDB = getDatabase(app);
}

const _uid = () => Math.random().toString(36).substr(2, 9);

export const cloud = {
  enabled: isConfigured,

  /** Save one key to Firebase */
  save: (key, data) => {
    if (!firebaseDB) return;
    set(ref(firebaseDB, key), data ?? null)
      .catch(err => console.warn('[Firebase] save failed:', err));
  },

  /** Load all keys from Firebase into localStorage, return true if data found */
  loadAll: async () => {
    if (!firebaseDB) return false;
    try {
      const snap = await get(ref(firebaseDB, '/'));
      if (!snap.exists()) return false;
      const data = snap.val();
      CLOUD_KEYS.forEach(key => {
        if (data[key] !== undefined) {
          localStorage.setItem(key, JSON.stringify(data[key]));
        }
      });
      return true;
    } catch (err) {
      console.warn('[Firebase] loadAll failed:', err);
      return false;
    }
  },

  /** Subscribe to real-time updates and apply to localStorage */
  subscribe: (onUpdate) => {
    if (!firebaseDB) return () => {};
    const unsub = onValue(ref(firebaseDB, '/'), snap => {
      if (!snap.exists()) return;
      const data = snap.val();
      CLOUD_KEYS.forEach(key => {
        if (data[key] !== undefined) {
          localStorage.setItem(key, JSON.stringify(data[key]));
        }
      });
      onUpdate?.();
    }, err => console.warn('[Firebase] subscribe error:', err));
    return unsub;
  },

  // ─── Activity Log ────────────────────────────────────────

  /** Append an activity entry to hec_activity_log (keeps last 500) */
  logActivity: (entry) => {
    if (!firebaseDB) return;
    const key = 'hec_activity_log';
    get(ref(firebaseDB, key)).then(snap => {
      const current = Array.isArray(snap.val()) ? snap.val() : [];
      const updated = [{ ...entry, id: _uid() }, ...current].slice(0, 500);
      set(ref(firebaseDB, key), updated);
      localStorage.setItem(key, JSON.stringify(updated));
    }).catch(() => {});
  },

  /** Listen to activity log in real time */
  listenActivityLog: (callback) => {
    if (!firebaseDB) return () => {};
    return onValue(ref(firebaseDB, 'hec_activity_log'), snap => {
      callback(Array.isArray(snap.val()) ? snap.val() : []);
    }, () => {});
  },

  // ─── Notifications ────────────────────────────────────────

  /** Push a notification for a specific user */
  addNotification: (targetUserId, notif) => {
    if (!firebaseDB) return;
    const key = `hec_notif_${targetUserId}`;
    get(ref(firebaseDB, key)).then(snap => {
      const current = Array.isArray(snap.val()) ? snap.val() : [];
      const updated = [{ ...notif, id: _uid(), read: false, timestamp: new Date().toISOString() }, ...current].slice(0, 100);
      set(ref(firebaseDB, key), updated);
    }).catch(() => {});
  },

  /** Listen to notifications for a user in real time */
  listenNotifications: (userId, callback) => {
    if (!firebaseDB) return () => {};
    return onValue(ref(firebaseDB, `hec_notif_${userId}`), snap => {
      callback(Array.isArray(snap.val()) ? snap.val() : []);
    }, () => {});
  },

  /** Mark a single notification as read */
  markRead: (userId, notifId) => {
    if (!firebaseDB) return;
    const key = `hec_notif_${userId}`;
    get(ref(firebaseDB, key)).then(snap => {
      const current = Array.isArray(snap.val()) ? snap.val() : [];
      set(ref(firebaseDB, key), current.map(n => n.id === notifId ? { ...n, read: true } : n));
    }).catch(() => {});
  },

  /** Mark all notifications as read for a user */
  markAllRead: (userId) => {
    if (!firebaseDB) return;
    const key = `hec_notif_${userId}`;
    get(ref(firebaseDB, key)).then(snap => {
      const current = Array.isArray(snap.val()) ? snap.val() : [];
      set(ref(firebaseDB, key), current.map(n => ({ ...n, read: true })));
    }).catch(() => {});
  },

  // ─── Hawlak Driver Live Locations ─────────────────────────

  /** Write driver location to Firebase (called every GPS update) */
  setDriverLocation: (driverId, payload) => {
    if (!firebaseDB) return;
    // payload: { lat, lng, ts, name, active, shipmentNo? }
    set(ref(firebaseDB, `hawlak_locations/${driverId}`), payload)
      .catch(() => {});
  },

  /** Mark driver as inactive (arrived / logged out) */
  clearDriverLocation: (driverId) => {
    if (!firebaseDB) return;
    // Keep last known position but set active=false
    const r = ref(firebaseDB, `hawlak_locations/${driverId}`);
    get(r).then(snap => {
      if (snap.exists()) {
        update(r, { active: false, stoppedAt: Date.now() }).catch(() => {});
      }
    }).catch(() => {});
  },

  /** Real-time listener for all driver locations (management view) */
  listenDriverLocations: (callback) => {
    if (!firebaseDB) return () => {};
    return onValue(
      ref(firebaseDB, 'hawlak_locations'),
      snap => callback(snap.exists() ? snap.val() : {}),
      () => callback({})
    );
  },
};
