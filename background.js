// FraudBuster Background Service Worker
// Load Firebase configuration and fraud detection system
importScripts('firebase-config.js');
importScripts('fraud-detector.js');

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
    
    this.init();
    this.setupMessageListeners();
  }

  async init() {
    try {
      // Initialize Firebase using the manager
      this.firebaseManager = new FirebaseManager();
      await this.firebaseManager.initialize();
      
      // Initialize ModelManager and FraudDetector
      this.modelManager = new ModelManager(this.firebaseManager);
      this.fraudDetector = new FraudDetector(this.modelManager);
      
      // Initialize fraud detection system
      await this.initializeFraudDetection();
      
      // Initialize legacy ML model for backward compatibility
      await this.initializeMLModel();
      
      this.isInitialized = true;
      console.log('FraudBuster background service initialized');
    } catch (error) {
      console.error('Failed to initialize FraudBuster background:', error);
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
          // Validate parameters before calling scanPageComprehensive
          if (!request.data && !sender.tab) {
            sendResponse({
              success: false,
              error: 'Missing required parameters: both pageData and tab information are unavailable',
              errorType: 'INVALID_PARAMETERS'
            });
            break;
          }
          
          // Create fallback data structure if request.data is missing but we have tab info
          let pageData = request.data;
          if (!pageData && sender.tab && sender.tab.url) {
            pageData = {
              pageUrl: sender.tab.url,
              domain: new URL(sender.tab.url).hostname,
              text: '', // Empty text will trigger manual review
              source: 'popup_fallback'
            };
          }
          
          // Validate that we have at least a URL to work with
          if (!pageData && (!sender.tab || !sender.tab.url)) {
            sendResponse({
              success: false,
              error: 'Cannot perform scan: no page URL available',
              errorType: 'NO_URL_AVAILABLE'
            });
            break;
          }
          
          const scanResult = await this.scanPageComprehensive(pageData, sender.tab);
          sendResponse(scanResult);
          break;
          
        case 'analyzeJobPosting':
          const analysisResult = await this.analyzeJobPosting(request.jobText, request.pageUrl);
          sendResponse(analysisResult);
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
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async analyzeJobPosting(jobText, pageUrl = null) {
    try {
      // Check if fraud detector is available
      if (!this.fraudDetector) {
        return {
          success: false,
          error: 'Fraud detection system not available',
          errorType: 'SYSTEM_NOT_AVAILABLE',
          fallback: true
        };
      }

      // Check if fraud detector is initialized
      if (!this.fraudDetector.isInitialized) {
        return {
          success: false,
          error: 'Fraud detection models are still loading. Please try again in a moment.',
          errorType: 'MODELS_LOADING',
          fallback: true
        };
      }

      // Check if models are ready
      const status = this.fraudDetector.getStatus();
      if (status.status === 'loading') {
        return {
          success: false,
          error: 'AI models are currently loading. Please wait and try again.',
          errorType: 'MODELS_LOADING',
          progress: status.progress || 0,
          fallback: true
        };
      }

      if (status.status === 'error') {
        return {
          success: false,
          error: 'AI models failed to load. Using basic pattern detection.',
          errorType: 'MODELS_ERROR',
          fallback: true
        };
      }

      // Use comprehensive analysis with domain checking and NLP fallback
      const analysis = await this.fraudDetector.analyzeJobPosting(jobText, pageUrl);
      
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
          enhancedStatus.message = 'AI models loaded and ready';
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
    
    try {
      if (!this.isInitialized) {
        throw new Error('Background service not initialized');
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
      
      // Extract job postings from page data
      const jobPostings = this.extractJobPostings(pageData);
      
      if (jobPostings.length === 0) {
        console.log('No job postings detected on page');
        return {
          success: true,
          result: {
            hasJobPostings: false,
            message: 'No job postings detected on this page'
          }
        };
      }
      
      console.log(`Found ${jobPostings.length} job posting(s) to analyze`);
      
      // Analyze the most prominent job posting
      const primaryJobPosting = jobPostings[0];
      const analysisResult = await this.analyzeJobPosting(primaryJobPosting.text, pageUrl);
      
      if (!analysisResult.success) {
        return {
          success: false,
          error: analysisResult.error,
          errorType: analysisResult.errorType
        };
      }
      
      // Store analysis result for popup access
      await this.storeAnalysisResult(pageUrl, analysisResult.analysis);
      
      return {
        success: true,
        result: {
          hasJobPostings: true,
          jobPostingsCount: jobPostings.length,
          fraudAnalysis: analysisResult.analysis,
          pageUrl: pageUrl,
          domain: domain,
          timestamp: new Date().toISOString()
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
    
    // Fallback to page text if no structured data
    if (jobPostings.length === 0 && pageData.text && typeof pageData.text === 'string') {
      jobPostings.push({
        text: pageData.text,
        source: 'page_content',
        data: { fullPageText: true }
      });
    }
    
    return jobPostings;
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
      
      // Store in Firebase
      await this.modelManager.storeUserFeedback(reportData);
      
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

  async scanPage(tabId, url, sensitivity = 5) {
    try {
      if (!this.isInitialized) {
        throw new Error('Background service not initialized');
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
      
      // Add report to Firebase
      await this.firebaseManager.addDocument('user_reports', {
        urlHash,
        reason,
        userAgent: navigator.userAgent
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
          reports: 1,
          totalVotes: 1,
          isBlacklisted: false
        });
      } else {
        // Update existing entry
        const doc = existingReports[0];
        await this.firebaseManager.incrementField('url_reports', doc.id, 'reports', 1);
        await this.firebaseManager.incrementField('url_reports', doc.id, 'totalVotes', 1);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error reporting URL:', error);
      return { success: false, error: error.message };
    }
  }

  async voteURL(url, voteType) {
    try {
      const urlHash = this.firebaseManager.hashURL(url);
      
      // Add vote to Firebase
      await this.firebaseManager.addDocument('user_votes', {
        urlHash,
        voteType, // 'upvote' or 'downvote'
        userAgent: navigator.userAgent
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
      
      return { success: true };
    } catch (error) {
      console.error('Error voting on URL:', error);
      return { success: false, error: error.message };
    }
  }

  async handleTabUpdate(tabId, tab) {
    try {
      // Check if auto-scan is enabled
      const result = await chrome.storage.sync.get(['autoScan', 'extensionActive']);
      
      if (result.autoScan && result.extensionActive && tab.url && 
          (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
        
        // Wait a bit for page to load completely
        setTimeout(async () => {
          try {
            await this.scanPage(tabId, tab.url, 5);
            
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


}

// Initialize the background service
const fraudBusterBackground = new FraudBusterBackground();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set default settings
    chrome.storage.sync.set({
      extensionActive: true,
      autoScan: false,
      sensitivity: 5,
      darkMode: 'auto',
      userContributions: 0
    });
    
    console.log('FraudBuster extension installed');
  }
});

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FraudBusterBackground;
}