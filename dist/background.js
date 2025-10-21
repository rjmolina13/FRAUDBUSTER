// FraudBuster Background Service Worker
// Load Firebase configuration and fraud detection system
importScripts('firebase-config.js');
importScripts('fraud-detector.js');
importScripts('page-context-analyzer.js');
importScripts('content-density-analyzer.js');
importScripts('firestore-false-positive-integration.js');
importScripts('dynamic-learning-engine.js');

// Firebase SDK URLs for service worker
const FIREBASE_SCRIPTS = [
  'lib/firebase-app-compat.js',
  'lib/firebase-firestore-compat.js',
  'lib/firebase-auth-compat.js'
];

// Load Firebase scripts
FIREBASE_SCRIPTS.forEach(script => {
  try {
    importScripts(script);
  } catch (error) {
     console.error('Failed to load Firebase script:', script, error);
  }
});

class FraudBusterBackground {
  constructor() {
    this.firebaseManager = null;
    this.modelManager = null;
    this.fraudDetector = null;
    this.mlModel = null; // Keep for backward compatibility
    this.isInitialized = false;
    this.initializationPromise = null;
    
    // False Positive Reduction System components
    this.pageContextAnalyzer = null;
    this.contentDensityAnalyzer = null;
    this.firestoreFPIntegration = null;
    this.dynamicLearningEngine = null;
    
    // Session-based caching properties
    this.sessionId = null;
    this.sessionInitialized = false;
    this.lastDataFetch = null;
    this.cachedData = {
      urlList: null,
      nlpModel: null,
      userRegistered: false,
      firebaseConnected: false
    };
    
    // Start initialization and store the promise
    this.initializationPromise = this.initializeSession();
    this.setupMessageListeners();
  }

  async initializeSession() {
    try {
      console.log('Starting FraudBuster session initialization...');
      
      // Check if this is first launch
      await this.checkFirstLaunch();
      
      // Generate or retrieve session ID
      this.sessionId = this.generateSessionId();
      
      // Check if we already have cached data for this session
      const sessionData = await this.getSessionData();
      
      if (sessionData && sessionData.sessionId === this.sessionId && sessionData.initialized) {
        console.log('Using cached session data');
        this.cachedData = sessionData.cachedData;
        this.sessionInitialized = true;
        this.lastDataFetch = sessionData.lastDataFetch;
        
        // Quick initialization with cached data
        await this.initializeWithCachedData();
      } else {
        console.log('Performing full session initialization');
        await this.performFullInitialization();
        
        // Cache the session data
        await this.saveSessionData();
      }
      
      this.isInitialized = true;
      console.log('FraudBuster session initialized successfully');
    } catch (error) {
      console.error('Failed to initialize FraudBuster session:', error);
      // Fallback to basic initialization
      await this.initializeFallback();
    }
  }

  async performFullInitialization() {
    try {
      // Step 1: Establish Firebase connection (once per session)
      if (!this.cachedData.firebaseConnected) {
        console.log('Establishing Firebase connection...');
        this.firebaseManager = new FirebaseManager();
        await this.firebaseManager.initialize();
        this.cachedData.firebaseConnected = true;
      }
      
      // Step 2: Register user anonymously if not registered (once per session)
      if (!this.cachedData.userRegistered) {
        console.log('Registering user anonymously...');
        await this.registerUserAnonymously();
        this.cachedData.userRegistered = true;
      }
      
      // Step 3: Initialize fraud detection system first (creates ModelManager)
      await this.initializeFraudDetectionSystem();
      
      // Step 4: Initialize False Positive Reduction System
      await this.initializeFalsePositiveReductionSystem();
      
      // Step 5: Fetch latest data from Firebase and cache (requires ModelManager)
      console.log('Fetching latest data from Firebase...');
      await this.fetchAndCacheData();
      
      // Initialize legacy ML model for backward compatibility
      await this.initializeMLModel();
      
      this.sessionInitialized = true;
      this.lastDataFetch = new Date().toISOString();
    } catch (error) {
      console.error('Error in full initialization:', error);
      throw error;
    }
  }

  async initializeWithCachedData() {
    try {
      console.log('Initializing with cached data...');
      
      // Quick setup with cached data
      if (this.cachedData.firebaseConnected) {
        this.firebaseManager = new FirebaseManager();
        // Skip full Firebase initialization, use cached connection
      }
      
      // Initialize fraud detection system with cached data
      await this.initializeFraudDetectionSystem();
      
      // Initialize False Positive Reduction System
      await this.initializeFalsePositiveReductionSystem();
      
      // Initialize legacy ML model
      await this.initializeMLModel();
    } catch (error) {
      console.error('Error initializing with cached data:', error);
      // Fallback to full initialization
      await this.performFullInitialization();
    }
  }

  async initializeFallback() {
    try {
      console.log('Initializing with fallback mode...');
      
      // Basic initialization without Firebase
      this.modelManager = new ModelManager(null);
      this.fraudDetector = new FraudDetector(this.modelManager);
      
      await this.initializeFraudDetection();
      await this.initializeMLModel();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Fallback initialization failed:', error);
      this.isInitialized = false;
    }
  }

  // Session management methods
  async getSessionData() {
    try {
      const result = await chrome.storage.session.get(['fraudBusterSession']);
      return result.fraudBusterSession || null;
    } catch (error) {
      console.error('Error getting session data in storage method:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return null;
    }
  }

  async saveSessionData() {
    try {
      const sessionData = {
        sessionId: this.sessionId,
        initialized: this.sessionInitialized,
        cachedData: this.cachedData,
        lastDataFetch: this.lastDataFetch,
        timestamp: new Date().toISOString()
      };
      
      await chrome.storage.session.set({ fraudBusterSession: sessionData });
      console.log('Session data saved successfully');
    } catch (error) {
      console.error('Error saving session data:', error);
    }
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Generate a stable fingerprint based on browser/system characteristics
  async generateStableFingerprint() {
    try {
      const fingerprint = {
        screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        userAgent: navigator.userAgent.replace(/Chrome\/[\d.]+/, 'Chrome/XXX'), // Normalize Chrome version
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack || 'unspecified'
      };

      // Create a stable hash from the fingerprint
      const fingerprintString = JSON.stringify(fingerprint);
      const hash = await this.simpleHash(fingerprintString);
      
      return 'anon_' + hash;
    } catch (error) {
      console.error('Error generating fingerprint:', error);
      // Fallback to timestamp-based ID if fingerprinting fails
      return 'anon_fallback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  }

  // Simple hash function for creating consistent IDs
  async simpleHash(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substr(0, 16); // Use first 16 characters for shorter ID
  }

  async registerUserAnonymously() {
    try {
      // Check if user is already registered
      const result = await chrome.storage.sync.get(['anonymousUserId']);
      
      if (!result.anonymousUserId) {
        // Generate stable anonymous user ID based on browser fingerprint
        const anonymousId = await this.generateStableFingerprint();
        
        // Store in sync storage to persist across devices
        await chrome.storage.sync.set({ anonymousUserId: anonymousId });
        console.log('Anonymous user registered with stable ID:', anonymousId);
      } else {
        console.log('Using existing anonymous user ID:', result.anonymousUserId);
      }
    } catch (error) {
      console.error('Error registering anonymous user:', error);
    }
  }

  async fetchAndCacheData() {
    try {
      // Fetch URL list and NLP model from Firebase
      if (this.firebaseManager) {
        console.log('Starting data fetch from Firebase...');
        
        // Notify popup about Firebase connection
        this.notifyLoadingProgress('Connecting to database...', 25);
        
        console.log('Firebase Manager status:', {
          initialized: !!this.firebaseManager,
          db: !!this.firebaseManager.db
        });
        console.log('Model Manager status:', {
          initialized: !!this.modelManager,
          firebaseManager: !!this.modelManager?.firebaseManager
        });
        
        // Fetch URL list
        console.log('Fetching URL list...');
        this.notifyLoadingProgress('Downloading fraud patterns...', 50);
        this.cachedData.urlList = await this.fetchUrlListFromFirebase();
        console.log('URL list fetch result:', {
          count: this.cachedData.urlList?.length || 0,
          sample: this.cachedData.urlList?.slice(0, 3)
        });
        
        // Fetch NLP model
        console.log('Fetching NLP model...');
        this.notifyLoadingProgress('Loading ML models...', 75);
        this.cachedData.nlpModel = await this.fetchNlpModelFromFirebase();
        console.log('NLP model fetch result:', {
          hasModel: !!this.cachedData.nlpModel,
          rulesCount: this.cachedData.nlpModel?.rules?.length || 0,
          patternsCount: this.cachedData.nlpModel?.patterns?.length || 0,
          hasMetadata: !!this.cachedData.nlpModel?.metadata
        });
        
        console.log('Data fetched and cached successfully');
      } else {
        console.warn('Firebase Manager not available, skipping data fetch');
        this.cachedData.urlList = [];
        this.cachedData.nlpModel = null;
      }
    } catch (error) {
      console.error('Error fetching and caching data:', {
        error: error.message,
        stack: error.stack,
        firebaseManager: !!this.firebaseManager,
        modelManager: !!this.modelManager
      });
      // Use fallback data
      this.cachedData.urlList = [];
      this.cachedData.nlpModel = null;
    }
  }

  async fetchUrlListFromFirebase() {
    try {
      console.log('Fetching URL list from Firebase...');
      console.log('ModelManager status:', {
        initialized: !!this.modelManager,
        firebaseManager: !!this.firebaseManager
      });
      
      if (!this.modelManager) {
        console.warn('ModelManager not initialized, returning empty URL list');
        return [];
      }
      
      const { domains, metadata } = await this.modelManager.fetchFraudDomains();
      
      console.log('URL list fetched successfully:', {
        totalDomains: domains?.length || 0,
        source: metadata?.source,
        metadata: metadata,
        sampleDomains: domains?.slice(0, 3) || []
      });
      
      if (!domains || domains.length === 0) {
        console.warn('No domains returned from Firebase - check Firestore collection and permissions');
      }
      
      return domains || [];
    } catch (error) {
      console.error('Failed to fetch URL list from Firebase:', {
        error: error.message,
        stack: error.stack,
        modelManagerStatus: !!this.modelManager,
        firebaseStatus: !!this.firebaseManager
      });
      return [];
    }
  }

  async fetchNlpModelFromFirebase() {
    try {
      console.log('Fetching NLP model from Firebase...');
      console.log('ModelManager status:', {
        initialized: !!this.modelManager,
        firebaseManager: !!this.firebaseManager
      });
      
      if (!this.modelManager) {
        console.warn('ModelManager not initialized, returning null NLP model');
        return {
          rules: [],
          patterns: [],
          metadata: null
        };
      }
      
      const modelData = await this.modelManager.fetchModelData();
      
      console.log('Raw NLP model data received:', {
        hasModelData: !!modelData,
        hasModel: !!modelData?.model,
        hasVectorizer: !!modelData?.vectorizer,
        hasMetadata: !!modelData?.metadata,
        metadataKeys: modelData?.metadata ? Object.keys(modelData.metadata) : [],
        modelType: typeof modelData?.model,
        vectorizerType: typeof modelData?.vectorizer
      });
      
      if (!modelData || !modelData.model || !modelData.vectorizer) {
        console.warn('Incomplete NLP model data received from Firebase - check Firestore collection and data structure');
        return {
          rules: [],
          patterns: [],
          metadata: modelData?.metadata || null
        };
      }
      
      const structuredData = {
        rules: modelData.metadata?.vocabulary_size || modelData.metadata?.n_features || 0,
        patterns: modelData.metadata?.features || [],
        model: modelData.model,
        vectorizer: modelData.vectorizer,
        metadata: modelData.metadata
      };
      
      console.log('NLP model processed successfully:', {
        rulesCount: structuredData.rules,
        patternsCount: structuredData.patterns.length,
        accuracy: modelData.metadata?.accuracy,
        vocabularySize: modelData.metadata?.vocabulary_size || 0,
        nFeatures: modelData.metadata?.n_features || 0
      });
      
      return structuredData;
    } catch (error) {
      console.error('Failed to fetch NLP model from Firebase:', {
        error: error.message,
        stack: error.stack,
        modelManagerStatus: !!this.modelManager,
        firebaseStatus: !!this.firebaseManager
      });
      return {
        rules: [],
        patterns: [],
        metadata: null
      };
    }
  }

  async initializeFraudDetectionSystem() {
    try {
      console.log('Initializing fraud detection system with cached data...');
      console.log('System status before initialization:', {
        firebaseManager: !!this.firebaseManager,
        modelManager: !!this.modelManager,
        fraudDetector: !!this.fraudDetector,
        cachedData: !!this.cachedData
      });
      
      // Ensure Firebase is initialized first
      if (this.firebaseManager && !this.firebaseManager.initialized) {
        console.log('Initializing Firebase manager...');
        await this.firebaseManager.initialize();
      }
      
      // Initialize ModelManager and FraudDetector
      console.log('Creating ModelManager and FraudDetector instances...');
      this.modelManager = new ModelManager(this.firebaseManager);
      await this.modelManager.initialize();
      
      this.fraudDetector = new FraudDetector(this.modelManager);
      
      console.log('Instances created:', {
        modelManager: !!this.modelManager,
        fraudDetector: !!this.fraudDetector
      });
      
      // Initialize FraudDetector
      console.log('Calling fraudDetector.initialize()...');
      await this.fraudDetector.initialize();
      
      console.log('Fraud detection system initialized successfully');
      
      // Check what data is actually available after initialization
      const testData = await this.getSessionData();
      console.log('Post-initialization session data check:', {
        nlpRulesCount: testData?.nlpRulesCount || 0,
        urlListingCount: testData?.urlListingCount || 0,
        lastDataFetch: testData?.lastDataFetch || 'none'
      });
    } catch (error) {
      // Properly serialize error for logging
      const errorDetails = {
        message: error?.message || 'Unknown error',
        name: error?.name || 'UnknownError',
        errorType: typeof error,
        errorString: String(error),
        stack: error?.stack,
        firebaseManagerStatus: !!this.firebaseManager,
        firebaseInitialized: this.firebaseManager?.initialized,
        modelManagerStatus: !!this.modelManager
      };
      
      console.error('Failed to initialize fraud detection system:', errorDetails);
      console.error('Raw error object:', error);
      
      // Try to initialize with fallback patterns
      try {
        if (this.fraudDetector) {
          console.log('Attempting to initialize fraud detector with fallback patterns...');
          await this.fraudDetector.initializeWithFallback();
        }
      } catch (fallbackError) {
        console.error('Failed to initialize with fallback patterns:', fallbackError);
      }
    }
  }

  async initializeFraudDetection() {
    try {
      console.log('Initializing fraud detection system...');
      const initialized = await this.fraudDetector.initialize();
      
      if (initialized) {
        console.log('Fraud detection system initialized successfully');
      } else {
        console.warn('Fraud detection system initialized with fallback patterns');
      }
    } catch (error) {
      console.error('Failed to initialize fraud detection system:', error);
      // Continue with fallback patterns
    }
  }

  async initializeFalsePositiveReductionSystem() {
    try {
      console.log('Initializing False Positive Reduction System...');
      
      // Initialize Page Context Analyzer
      this.pageContextAnalyzer = new PageContextAnalyzer();
      
      // Initialize Content Density Analyzer
      this.contentDensityAnalyzer = new ContentDensityAnalyzer();
      
      // Initialize Firestore False Positive Integration
      if (this.firebaseManager) {
        this.firestoreFPIntegration = new FirestoreFalsePositiveIntegration(this.firebaseManager);
        await this.firestoreFPIntegration.initialize();
      }
      
      // Initialize Dynamic Learning Engine
      this.dynamicLearningEngine = new DynamicLearningEngine(this.firestoreFPIntegration);
      await this.dynamicLearningEngine.initialize();
      
      console.log('False Positive Reduction System initialized successfully');
    } catch (error) {
      console.error('Failed to initialize False Positive Reduction System:', error);
      // Continue without false positive reduction
    }
  }

  async initializeMLModel() {
    // Placeholder for ML model initialization
    // In a real implementation, this would load a TensorFlow.js model
    // or connect to a cloud ML service
    this.mlModel = {
      predict: async (features) => {
        // Simple heuristic-based fraud detection for demo
        let riskScore = 0;
        
        // Check for suspicious keywords
        const suspiciousKeywords = [
          'urgent', 'limited time', 'act now', 'guaranteed', 'free money',
          'click here', 'verify account', 'suspended', 'confirm identity',
          'wire transfer', 'bitcoin', 'cryptocurrency', 'investment opportunity'
        ];
        
        const textContent = features.textContent.toLowerCase();
        const keywordMatches = suspiciousKeywords.filter(keyword => 
          textContent.includes(keyword)
        ).length;
        
        riskScore += keywordMatches * 0.15;
        
        // Check for suspicious form fields
        if (features.hasPasswordField && features.hasEmailField) {
          riskScore += 0.2;
        }
        
        // Check for suspicious URLs
        if (features.hasExternalLinks) {
          riskScore += 0.1;
        }
        
        // Check domain age and reputation (simulated)
        if (features.isDomainNew) {
          riskScore += 0.3;
        }
        
        // Normalize score to 0-1 range
        riskScore = Math.min(riskScore, 1);
        
        return {
          riskScore,
          confidence: 0.8 + Math.random() * 0.2, // Simulated confidence
          features: {
            suspiciousKeywords: keywordMatches,
            hasLoginForm: features.hasPasswordField && features.hasEmailField,
            hasExternalLinks: features.hasExternalLinks,
            domainRisk: features.isDomainNew ? 'high' : 'low'
          }
        };
      }
    };
  }

  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Listen for tab updates to potentially trigger auto-scan
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        await this.handleTabUpdate(tabId, tab);
      }
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'scanPage':
          // Get tab information from request or sender
          let tabInfo = null;
          let domain = null;
          
          if (request.tabId && request.tabUrl) {
            // Tab info provided in request (from popup)
            tabInfo = { id: request.tabId, url: request.tabUrl };
            domain = request.domain || extractDomainFromUrl(request.tabUrl);
          } else if (sender.tab) {
            // Tab info from sender (from content script)
            tabInfo = sender.tab;
            domain = extractDomainFromUrl(sender.tab.url);
          }
          
          // Validate that we have tab information
          if (!tabInfo || !tabInfo.id) {
            sendResponse({
              success: false,
              error: 'Missing required tab information',
              errorType: 'INVALID_PARAMETERS'
            });
            break;
          }
          
          // Check if extension is active for this domain
          if (!await isExtensionActiveForDomain(domain)) {
            sendResponse({
              success: false,
              error: `Extension is not active for domain: ${domain}`,
              errorType: 'EXTENSION_INACTIVE'
            });
            break;
          }
          
          let pageData = request.data;
          
          // If no pageData provided, extract it from the content script
          if (!pageData) {
            try {
              console.log('DEBUG scanPage: No pageData provided, extracting from content script for tab:', tabInfo.id);
              pageData = await this.extractPageData(tabInfo.id);
              console.log('DEBUG scanPage: Extracted pageData:', {
                hasPageData: !!pageData,
                hasJobPostings: pageData && pageData.jobPostings ? 'yes' : 'no',
                jobPostingsCount: pageData && pageData.jobPostings ? pageData.jobPostings.length : 0
              });
            } catch (error) {
              console.error('Failed to extract page data from content script:', error);
              // Create minimal fallback only if extraction fails
              pageData = {
                pageUrl: tabInfo.url,
                domain: new URL(tabInfo.url).hostname,
                text: '',
                source: 'extraction_failed_fallback'
              };
            }
          }
          
          const scanResult = await this.scanPageComprehensive(pageData, tabInfo);
          sendResponse(scanResult);
          break;
          
        case 'analyzeJobPosting':
          const analysisResult = await this.analyzeJobPosting(request.jobText, request.pageUrl);
          sendResponse(analysisResult);
          break;
          
        case 'classifyPageType':
          // New action for page classification to reduce false positives
          try {
            await this.ensureInitialized();
            
            if (!this.fraudDetector) {
              throw new Error('FraudDetector not initialized');
            }
            
            const classification = this.fraudDetector.classifyPageType(request.pageContent, request.pageUrl);
            
            // Store page classification result in Firestore
            await this.storePageClassification({
              url: request.pageUrl,
              domain: request.pageUrl ? new URL(request.pageUrl).hostname : null,
              pageType: classification.pageType,
              confidence: classification.confidence,
              shouldAnalyze: classification.shouldAnalyze,
              method: classification.method || 'fraud_detector',
              scores: classification.scores || {}
            });
            
            sendResponse({
              success: true,
              classification: classification
            });
          } catch (error) {
            console.error('Error classifying page type:', error);
            sendResponse({
              success: false,
              error: error.message || 'Page classification failed'
            });
          }
          break;
          
        case 'getFraudDetectorStatus':
          const statusResult = await this.getFraudDetectorStatus();
          sendResponse(statusResult);
          break;
          
        case 'reportURL':
          const reportResult = await this.reportURL(request.url, request.reason);
          sendResponse(reportResult);
          break;
          
        case 'voteURL':
          const voteResult = await this.voteURL(request.url, request.voteType);
          sendResponse(voteResult);
          break;
          
        case 'analysisComplete':
          await this.handleAnalysisComplete(request.data);
          sendResponse({ success: true });
          break;
          
        case 'checkDomainStatus':
          // Check domain status before NLP analysis
          try {
            const url = request.tabUrl;
            const domain = new URL(url).hostname;
            const domainStatus = this.checkDomainStatus(domain);
            
            if (domainStatus === 'Fraudulent') {
              // Get report count from database (mock for now)
              const reportCount = Math.floor(Math.random() * 50) + 10; // Mock data
              
              sendResponse({
                success: true,
                isBlacklisted: true,
                domainInfo: {
                  domain: domain,
                  status: 'Fraudulent',
                  reportCount: reportCount
                }
              });
            } else {
              sendResponse({
                success: true,
                isBlacklisted: false,
                domainInfo: {
                  domain: domain,
                  status: domainStatus
                }
              });
            }
          } catch (error) {
            console.error('Error checking domain status:', error);
            sendResponse({
              success: false,
              error: 'Failed to check domain status'
            });
          }
          break;

        case 'showAnalysisDetails':
          // Return stored analysis result for popup
          const storedAnalysisResult = this.getAnalysisResult(sender.tab?.url);
          sendResponse({ success: true, data: storedAnalysisResult });
          break;
          
        case 'showReportInterface':
          // Open popup for manual reporting
          try {
            await chrome.action.openPopup();
            sendResponse({ success: true });
          } catch (error) {
            console.warn('Could not open popup:', error);
            sendResponse({ success: false, error: 'Could not open popup' });
          }
          break;
          
        case 'getAnalysisForPopup':
          // Get analysis result for current tab
          const currentUrl = sender.tab?.url;
          if (currentUrl) {
            const result = this.getAnalysisResult(currentUrl);
            sendResponse({ success: true, data: result });
          } else {
            sendResponse({ success: false, error: 'No current tab URL' });
          }
          break;
          
        case 'reportNewFraudDomain':
          const reportDomainResult = await this.reportNewFraudDomain(request.domain, request.reason);
          sendResponse(reportDomainResult);
          break;
          
        case 'processManualFraudReport':
          const processResult = await this.processManualFraudReport(request.data);
          sendResponse(processResult);
          break;
          
        case 'submitUserFeedback':
          const feedbackResult = await this.submitUserFeedback(request.data);
          sendResponse(feedbackResult);
          break;
          
        case 'getJobDetectionData':
          const jobDetectionData = await this.getJobDetectionData();
          sendResponse(jobDetectionData);
          break;
          
        case 'getSessionData':
          // Get current domain from request or sender tab if available
          let currentDomain = request.currentDomain || null;
          if (!currentDomain && sender.tab && sender.tab.url) {
            try {
              currentDomain = new URL(sender.tab.url).hostname;
            } catch (error) {
              console.warn('Could not parse domain from tab URL:', sender.tab.url);
            }
          }
          const sessionData = await this.getSessionData(currentDomain);
          sendResponse(sessionData);
          break;
          
        case 'getCommunityData':
          const communityData = await this.getCommunityData(request.url);
          sendResponse({ success: true, data: communityData });
          break;
          
        case 'checkUserVote':
          const voteStatus = await this.checkUserVote(request.url);
          sendResponse(voteStatus);
          break;
          
        case 'getLearningMetrics':
          const learningMetrics = await this.getLearningMetrics();
          sendResponse(learningMetrics);
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async analyzeJobPosting(jobText, pageUrl = null) {
    console.log('Background: analyzeJobPosting called with text:', jobText.substring(0, 100) + '...');
    
    try {
      // Check if fraud detector is available
      if (!this.fraudDetector) {
        console.log('Background: Fraud detector not available');
        return {
          success: false,
          error: 'Fraud detection system not available',
          errorType: 'SYSTEM_NOT_AVAILABLE',
          fallback: true
        };
      }

      // Check if fraud detector is initialized
      if (!this.fraudDetector.isInitialized) {
        console.log('Background: Fraud detector not initialized');
        return {
          success: false,
          error: 'Fraud detection models are still loading. Please try again in a moment.',
          errorType: 'MODELS_LOADING',
          fallback: true
        };
      }

      // Check if models are ready
      const status = this.fraudDetector.getStatus();
      console.log('Background: Fraud detector status:', status);
      
      if (status.status === 'loading') {
        console.log('Background: Models still loading');
        return {
          success: false,
          error: 'AI models are currently loading. Please wait and try again.',
          errorType: 'MODELS_LOADING',
          progress: status.progress || 0,
          fallback: true
        };
      }

      // Allow analysis even when models are in error/fallback state
      // The fraud detector will handle fallback to rule-based analysis
      console.log('Background: Starting fraud detector analysis');

      // Use comprehensive analysis with domain checking and NLP fallback
      const analysis = await this.fraudDetector.analyzeJobPosting(jobText, pageUrl);
      
      console.log('Background: Analysis completed:', {
        isFraud: analysis.isFraud,
        confidence: analysis.confidence,
        method: analysis.method
      });
      
      // Store analysis result in Firestore
      await this.storeAnalysisResult(analysis, jobText, pageUrl);
      
      return {
        success: true,
        analysis: analysis,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error analyzing job posting:', error);
      
      // Provide fallback analysis for critical errors
      if (error.message.includes('model') || error.message.includes('loading')) {
        return {
          success: false,
          error: 'AI models are temporarily unavailable. Please try again later.',
          errorType: 'MODELS_UNAVAILABLE',
          fallback: true
        };
      }
      
      return {
        success: false,
        error: error.message,
        errorType: 'UNKNOWN_ERROR'
      };
    }
  }

  async getFraudDetectorStatus() {
    try {
      if (!this.fraudDetector) {
        return {
          success: true,
          status: {
            status: 'not_initialized',
            message: 'Fraud detection system is not available',
            canAnalyze: false,
            errorType: 'SYSTEM_NOT_AVAILABLE'
          }
        };
      }

      const status = this.fraudDetector.getStatus();
      
      // Enhance status with user-friendly messages
      let enhancedStatus = { ...status };
      
      switch (status.status) {
        case 'ready':
          enhancedStatus.message = 'Using AI models';
          enhancedStatus.canAnalyze = true;
          break;
        case 'loading':
          enhancedStatus.message = `Loading AI models... ${Math.round((status.progress || 0) * 100)}%`;
          enhancedStatus.canAnalyze = false;
          enhancedStatus.errorType = 'MODELS_LOADING';
          break;
        case 'error':
          enhancedStatus.message = 'AI models failed to load. Using basic pattern detection.';
          enhancedStatus.canAnalyze = true; // Can still use fallback patterns
          enhancedStatus.errorType = 'MODELS_ERROR';
          break;
        case 'fallback':
          enhancedStatus.message = 'Using basic pattern detection (AI models unavailable)';
          enhancedStatus.canAnalyze = true;
          enhancedStatus.errorType = 'MODELS_FALLBACK';
          break;
        default:
          enhancedStatus.message = 'Unknown status';
          enhancedStatus.canAnalyze = false;
          enhancedStatus.errorType = 'UNKNOWN_STATUS';
      }
      
      return {
        success: true,
        status: enhancedStatus
      };
    } catch (error) {
      console.error('Error getting fraud detector status:', error);
      return {
        success: false,
        error: error.message,
        status: {
          status: 'error',
          message: 'Failed to get system status',
          canAnalyze: false,
          errorType: 'STATUS_ERROR'
        }
      };
    }
  }
  
  async scanPageComprehensive(pageData, tab) {
    // Initialize variables outside try block to avoid undefined errors in catch
    let pageUrl = 'unknown';
    let domain = 'unknown';
    
    // DEBUG: Log received pageData structure
    console.log('DEBUG scanPageComprehensive: Received pageData:', {
      hasPageData: !!pageData,
      pageDataKeys: pageData ? Object.keys(pageData) : 'null',
      hasJobPostings: pageData && pageData.jobPostings ? pageData.jobPostings.length : 'no jobPostings property',
      jobPostingsType: pageData && pageData.jobPostings ? typeof pageData.jobPostings : 'undefined'
    });
    
    if (pageData && pageData.jobPostings) {
      console.log('DEBUG scanPageComprehensive: Job postings found:', pageData.jobPostings.length, 'postings');
      pageData.jobPostings.forEach((job, index) => {
        console.log(`DEBUG scanPageComprehensive: Job ${index + 1}:`, {
          title: job.title ? job.title.substring(0, 50) + '...' : 'no title',
          company: job.company || 'no company',
          hasDescription: !!job.description,
          descriptionLength: job.description ? job.description.length : 0
        });
      });
    } else {
      console.log('DEBUG scanPageComprehensive: No job postings in pageData');
    }
    
    try {
      // Wait for initialization to complete if not already initialized
      if (!this.isInitialized) {
        console.log('Waiting for background service initialization...');
        try {
          await this.initializationPromise;
          if (!this.isInitialized) {
            throw new Error('Background service initialization failed');
          }
        } catch (initError) {
          console.error('Initialization failed:', initError);
          throw new Error('Background service not initialized: ' + initError.message);
        }
      }

      // Comprehensive null/undefined checking
      if (!pageData) {
        throw new Error('pageData parameter is null or undefined');
      }

      // Handle different data structures from content.js vs popup.js
      if (pageData && pageData.pageUrl) {
        // Called from content.js - pageData has pageUrl and domain
        pageUrl = pageData.pageUrl;
        domain = pageData.domain || new URL(pageData.pageUrl).hostname;
      } else if (tab && tab.url) {
        // Called from popup.js - extract URL from tab parameter
        pageUrl = tab.url;
        domain = new URL(tab.url).hostname;
        // Update pageData to include missing properties
        if (pageData) {
          pageData.pageUrl = pageUrl;
          pageData.domain = domain;
        }
      } else {
        // Enhanced error message with more context
        const pageDataInfo = pageData ? `pageData exists but missing pageUrl: ${JSON.stringify(Object.keys(pageData))}` : 'pageData is null/undefined';
        const tabInfo = tab ? `tab exists but missing url: ${JSON.stringify(Object.keys(tab))}` : 'tab is null/undefined';
        throw new Error(`Unable to determine page URL - ${pageDataInfo}, ${tabInfo}`);
      }

      console.log('Starting comprehensive page scan for:', pageUrl);
      
      // STEP 1: Page Classification to Reduce False Positives
      let shouldProceedWithAnalysis = true;
      let pageClassification = null;
      
      if (this.pageContextAnalyzer) {
        try {
          console.log('Performing page classification to reduce false positives...');
          pageClassification = await this.pageContextAnalyzer.classifyPage(pageData, pageUrl);
          
          console.log('Page classification result:', {
            pageType: pageClassification.pageType,
            confidence: pageClassification.confidence,
            shouldAnalyze: pageClassification.shouldAnalyze
          });
          
          // Store page classification in Firestore
          if (this.firestoreFPIntegration) {
            await this.firestoreFPIntegration.storePageClassification({
              url: pageUrl,
              domain: domain,
              pageType: pageClassification.pageType,
              confidence: pageClassification.confidence,
              shouldAnalyze: pageClassification.shouldAnalyze,
              method: 'page_context_analyzer',
              scores: pageClassification.scores || {}
            });
          }
          
          // Skip fraud analysis if classified as landing page with high confidence
          if (!pageClassification.shouldAnalyze) {
            console.log('Skipping fraud analysis - page classified as landing page');
            
            // Process user feedback for learning if available
            if (this.dynamicLearningEngine && pageClassification.userFeedback) {
              await this.dynamicLearningEngine.processFeedback(pageClassification.userFeedback);
            }
            
            return {
              success: true,
              results: {
                hasJobPostings: false,
                pageClassification: pageClassification,
                message: 'Page classified as landing page - no fraud analysis needed',
                skippedAnalysis: true
              }
            };
          }
          
          shouldProceedWithAnalysis = pageClassification.shouldAnalyze;
        } catch (error) {
          console.warn('Page classification failed, proceeding with analysis:', error);
          // Continue with analysis if classification fails
        }
      }
      
      // Extract job postings from page data
      const jobPostings = this.extractJobPostings(pageData);
      
      if (jobPostings.length === 0) {
        console.log('No job postings detected on page');
        return {
          success: true,
          results: {
            hasJobPostings: false,
            pageClassification: pageClassification,
            message: 'No job postings detected on this page'
          }
        };
      }
      
      console.log(`Found ${jobPostings.length} job posting(s) to analyze`);
      
      // Analyze ALL job postings instead of just the first one
      const analysisResults = [];
      let fraudCount = 0;
      let totalConfidence = 0;
      
      for (let i = 0; i < jobPostings.length; i++) {
        const jobPosting = jobPostings[i];
        console.log(`Analyzing job posting ${i + 1}/${jobPostings.length}`);
        
        const analysisResult = await this.analyzeJobPosting(jobPosting.text, pageUrl);
        
        if (!analysisResult.success) {
          console.warn(`Failed to analyze job posting ${i + 1}:`, analysisResult.error);
          continue;
        }
        
        analysisResults.push(analysisResult.analysis);
        totalConfidence += analysisResult.analysis.confidence || 0;
        
        if (analysisResult.analysis.isFraud) {
          fraudCount++;
        }
      }
      
      if (analysisResults.length === 0) {
        return {
          success: false,
          error: 'Failed to analyze any job postings',
          errorType: 'ANALYSIS_ERROR'
        };
      }
      
      // Calculate aggregated risk based on proportion of fraudulent postings
      const fraudPercentage = (fraudCount / analysisResults.length) * 100;
      const avgConfidence = totalConfidence / analysisResults.length;
      
      // STEP 2: Apply False Positive Reduction adjustments
      let adjustedConfidence = avgConfidence;
      let confidenceAdjustment = 0;
      
      if (pageClassification && this.dynamicLearningEngine) {
        try {
          // Get confidence adjustment based on page classification
          confidenceAdjustment = await this.dynamicLearningEngine.getConfidenceAdjustment(
            pageClassification,
            { fraudPercentage, avgConfidence, domain }
          );
          
          adjustedConfidence = Math.max(0, Math.min(1, avgConfidence + confidenceAdjustment));
          
          console.log('Applied confidence adjustment:', {
            original: avgConfidence,
            adjustment: confidenceAdjustment,
            adjusted: adjustedConfidence
          });
        } catch (error) {
          console.warn('Failed to apply confidence adjustment:', error);
        }
      }
      
      // Determine overall page risk with adjusted confidence
      let overallIsFraud = fraudCount > 0;
      let overallRiskLevel = 'low';
      let overallConfidence = adjustedConfidence; // Use adjusted confidence
      
      if (fraudPercentage >= 50) {
        overallRiskLevel = 'high';
        overallConfidence = Math.min(0.9, adjustedConfidence + (fraudPercentage - 50) / 100);
      } else if (fraudPercentage >= 25) {
        overallRiskLevel = 'medium';
        overallConfidence = Math.min(0.75, adjustedConfidence + fraudPercentage / 100);
      } else if (fraudCount > 0) {
        overallRiskLevel = 'low-medium';
        overallConfidence = Math.min(0.6, adjustedConfidence + fraudPercentage / 100);
      }
      
      // Create aggregated analysis result with false positive reduction data
      const aggregatedAnalysis = {
        isFraud: overallIsFraud,
        confidence: overallConfidence, // Already a decimal (0-1) for popup display
        riskLevel: overallRiskLevel,
        method: 'aggregated_analysis_with_fp_reduction',
        fraudCount: fraudCount,
        totalPostings: analysisResults.length,
        fraudPercentage: Math.round(fraudPercentage),
        individualResults: analysisResults,
        reasons: this.generateAggregatedReasons(analysisResults, fraudCount, analysisResults.length),
        pageClassification: pageClassification,
        confidenceAdjustment: confidenceAdjustment,
        originalConfidence: avgConfidence
      };
      
      // Store aggregated analysis result for popup access
      await this.storeAnalysisResult(pageUrl, aggregatedAnalysis);
      
      // Trigger toast notification
      try {
        const riskScore = Math.round(overallConfidence * 100);
        let riskLevel, title, message;
        
        if (riskScore < 30) {
          riskLevel = 'low';
          title = 'Low Risk Detected';
          message = 'This page appears to be legitimate';
        } else if (riskScore < 70) {
          riskLevel = 'medium';
          title = 'Medium Risk Detected';
          message = 'Exercise caution with this page';
        } else {
          riskLevel = 'high';
          title = 'High Risk Detected';
          message = 'This page may be fraudulent';
        }
        
        console.log('DEBUG: Sending displayToast message to tab:', tab.id);
        await chrome.tabs.sendMessage(tab.id, {
          action: 'displayToast',
          data: {
            fraudAnalysis: {
              fraudPercentage: Math.round(fraudPercentage),
              confidence: overallConfidence,
              riskLevel: overallRiskLevel,
              fraudCount: fraudCount,
              totalPostings: analysisResults.length
            },
            title,
            message,
            riskLevel: overallRiskLevel,
            riskScore
          }
        }).catch(error => {
          console.warn('Failed to send toast notification:', error);
        });
      } catch (error) {
        console.warn('Failed to trigger toast notification:', error);
      }
      
      // STEP 3: Process user feedback for learning (if available)
        if (this.dynamicLearningEngine && pageClassification && pageClassification.userFeedback) {
          try {
            await this.dynamicLearningEngine.processFeedback({
              ...pageClassification.userFeedback,
              analysisResult: aggregatedAnalysis,
              pageUrl: pageUrl,
              domain: domain
            });
          } catch (error) {
            console.warn('Failed to process user feedback for learning:', error);
          }
        }

        return {
          success: true,
          results: {
            hasJobPostings: true,
            jobPostingsCount: jobPostings.length,
            fraudAnalysis: aggregatedAnalysis,
            pageUrl: pageUrl,
            domain: domain,
            timestamp: new Date().toISOString(),
            falsePositiveReduction: {
              pageClassification: pageClassification,
              confidenceAdjustment: confidenceAdjustment,
              systemActive: !!this.pageContextAnalyzer
            }
          }
        };
    } catch (error) {
      console.error('Comprehensive scan error:', error);
      console.error('Error context - pageUrl:', pageUrl, 'domain:', domain);
      console.error('Error context - pageData:', pageData ? Object.keys(pageData) : 'null/undefined');
      console.error('Error context - tab:', tab ? Object.keys(tab) : 'null/undefined');
      
      return { 
        success: false, 
        error: error.message,
        errorType: 'SCAN_ERROR',
        context: {
          pageUrl: pageUrl,
          domain: domain,
          hasPageData: !!pageData,
          hasTab: !!tab
        }
      };
    }
  }
  
  extractJobPostings(pageData) {
    const jobPostings = [];
    
    // Safety check for null/undefined pageData
    if (!pageData) {
      console.warn('extractJobPostings: pageData is null or undefined');
      return jobPostings;
    }
    
    // Extract from structured data if available
    if (pageData.jobPostings && Array.isArray(pageData.jobPostings) && pageData.jobPostings.length > 0) {
      pageData.jobPostings.forEach(job => {
        if (job && typeof job === 'object') {
          jobPostings.push({
            text: `${job.title || ''} ${job.description || ''} ${job.company || ''} ${job.location || ''} ${job.salary || ''}`.trim(),
            source: 'structured',
            data: job
          });
        }
      });
    }
    
    // If no structured data, try to extract individual job postings from page content
    if (jobPostings.length === 0 && pageData.text && typeof pageData.text === 'string') {
      console.log('No structured job data found, attempting to extract individual jobs from page content');
      
      // Try to split page content into individual job sections
      const pageText = pageData.text;
      
      // Look for job posting patterns that indicate separate jobs
      const jobSectionPatterns = [
        // Common job posting separators
        /(?=.*(?:job|position|role|career|opening|vacancy))(?=.*(?:title|company|salary|description))[\s\S]*?(?=(?:.*(?:job|position|role|career|opening|vacancy))(?=.*(?:title|company|salary|description))|$)/gi,
        // Fallback: split by common job indicators
        /(?:^|\n\s*)(?=.*(?:job|position|hiring|career|work|employment))[\s\S]*?(?=\n\s*(?:.*(?:job|position|hiring|career|work|employment))|$)/gi
      ];
      
      let foundJobs = false;
      
      // Try each pattern to find job sections
      for (const pattern of jobSectionPatterns) {
        const matches = pageText.match(pattern);
        if (matches && matches.length > 1) {
          console.log(`Found ${matches.length} potential job sections using pattern matching`);
          
          matches.forEach((jobText, index) => {
            const cleanText = jobText.trim();
            if (cleanText.length > 100) { // Only include substantial content
              jobPostings.push({
                text: cleanText,
                source: 'pattern_extracted',
                data: { 
                  sectionIndex: index,
                  extractionMethod: 'pattern_matching'
                }
              });
            }
          });
          
          foundJobs = true;
          break;
        }
      }
      
      // If pattern matching failed, try to split by obvious separators
      if (!foundJobs) {
        console.log('Pattern matching failed, trying separator-based splitting');
        
        // Split by multiple line breaks or obvious separators
        const sections = pageText.split(/\n\s*\n\s*\n|\n\s*[-=]{3,}\s*\n|\n\s*\*{3,}\s*\n/);
        
        if (sections.length > 1) {
          sections.forEach((section, index) => {
            const cleanText = section.trim();
            // Check if section contains job-related keywords
            const hasJobKeywords = /(?:job|position|role|career|hiring|work|employment|salary|company|responsibilities|requirements|qualifications)/i.test(cleanText);
            
            if (cleanText.length > 100 && hasJobKeywords) {
              jobPostings.push({
                text: cleanText,
                source: 'separator_split',
                data: { 
                  sectionIndex: index,
                  extractionMethod: 'separator_splitting'
                }
              });
            }
          });
          foundJobs = true;
        }
      }
      
      // Final fallback: use entire page as single job posting
      if (!foundJobs) {
        console.log('Individual job extraction failed, using entire page content as single job posting');
        jobPostings.push({
          text: pageText,
          source: 'full_page_fallback',
          data: { fullPageText: true }
        });
      }
    }
    
    console.log(`Extracted ${jobPostings.length} job posting(s) for analysis`);
    return jobPostings;
  }
  
  generateAggregatedReasons(analysisResults, fraudCount, totalPostings) {
    const reasons = [];
    
    if (fraudCount === 0) {
      reasons.push('All job postings appear legitimate');
      return reasons;
    }
    
    const fraudPercentage = Math.round((fraudCount / totalPostings) * 100);
    
    if (fraudCount === totalPostings) {
      reasons.push(`All ${totalPostings} job posting${totalPostings > 1 ? 's' : ''} detected as fraudulent`);
    } else {
      reasons.push(`${fraudCount} out of ${totalPostings} job postings detected as fraudulent (${fraudPercentage}%)`);
    }
    
    // Collect unique fraud indicators from individual results
    const fraudIndicators = new Set();
    analysisResults.forEach(result => {
      if (result.isFraud && result.reasons) {
        result.reasons.forEach(reason => fraudIndicators.add(reason));
      }
    });
    
    if (fraudIndicators.size > 0) {
      reasons.push('Common fraud indicators found:');
      Array.from(fraudIndicators).slice(0, 5).forEach(indicator => {
        reasons.push(`• ${indicator}`);
      });
    }
    
    return reasons;
  }
  
  async storeAnalysisResult(url, analysis) {
    try {
      // Store in memory for popup access
      if (!this.analysisCache) {
        this.analysisCache = new Map();
      }
      
      this.analysisCache.set(url, {
        analysis,
        timestamp: new Date().toISOString()
      });
      
      // Clean old entries (keep only last 10)
      if (this.analysisCache.size > 10) {
        const entries = Array.from(this.analysisCache.entries());
        entries.sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp));
        
        this.analysisCache.clear();
        entries.slice(0, 10).forEach(([key, value]) => {
          this.analysisCache.set(key, value);
        });
      }
      
      // Also store in Firebase for analytics
      await this.firebaseManager.addDocument('analysis_results', {
        urlHash: this.firebaseManager.hashURL(url),
        method: analysis.method,
        isFraud: analysis.isFraud,
        confidence: analysis.confidence,
        riskLevel: analysis.riskLevel,
        needsManualReview: analysis.needsManualReview || false,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to store analysis result:', error);
    }
  }
  
  async handleAnalysisComplete(data) {
    try {
      console.log('Analysis completed for:', data.url);
      
      // Update badge based on analysis result
      const analysis = data.analysis;
      let badgeText = '';
      let badgeColor = '#666666';
      
      if (analysis.isFraud) {
        badgeText = '⚠️';
        badgeColor = analysis.method === 'domain_blacklist' ? '#dc2626' : '#ea580c';
      } else if (analysis.needsManualReview) {
        badgeText = '?';
        badgeColor = '#f59e0b';
      } else {
        badgeText = '✓';
        badgeColor = '#16a34a';
      }
      
      // Get the tab ID for this URL
      const tabs = await chrome.tabs.query({ url: data.url });
      if (tabs.length > 0) {
        await chrome.action.setBadgeText({ text: badgeText, tabId: tabs[0].id });
        await chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId: tabs[0].id });
      }
    } catch (error) {
      console.warn('Failed to handle analysis completion:', error);
    }
  }
  
  async analyzePageForFraud(tabId, url, content) {
    try {
      console.log('Starting fraud analysis for:', url);
      
      const domain = new URL(url).hostname;
      let analysisResult = {
        url,
        domain,
        analyzedAt: new Date().toISOString(),
        tabId,
        networkStatus: navigator.onLine ? 'online' : 'offline'
      };

      // Step 1: Check domain blacklist first (with enhanced error handling)
      console.log('Checking domain blacklist...');
      const domainResult = await this.checkDomainFraud(domain);
      
      if (domainResult.isFraudulent) {
        analysisResult = {
          ...analysisResult,
          ...domainResult,
          reason: 'Domain found in fraud blacklist'
        };
        
        // Cache result and notify content script
        this.analysisCache.set(tabId, analysisResult);
        await this.notifyContentScript(tabId, analysisResult);
        return analysisResult;
      }
      
      // Handle domain check errors gracefully
      if (domainResult.fallbackUsed) {
        console.warn('Domain check used fallback due to error:', domainResult.error);
      }

      // Step 2: Analyze content with NLP if domain is clean
      console.log('Domain clean, analyzing content with NLP...');
      const nlpResult = await this.analyzeContentWithNLP(content, url);
      
      // Handle NLP analysis results (including errors)
      if (nlpResult.method === 'nlp_analysis_failed') {
        console.warn('NLP analysis failed, determining fallback action:', nlpResult.fallbackAction);
        
        let fallbackReason = 'Automated analysis unavailable';
        let fallbackMethod = 'manual_review_required';
        
        switch (nlpResult.fallbackAction) {
          case 'offline_mode':
            fallbackReason = 'Network connection unavailable - manual review recommended';
            fallbackMethod = 'offline_fallback';
            break;
          case 'retry_later':
            fallbackReason = 'Analysis timed out - please try again later';
            fallbackMethod = 'timeout_fallback';
            break;
          case 'domain_check_only':
            fallbackReason = 'NLP model unavailable - domain check completed only';
            fallbackMethod = 'domain_only_fallback';
            break;
          default:
            fallbackReason = 'Technical error occurred - manual review needed';
        }
        
        analysisResult = {
          ...analysisResult,
          isFraudulent: false,
          confidence: 0,
          method: fallbackMethod,
          reason: fallbackReason,
          error: nlpResult.error,
          errorType: nlpResult.errorType,
          fallbackAction: nlpResult.fallbackAction
        };
      } else {
        // Successful NLP analysis
        analysisResult = {
          ...analysisResult,
          ...nlpResult,
          reason: nlpResult.isFraudulent ? 
            `NLP analysis detected fraud (confidence: ${(nlpResult.confidence * 100).toFixed(1)}%)` :
            'Content appears legitimate based on NLP analysis'
        };
        
        // Add warning if using expired model data
        if (nlpResult.modelExpired) {
          analysisResult.warning = 'Analysis performed with expired model data due to network issues';
        }
      }

      // Cache result and notify content script
      this.analysisCache.set(tabId, analysisResult);
      await this.notifyContentScript(tabId, analysisResult);
      
      return analysisResult;
      
    } catch (error) {
      console.error('Page analysis failed:', error);
      
      const errorResult = {
        url,
        domain: new URL(url).hostname,
        isFraudulent: false,
        confidence: 0,
        method: 'analysis_failed',
        reason: 'Critical analysis failure - manual review required',
        error: error.message,
        analyzedAt: new Date().toISOString(),
        tabId,
        networkStatus: navigator.onLine ? 'online' : 'offline'
      };
      
      this.analysisCache.set(tabId, errorResult);
      await this.notifyContentScript(tabId, errorResult);
      return errorResult;
    }
  }
  
  // Analyze content using NLP model with enhanced error handling
  async analyzeContentWithNLP(content, url) {
    try {
      // Check network connectivity first
      if (!navigator.onLine) {
        throw new Error('No network connection available for NLP analysis');
      }

      // Get model data from Firebase with timeout
      const modelDataTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Model data fetch timeout')), 30000)
      );
      
      const modelData = await Promise.race([
        this.modelManager.fetchModelData(),
        modelDataTimeout
      ]);
      
      if (!modelData.model || !modelData.vectorizer) {
        throw new Error('Model or vectorizer data not available');
      }

      // Check if model data is expired and warn user
      if (modelData.metadata?.isExpired) {
        console.warn('Using expired model data due to network issues');
      }

      // Send content to NLP service for analysis with timeout
      const analysisTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('NLP analysis timeout')), 25000)
      );
      
      const response = await Promise.race([
        fetch('http://localhost:8080/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: content,
            url: url,
            model_data: modelData.model,
            vectorizer_data: modelData.vectorizer
          })
        }),
        analysisTimeout
      ]);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`NLP service error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      return {
        isFraudulent: result.is_fraudulent,
        confidence: result.confidence,
        method: 'nlp_analysis',
        features: result.features,
        modelAccuracy: modelData.metadata?.accuracy,
        analyzedAt: new Date().toISOString(),
        networkStatus: 'online',
        modelExpired: modelData.metadata?.isExpired || false
      };
      
    } catch (error) {
      console.error('NLP analysis failed:', error);
      
      // Provide detailed error information for different failure types
      let errorType = 'unknown_error';
      let fallbackAction = 'manual_review_required';
      
      if (error.message.includes('network') || error.message.includes('fetch')) {
        errorType = 'network_error';
        fallbackAction = 'offline_mode';
      } else if (error.message.includes('timeout')) {
        errorType = 'timeout_error';
        fallbackAction = 'retry_later';
      } else if (error.message.includes('Model') || error.message.includes('vectorizer')) {
        errorType = 'model_unavailable';
        fallbackAction = 'domain_check_only';
      } else if (error.message.includes('NLP service')) {
        errorType = 'service_error';
        fallbackAction = 'manual_review_required';
      }
      
      return {
        isFraudulent: false,
        confidence: 0,
        method: 'nlp_analysis_failed',
        error: error.message,
        errorType,
        fallbackAction,
        analyzedAt: new Date().toISOString(),
        networkStatus: navigator.onLine ? 'online' : 'offline'
      };
    }
  }
  
  // Check if domain is in fraud list with enhanced error handling
  async checkDomainFraud(domain) {
    try {
      const result = await this.modelManager.isDomainFraudulent(domain);
      return {
        isFraudulent: result.isFraudulent,
        method: 'domain_blacklist',
        confidence: result.isFraudulent ? 0.95 : 0.1,
        domain: result.domain,
        checkedAt: result.checkedAt,
        networkStatus: navigator.onLine ? 'online' : 'offline'
      };
    } catch (error) {
      console.error('Error checking domain fraud:', error);
      
      // Provide fallback behavior based on error type
      let fallbackConfidence = 0;
      let fallbackMethod = 'domain_blacklist_error';
      
      if (error.message.includes('network') || error.message.includes('timeout')) {
        fallbackMethod = 'domain_blacklist_network_error';
        console.warn('Network error during domain check, using fallback');
      }
      
      return {
        isFraudulent: false,
        method: fallbackMethod,
        confidence: fallbackConfidence,
        error: error.message,
        domain,
        networkStatus: navigator.onLine ? 'online' : 'offline',
        fallbackUsed: true
      };
    }
  }
  
  async reportNewFraudDomain(domain, reason) {
    try {
      // Use ModelManager to report new fraud domain
      if (this.modelManager) {
        await this.modelManager.reportNewFraudDomain(domain, reason);
        
        return {
          success: true,
          message: 'Domain reported successfully'
        };
      } else {
        throw new Error('ModelManager not available');
      }
    } catch (error) {
      console.error('Error reporting new fraud domain:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  getAnalysisResult(url) {
    if (this.analysisCache && this.analysisCache.has(url)) {
      return this.analysisCache.get(url);
    }
    return null;
  }
  
  // Submit user feedback for fraud detection accuracy
  async submitUserFeedback(feedbackData) {
    try {
      // Add additional metadata
      const enrichedFeedback = {
        ...feedbackData,
        extensionVersion: chrome.runtime.getManifest().version,
        submittedAt: new Date().toISOString(),
        sessionId: this.generateSessionId()
      };
      
      // Store feedback in Firebase
      const result = await this.modelManager.storeUserFeedback(enrichedFeedback);
      
      console.log('User feedback submitted successfully:', result.id);
      
      // Update local analytics if needed
      this.updateFeedbackAnalytics(feedbackData);
      
      return { success: true, feedbackId: result.id };
      
    } catch (error) {
      console.error('Error submitting user feedback:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Generate a session ID for tracking user interactions
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Update local feedback analytics
  updateFeedbackAnalytics(feedbackData) {
    try {
      // Store feedback stats locally for quick access
      const stats = {
        feedbackType: feedbackData.feedbackType,
        domain: feedbackData.domain,
        timestamp: feedbackData.timestamp
      };
      
      // You could store this in chrome.storage.local for analytics dashboard
      chrome.storage.local.get(['feedbackStats'], (result) => {
        const existingStats = result.feedbackStats || [];
        existingStats.push(stats);
        
        // Keep only last 100 feedback entries locally
        if (existingStats.length > 100) {
          existingStats.splice(0, existingStats.length - 100);
        }
        
        chrome.storage.local.set({ feedbackStats: existingStats });
      });
      
    } catch (error) {
      console.error('Error updating feedback analytics:', error);
    }
  }
  
  // Process manual fraud report from user
  async processManualFraudReport(data) {
    try {
      console.log('Processing manual fraud report:', data);
      
      // Store the manual feedback in Firebase for training data
      const reportData = {
        url: data.url,
        domain: data.domain,
        isFraud: data.isFraud,
        timestamp: data.timestamp,
        userAgent: 'FraudBuster Extension',
        reportType: 'manual_feedback',
        pageData: data.pageData || null
      };
      
      // Store in Firebase using new Firestore collections
      await this.storeUserFeedback(reportData);
      
      // If reporting as fraud, also add domain to fraud reports if not already there
      if (data.isFraud && data.domain) {
        try {
          const isDomainFraudulent = await this.modelManager.isDomainFraudulent(data.domain);
          if (!isDomainFraudulent) {
            await this.modelManager.reportNewFraudDomain({
              domain: data.domain,
              reason: 'user_manual_report',
              reportedBy: 'extension_user',
              timestamp: data.timestamp
            });
            console.log(`Added domain ${data.domain} to fraud list based on user report`);
          }
        } catch (error) {
          console.error('Error adding domain to fraud list:', error);
        }
      }
      
      // Update local analysis cache with user feedback
      const tabId = await this.getCurrentTabId();
      if (tabId) {
        const existingAnalysis = this.analysisCache.get(tabId);
        if (existingAnalysis) {
          existingAnalysis.userFeedback = {
            isFraud: data.isFraud,
            timestamp: data.timestamp
          };
          existingAnalysis.method = 'user_feedback';
          this.analysisCache.set(tabId, existingAnalysis);
        }
      }
      
      return { success: true, message: 'Manual fraud report processed successfully' };
      
    } catch (error) {
      console.error('Error processing manual fraud report:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Helper method to get current active tab ID
  async getCurrentTabId() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab ? tab.id : null;
    } catch (error) {
      console.error('Error getting current tab ID:', error);
      return null;
    }
  }

  async scanPage(tabId, url, sensitivity = 5, domain = null) {
    try {
      // Check if extension is active for this domain before scanning
      if (!await isExtensionActiveForDomain(domain || extractDomainFromUrl(url))) {
        console.log(`FraudBuster: Extension inactive for domain ${domain} - scan cancelled`);
        return { success: false, error: 'Extension is not active for this domain' };
      }
      
      // Wait for initialization to complete if not already initialized
      if (!this.isInitialized) {
        console.log('Waiting for background service initialization...');
        try {
          await this.initializationPromise;
          if (!this.isInitialized) {
            throw new Error('Background service initialization failed');
          }
        } catch (initError) {
          console.error('Initialization failed:', initError);
          throw new Error('Background service not initialized: ' + initError.message);
        }
      }

      // Extract page content using content script
      const pageData = await this.extractPageData(tabId);
      
      // Get community data from Firebase
      const communityData = await this.getCommunityData(url);
      
      // Run ML analysis
      const mlResult = await this.mlModel.predict(pageData);
      
      // Calculate overall risk score
      const overallRisk = this.calculateOverallRisk(mlResult, communityData, sensitivity);
      
      // Store scan result
      await this.storeScanResult(url, overallRisk, mlResult, communityData);
      
      return {
        success: true,
        results: {
          overallRisk: overallRisk,
          mlConfidence: mlResult.confidence,
          communityReports: communityData.reports,
          totalReports: communityData.totalReports,
          isBlacklisted: communityData.isBlacklisted,
          features: mlResult.features,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Scan error:', error);
      return { success: false, error: error.message };
    }
  }

  async extractPageData(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: 'extractPageData' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error('Failed to extract page data'));
        }
      });
    });
  }

  async getCommunityData(url) {
    try {
      const urlHash = this.firebaseManager.hashURL(url);
      const documents = await this.firebaseManager.getDocuments(
        'url_reports',
        { field: 'urlHash', operator: '==', value: urlHash }
      );
      
      let reports = 0;
      let totalReports = 0;
      let isBlacklisted = false;
      
      documents.forEach((doc) => {
        reports += doc.reports || 0;
        totalReports += doc.totalVotes || 0;
        if (doc.isBlacklisted) {
          isBlacklisted = true;
        }
      });
      
      return {
        reports,
        totalReports,
        isBlacklisted
      };
    } catch (error) {
      console.error('Error getting community data:', error);
      return { reports: 0, totalReports: 0, isBlacklisted: false };
    }
  }

  calculateOverallRisk(mlResult, communityData, sensitivity) {
    const mlWeight = 0.6;
    const communityWeight = 0.4;
    
    // Adjust ML score based on sensitivity (1-10 scale)
    const sensitivityMultiplier = sensitivity / 5; // Normalize to 0.2-2.0 range
    const adjustedMLScore = Math.min(mlResult.riskScore * sensitivityMultiplier, 1);
    
    // Calculate community risk score
    let communityRisk = 0;
    if (communityData.isBlacklisted) {
      communityRisk = 1;
    } else if (communityData.totalReports > 0) {
      communityRisk = Math.min(communityData.reports / communityData.totalReports, 1);
    }
    
    // Combine scores
    const overallRisk = (adjustedMLScore * mlWeight) + (communityRisk * communityWeight);
    
    return Math.min(overallRisk, 1);
  }

  async storeScanResult(url, riskScore, mlResult, communityData) {
    try {
      await this.firebaseManager.addDocument('scan_results', {
        urlHash: this.firebaseManager.hashURL(url),
        riskScore,
        mlConfidence: mlResult.confidence,
        features: mlResult.features,
        communityReports: communityData.reports,
        userAgent: navigator.userAgent
      });
    } catch (error) {
      console.error('Error storing scan result:', error);
    }
  }

  async reportURL(url, reason) {
    try {
      const urlHash = this.firebaseManager.hashURL(url);
      const timestamp = new Date().toISOString();
      
      // Add detailed report to Firebase with full URL and metadata
      await this.firebaseManager.addDocument('user_reports', {
        urlHash,
        fullUrl: url, // Store the complete URL for reference
        reason,
        userAgent: navigator.userAgent,
        timestamp: timestamp,
        reportedBy: this.userId || 'anonymous',
        domain: new URL(url).hostname,
        reportType: 'user_report'
      });
      
      // Also add to fraud_urls collection for immediate blacklisting
      await this.firebaseManager.addDocument('fraud_urls', {
        url: url,
        domain: new URL(url).hostname,
        reason: reason,
        reportedAt: timestamp,
        reportedBy: this.userId || 'anonymous',
        status: 'reported',
        source: 'user_report'
      });
      
      // Check if URL report entry exists
      const existingReports = await this.firebaseManager.getDocuments(
        'url_reports',
        { field: 'urlHash', operator: '==', value: urlHash }
      );
      
      if (existingReports.length === 0) {
        // Create new report entry
        await this.firebaseManager.addDocument('url_reports', {
          urlHash,
          fullUrl: url,
          domain: new URL(url).hostname,
          reports: 1,
          totalVotes: 1,
          isBlacklisted: true, // Automatically blacklist reported URLs
          firstReportedAt: timestamp,
          lastReportedAt: timestamp
        });
      } else {
        // Update existing entry
        const doc = existingReports[0];
        await this.firebaseManager.incrementField('url_reports', doc.id, 'reports', 1);
        await this.firebaseManager.incrementField('url_reports', doc.id, 'totalVotes', 1);
        await this.firebaseManager.updateDocument('url_reports', doc.id, {
          isBlacklisted: true,
          lastReportedAt: timestamp
        });
      }
      
      console.log(`✅ Successfully reported URL to Firebase: ${url}`);
      return { success: true, message: 'URL reported and added to fraud database' };
    } catch (error) {
      console.error('Error reporting URL:', error);
      return { success: false, error: error.message };
    }
  }

  async voteURL(url, voteType) {
    try {
      const urlHash = this.firebaseManager.hashURL(url);
      
      // Get the user's anonymous ID
      const result = await chrome.storage.sync.get(['anonymousUserId']);
      if (!result.anonymousUserId) {
        return { success: false, error: 'User not registered. Please reload the extension.' };
      }
      
      const anonymousUserId = result.anonymousUserId;
      
      // Check if user has already voted on this URL
      const voteStatus = await this.checkUserVote(url);
      
      if (voteStatus.hasVoted) {
        if (voteStatus.voteType === voteType) {
          return { 
            success: false, 
            error: `You have already ${voteType}d this URL.` 
          };
        } else {
          // User is changing their vote - update existing vote
          await this.firebaseManager.updateDocument('user_votes', voteStatus.voteId, {
            voteType: voteType,
            timestamp: new Date().toISOString()
          });
          
          // Update URL reports - adjust counts for vote change
          const existingReports = await this.firebaseManager.getDocuments(
            'url_reports',
            { field: 'urlHash', operator: '==', value: urlHash }
          );
          
          if (existingReports.length > 0) {
            const doc = existingReports[0];
            
            // Adjust report counts based on vote change
            if (voteStatus.voteType === 'downvote' && voteType === 'upvote') {
              // Changed from downvote to upvote - decrease reports
              await this.firebaseManager.incrementField('url_reports', doc.id, 'reports', -1);
            } else if (voteStatus.voteType === 'upvote' && voteType === 'downvote') {
              // Changed from upvote to downvote - increase reports
              await this.firebaseManager.incrementField('url_reports', doc.id, 'reports', 1);
            }
          }
          
          return { success: true, message: `Vote changed to ${voteType} successfully!` };
        }
      }
      
      // Add new vote to Firebase with anonymous user ID
      await this.firebaseManager.addDocument('user_votes', {
        urlHash,
        voteType, // 'upvote' or 'downvote'
        anonymousUserId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent // Keep for analytics but use anonymousUserId for identification
      });
      
      // Check if URL report entry exists
      const existingReports = await this.firebaseManager.getDocuments(
        'url_reports',
        { field: 'urlHash', operator: '==', value: urlHash }
      );
      
      if (existingReports.length === 0) {
        // Create new report entry
        await this.firebaseManager.addDocument('url_reports', {
          urlHash,
          reports: voteType === 'downvote' ? 1 : 0,
          totalVotes: 1,
          isBlacklisted: false
        });
      } else {
        // Update existing entry
        const doc = existingReports[0];
        await this.firebaseManager.incrementField('url_reports', doc.id, 'totalVotes', 1);
        
        if (voteType === 'downvote') {
          await this.firebaseManager.incrementField('url_reports', doc.id, 'reports', 1);
        }
      }
      
      return { success: true, message: 'Vote recorded successfully!' };
    } catch (error) {
      console.error('Error voting on URL:', error);
      return { success: false, error: error.message };
    }
  }

  async checkUserVote(url) {
    try {
      const urlHash = this.firebaseManager.hashURL(url);
      
      // Get the user's anonymous ID
      const result = await chrome.storage.sync.get(['anonymousUserId']);
      if (!result.anonymousUserId) {
        return { hasVoted: false, voteType: null }; // User not registered, so no vote exists
      }
      
      const anonymousUserId = result.anonymousUserId;
      
      // Check if user has already voted on this URL
      const existingVotes = await this.firebaseManager.getDocuments(
        'user_votes',
        { field: 'urlHash', operator: '==', value: urlHash }
      );
      
      // Filter votes by this specific user
      const userExistingVote = existingVotes.find(vote => vote.anonymousUserId === anonymousUserId);
      
      if (userExistingVote) {
        return { 
          hasVoted: true, 
          voteType: userExistingVote.voteType,
          voteId: userExistingVote.id 
        };
      }
      
      return { hasVoted: false, voteType: null };
    } catch (error) {
      console.error('Error checking user vote:', error);
      return { hasVoted: false, voteType: null }; // On error, assume no vote to allow voting
    }
  }

  async handleTabUpdate(tabId, tab) {
    try {
      // Check if auto-scan is enabled
      const result = await chrome.storage.sync.get(['autoScan']);
      const domain = extractDomainFromUrl(tab.url);
        
        if (result.autoScan && await isExtensionActiveForDomain(domain) && tab.url && 
          (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        
        // Wait a bit for page to load completely
        setTimeout(async () => {
          try {
            await this.scanPage(tabId, tab.url, 5, domain);
            
            // Optionally notify user of auto-scan results
            // This could be implemented as a badge or notification
          } catch (error) {
            console.error('Auto-scan error:', error);
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error in tab update handler:', error);
    }
  }

  async getJobDetectionData() {
    try {
      console.log('Fetching job detection data from Firebase...');
      
      // Get job keywords and fraud patterns from the fraud detector
      if (this.fraudDetector && this.fraudDetector.isInitialized) {
        const detectorStatus = this.fraudDetector.getStatus();
        const modelMetadata = detectorStatus.modelMetadata;
        
        if (modelMetadata && modelMetadata.features) {
          // Extract job-related keywords from model features
          const jobKeywords = modelMetadata.features.filter(feature => 
            feature.toLowerCase().includes('job') ||
            feature.toLowerCase().includes('work') ||
            feature.toLowerCase().includes('career') ||
            feature.toLowerCase().includes('position') ||
            feature.toLowerCase().includes('employment') ||
            feature.toLowerCase().includes('hiring')
          );
          
          // Get fraud patterns from the detector
          const fraudPatterns = this.fraudDetector.getFraudPatterns ? 
            this.fraudDetector.getFraudPatterns() : {};
          
          return {
            success: true,
            data: {
              jobKeywords: jobKeywords.length > 0 ? jobKeywords : this.getFallbackJobKeywords(),
              fraudPatterns: fraudPatterns
            }
          };
        }
      }
      
      // Fallback: return default job keywords
      return {
        success: true,
        data: {
          jobKeywords: this.getFallbackJobKeywords(),
          fraudPatterns: this.getFallbackFraudPatterns()
        }
      };
      
    } catch (error) {
      console.error('Error fetching job detection data:', error);
      
      // Return fallback data on error
      return {
        success: true,
        data: {
          jobKeywords: this.getFallbackJobKeywords(),
          fraudPatterns: this.getFallbackFraudPatterns()
        }
      };
    }
  }

  getFallbackJobKeywords() {
    return [
      // Basic job terms
      'job', 'position', 'career', 'employment', 'hiring', 'vacancy', 'opening',
      // Job titles and roles
      'engineer', 'developer', 'manager', 'analyst', 'specialist', 'coordinator',
      'assistant', 'associate', 'director', 'supervisor', 'representative',
      'consultant', 'technician', 'administrator', 'executive', 'officer',
      // Work arrangements
      'work from home', 'remote', 'freelance', 'part-time', 'full-time',
      'contract', 'temporary', 'permanent', 'internship',
      // Action words in job titles
      'earn', 'make money', 'income', 'opportunity', 'hiring now', 'apply now',
      // Common job fields
      'software', 'marketing', 'sales', 'customer service', 'data', 'finance',
      'accounting', 'human resources', 'operations', 'project', 'business',
      // Additional job-related terms
      'recruiter', 'recruitment', 'candidate', 'applicant', 'resume', 'cv',
      'interview', 'salary', 'benefits', 'company', 'employer', 'team'
    ];
  }

  getFallbackFraudPatterns() {
    return {
      suspicious: [
        'easy money', 'guaranteed income', 'no experience required',
        'mystery shopper', 'data entry', 'envelope stuffing',
        'work from phone', 'copy paste work', 'make money fast',
        'earn $500 daily', 'no skills needed', 'instant pay'
      ],
      legitimate: [
        'benefits package', 'health insurance', '401k', 'pto',
        'professional development', 'career growth', 'team environment'
      ]
    };
  }

  async getSessionDataFromStorage() {
    try {
      return new Promise((resolve) => {
        chrome.storage.session.get(null, (result) => {
          if (chrome.runtime.lastError) {
            console.error('Error getting session data from storage:', {
              message: chrome.runtime.lastError?.message || 'Unknown storage error',
              error: chrome.runtime.lastError
            });
            resolve({});
          } else {
            resolve(result || {});
          }
        });
      });
    } catch (error) {
      console.error('Error in getSessionDataFromStorage:', error);
      return {};
    }
  }

  checkDomainStatus(domain) {
    try {
      if (!domain) {
        return 'Unknown';
      }
      
      // Clean the domain (remove protocol, www, etc.)
      const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').toLowerCase();
      
      if (!Array.isArray(this.cachedData.urlList) || this.cachedData.urlList.length === 0) {
        console.log('No URL database loaded, domain status unknown');
        return 'Unknown';
      }
      
      // Check if domain is in fraud database
      const isFraudulent = this.cachedData.urlList.some(fraudUrl => {
        const cleanFraudUrl = fraudUrl.replace(/^(https?:\/\/)?(www\.)?/, '').toLowerCase();
        return cleanFraudUrl === cleanDomain || cleanDomain.includes(cleanFraudUrl) || cleanFraudUrl.includes(cleanDomain);
      });
      
      if (isFraudulent) {
        console.log(`Domain ${cleanDomain} found in fraud database`);
        return 'Fraudulent';
      }
      
      console.log(`Domain ${cleanDomain} not found in fraud database - Clean`);
      return 'Clean';
    } catch (error) {
      console.error('Error checking domain status:', error);
      return 'Unknown';
    }
  }

  async getSessionData(currentDomain = null) {
    try {
      // Get session data from chrome.storage.session
      const sessionData = await this.getSessionDataFromStorage();
      
      // Get cached data counts
      let nlpRulesCount = 0;
      let urlListingCount = 0;
      
      console.log('Getting session data - cached data status:', {
        hasCachedData: !!this.cachedData,
        hasNlpModel: !!this.cachedData?.nlpModel,
        hasUrlList: !!this.cachedData?.urlList,
        nlpModelStructure: this.cachedData?.nlpModel ? Object.keys(this.cachedData.nlpModel) : null,
        urlListLength: this.cachedData?.urlList?.length || 0
      });
      
      if (this.cachedData) {
        // Count NLP rules if available
        if (this.cachedData.nlpModel && this.cachedData.nlpModel.rules) {
          nlpRulesCount = typeof this.cachedData.nlpModel.rules === 'number' ? 
            this.cachedData.nlpModel.rules : 
            (Array.isArray(this.cachedData.nlpModel.rules) ? 
              this.cachedData.nlpModel.rules.length : 
              Object.keys(this.cachedData.nlpModel.rules).length);
          console.log('NLP rules found:', nlpRulesCount);
        } else if (this.cachedData.nlpModel && this.cachedData.nlpModel.patterns) {
          nlpRulesCount = Array.isArray(this.cachedData.nlpModel.patterns) ? 
            this.cachedData.nlpModel.patterns.length : 
            Object.keys(this.cachedData.nlpModel.patterns).length;
          console.log('NLP patterns found:', nlpRulesCount);
        } else {
          console.log('No NLP rules or patterns found in cached data');
        }
        
        // Count URL listings if available
        if (this.cachedData.urlList) {
          urlListingCount = Array.isArray(this.cachedData.urlList) ? 
            this.cachedData.urlList.length : 
            Object.keys(this.cachedData.urlList).length;
          console.log('URL listings found:', urlListingCount);
        } else {
          console.log('No URL list found in cached data');
        }
      } else {
        console.log('No cached data available');
      }
      
      // Check domain status if domain is provided
      const domainStatus = currentDomain ? this.checkDomainStatus(currentDomain) : 'Unknown';
      
      return {
        success: true,
        data: {
          sessionId: this.sessionId,
          sessionInitialized: this.sessionInitialized,
          lastDataFetch: this.lastDataFetch,
          nlpRulesCount: nlpRulesCount,
          urlListingCount: urlListingCount,
          domainStatus: domainStatus,
          cacheStatus: this.cachedData ? 'loaded' : 'empty'
        }
      };
    } catch (error) {
      console.error('Error getting session data:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return {
        success: false,
        error: error.message || 'Unknown error occurred',
        data: {
          sessionId: this.sessionId || 'unknown',
          sessionInitialized: false,
          lastDataFetch: null,
          nlpRulesCount: 0,
          urlListingCount: 0,
          domainStatus: 'Unknown',
          cacheStatus: 'error'
        }
      };
    }
  }

  // First launch detection method
  async checkFirstLaunch() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['firstLaunch'], (result) => {
        if (result.firstLaunch === undefined) {
          // First launch - set flag and add delay
          chrome.storage.local.set({ firstLaunch: false });
          console.log('First launch detected - initializing extension...');
          // Add extra delay for first launch to show loading screen
          setTimeout(resolve, 1000);
        } else {
          resolve();
        }
      });
    });
  }

  // Notify popup about loading progress
  notifyLoadingProgress(message, progress) {
    try {
      chrome.runtime.sendMessage({
        action: 'loadingProgress',
        message: message,
        progress: progress
      }).catch(() => {
        // Ignore errors if popup is not open
      });
    } catch (error) {
      // Ignore errors if popup is not open
    }
  }

  // New methods for enhanced Firestore integration

  async storeAnalysisResult(analysis, jobText, pageUrl) {
    try {
      if (!this.firebaseManager) {
        console.warn('Firebase Manager not available, skipping analysis result storage');
        return;
      }

      // Get anonymous user ID
      const result = await chrome.storage.sync.get(['anonymousUserId']);
      const anonymousUserId = result.anonymousUserId || 'unknown';

      const analysisData = {
        userId: anonymousUserId,
        url: pageUrl,
        domain: pageUrl ? new URL(pageUrl).hostname : null,
        jobText: jobText.substring(0, 1000), // Store first 1000 chars for analysis
        isFraud: analysis.isFraud,
        confidence: analysis.confidence,
        method: analysis.method,
        fraudPercentage: analysis.fraudPercentage,
        reasons: analysis.reasons || [],
        flags: analysis.flags || [],
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        extensionVersion: chrome.runtime.getManifest().version
      };

      await this.firebaseManager.saveAnalysisResult(analysisData);
      console.log('Analysis result stored in Firestore successfully');
    } catch (error) {
      console.error('Error storing analysis result:', error);
    }
  }

  async storeUserFeedback(feedbackData) {
    try {
      if (!this.firebaseManager) {
        console.warn('Firebase Manager not available, skipping user feedback storage');
        return;
      }

      // Get anonymous user ID
      const result = await chrome.storage.sync.get(['anonymousUserId']);
      const anonymousUserId = result.anonymousUserId || 'unknown';

      const enhancedFeedbackData = {
        ...feedbackData,
        userId: anonymousUserId,
        extensionVersion: chrome.runtime.getManifest().version,
        browserInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform
        }
      };

      // Store in analysisResults collection with feedback flag
      await this.firebaseManager.saveAnalysisResult({
        ...enhancedFeedbackData,
        isUserFeedback: true,
        feedbackType: feedbackData.reportType
      });

      console.log('User feedback stored in Firestore successfully');
    } catch (error) {
      console.error('Error storing user feedback:', error);
    }
  }

  async storePageClassification(classificationData) {
    try {
      if (!this.firebaseManager) {
        console.warn('Firebase Manager not available, skipping page classification storage');
        return;
      }

      // Get anonymous user ID
      const result = await chrome.storage.sync.get(['anonymousUserId']);
      const anonymousUserId = result.anonymousUserId || 'unknown';

      const pageClassificationData = {
        userId: anonymousUserId,
        url: classificationData.url,
        domain: classificationData.domain,
        pageType: classificationData.pageType,
        confidence: classificationData.confidence,
        shouldAnalyze: classificationData.shouldAnalyze,
        method: classificationData.method,
        scores: classificationData.scores || {},
        timestamp: new Date().toISOString(),
        extensionVersion: chrome.runtime.getManifest().version
      };

      await this.firebaseManager.savePageClassification(pageClassificationData);
      console.log('Page classification stored in Firestore successfully');
    } catch (error) {
      console.error('Error storing page classification:', error);
    }
  }

  async getLearningMetrics() {
    try {
      if (!this.dynamicLearningEngine) {
        return {
          success: false,
          error: 'Learning system not available'
        };
      }

      const metrics = await this.dynamicLearningEngine.getMetrics();
      
      return {
        success: true,
        metrics: {
          totalFeedback: metrics.totalFeedback || 0,
          accuracyRate: metrics.accuracyRate || 0,
          patternsLearned: metrics.patternsLearned || 0,
          lastUpdate: metrics.lastUpdate || null,
          systemActive: true
        }
      };
    } catch (error) {
      console.error('Error getting learning metrics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Initialize the background service
let fraudBusterBackground = null;

// Function to ensure background service is initialized
function ensureBackgroundService() {
  if (!fraudBusterBackground) {
    console.log('Creating new FraudBuster background service instance');
    fraudBusterBackground = new FraudBusterBackground();
  }
  return fraudBusterBackground;
}

// Initialize on startup
ensureBackgroundService();

// Handle extension installation and startup events
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      extensionActive: false,
      autoScan: false,
      sensitivity: 5,
      darkMode: 'auto',
      userContributions: 0
    });
    
    console.log('FraudBuster extension installed');
  }
  
  // Ensure service is initialized after installation/update
  ensureBackgroundService();
});

// Handle service worker startup (Chrome extensions)
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension startup detected');
  ensureBackgroundService();
});

// Handle service worker wake-up from suspension
self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
  event.waitUntil(
    Promise.resolve().then(() => {
      ensureBackgroundService();
    })
  );
});

// Ensure service is available when messages are received
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // This listener ensures the service worker stays active
  // The actual message handling is done in the FraudBusterBackground class
  ensureBackgroundService();
  return false; // Let the class handle the message
});

// Helper functions for domain-based extension state
function extractDomainFromUrl(url) {
  try {
    if (!url) return null;
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Error extracting domain from URL:', error);
    return null;
  }
}

async function isExtensionActiveForDomain(domain) {
  try {
    if (!domain) return false;
    
    const result = await chrome.storage.sync.get(['domainStates']);
    const domainStates = result.domainStates || {};
    
    return domainStates[domain] || false;
  } catch (error) {
    console.error('Error checking domain state:', error);
    return false;
  }
}

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FraudBusterBackground;
}