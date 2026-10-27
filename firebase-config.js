/**
 * AFOS - Adaptive Farm Operations System
 * Firebase & Data Persistence Layer
 * 
 * Manages Firestore connection and farm records.
 * Securely handles client-side configuration without exposing service-account secrets.
 * Provides resilient fallback to local storage so the application works seamlessly
 * before or during live Firebase provisioning.
 */

// User Firebase Web App Configuration (Kisan AI)
const AFOS_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBkjh6IFAOqKz_C0MEydHxtADvSgJkVQRw",
  authDomain: "kisan-ai-94e93.firebaseapp.com",
  projectId: "kisan-ai-94e93",
  storageBucket: "kisan-ai-94e93.firebasestorage.app",
  messagingSenderId: "467204562597",
  appId: "1:467204562597:web:2adc815f4ddbb09cd9774c",
  measurementId: "G-78RK2PKZRR"
};

class FarmDataService {
  constructor() {
    this.isLiveFirebase = false;
    this.db = null;
    this.auth = null;
    this.analytics = null;
    this.localStorageKey = 'afos_farms_db_v1';
    this.schedulesStorageKey = 'afos_schedules_db_v1';

    this.init();
  }

  init() {
    // Check if Firebase SDK is loaded on page and config is configured
    const isConfigured = AFOS_FIREBASE_CONFIG.apiKey && 
                         !AFOS_FIREBASE_CONFIG.apiKey.startsWith("YOUR_") &&
                         window.firebase;

    if (isConfigured) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(AFOS_FIREBASE_CONFIG);
        }
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        if (firebase.analytics && AFOS_FIREBASE_CONFIG.measurementId) {
          this.analytics = firebase.analytics();
        }
        this.isLiveFirebase = true;
        console.log('[AFOS] Connected to Live Cloud Firestore (kisan-ai-94e93)');
      } catch (e) {
        console.warn('[AFOS] Firebase init failed, operating in resilient local mode:', e.message);
        this.isLiveFirebase = false;
      }
    } else {
      this.isLiveFirebase = false;
      console.log('[AFOS] Running in Local Storage Mode (Ready for Firebase credentials)');
    }

    this.seedDefaultFarmsIfEmpty();
  }

  /**
   * Seeds realistic agricultural farm records if no records exist.
   * Includes valid latitude and longitude fields.
   */
  seedDefaultFarmsIfEmpty() {
    const existing = this.getLocalFarms();
    if (!existing || existing.length === 0) {
      const defaultFarms = [
        {
          id: 'farm-001',
          name: 'Green Valley Organic Estate',
          locationName: 'Jaipur Rural, Rajasthan',
          latitude: 26.9124,
          longitude: 75.7873,
          cropType: 'Wheat & Mustard',
          areaAcres: 45,
          updatedAt: new Date().toISOString()
        },
        {
          id: 'farm-002',
          name: 'Sunrise Corn & Soybean Acreage',
          locationName: 'Ames, Iowa, USA',
          latitude: 42.0308,
          longitude: -93.6319,
          cropType: 'Corn & Soybeans',
          areaAcres: 120,
          updatedAt: new Date().toISOString()
        },
        {
          id: 'farm-003',
          name: 'Highland Orchard & Vineyard',
          locationName: 'Fresno, California, USA',
          latitude: 36.7468,
          longitude: -119.7726,
          cropType: 'Citrus & Table Grapes',
          areaAcres: 60,
          updatedAt: new Date().toISOString()
        }
      ];
      this.saveLocalFarms(defaultFarms);

      // Seed scheduled farming tasks for testing advisories
      const today = new Date();
      const formatDate = (offsetDays) => {
        const d = new Date(today);
        d.setDate(today.getDate() + offsetDays);
        return d.toISOString().split('T')[0];
      };

      const defaultTasks = [
        {
          id: 'task-101',
          farmId: 'farm-001',
          title: 'Foliar Micronutrient & Fertilizer Spray',
          type: 'fertilizer',
          date: formatDate(1), // Tomorrow
          status: 'Scheduled',
          notes: 'Apply nitrogen & zinc foliar spray to Section B wheat parcel.'
        },
        {
          id: 'task-102',
          farmId: 'farm-001',
          title: 'Targeted Insect Pest Control Spray',
          type: 'spray_pesticide',
          date: formatDate(2), // Day +2
          status: 'Scheduled',
          notes: 'Eco-safe pesticide treatment against mustard aphid infestation.'
        },
        {
          id: 'task-103',
          farmId: 'farm-001',
          title: 'Canal Drip Line Irrigation Cycle',
          type: 'irrigation',
          date: formatDate(3), // Day +3
          status: 'Scheduled',
          notes: 'Run Zone 1 & 2 standard 4-hour drip irrigation.'
        },
        {
          id: 'task-104',
          farmId: 'farm-001',
          title: 'Winter Crop Parcel Soil Tilling',
          type: 'tilling',
          date: formatDate(4), // Day +4
          status: 'Scheduled',
          notes: 'Prepare fallow block for legume cover crop.'
        },
        {
          id: 'task-201',
          farmId: 'farm-002',
          title: 'Corn Harvest & Moisture Checking',
          type: 'harvesting',
          date: formatDate(1),
          status: 'Scheduled',
          notes: 'Combine harvester operation for Field North.'
        }
      ];
      this.saveLocalTasks(defaultTasks);
    }
  }

  // --- Local Storage Helpers ---
  getLocalFarms() {
    try {
      const raw = localStorage.getItem(this.localStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  saveLocalFarms(farms) {
    try {
      localStorage.setItem(this.localStorageKey, JSON.stringify(farms));
    } catch (_) {}
  }

  getLocalTasks() {
    try {
      const raw = localStorage.getItem(this.schedulesStorageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  saveLocalTasks(tasks) {
    try {
      localStorage.setItem(this.schedulesStorageKey, JSON.stringify(tasks));
    } catch (_) {}
  }

  // --- Public API for Farms ---
  async getFarms() {
    if (this.isLiveFirebase && this.db) {
      try {
        const snapshot = await this.db.collection('farms').orderBy('name').get();
        const farms = [];
        snapshot.forEach(doc => farms.push({ id: doc.id, ...doc.data() }));
        return farms.length > 0 ? farms : this.getLocalFarms();
      } catch (err) {
        console.warn('[AFOS] Firestore fetch error, falling back to local:', err.message);
        return this.getLocalFarms();
      }
    }
    return this.getLocalFarms();
  }

  /**
   * Updates or saves coordinates and farm details.
   */
  async updateFarmCoordinates(farmId, latitude, longitude, locationName = null) {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new Error('Invalid coordinate values. Latitude [-90, 90], Longitude [-180, 180].');
    }

    const updatePayload = {
      latitude: lat,
      longitude: lon,
      updatedAt: new Date().toISOString()
    };
    if (locationName) {
      updatePayload.locationName = locationName;
    }

    if (this.isLiveFirebase && this.db) {
      try {
        await this.db.collection('farms').doc(farmId).set(updatePayload, { merge: true });
      } catch (err) {
        console.warn('[AFOS] Live Firestore update error, saving locally:', err.message);
      }
    }

    // Always keep local copy in sync
    const farms = this.getLocalFarms();
    const index = farms.findIndex(f => f.id === farmId);
    if (index >= 0) {
      farms[index] = { ...farms[index], ...updatePayload };
      this.saveLocalFarms(farms);
      return farms[index];
    } else {
      const newFarm = { id: farmId, name: 'New Farm Location', ...updatePayload };
      farms.push(newFarm);
      this.saveLocalFarms(farms);
      return newFarm;
    }
  }

  /**
   * Retrieves scheduled tasks for a farm.
   */
  async getFarmTasks(farmId) {
    if (this.isLiveFirebase && this.db) {
      try {
        const snapshot = await this.db.collection('farms').doc(farmId).collection('tasks').get();
        const tasks = [];
        snapshot.forEach(doc => tasks.push({ id: doc.id, ...doc.data() }));
        if (tasks.length > 0) return tasks;
      } catch (err) {
        console.warn('[AFOS] Firestore tasks fetch error, fallback to local:', err.message);
      }
    }
    const all = this.getLocalTasks();
    return all.filter(t => t.farmId === farmId);
  }

  /**
   * Saves or updates a schedule task status.
   */
  async updateTaskStatus(taskId, status, notes = null) {
    const all = this.getLocalTasks();
    const task = all.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      if (notes !== null) task.notes = notes;
      task.updatedAt = new Date().toISOString();
      this.saveLocalTasks(all);
    }
    return task;
  }
}

// Global data service instance
window.farmDataService = new FarmDataService();
