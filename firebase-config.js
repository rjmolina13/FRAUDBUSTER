// Firebase Configuration for FraudBuster Chrome Extension
// This file provides Firebase initialization compatible with Chrome extensions

// Firebase configuration from firebase-details.txt
const firebaseConfig = {
  apiKey: "AIzaSyAQVeuqUkoO9jwXehNda6Frsp9XeeDpVoc",
  authDomain: "fraudbuster-c59d3.firebaseapp.com",
  databaseURL: "https://fraudbuster-c59d3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fraudbuster-c59d3",
  storageBucket: "fraudbuster-c59d3.appspot.com",
  messagingSenderId: "34046134222",
  appId: "1:34046134222:web:8cbb84d6843da05e51cd9f",
  measurementId: "G-Y36BH1GF6W"
};

// Firebase SDK URLs for Chrome extension compatibility
const FIREBASE_SDK_URLS = {
  app: 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
  firestore: 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
  auth: 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
  analytics: 'https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics-compat.js'
};

// Firebase initialization class for Chrome extensions
class FirebaseManager {
  constructor() {
    this.app = null;
    this.db = null;
    this.auth = null;
    this.analytics = null;
    this.isInitialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      // Check network connectivity
      if (!navigator.onLine) {
        throw new Error('No network connection available for Firebase initialization');
      }

      // Initialize Firebase app
      this.app = firebase.initializeApp(firebaseConfig);
      
      // Initialize Firestore
      this.db = firebase.firestore();
      
      // Initialize Auth
      this.auth = firebase.auth();
      
      // Initialize Analytics (optional)
      if (typeof firebase.analytics === 'function') {
        this.analytics = firebase.analytics();
      }

      // Sign in anonymously for basic access with timeout
      const authTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase auth timeout')), 15000)
      );
      
      await Promise.race([this.auth.signInAnonymously(), authTimeout]);
      
      this.isInitialized = true;
      console.log('Firebase initialized successfully');
      
      return {
        app: this.app,
        db: this.db,
        auth: this.auth,
        analytics: this.analytics
      };
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      
      // Reset initialization state on failure
      this.isInitialized = false;
      this.initPromise = null;
      
      // Provide more specific error messages
      if (error.code === 'auth/network-request-failed') {
        throw new Error('Network connection failed during Firebase initialization');
      } else if (error.message.includes('timeout')) {
        throw new Error('Firebase initialization timed out - check network connection');
      }
      
      throw new Error(`Firebase initialization failed: ${error.message}`);
    }
  }

  // Firestore helper methods
  async addDocument(collection, data) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return this.db.collection(collection).add({
      ...data,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async getDocuments(collection, whereClause = null, limit = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    let query = this.db.collection(collection);
    
    if (whereClause) {
      query = query.where(whereClause.field, whereClause.operator, whereClause.value);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async updateDocument(collection, docId, data) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return this.db.collection(collection).doc(docId).update({
      ...data,
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  async incrementField(collection, docId, field, value = 1) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    return this.db.collection(collection).doc(docId).update({
      [field]: firebase.firestore.FieldValue.increment(value),
      lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  // URL hashing utility
  hashURL(url) {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  // Analytics helper methods
  logEvent(eventName, parameters = {}) {
    if (this.analytics) {
      this.analytics.logEvent(eventName, parameters);
    }
  }

  // Auth helper methods
  getCurrentUser() {
    return this.auth ? this.auth.currentUser : null;
  }

  async signOut() {
    if (this.auth) {
      await this.auth.signOut();
    }
  }
}

// Model Manager class for handling NLP model data and fraud domains from Firestore
class ModelManager {
  constructor(firebaseManager) {
    this.firebaseManager = firebaseManager;
    this.modelCache = null;
    this.vectorizerCache = null;
    this.metadataCache = null;
    this.fraudDomainsCache = null;
    this.fraudDomainsMetadata = null;
    this.lastFetchTime = null;
    this.lastDomainsFetchTime = null;
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.domainsCacheExpiry = 6 * 60 * 60 * 1000; // 6 hours for domains (more frequent updates)
  }

  async fetchModelData() {
    try {
      // Check if cache is still valid
      if (this.isCacheValid()) {
        console.log('Using cached model data');
        return {
          model: this.modelCache,
          vectorizer: this.vectorizerCache,
          metadata: this.metadataCache
        };
      }

      // Check network connectivity
      if (!navigator.onLine) {
        console.warn('No network connection, using cached model data if available');
        if (this.modelCache && this.vectorizerCache && this.metadataCache) {
          return {
            model: this.modelCache,
            vectorizer: this.vectorizerCache,
            metadata: { ...this.metadataCache, isExpired: true }
          };
        }
        throw new Error('No cached model data available and no network connection');
      }

      console.log('Fetching model data from Firestore...');
      
      // Ensure Firebase is initialized with timeout
      if (!firebaseManager.isInitialized) {
        const initTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firebase initialization timeout')), 10000)
        );
        await Promise.race([firebaseManager.initialize(), initTimeout]);
      }

      // Fetch model data from Firestore with timeout
      const fetchTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Model fetch timeout')), 20000)
      );
      
      const modelDoc = await Promise.race([
        firebaseManager.db.collection('nlp_models').doc('current_model').get(),
        fetchTimeout
      ]);

      if (!modelDoc.exists) {
        throw new Error('Model data not found in Firestore');
      }

      const data = modelDoc.data();
      
      // Cache the data
      this.modelCache = data.model_data;
      this.vectorizerCache = data.vectorizer_data;
      this.metadataCache = {
        accuracy: data.accuracy,
        features: data.features,
        uploadedAt: data.uploaded_at,
        modelType: data.model_type
      };
      this.lastFetchTime = Date.now();

      console.log('Model data fetched successfully:', {
        accuracy: this.metadataCache.accuracy,
        features: this.metadataCache.features?.length || 0,
        modelType: this.metadataCache.modelType
      });

      return {
        model: this.modelCache,
        vectorizer: this.vectorizerCache,
        metadata: this.metadataCache
      };
    } catch (error) {
      console.error('Failed to fetch model data:', error);
      
      // Return cached data if available, even if expired
      if (this.modelCache && this.vectorizerCache && this.metadataCache) {
        console.log('Using expired cached model data due to network error');
        return {
          model: this.modelCache,
          vectorizer: this.vectorizerCache,
          metadata: { ...this.metadataCache, isExpired: true, error: error.message }
        };
      }
      
      // If no cached data available, throw error
      throw new Error(`Model data unavailable: ${error.message}`);
    }
  }

  isCacheValid() {
    return (
      this.modelCache &&
      this.vectorizerCache &&
      this.metadataCache &&
      this.lastFetchTime &&
      (Date.now() - this.lastFetchTime) < this.cacheExpiry
    );
  }

  isDomainsCacheValid() {
    return (
      this.fraudDomainsCache &&
      this.lastDomainsFetchTime &&
      (Date.now() - this.lastDomainsFetchTime) < this.domainsCacheExpiry
    );
  }

  async fetchFraudDomains() {
    try {
      // Check if cache is still valid
      if (this.isDomainsCacheValid()) {
        console.log('Using cached fraud domains data');
        return {
          domains: this.fraudDomainsCache,
          metadata: this.fraudDomainsMetadata
        };
      }

      // Check network connectivity
      if (!navigator.onLine) {
        console.warn('No network connection, using cached data if available');
        if (this.fraudDomainsCache) {
          return {
            domains: this.fraudDomainsCache,
            metadata: this.fraudDomainsMetadata
          };
        }
        return { domains: [], metadata: null };
      }

      console.log('Fetching fraud domains from Firestore...');
      
      // Ensure Firebase is initialized with timeout
      if (!this.firebaseManager.isInitialized) {
        const initTimeout = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firebase initialization timeout')), 10000)
        );
        await Promise.race([this.firebaseManager.initialize(), initTimeout]);
      }

      // Fetch fraud domains from Firestore with timeout
      const fetchTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firestore fetch timeout')), 15000)
      );
      
      const domainsDoc = await Promise.race([
        firebaseManager.db.collection('fraud_data').doc('known_domains').get(),
        fetchTimeout
      ]);

      if (!domainsDoc.exists) {
        console.warn('Fraud domains data not found in Firestore');
        return { domains: [], metadata: null };
      }

      const data = domainsDoc.data();
      
      // Cache the data
      this.fraudDomainsCache = data.domains || [];
      this.fraudDomainsMetadata = {
        totalDomains: data.total_domains,
        uploadedAt: data.uploaded_at,
        lastUpdated: data.last_updated,
        source: data.source
      };
      this.lastDomainsFetchTime = Date.now();

      console.log('Fraud domains fetched successfully:', {
        totalDomains: this.fraudDomainsMetadata.totalDomains,
        source: this.fraudDomainsMetadata.source
      });

      return {
        domains: this.fraudDomainsCache,
        metadata: this.fraudDomainsMetadata
      };
    } catch (error) {
      console.error('Failed to fetch fraud domains:', error);
      
      // Return cached data if available, even if expired
      if (this.fraudDomainsCache) {
        console.log('Using expired cached fraud domains due to network error');
        return {
          domains: this.fraudDomainsCache,
          metadata: { ...this.fraudDomainsMetadata, isExpired: true }
        };
      }
      
      // Return empty array as last resort
      console.warn('No cached fraud domains available, returning empty array');
      return { domains: [], metadata: null };
    }
  }

  async isDomainFraudulent(domain) {
    try {
      // Fetch fraud domains if not cached
      const { domains } = await this.fetchFraudDomains();
      
      // Normalize domain (remove www, convert to lowercase)
      const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');
      
      // Check if domain is in the fraud list
      const isFraudulent = domains.some(fraudDomain => {
        const normalizedFraudDomain = fraudDomain.toLowerCase().replace(/^www\./, '');
        return normalizedFraudDomain === normalizedDomain || 
               normalizedDomain.includes(normalizedFraudDomain) ||
               normalizedFraudDomain.includes(normalizedDomain);
      });
      
      return {
        isFraudulent,
        domain: normalizedDomain,
        checkedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error checking domain fraud status:', error);
      return {
        isFraudulent: false,
        domain,
        error: error.message,
        checkedAt: new Date().toISOString()
      };
    }
  }

  async reportNewFraudDomain(domain, reportedBy = 'user', reason = '') {
    try {
      // Ensure Firebase is initialized
      if (!firebaseManager.isInitialized) {
        await firebaseManager.initialize();
      }

      // Add to reported domains collection for review
      const reportData = {
        domain: domain.toLowerCase().replace(/^www\./, ''),
        reportedBy,
        reason,
        reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'pending_review',
        votes: { fraud: 1, legitimate: 0 }
      };

      await firebaseManager.db
        .collection('fraud_reports')
        .add(reportData);

      console.log('New fraud domain reported:', domain);
      return { success: true, domain };
    } catch (error) {
      console.error('Failed to report fraud domain:', error);
      return { success: false, error: error.message };
    }
  }

  clearCache() {
    this.modelCache = null;
    this.vectorizerCache = null;
    this.metadataCache = null;
    this.fraudDomainsCache = null;
    this.fraudDomainsMetadata = null;
    this.lastFetchTime = null;
    this.lastDomainsFetchTime = null;
    console.log('All caches cleared');
  }
  
  // Clear domains cache specifically
  clearDomainsCache() {
    this.fraudDomainsCache = null;
    this.fraudDomainsMetadata = null;
    this.lastDomainsFetchTime = 0;
    console.log('Fraud domains cache cleared');
  }
  
  // Store user feedback for training and analytics
  async storeUserFeedback(feedbackData) {
    try {
      if (!this.db) {
        throw new Error('Firebase not initialized');
      }
      
      const feedbackRef = collection(this.db, 'user_feedback');
      const docRef = await addDoc(feedbackRef, {
        ...feedbackData,
        createdAt: new Date(),
        version: '1.0'
      });
      
      console.log('User feedback stored with ID:', docRef.id);
      return { success: true, id: docRef.id };
      
    } catch (error) {
      console.error('Error storing user feedback:', error);
      throw error;
    }
  }

  getModelMetadata() {
    return this.metadataCache;
  }

  // Convert base64 to binary data (for future use if needed)
  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Create global Firebase manager instance
const firebaseManager = new FirebaseManager();

// Create global Model manager instance
const modelManager = new ModelManager(firebaseManager);

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.firebaseManager = firebaseManager;
  window.modelManager = modelManager;
}

// For service worker/background script
if (typeof self !== 'undefined' && typeof importScripts === 'function') {
  self.firebaseManager = firebaseManager;
  self.modelManager = modelManager;
}

// CommonJS export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { firebaseManager, modelManager, firebaseConfig, FirebaseManager, ModelManager };
}