// FraudBuster Popup JavaScript
class FraudBusterPopup {
  constructor() {
    this.isExtensionActive = false;
    this.currentTab = null;
    this.currentDomain = null;
    this.scanResults = null;
    this.fraudDetectorStatus = null;
    this.jobPostings = [];
    this.fraudAnalysisResults = new Map();
    this.tabStates = new Map(); // Store state per tab ID
    this.domainStates = new Map(); // Store toggle state per domain
    this.userSettings = {
      autoScan: false,
      sensitivity: 5,
      darkMode: 'auto'
    };
    
    this.init();
  }
  
  // Get user-friendly method display text
  getMethodDisplayText(method) {
    const methodMap = {
      'domain_blacklist': 'Domain Blacklist',
      'nlp_analysis': 'AI Content Analysis',
      'manual_review_required': 'Manual Review Required',
      'analysis_failed': 'Analysis Failed',
      'nlp_analysis_failed': 'AI Analysis Failed',
      'offline_fallback': 'Offline Mode',
      'timeout_fallback': 'Timeout Fallback',
      'domain_only_fallback': 'Domain Check Only'
    };
    return methodMap[method] || method || 'Unknown';
  }
  
  // Get fallback action description
  getFallbackActionText(action) {
    const actionMap = {
      'offline_mode': 'Operating in offline mode - limited functionality',
      'retry_later': 'Service temporarily unavailable - please retry',
      'domain_check_only': 'Using domain verification only',
      'manual_review': 'Manual verification recommended'
    };
    return actionMap[action];
  }

  async init() {
    console.log('FraudBuster: Starting initialization...');
    
    try {
      // Ensure loading screen is hidden by default
      console.log('FraudBuster: Ensuring loading screen is hidden by default...');
      this.hideLoadingScreen();
      
      // Check if this is first launch of the session
      console.log('FraudBuster: Checking session launch status...');
      const shouldShowLoadingScreen = await this.checkFirstLaunch();
      console.log('FraudBuster: Should show loading screen:', shouldShowLoadingScreen);
      
      if (shouldShowLoadingScreen) {
        // Show loading screen only on first launch of session
        this.showLoadingScreen();
        console.log('FraudBuster: Loading screen shown for first session launch');
        
        // Initialize extension step by step with loading updates
        console.log('FraudBuster: Starting step 1 - Initializing extension...');
        await this.updateLoadingState('Initializing extension...', 0, 'step1');
        await this.loadSettings();
        console.log('FraudBuster: Settings loaded');
        
        await this.getCurrentTab();
        console.log('FraudBuster: Current tab obtained');
        
        console.log('FraudBuster: Starting step 2 - Connecting to database...');
        await this.updateLoadingState('Connecting to database...', 25, 'step2');
        await this.restoreTabState();
        console.log('FraudBuster: Tab state restored');
        
        console.log('FraudBuster: Starting step 3 - Downloading fraud patterns...');
        await this.updateLoadingState('Downloading fraud patterns...', 50, 'step3');
        await this.checkFraudDetectorStatus();
        console.log('FraudBuster: Fraud detector status checked');
        
        console.log('FraudBuster: Starting step 4 - Loading ML models...');
        await this.updateLoadingState('Loading ML models...', 75, 'step4');
        await this.detectJobPostings();
        console.log('FraudBuster: Job postings detected');
        
        console.log('FraudBuster: Finalizing initialization...');
        await this.updateLoadingState('Ready!', 100, 'step4');
        
        // Setup UI
        console.log('FraudBuster: Setting up event listeners...');
        this.setupEventListeners();
        console.log('FraudBuster: Updating UI...');
        this.updateUI();
        console.log('FraudBuster: Applying theme...');
        this.applyTheme();
        console.log('FraudBuster: Updating community section...');
        await this.updateCommunitySection();
        
        // Hide loading screen after a brief delay
        console.log('FraudBuster: Hiding loading screen...');
        setTimeout(() => {
          this.hideLoadingScreen();
          console.log('FraudBuster: Initialization completed successfully!');
        }, 800);
      } else {
        // Skip loading screen for subsequent opens in same session
        console.log('FraudBuster: Skipping loading screen - performing quick initialization...');
        
        // Ensure loading screen stays hidden
        console.log('FraudBuster: Ensuring loading screen remains hidden...');
        this.hideLoadingScreen();
        
        // Still need to initialize but without loading screen delays
        console.log('FraudBuster: Loading settings...');
        await this.loadSettings();
        console.log('FraudBuster: Getting current tab...');
        await this.getCurrentTab();
        console.log('FraudBuster: Restoring tab state...');
        await this.restoreTabState();
        console.log('FraudBuster: Checking fraud detector status...');
        await this.checkFraudDetectorStatus();
        console.log('FraudBuster: Detecting job postings...');
        await this.detectJobPostings();
        
        // Setup UI immediately
        console.log('FraudBuster: Setting up event listeners...');
        this.setupEventListeners();
        console.log('FraudBuster: Updating UI...');
        this.updateUI();
        console.log('FraudBuster: Applying theme...');
        this.applyTheme();
        console.log('FraudBuster: Updating community section...');
        await this.updateCommunitySection();
        
        console.log('FraudBuster: Quick initialization completed successfully!');
      }
      
    } catch (error) {
      console.error('FraudBuster: Initialization error:', error);
      console.error('FraudBuster: Error stack:', error.stack);
      this.hideLoadingScreen();
    }
  }

  async getCurrentTab() {
    try {
      console.log('FraudBuster: Getting current tab...');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
      console.log('FraudBuster: Current tab obtained:', tab);
      
      // Extract domain from current tab URL
      if (tab && tab.url) {
        try {
          const url = new URL(tab.url);
          this.currentDomain = url.hostname;
          console.log('FraudBuster: Domain extracted:', this.currentDomain);
        } catch (error) {
          console.error('Error parsing tab URL:', error);
          this.currentDomain = null;
        }
      } else {
        console.log('FraudBuster: No tab or URL available');
        this.currentDomain = null;
      }
    } catch (error) {
      console.error('Error getting current tab:', error);
    }
  }

  async loadSettings() {
    try {
      console.log('FraudBuster: Starting loadSettings...');
      
      // Check if this is first launch of browser session
      console.log('FraudBuster: Checking session initialization...');
      const sessionResult = await chrome.storage.session.get(['sessionInitialized']);
      const isFirstSession = !sessionResult.sessionInitialized;
      console.log('FraudBuster: Is first session:', isFirstSession);
      
      console.log('FraudBuster: Loading storage data...');
      const result = await chrome.storage.sync.get({
        domainStates: {},
        autoScan: false,
        sensitivity: 5,
        darkMode: 'auto',
        userContributions: 0
      });
      console.log('FraudBuster: Storage data loaded:', result);
      
      // Load domain states from storage
      console.log('FraudBuster: Converting domain states to Map...');
      this.domainStates = new Map(Object.entries(result.domainStates || {}));
      console.log('FraudBuster: Domain states Map created:', this.domainStates);
      
      // Get extension state for current domain
      console.log('FraudBuster: Current domain:', this.currentDomain);
      if (this.currentDomain) {
        this.isExtensionActive = this.domainStates.get(this.currentDomain) || false;
        console.log('FraudBuster: Extension active for current domain:', this.isExtensionActive);
      } else {
        this.isExtensionActive = false;
        console.log('FraudBuster: No current domain, setting extension inactive');
      }
      
      // Force extension to be OFF on first launch of browser session for all domains
      if (isFirstSession) {
        console.log('FraudBuster: First session launch - forcing extension toggle OFF for all domains');
        this.domainStates.clear();
        this.isExtensionActive = false;
        await this.saveDomainStates();
        console.log('FraudBuster: Domain states cleared and saved');
      }
      
      this.userSettings = {
        autoScan: result.autoScan,
        sensitivity: result.sensitivity,
        darkMode: result.darkMode
      };
      
      document.getElementById('userContributions').textContent = result.userContributions;
      
      // Load status information
      await this.loadStatusInformation();
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async loadStatusInformation() {
    try {
      // Get current domain for domain status checking
      let currentDomain = null;
      if (this.currentTab && this.currentTab.url) {
        try {
          const url = new URL(this.currentTab.url);
          currentDomain = url.hostname;
        } catch (error) {
          console.error('Error parsing current tab URL:', error);
        }
      }
      
      // Get session data from background script with current domain
      const response = await chrome.runtime.sendMessage({ 
        action: 'getSessionData',
        currentDomain: currentDomain
      });
      
      if (response && response.success && response.data) {
        const sessionData = response.data;
        
        // Update last data fetch time
        const lastFetchElement = document.getElementById('lastDataFetch');
        if (lastFetchElement) {
          if (sessionData.lastDataFetch) {
            const fetchDate = new Date(sessionData.lastDataFetch);
            lastFetchElement.textContent = fetchDate.toLocaleString();
          } else {
            lastFetchElement.textContent = 'Never';
          }
        }
        
        // Update NLP rules count
        const nlpRulesElement = document.getElementById('nlpRulesCount');
        if (nlpRulesElement) {
          nlpRulesElement.textContent = sessionData.nlpRulesCount || '0';
        }
        
        // Update URL listing count
        const urlListingElement = document.getElementById('urlListingCount');
        if (urlListingElement) {
          urlListingElement.textContent = sessionData.urlListingCount || '0';
        }
        
        // Update domain status
        const domainStatusElement = document.getElementById('domainStatus');
        if (domainStatusElement && sessionData.domainStatus) {
          domainStatusElement.textContent = sessionData.domainStatus;
          // Add CSS class based on status for styling
          domainStatusElement.className = 'detail-value domain-' + sessionData.domainStatus.toLowerCase();
        }
      } else {
        // Set default values if no session data available
        this.setDefaultStatusValues();
      }
    } catch (error) {
      console.error('Error loading status information:', error);
      this.setDefaultStatusValues();
    }
  }

  setDefaultStatusValues() {
    const lastFetchElement = document.getElementById('lastDataFetch');
    const nlpRulesElement = document.getElementById('nlpRulesCount');
    const urlListingElement = document.getElementById('urlListingCount');
    const domainStatusElement = document.getElementById('domainStatus');
    
    if (lastFetchElement) lastFetchElement.textContent = 'Loading...';
    if (nlpRulesElement) nlpRulesElement.textContent = 'Loading...';
    if (urlListingElement) urlListingElement.textContent = 'Loading...';
    if (domainStatusElement) {
      domainStatusElement.textContent = 'Checking...';
      domainStatusElement.className = 'detail-value';
    }
  }

  async saveTabState() {
    if (!this.currentTab) return;
    
    const tabState = {
      scanResults: this.scanResults,
      jobPostings: this.jobPostings,
      fraudAnalysisResults: Array.from(this.fraudAnalysisResults.entries()),
      lastScanTime: Date.now()
    };
    
    this.tabStates.set(this.currentTab.id, tabState);
    
    // Also save to session storage for persistence across popup sessions
    try {
      await chrome.storage.session.set({
        [`tabState_${this.currentTab.id}`]: tabState
      });
    } catch (error) {
      console.error('Error saving tab state:', error);
    }
  }

  async restoreTabState() {
    if (!this.currentTab) return;
    
    try {
      // First try to get from memory
      let tabState = this.tabStates.get(this.currentTab.id);
      
      // If not in memory, try session storage
      if (!tabState) {
        const result = await chrome.storage.session.get([`tabState_${this.currentTab.id}`]);
        tabState = result[`tabState_${this.currentTab.id}`];
      }
      
      if (tabState) {
        this.scanResults = tabState.scanResults;
        this.jobPostings = tabState.jobPostings || [];
        this.fraudAnalysisResults = new Map(tabState.fraudAnalysisResults || []);
        
        // Restore UI if we have scan results
        if (this.scanResults) {
          this.displayResults(this.scanResults);
        }
        
        // Update job postings display
        this.updateJobPostingsDisplay();
      }
    } catch (error) {
      console.error('Error restoring tab state:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        autoScan: this.userSettings.autoScan,
        sensitivity: this.userSettings.sensitivity,
        darkMode: this.userSettings.darkMode
      });
      
      // Save domain states separately
      await this.saveDomainStates();
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async saveDomainStates() {
    try {
      // Convert Map to object for storage
      const domainStatesObj = Object.fromEntries(this.domainStates);
      await chrome.storage.sync.set({
        domainStates: domainStatesObj
      });
    } catch (error) {
      console.error('Error saving domain states:', error);
    }
  }

  setupEventListeners() {
    // Extension toggle
    const extensionToggle = document.getElementById('extensionToggle');
    extensionToggle.checked = this.isExtensionActive;
    extensionToggle.addEventListener('change', (e) => {
      this.isExtensionActive = e.target.checked;
      
      // Save state for current domain
      if (this.currentDomain) {
        this.domainStates.set(this.currentDomain, this.isExtensionActive);
        console.log(`FraudBuster: Toggle ${this.isExtensionActive ? 'ON' : 'OFF'} for domain: ${this.currentDomain}`);
      }
      
      this.updateUI();
      this.saveSettings();
      this.updateStatus();
    });

    // Scan button
    const scanButton = document.getElementById('scanButton');
    scanButton.addEventListener('click', () => this.scanPage());

    // Community buttons
    document.getElementById('reportButton').addEventListener('click', () => this.reportURL());
    document.getElementById('upvoteButton').addEventListener('click', () => this.voteURL('upvote'));
    document.getElementById('downvoteButton').addEventListener('click', () => this.voteURL('downvote'));

    // Settings
    const autoScanCheckbox = document.getElementById('autoScan');
    autoScanCheckbox.checked = this.userSettings.autoScan;
    autoScanCheckbox.addEventListener('change', (e) => {
      this.userSettings.autoScan = e.target.checked;
      this.saveSettings();
    });

    const sensitivitySlider = document.getElementById('sensitivity');
    sensitivitySlider.value = this.userSettings.sensitivity;
    document.getElementById('sensitivityValue').textContent = this.userSettings.sensitivity;
    sensitivitySlider.addEventListener('input', (e) => {
      this.userSettings.sensitivity = parseInt(e.target.value);
      document.getElementById('sensitivityValue').textContent = e.target.value;
      this.saveSettings();
    });

    const darkModeSelect = document.getElementById('darkMode');
    darkModeSelect.value = this.userSettings.darkMode;
    darkModeSelect.addEventListener('change', (e) => {
      this.userSettings.darkMode = e.target.value;
      this.applyTheme();
      this.saveSettings();
    });

    // Fraud detection buttons
    const analyzeJobsButton = document.getElementById('analyzeJobsButton');
    if (analyzeJobsButton) {
      analyzeJobsButton.addEventListener('click', () => this.analyzeAllJobs());
    }

    const refreshJobsButton = document.getElementById('refreshJobsButton');
    if (refreshJobsButton) {
      refreshJobsButton.addEventListener('click', () => this.detectJobPostings());
    }
  }

  updateUI() {
    const scanButton = document.getElementById('scanButton');
    const toggleLabel = document.querySelector('.toggle-label');
    const statusText = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');

    if (this.isExtensionActive) {
      scanButton.disabled = false;
      toggleLabel.textContent = 'Active';
      statusText.textContent = 'Ready to scan';
      statusDot.className = 'status-dot';
    } else {
      scanButton.disabled = true;
      toggleLabel.textContent = 'Inactive';
      statusText.textContent = 'Extension disabled - toggle ON to scan';
      statusDot.className = 'status-dot warning';
    }
  }

  applyTheme() {
    const body = document.body;
    
    if (this.userSettings.darkMode === 'dark') {
      body.setAttribute('data-theme', 'dark');
    } else if (this.userSettings.darkMode === 'light') {
      body.setAttribute('data-theme', 'light');
    } else {
      body.removeAttribute('data-theme');
    }
  }

  async scanPage() {
    // Check if extension is active before scanning
    if (!this.isExtensionActive) {
      this.showNotification('Please turn ON the extension toggle first', 'warning');
      return;
    }

    if (!this.currentTab) {
      this.showNotification('No active tab found', 'error');
      return;
    }

    this.showLoading(true);
    this.updateScanStatus('Checking domain status...');

    try {
      // First, check domain status
      const domainCheckResponse = await chrome.runtime.sendMessage({
        action: 'checkDomainStatus',
        tabUrl: this.currentTab.url
      });

      if (domainCheckResponse.success && domainCheckResponse.isBlacklisted) {
        // Domain is blacklisted - show dialog to user
        this.showLoading(false);
        const userChoice = await this.showDomainStatusDialog(domainCheckResponse.domainInfo);
        
        if (userChoice === 'skip') {
          // User chose to skip NLP analysis - show domain-only results
          this.displayDomainOnlyResults(domainCheckResponse.domainInfo);
          return;
        }
        // If userChoice === 'proceed', continue with NLP analysis below
      }

      // Proceed with full scan (either domain is safe/unknown or user chose to proceed)
      this.updateScanStatus('Analyzing page...');
      
      // Send message to background script to start scan
      // Include tab info so background script can extract page data from content script
      const response = await chrome.runtime.sendMessage({
        action: 'scanPage',
        tabId: this.currentTab.id,
        tabUrl: this.currentTab.url,
        domain: this.currentDomain,
        extensionActive: this.isExtensionActive, // Pass extension state
        skipDomainCheck: domainCheckResponse.success // Skip domain check if already done
      });

      console.log('Scan response:', response); // Debug log
      
      if (response.success) {
        // Validate that results exist before processing
        if (response.results) {
          console.log('Scan results:', response.results); // Debug log
          this.scanResults = response.results;
          
          // Populate jobPostings from scan results to enable "Analyze Jobs" button
          if (response.results.hasJobPostings && response.results.jobPostingsCount > 0) {
            // Extract job postings from the scan results for individual analysis
            await this.detectJobPostings();
          }
          
          this.displayResults(response.results);
          await this.saveTabState(); // Save state after successful scan
          await this.updateCommunitySection(); // Update community section after scan
        } else {
          console.error('Scan succeeded but results are null/undefined');
          this.showError('Analysis completed but no results available');
        }
      } else {
        console.error('Scan failed:', response.error);
        this.showError(response.error || 'Scan failed');
      }
    } catch (error) {
      console.error('Scan error:', error);
      this.showError('Failed to scan page');
    } finally {
      this.showLoading(false);
      this.updateStatus(); // Clear the "Analyzing page..." status
    }
  }

  displayResults(results) {
    console.log('=== DISPLAYRESULTS DEBUG START ===');
    console.log('Complete results object:', JSON.stringify(results, null, 2));
    console.log('results.fraudAnalysis:', results.fraudAnalysis);
    console.log('results.overallRisk:', results.overallRisk);
    console.log('results.overallConfidence:', results.overallConfidence);
    console.log('results.analysis:', results.analysis);
    
    const resultsSection = document.getElementById('resultsSection');
    const riskCircle = document.getElementById('riskCircle');
    const riskPercentage = document.getElementById('riskPercentage');
    const riskTitle = document.getElementById('riskTitle');
    const riskDescription = document.getElementById('riskDescription');
    const mlConfidence = document.getElementById('mlConfidence');
    const communityReports = document.getElementById('communityReports');
    const domainStatus = document.getElementById('domainStatus');
    const totalReports = document.getElementById('totalReports');

    // Validate results object
    if (!results) {
      console.error('displayResults: results is null or undefined');
      this.showError('No analysis results available');
      return;
    }

    // Show results section
    resultsSection.style.display = 'block';

    // Extract fraud analysis data from the actual response structure
    const fraudAnalysis = results.fraudAnalysis || results.analysis || {};
    console.log('Extracted fraudAnalysis:', fraudAnalysis);
    
    // Calculate risk score from confidence and fraud status
    let riskScore = 0;
    console.log('=== RISK CALCULATION DEBUG ===');
    console.log('fraudAnalysis.method:', fraudAnalysis.method);
    console.log('fraudAnalysis.isFraud:', fraudAnalysis.isFraud);
    console.log('fraudAnalysis.isFraudulent:', fraudAnalysis.isFraudulent);
    console.log('fraudAnalysis.confidence:', fraudAnalysis.confidence);
    
    // Check if we have aggregated analysis results (multiple job postings)
    if (fraudAnalysis.method === 'aggregated_analysis') {
      console.log('=== AGGREGATED ANALYSIS BRANCH ===');
      console.log('fraudAnalysis.fraudCount:', fraudAnalysis.fraudCount);
      console.log('fraudAnalysis.totalPostings:', fraudAnalysis.totalPostings);
      console.log('fraudAnalysis.fraudPercentage:', fraudAnalysis.fraudPercentage);
      
      // For aggregated analysis, use the confidence directly as risk percentage
      // The background.js already calculates proper overallConfidence for multiple postings
      if (fraudAnalysis.isFraud) {
        console.log('=== FRAUD DETECTED IN AGGREGATED ANALYSIS ===');
        riskScore = Math.round((fraudAnalysis.confidence || 0.8) * 100);
        console.log('Calculated fraud risk score:', riskScore);
      } else {
        console.log('=== NO FRAUD IN AGGREGATED ANALYSIS ===');
        // For legitimate aggregated results, show low risk
        riskScore = Math.max(5, Math.round((fraudAnalysis.confidence || 0.2) * 30));
        console.log('Calculated legitimate risk score:', riskScore);
      }
    } else if (fraudAnalysis.isFraud || fraudAnalysis.isFraudulent) {
      console.log('=== SINGLE FRAUDULENT POSTING BRANCH ===');
      // Single fraudulent posting - use confidence as risk score
      riskScore = Math.round((fraudAnalysis.confidence || 0.8) * 100);
      console.log('Calculated single fraud risk score:', riskScore);
    } else {
      console.log('=== SINGLE LEGITIMATE POSTING BRANCH ===');
      // Single legitimate posting - calculate proper low risk score
      const confidence = fraudAnalysis.confidence || 0.2;
      // For legitimate sites: higher confidence = lower risk
      // Cap legitimate sites at 25% max risk, minimum 5%
      riskScore = Math.max(5, Math.round((1 - confidence) * 25));
      console.log('Calculated single legitimate risk score:', riskScore, 'from confidence:', confidence);
    }
    
    console.log('=== FINAL RISK SCORE ===', riskScore);

    riskPercentage.textContent = `${riskScore}%`;

    // Set risk level styling and text
    riskCircle.className = 'risk-circle';
    if (riskScore < 30) {
      riskCircle.classList.add('safe');
      riskTitle.textContent = 'Low Risk';
      riskDescription.textContent = 'This page appears to be legitimate';
    } else if (riskScore < 70) {
      riskCircle.classList.add('warning');
      riskTitle.textContent = 'Medium Risk';
      riskDescription.textContent = 'Exercise caution with this page';
    } else {
      riskCircle.classList.add('danger');
      riskTitle.textContent = 'High Risk';
      riskDescription.textContent = 'This page may be fraudulent';
    }

    // Update analysis details with proper fallbacks
    const confidence = fraudAnalysis.confidence || results.mlConfidence || 0;
    
    // Debug logging for confidence calculation
    console.log('ML Confidence Debug:', {
      confidence,
      method: fraudAnalysis.method,
      fraudAnalysis,
      results
    });
    
    // Show confidence percentage based on analysis method
    if (fraudAnalysis.method === 'ml_prediction' || fraudAnalysis.method === 'aggregated_analysis') {
      // For ML predictions and aggregated analysis, always show confidence percentage
      mlConfidence.textContent = `${Math.round(confidence * 100)}%`;
    } else if (fraudAnalysis.method === 'rule_based' || fraudAnalysis.method === 'pattern_matching') {
      // For rule-based analysis, show "Rule-based" instead of '--'
      mlConfidence.textContent = 'Rule-based';
    } else if (fraudAnalysis.method === 'domain_blacklist') {
      mlConfidence.textContent = 'Domain Check';
    } else if (confidence > 0) {
      // Fallback: if we have confidence but unknown method, show percentage
      mlConfidence.textContent = `${Math.round(confidence * 100)}%`;
    } else {
      // Only show '--' when truly no analysis method is available
      mlConfidence.textContent = '--';
    }
    
    communityReports.textContent = results.communityReports || 0;
    
    // Check domain status from various possible properties
    const isBlacklisted = fraudAnalysis.method === 'domain_blacklist' || 
                         results.isBlacklisted || 
                         fraudAnalysis.isBlacklisted || 
                         false;
    domainStatus.textContent = isBlacklisted ? 'Blacklisted' : 'Clean';
    
    totalReports.textContent = results.totalReports || 0;
  }

  async reportURL() {
    if (!this.currentTab) return;

    try {
      // Get additional context for the report
      const domain = new URL(this.currentTab.url).hostname;
      const pageTitle = this.currentTab.title || 'Unknown Page';
      
      const response = await chrome.runtime.sendMessage({
        action: 'reportURL',
        url: this.currentTab.url,
        reason: `User reported suspicious content on ${domain} - "${pageTitle}"`
      });

      if (response.success) {
        this.showNotification(
          response.message || 'URL reported and added to fraud database', 
          'success'
        );
        this.updateUserContributions();
        await this.updateCommunitySection(); // Refresh community data after reporting
        
        // Log successful report
        console.log(`✅ Successfully reported URL: ${this.currentTab.url}`);
      } else {
        this.showNotification(`Failed to report URL: ${response.error}`, 'error');
        console.error('Report failed:', response.error);
      }
    } catch (error) {
      console.error('Report error:', error);
      this.showNotification('Failed to report URL - please try again', 'error');
    }
  }

  async voteURL(voteType) {
    if (!this.currentTab || !this.scanResults) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'voteURL',
        url: this.currentTab.url,
        voteType: voteType
      });

      if (response.success) {
        this.showNotification(response.message || `${voteType === 'upvote' ? 'Upvoted' : 'Downvoted'} successfully`, 'success');
        this.updateUserContributions();
        await this.updateCommunitySection(); // Refresh community data after voting
      } else {
        this.showNotification(response.error || 'Failed to submit vote', 'error');
      }
    } catch (error) {
      console.error('Vote error:', error);
      this.showNotification('Failed to submit vote', 'error');
    }
  }

  async updateUserContributions() {
    try {
      const result = await chrome.storage.sync.get('userContributions');
      const contributions = (result.userContributions || 0) + 1;
      await chrome.storage.sync.set({ userContributions: contributions });
      document.getElementById('userContributions').textContent = contributions;
    } catch (error) {
      console.error('Error updating contributions:', error);
    }
  }

  showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    loadingOverlay.style.display = show ? 'flex' : 'none';
  }

  updateScanStatus(message) {
    const statusText = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');
    
    statusText.textContent = message;
    statusDot.className = 'status-dot warning';
  }

  updateStatus() {
    const statusText = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');
    
    if (this.isExtensionActive) {
      statusText.textContent = 'Ready';
      statusDot.className = 'status-dot';
    } else {
      statusText.textContent = 'Inactive';
      statusDot.className = 'status-dot warning';
    }
  }

  showError(message) {
    const statusText = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');
    
    statusText.textContent = message;
    statusDot.className = 'status-dot error';
    
    setTimeout(() => {
      this.updateStatus();
    }, 3000);
  }

  showNotification(message, type) {
    // Simple notification using status indicator
    const statusText = document.querySelector('.status-text');
    const statusDot = document.querySelector('.status-dot');
    
    statusText.textContent = message;
    statusDot.className = `status-dot ${type === 'success' ? '' : 'error'}`;
    
    setTimeout(() => {
      this.updateStatus();
    }, 2000);
  }

  async checkFraudDetectorStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getFraudDetectorStatus' });
      
      if (response.success) {
        this.fraudDetectorStatus = response.status;
        this.updateFraudDetectorUI();
        
        // If models are loading, check status periodically
        if (response.status.status === 'loading') {
          setTimeout(() => this.checkFraudDetectorStatus(), 2000);
        }
      } else {
        console.error('Failed to get fraud detector status:', response.error);
        this.fraudDetectorStatus = response.status || { 
          status: 'error', 
          message: 'Failed to get system status',
          canAnalyze: false,
          errorType: 'STATUS_ERROR'
        };
        this.updateFraudDetectorUI();
      }
    } catch (error) {
      console.error('Error checking fraud detector status:', error);
      this.fraudDetectorStatus = { 
        status: 'error', 
        message: 'Connection error',
        canAnalyze: false,
        errorType: 'CONNECTION_ERROR'
      };
      this.updateFraudDetectorUI();
    }
  }

  async detectJobPostings() {
    if (!this.currentTab) return;

    try {
      // Check if content script is available by trying to ping it first
      const pingResponse = await this.pingContentScript();
      if (!pingResponse) {
        console.log('Content script not available, attempting to inject...');
        await this.ensureContentScriptInjected();
      }

      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'detectJobPostings'
      });
      
      if (response && response.success && response.jobPostings) {
        this.jobPostings = response.jobPostings;
        this.updateJobPostingsUI();
        await this.saveTabState(); // Save state after detecting job postings
      } else if (response && !response.success) {
        console.error('Content script error:', response.error);
        this.showError('Failed to detect job postings: ' + response.error);
      } else {
        console.log('No job postings found on this page');
        this.jobPostings = [];
        this.updateJobPostingsUI();
      }
    } catch (error) {
      console.error('Error detecting job postings:', error);
      
      // Handle specific connection errors
      if (error.message && error.message.includes('Receiving end does not exist')) {
        this.showError('Content script not available. Please refresh the page and try again.');
      } else {
        this.showError('Failed to detect job postings. Please try again.');
      }
      
      // Set empty job postings to prevent UI issues
      this.jobPostings = [];
      this.updateJobPostingsUI();
    }
  }

  // Ping content script to check if it's available
  async pingContentScript() {
    try {
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'ping'
      });
      return response && response.success;
    } catch (error) {
      return false;
    }
  }

  // Ensure content script is injected
  async ensureContentScriptInjected() {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        files: ['content.js']
      });
      
      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Failed to inject content script:', error);
      throw new Error('Unable to inject content script');
    }
  }
  
  // Show comprehensive analysis results with enhanced error handling
  showComprehensiveAnalysis(analysisResult) {
    const section = document.getElementById('comprehensiveAnalysisSection');
    const detectionMethod = document.getElementById('detectionMethod');
    const fraudStatus = document.getElementById('fraudStatus');
    const riskLevelValue = document.getElementById('riskLevelValue');
    const confidenceValue = document.getElementById('confidenceValue');
    const domainValue = document.getElementById('domainValue');
    const analysisReasons = document.getElementById('analysisReasons');
    const reasonsList = document.getElementById('reasonsList');
    const manualReviewSection = document.getElementById('manualReviewSection');
    const domainReportingSection = document.getElementById('domainReportingSection');
    const reportDomainName = document.getElementById('reportDomainName');
    
    // Show the section
    section.style.display = 'block';
    
    // Show page classification section if available
    this.showPageClassificationResults(analysisResult);
    
    // Show learning system status if available
    this.showLearningSystemStatus(analysisResult);
    
    // Handle different analysis states including errors and fallbacks
    let statusText, statusClass, methodText;
    
    // Determine status based on method and results
    if (analysisResult.method && analysisResult.method.includes('_failed')) {
      statusText = 'Analysis Unavailable';
      statusClass = 'analysis-error';
      methodText = this.getMethodDisplayText(analysisResult.method);
    } else if (analysisResult.method && analysisResult.method.includes('_fallback')) {
      statusText = analysisResult.isFraudulent ? 'Fraud Detected' : 'Limited Analysis';
      statusClass = analysisResult.isFraudulent ? 'fraud' : 'limited-analysis';
      methodText = this.getMethodDisplayText(analysisResult.method);
    } else {
      statusText = analysisResult.isFraudulent ? 'Fraud Detected' : 
                   analysisResult.isFraudulent === false ? 'Appears Safe' : 'Inconclusive';
      statusClass = analysisResult.isFraudulent ? 'fraud' : 
                    analysisResult.isFraudulent === false ? 'legitimate' : 'inconclusive';
      methodText = this.getMethodDisplayText(analysisResult.method);
    }
    
    // Update fraud status
    fraudStatus.textContent = statusText;
    fraudStatus.className = `fraud-status ${statusClass}`;
    
    // Update detection method with network status
    let methodDisplay = methodText || 'Unknown Method';
    if (analysisResult.networkStatus === 'offline') {
      methodDisplay += ' (Offline Mode)';
    } else if (analysisResult.fallbackUsed) {
      methodDisplay += ' (Fallback Used)';
    }
    detectionMethod.textContent = methodDisplay;
    
    // Update analysis details
    riskLevelValue.textContent = analysisResult.riskLevel || '--';
    
    // Show confidence only if meaningful
    if (typeof analysisResult.confidence === 'number' && analysisResult.confidence > 0) {
      confidenceValue.textContent = `${Math.round(analysisResult.confidence * 100)}%`;
      confidenceValue.parentElement.style.display = 'block';
    } else {
      confidenceValue.textContent = '--';
      confidenceValue.parentElement.style.display = analysisResult.method && analysisResult.method.includes('_failed') ? 'none' : 'block';
    }
    
    domainValue.textContent = analysisResult.domain || '--';
    
    // Update reasons with error context
    const reasons = [];
    if (analysisResult.reason) {
      reasons.push(analysisResult.reason);
    }
    if (analysisResult.warning) {
      reasons.push(`⚠️ ${analysisResult.warning}`);
    }
    if (analysisResult.error && analysisResult.method && analysisResult.method.includes('_failed')) {
      reasons.push(`Error: ${analysisResult.errorType || 'Technical issue occurred'}`);
    }
    if (analysisResult.fallbackAction) {
      const actionText = this.getFallbackActionText(analysisResult.fallbackAction);
      if (actionText) reasons.push(actionText);
    }
    
    if (reasons.length > 0) {
      analysisReasons.style.display = 'block';
      reasonsList.innerHTML = '';
      reasons.forEach(reason => {
        const li = document.createElement('li');
        li.textContent = reason;
        reasonsList.appendChild(li);
      });
    } else {
      analysisReasons.style.display = 'none';
    }
    
    // Show manual review section for failed analyses or inconclusive results
    const needsManualReview = analysisResult.needsManualReview || 
                             (analysisResult.method && analysisResult.method.includes('_failed')) ||
                             analysisResult.method === 'manual_review_required';
    
    if (needsManualReview) {
      manualReviewSection.style.display = 'block';
    } else {
      manualReviewSection.style.display = 'none';
    }
    
    // Show domain reporting section for unknown domains or inconclusive results
    if ((analysisResult.method === 'inconclusive' || analysisResult.method === 'manual_review_required') && analysisResult.domain) {
      domainReportingSection.style.display = 'block';
      reportDomainName.textContent = analysisResult.domain;
    } else {
      domainReportingSection.style.display = 'none';
    }
    
    // Show user feedback section only for successful analyses
    if (!analysisResult.method || !analysisResult.method.includes('_failed')) {
      showUserFeedbackSection();
    }
  }
  
  // Handle manual fraud reporting
  async handleManualFraudReport(isFraud) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.tabs.sendMessage(tab.id, {
        action: 'manualFraudReport',
        data: {
          isFraud: isFraud,
          url: tab.url,
          timestamp: Date.now()
        }
      });
      
      // Update UI to show feedback was submitted
      this.showNotification(
        isFraud ? 'Reported as fraudulent. Thank you for your feedback!' : 
                 'Marked as legitimate. Thank you for your feedback!',
        'success'
      );
      
      // Hide manual review section
      document.getElementById('manualReviewSection').style.display = 'none';
      
    } catch (error) {
      console.error('Error submitting manual report:', error);
      this.showError('Failed to submit report. Please try again.');
    }
  }
  
  // Handle domain reporting
  async handleDomainReport(domain, reason) {
    try {
      await chrome.runtime.sendMessage({
        action: 'reportNewFraudDomain',
        data: {
          domain: domain,
          reason: reason,
          timestamp: Date.now()
        }
      });
      
      this.showNotification('Domain reported successfully. Thank you for helping protect others!', 'success');
      
      // Hide domain reporting section
      document.getElementById('domainReportingSection').style.display = 'none';
      
    } catch (error) {
      console.error('Error reporting domain:', error);
      this.showError('Failed to report domain. Please try again.');
    }
  }
  
  // Show page classification results
  showPageClassificationResults(analysisResult) {
    const pageClassificationSection = document.getElementById('pageClassificationSection');
    
    if (!analysisResult.falsePositiveReduction || !analysisResult.falsePositiveReduction.pageClassification) {
      // Hide section if no classification data
      if (pageClassificationSection) {
        pageClassificationSection.style.display = 'none';
      }
      return;
    }
    
    const classification = analysisResult.falsePositiveReduction.pageClassification;
    
    // Show the section
    if (pageClassificationSection) {
      pageClassificationSection.style.display = 'block';
    }
    
    // Update classification type and confidence
    const classificationType = document.getElementById('classificationType');
    const classificationConfidence = document.getElementById('classificationConfidence');
    
    if (classificationType) {
      const typeText = classification.type === 'landing_page' ? 'Landing Page' : 'Job Posting Page';
      classificationType.textContent = typeText;
    }
    
    if (classificationConfidence) {
      const confidence = Math.round(classification.confidence * 100);
      classificationConfidence.textContent = `${confidence}% confidence`;
    }
    
    // Update classification details
    const contentDensityValue = document.getElementById('contentDensityValue');
    const jobIndicatorsValue = document.getElementById('jobIndicatorsValue');
    const navigationScoreValue = document.getElementById('navigationScoreValue');
    const confidenceAdjustmentValue = document.getElementById('confidenceAdjustmentValue');
    
    if (contentDensityValue && classification.features) {
      const density = Math.round(classification.features.contentDensity * 100);
      contentDensityValue.textContent = `${density}%`;
    }
    
    if (jobIndicatorsValue && classification.features) {
      const indicators = Math.round(classification.features.jobIndicators * 100);
      jobIndicatorsValue.textContent = `${indicators}%`;
    }
    
    if (navigationScoreValue && classification.features) {
      const navigation = Math.round(classification.features.navigationScore * 100);
      navigationScoreValue.textContent = `${navigation}%`;
    }
    
    if (confidenceAdjustmentValue && analysisResult.falsePositiveReduction.confidenceAdjustment) {
      const adjustment = analysisResult.falsePositiveReduction.confidenceAdjustment;
      const sign = adjustment >= 0 ? '+' : '';
      confidenceAdjustmentValue.textContent = `${sign}${Math.round(adjustment * 100)}%`;
    }
  }
  
  // Show learning system status
  showLearningSystemStatus(analysisResult) {
    const learningStatusSection = document.getElementById('learningStatusSection');
    
    if (!analysisResult.falsePositiveReduction || !analysisResult.falsePositiveReduction.systemActive) {
      // Hide section if system is not active
      if (learningStatusSection) {
        learningStatusSection.style.display = 'none';
      }
      return;
    }
    
    // Show the section
    if (learningStatusSection) {
      learningStatusSection.style.display = 'block';
    }
    
    // Update learning status
    const learningStatusValue = document.getElementById('learningStatusValue');
    if (learningStatusValue) {
      learningStatusValue.textContent = 'Active';
      learningStatusValue.style.color = 'var(--success-color)';
    }
    
    // Request learning metrics from background script
    chrome.runtime.sendMessage({
      action: 'getLearningMetrics'
    }, (response) => {
      if (response && response.success && response.metrics) {
        updateLearningMetrics(response.metrics);
      }
    });
  }
  
  // Initialize user feedback system
  initializeUserFeedback() {
    const feedbackCorrect = document.getElementById('feedbackCorrect');
    const feedbackIncorrect = document.getElementById('feedbackIncorrect');
    const feedbackUnsure = document.getElementById('feedbackUnsure');
    const submitFeedback = document.getElementById('submitFeedback');
    
    if (feedbackCorrect) {
      feedbackCorrect.addEventListener('click', () => handleFeedbackSelection('correct'));
    }
    
    if (feedbackIncorrect) {
      feedbackIncorrect.addEventListener('click', () => handleFeedbackSelection('incorrect'));
    }
    
    if (feedbackUnsure) {
      feedbackUnsure.addEventListener('click', () => handleFeedbackSelection('unsure'));
    }
    
    if (submitFeedback) {
      submitFeedback.addEventListener('click', submitUserFeedback);
    }
  }
  
  // Handle feedback selection
  handleFeedbackSelection(feedbackType) {
    // Store the selected feedback type
    window.selectedFeedback = feedbackType;
    
    // Update button states
    const buttons = document.querySelectorAll('.feedback-button');
    buttons.forEach(btn => btn.classList.remove('selected'));
    
    const selectedButton = document.getElementById(`feedback${feedbackType.charAt(0).toUpperCase() + feedbackType.slice(1)}`);
    if (selectedButton) {
      selectedButton.classList.add('selected');
    }
    
    // Show details section for incorrect feedback
    const feedbackDetails = document.getElementById('feedbackDetails');
    if (feedbackType === 'incorrect' && feedbackDetails) {
      feedbackDetails.style.display = 'block';
    } else if (feedbackDetails) {
      feedbackDetails.style.display = 'none';
      // Auto-submit for correct/unsure feedback
      setTimeout(() => submitUserFeedback(), 500);
    }
  }
  
  // Submit user feedback
  async submitUserFeedback() {
    try {
      if (!window.selectedFeedback) {
        showNotification('Please select a feedback option', 'error');
        return;
      }
      
      const feedbackComment = document.getElementById('feedbackComment');
      const comment = feedbackComment ? feedbackComment.value.trim() : '';
      
      // Get current tab and analysis data
      const tabs = await new Promise(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
      });
      
      if (!tabs[0]) {
        throw new Error('No active tab found');
      }
      
      const feedbackData = {
        feedbackType: window.selectedFeedback,
        comment: comment,
        url: tabs[0].url,
        domain: new URL(tabs[0].url).hostname,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      };
      
      // Send feedback to background script
      chrome.runtime.sendMessage({
        action: 'submitUserFeedback',
        data: feedbackData
      }, (response) => {
        if (response && response.success) {
          showFeedbackSuccess();
        } else {
          throw new Error(response?.error || 'Failed to submit feedback');
        }
      });
      
    } catch (error) {
      console.error('Error submitting user feedback:', error);
      showNotification('Failed to submit feedback', 'error');
    }
  }
  
  // Show feedback success message
  showFeedbackSuccess() {
    const feedbackDetails = document.getElementById('feedbackDetails');
    const feedbackSuccess = document.getElementById('feedbackSuccess');
    const feedbackButtons = document.querySelector('.feedback-buttons');
    
    if (feedbackDetails) feedbackDetails.style.display = 'none';
    if (feedbackButtons) feedbackButtons.style.display = 'none';
    if (feedbackSuccess) {
      feedbackSuccess.style.display = 'block';
      
      // Hide feedback section after 3 seconds
      setTimeout(() => {
        const feedbackSection = document.getElementById('userFeedbackSection');
        if (feedbackSection) {
          feedbackSection.style.display = 'none';
        }
      }, 3000);
    }
  }
  
  // Show user feedback section when analysis is displayed
   showUserFeedbackSection() {
     const feedbackSection = document.getElementById('userFeedbackSection');
     if (feedbackSection) {
       feedbackSection.style.display = 'block';
     }
   }

  async analyzeJobPosting(jobId, jobText) {
    if (!this.fraudDetectorStatus?.initialized) {
      this.showNotification('Fraud detector not ready', 'error');
      return null;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeJobPosting',
        jobText: jobText
      });
      
      if (response.success) {
        this.fraudAnalysisResults.set(jobId, response.analysis);
        this.showNotification('Job analyzed successfully', 'success');
        return response.analysis;
      } else {
        console.error('Failed to analyze job posting:', response.error);
        
        // Handle specific error types with appropriate user messages
        let userMessage = 'Failed to analyze job posting';
        let notificationType = 'error';
        
        switch (response.errorType) {
          case 'MODELS_LOADING':
            userMessage = 'AI models are loading. Please wait and try again.';
            notificationType = 'warning';
            // Show progress if available
            if (response.progress) {
              userMessage += ` (${Math.round(response.progress * 100)}%)`;
            }
            break;
          case 'MODELS_UNAVAILABLE':
          case 'SYSTEM_NOT_AVAILABLE':
            userMessage = 'AI analysis temporarily unavailable. Using basic detection.';
            notificationType = 'warning';
            break;
          case 'MODELS_ERROR':
            userMessage = 'AI models failed to load. Using basic pattern detection.';
            notificationType = 'warning';
            break;
          default:
            userMessage = response.error || 'Failed to analyze job posting';
        }
        
        this.showNotification(userMessage, notificationType);
        return null;
      }
    } catch (error) {
      console.error('Error analyzing job posting:', error);
      this.showNotification('Connection error. Please try again.', 'error');
      return null;
    }
  }

  async analyzeAllJobs() {
    if (this.jobPostings.length === 0) {
      this.showNotification('No job postings found', 'warning');
      return;
    }

    this.showLoading(true);
    this.updateScanStatus(`Analyzing ${this.jobPostings.length} job postings...`);

    let analyzedCount = 0;
    let fraudulentJobs = [];

    for (const job of this.jobPostings) {
      const analysis = await this.analyzeJobPosting(job.id, job.text);
      if (analysis) {
        analyzedCount++;
        if (analysis.riskScore > 0.7) {
          fraudulentJobs.push({ ...job, analysis });
        }
      }
    }

    this.showLoading(false);
    
    if (fraudulentJobs.length > 0) {
      this.highlightFraudulentJobs(fraudulentJobs);
      this.showNotification(`Found ${fraudulentJobs.length} suspicious job(s)`, 'warning');
    } else {
      this.showNotification(`Analyzed ${analyzedCount} jobs - all appear legitimate`, 'success');
    }

    this.displayJobAnalysisResults();
  }

  async highlightFraudulentJobs(fraudulentJobs) {
    if (!this.currentTab) return;

    try {
      const jobIds = fraudulentJobs.map(job => job.id);
      await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'highlightFraudulentJobs',
        jobIds: jobIds
      });
    } catch (error) {
      console.error('Error highlighting fraudulent jobs:', error);
    }
  }

  updateFraudDetectorUI() {
    const fraudDetectorSection = document.getElementById('fraudDetectorSection');
    if (!fraudDetectorSection) return;

    const statusElement = document.getElementById('fraudDetectorStatus');
    const analyzeButton = document.getElementById('analyzeJobsButton');

    if (!this.fraudDetectorStatus) {
      statusElement.textContent = 'Checking system status...';
      statusElement.className = 'status-value';
      if (analyzeButton) analyzeButton.disabled = true;
      return;
    }
    
    // Update status display with consistent messaging
    let displayMessage = '';
    switch (this.fraudDetectorStatus.status) {
      case 'ready':
        displayMessage = 'AI models loaded and ready';
        break;
      case 'loading':
        displayMessage = `Loading AI models... ${Math.round((this.fraudDetectorStatus.progress || 0) * 100)}%`;
        break;
      case 'error':
        displayMessage = 'Using basic pattern detection (AI models unavailable)';
        break;
      case 'not_initialized':
        displayMessage = 'Using basic pattern detection (AI models unavailable)';
        break;
      case 'fallback':
        displayMessage = 'Using basic pattern detection (AI models unavailable)';
        break;
      default:
        displayMessage = this.fraudDetectorStatus.message || 'Using basic pattern detection (AI models unavailable)';
    }
    
    statusElement.textContent = displayMessage;
    
    // Apply appropriate CSS classes based on status
    switch (this.fraudDetectorStatus.status) {
      case 'ready':
        statusElement.className = 'status-value status-ready';
        break;
      case 'loading':
        statusElement.className = 'status-value status-loading';
        break;
      case 'error':
      case 'not_initialized':
        statusElement.className = 'status-value status-error';
        break;
      case 'fallback':
        statusElement.className = 'status-value status-warning';
        break;
      default:
        statusElement.className = 'status-value';
    }
    
    // Enable/disable analyze button based on canAnalyze flag and job availability
    if (analyzeButton) {
      const canAnalyze = this.fraudDetectorStatus.canAnalyze && this.jobPostings.length > 0;
      analyzeButton.disabled = !canAnalyze;
      
      // Update button text based on status
      if (this.fraudDetectorStatus.status === 'loading') {
        analyzeButton.textContent = 'Loading Models...';
      } else if (this.fraudDetectorStatus.status === 'fallback') {
        analyzeButton.textContent = 'Analyze Jobs (Basic)';
      } else {
        analyzeButton.textContent = 'Analyze Jobs';
      }
    }
  }

  updateJobPostingsUI() {
    const jobCountElement = document.getElementById('jobCount');
    if (jobCountElement) {
      jobCountElement.textContent = this.jobPostings.length;
    }

    const analyzeButton = document.getElementById('analyzeJobsButton');
    if (analyzeButton) {
      analyzeButton.disabled = this.jobPostings.length === 0 || !this.fraudDetectorStatus?.initialized;
    }
  }

  updateJobPostingsDisplay() {
    // Update job postings UI when restoring state
    this.updateJobPostingsUI();
    
    // Update analysis results display if we have any
    if (this.fraudAnalysisResults.size > 0) {
      this.displayJobAnalysisResults();
    }
  }

  async updateCommunitySection() {
    const reportButton = document.getElementById('reportButton');
    const upvoteButton = document.getElementById('upvoteButton');
    const downvoteButton = document.getElementById('downvoteButton');
    const reportDomainName = document.getElementById('reportDomainName');
    
    if (!this.currentTab) return;
    
    try {
      const domain = new URL(this.currentTab.url).hostname;
      if (reportDomainName) {
        reportDomainName.textContent = domain;
      }
      
      // Check Firebase connection status
      const response = await chrome.runtime.sendMessage({
        action: 'getCommunityData',
        url: this.currentTab.url
      });
      
      // Check if user has already voted on this URL
      const voteCheckResponse = await chrome.runtime.sendMessage({
        action: 'checkUserVote',
        url: this.currentTab.url
      });
      
      if (response && response.success) {
        // Firebase is available, enable buttons
        if (reportButton) {
          reportButton.disabled = response.data.isBlacklisted; // Disable if already reported
          reportButton.title = response.data.isBlacklisted ? 'URL already reported' : 'Report this URL as fraudulent';
        }
        
        if (upvoteButton && downvoteButton) {
          // Check if user has already voted
          if (voteCheckResponse && voteCheckResponse.hasVoted) {
            const userVoteType = voteCheckResponse.voteType;
            
            if (userVoteType === 'upvote') {
              // User has upvoted - disable upvote button, enable downvote
              upvoteButton.disabled = true;
              downvoteButton.disabled = false;
              upvoteButton.querySelector('.vote-text').textContent = 'Upvoted';
              downvoteButton.querySelector('.vote-text').textContent = 'Downvote';
              upvoteButton.title = 'You have upvoted this URL';
              downvoteButton.title = 'Change your vote to downvote';
              upvoteButton.classList.add('voted');
              downvoteButton.classList.remove('voted');
            } else if (userVoteType === 'downvote') {
              // User has downvoted - disable downvote button, enable upvote
              upvoteButton.disabled = false;
              downvoteButton.disabled = true;
              upvoteButton.querySelector('.vote-text').textContent = 'Upvote';
              downvoteButton.querySelector('.vote-text').textContent = 'Downvoted';
              upvoteButton.title = 'Change your vote to upvote';
              downvoteButton.title = 'You have downvoted this URL';
              upvoteButton.classList.remove('voted');
              downvoteButton.classList.add('voted');
            }
          } else {
            // User hasn't voted - enable both buttons
            upvoteButton.disabled = false;
            downvoteButton.disabled = false;
            upvoteButton.querySelector('.vote-text').textContent = 'Upvote';
            downvoteButton.querySelector('.vote-text').textContent = 'Downvote';
            upvoteButton.title = 'Upvote this URL';
            downvoteButton.title = 'Downvote this URL';
            upvoteButton.classList.remove('voted');
            downvoteButton.classList.remove('voted');
          }
        }
        
        // Update community stats
        const totalReports = document.getElementById('totalReports');
        const communityReports = document.getElementById('communityReports');
        
        if (totalReports) {
          totalReports.textContent = response.data.totalReports || 0;
        }
        if (communityReports) {
          communityReports.textContent = response.data.reports || 0;
        }
      } else {
        // Firebase not available, disable buttons
        if (reportButton) {
          reportButton.disabled = true;
          reportButton.title = 'Community features unavailable (Firebase not connected)';
        }
        
        if (upvoteButton && downvoteButton) {
          upvoteButton.disabled = true;
          downvoteButton.disabled = true;
          upvoteButton.title = 'Community features unavailable';
          downvoteButton.title = 'Community features unavailable';
        }
      }
    } catch (error) {
      console.error('Error updating community section:', error);
      // Disable buttons on error
      if (reportButton) reportButton.disabled = true;
      if (upvoteButton) upvoteButton.disabled = true;
      if (downvoteButton) downvoteButton.disabled = true;
    }
  }

  displayJobAnalysisResults() {
    const resultsContainer = document.getElementById('jobAnalysisResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '';

    if (this.fraudAnalysisResults.size === 0) {
      resultsContainer.innerHTML = '<div class="job-analysis-item"><p>No analysis results available</p></div>';
      return;
    }

    for (const [jobId, analysis] of this.fraudAnalysisResults) {
      const job = this.jobPostings.find(j => j.id === jobId);
      if (!job) continue;

      const resultElement = document.createElement('div');
      resultElement.className = 'job-analysis-result';
      
      const riskLevel = analysis.riskScore > 0.7 ? 'high' : analysis.riskScore > 0.4 ? 'medium' : 'low';
      const riskPercentage = Math.round(analysis.riskScore * 100);
      
      resultElement.innerHTML = `
        <div class="job-analysis-item">
          <div class="job-title">${job.title || 'Job Posting'}</div>
          <div class="risk-level ${riskLevel}">
            <span class="risk-score">${riskPercentage}%</span>
            <span class="risk-label">${riskLevel.toUpperCase()} RISK</span>
          </div>
          <div class="analysis-details">
            <div class="detail-item">
              <span class="detail-label">Confidence:</span>
              <span class="detail-value">${Math.round(analysis.confidence * 100)}%</span>
            </div>
            ${analysis.reasons.length > 0 ? `<div class="detail-item"><span class="detail-label">Reasons:</span><span class="detail-value">${analysis.reasons.join(', ')}</span></div>` : ''}
          </div>
        </div>
      `;
      
      resultsContainer.appendChild(resultElement);
    }
  }

  // Loading screen methods
  showLoadingScreen() {
    console.log('FraudBuster: Attempting to show loading screen...');
    const loadingScreen = document.getElementById('loadingScreen');
    console.log('FraudBuster: Loading screen element found:', !!loadingScreen);
    if (loadingScreen) {
      loadingScreen.style.display = 'flex';
      loadingScreen.classList.add('show');
      console.log('FraudBuster: Loading screen displayed');
    } else {
      console.error('FraudBuster: Loading screen element not found!');
    }
  }

  hideLoadingScreen() {
    console.log('FraudBuster: Attempting to hide loading screen...');
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.classList.add('fade-out');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
        loadingScreen.classList.remove('show', 'fade-out');
        console.log('FraudBuster: Loading screen hidden');
      }, 300);
    } else {
      console.error('FraudBuster: Loading screen element not found for hiding!');
    }
  }

  async updateLoadingState(message, progress, activeStep) {
    console.log(`FraudBuster: Updating loading state - ${message} (${progress}%)`);
    const statusText = document.getElementById('loadingText');
    const progressBar = document.getElementById('progressFill');
    const steps = document.querySelectorAll('.step');

    console.log('FraudBuster: Status text element found:', !!statusText);
    console.log('FraudBuster: Progress bar element found:', !!progressBar);
    console.log('FraudBuster: Steps found:', steps.length);

    if (statusText) {
      statusText.textContent = message;
    } else {
      console.error('FraudBuster: Status text element not found!');
    }

    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    } else {
      console.error('FraudBuster: Progress bar element not found!');
    }

    // Update step states
    steps.forEach((step, index) => {
      const stepId = step.id;
      step.classList.remove('active', 'completed');
      
      if (stepId === activeStep) {
        step.classList.add('active');
        console.log(`FraudBuster: Step ${stepId} set to active`);
      } else if (this.isStepCompleted(stepId, activeStep)) {
        step.classList.add('completed');
        console.log(`FraudBuster: Step ${stepId} set to completed`);
      }
    });

    // Add a small delay to make the loading feel more natural
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  isStepCompleted(stepId, currentStep) {
    const stepOrder = ['step1', 'step2', 'step3', 'step4'];
    const stepIndex = stepOrder.indexOf(stepId);
    const currentIndex = stepOrder.indexOf(currentStep);
    return stepIndex < currentIndex;
  }

  async checkFirstLaunch() {
    console.log('FraudBuster: Checking session initialization status...');
    return new Promise((resolve) => {
      chrome.storage.session.get(['sessionInitialized'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('FraudBuster: Error accessing session storage:', chrome.runtime.lastError);
          resolve(false); // Default to not showing loading screen on error
          return;
        }
        
        const isFirstLaunchThisSession = !result.sessionInitialized;
        console.log('FraudBuster: Is first launch this session:', isFirstLaunchThisSession);
        
        if (isFirstLaunchThisSession) {
          // Mark session as initialized
          chrome.storage.session.set({ sessionInitialized: true }, () => {
            if (chrome.runtime.lastError) {
              console.error('FraudBuster: Error setting session flag:', chrome.runtime.lastError);
            } else {
              console.log('FraudBuster: Session marked as initialized');
            }
          });
          // Add delay for first launch of session
          setTimeout(() => resolve(true), 500);
        } else {
          console.log('FraudBuster: Skipping loading screen - already initialized this session');
          resolve(false);
        }
      });
    });
  }

  // Update loading state from background script
  updateLoadingStateFromBackground(message, progress) {
    console.log(`FraudBuster: Background update - ${message} (${progress}%)`);
    const statusText = document.getElementById('loadingText');
    const progressBar = document.getElementById('progressFill');

    if (statusText) {
      statusText.textContent = message;
    }

    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
  }

  // Show domain status dialog and return user choice
  async showDomainStatusDialog(domainInfo) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('domainStatusDialog');
      const domainName = document.getElementById('dialogDomainName');
      const domainReports = document.getElementById('dialogDomainReports');
      const skipButton = document.getElementById('skipNlpButton');
      const proceedButton = document.getElementById('proceedNlpButton');

      // Update dialog content
      domainName.textContent = domainInfo.domain;
      domainReports.textContent = `Reported by ${domainInfo.reportCount || 0} users`;

      // Show dialog
      dialog.style.display = 'flex';

      // Handle button clicks
      const handleSkip = () => {
        dialog.style.display = 'none';
        skipButton.removeEventListener('click', handleSkip);
        proceedButton.removeEventListener('click', handleProceed);
        resolve('skip');
      };

      const handleProceed = () => {
        dialog.style.display = 'none';
        skipButton.removeEventListener('click', handleSkip);
        proceedButton.removeEventListener('click', handleProceed);
        resolve('proceed');
      };

      skipButton.addEventListener('click', handleSkip);
      proceedButton.addEventListener('click', handleProceed);
    });
  }

  // Display results for domain-only analysis (when user skips NLP)
  displayDomainOnlyResults(domainInfo) {
    const resultsSection = document.getElementById('resultsSection');
    const riskCircle = document.getElementById('riskCircle');
    const riskPercentage = document.getElementById('riskPercentage');
    const riskTitle = document.getElementById('riskTitle');
    const riskDescription = document.getElementById('riskDescription');
    const mlConfidence = document.getElementById('mlConfidence');
    const communityReports = document.getElementById('communityReports');
    const domainStatus = document.getElementById('domainStatus');
    const totalReports = document.getElementById('totalReports');

    // Show results section
    resultsSection.style.display = 'block';

    // Set high risk for blacklisted domains
    const riskScore = 85; // High risk for blacklisted domains
    riskPercentage.textContent = `${riskScore}%`;

    // Set danger styling
    riskCircle.className = 'risk-circle danger';
    riskTitle.textContent = 'High Risk';
    riskDescription.textContent = 'This domain is known to be fraudulent';

    // Update analysis details
    mlConfidence.textContent = 'Domain Check';
    communityReports.textContent = domainInfo.reportCount || 0;
    domainStatus.textContent = 'Blacklisted';
    totalReports.textContent = domainInfo.reportCount || 0;

    // Hide loading and update status
    this.showLoading(false);
    this.updateStatus();
  }
}

// Standalone helper functions for user feedback
function handleFeedbackSelection(feedbackType) {
  // Store the selected feedback type
  window.selectedFeedback = feedbackType;
  
  // Update button states
  const buttons = document.querySelectorAll('.feedback-button');
  buttons.forEach(btn => btn.classList.remove('selected'));
  
  const selectedButton = document.getElementById(`feedback${feedbackType.charAt(0).toUpperCase() + feedbackType.slice(1)}`);
  if (selectedButton) {
    selectedButton.classList.add('selected');
  }
  
  // Show details section for incorrect feedback
  const feedbackDetails = document.getElementById('feedbackDetails');
  if (feedbackType === 'incorrect' && feedbackDetails) {
    feedbackDetails.style.display = 'block';
  } else if (feedbackDetails) {
    feedbackDetails.style.display = 'none';
    // Auto-submit for correct/unsure feedback
    setTimeout(() => submitUserFeedback(), 500);
  }
}

// Submit user feedback
async function submitUserFeedback() {
  try {
    if (!window.selectedFeedback) {
      showNotification('Please select a feedback option', 'error');
      return;
    }
    
    const feedbackComment = document.getElementById('feedbackComment');
    const comment = feedbackComment ? feedbackComment.value.trim() : '';
    
    // Get current tab and analysis data
    const tabs = await new Promise(resolve => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });
    
    if (!tabs[0]) {
      throw new Error('No active tab found');
    }
    
    const feedbackData = {
      feedbackType: window.selectedFeedback,
      comment: comment,
      url: tabs[0].url,
      domain: new URL(tabs[0].url).hostname,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
    
    // Send feedback to background script
    chrome.runtime.sendMessage({
      action: 'submitUserFeedback',
      data: feedbackData
    }, (response) => {
      if (response && response.success) {
        showFeedbackSuccess();
      } else {
        throw new Error(response?.error || 'Failed to submit feedback');
      }
    });
    
  } catch (error) {
    console.error('Error submitting user feedback:', error);
    showNotification('Failed to submit feedback', 'error');
  }
}

// Show feedback success message
function showFeedbackSuccess() {
  const feedbackDetails = document.getElementById('feedbackDetails');
  const feedbackSuccess = document.getElementById('feedbackSuccess');
  const feedbackButtons = document.querySelector('.feedback-buttons');
  
  if (feedbackDetails) feedbackDetails.style.display = 'none';
  if (feedbackButtons) feedbackButtons.style.display = 'none';
  if (feedbackSuccess) {
    feedbackSuccess.style.display = 'block';
    
    // Hide feedback section after 3 seconds
    setTimeout(() => {
      const feedbackSection = document.getElementById('userFeedbackSection');
      if (feedbackSection) {
        feedbackSection.style.display = 'none';
      }
    }, 3000);
  }
}

// Show user feedback section when analysis is displayed
function showUserFeedbackSection() {
  const feedbackSection = document.getElementById('userFeedbackSection');
  if (feedbackSection) {
    feedbackSection.style.display = 'block';
  }
}

// Show notification helper function
function showNotification(message, type) {
  // Try to use the popup instance if available
  if (window.fraudBusterPopupInstance) {
    window.fraudBusterPopupInstance.showNotification(message, type);
  } else {
    console.log(`${type.toUpperCase()}: ${message}`);
  }
}

// Initialize user feedback system as standalone function
function initializeUserFeedbackSystem() {
  const feedbackCorrect = document.getElementById('feedbackCorrect');
  const feedbackIncorrect = document.getElementById('feedbackIncorrect');
  const feedbackUnsure = document.getElementById('feedbackUnsure');
  const submitFeedback = document.getElementById('submitFeedback');
  
  if (feedbackCorrect) {
    feedbackCorrect.addEventListener('click', () => handleFeedbackSelection('correct'));
  }
  
  if (feedbackIncorrect) {
    feedbackIncorrect.addEventListener('click', () => handleFeedbackSelection('incorrect'));
  }
  
  if (feedbackUnsure) {
    feedbackUnsure.addEventListener('click', () => handleFeedbackSelection('unsure'));
  }
  
  if (submitFeedback) {
    submitFeedback.addEventListener('click', submitUserFeedback);
  }
}

// Initialize comprehensive analysis event listeners
function initializeComprehensiveAnalysis() {
  // Manual fraud report buttons
  const reportFraudButton = document.getElementById('reportFraudButton');
  const markLegitimateButton = document.getElementById('markLegitimateButton');
  const submitDomainReportButton = document.getElementById('submitDomainReportButton');
  
  if (reportFraudButton) {
    reportFraudButton.addEventListener('click', async () => {
      const popup = new FraudBusterPopup();
      await popup.handleManualFraudReport(true);
    });
  }
  
  if (markLegitimateButton) {
    markLegitimateButton.addEventListener('click', async () => {
      const popup = new FraudBusterPopup();
      await popup.handleManualFraudReport(false);
    });
  }
  
  if (submitDomainReportButton) {
    submitDomainReportButton.addEventListener('click', async () => {
      const domainName = document.getElementById('reportDomainName').textContent;
      const fraudReason = document.getElementById('fraudReason').value;
      
      if (domainName && domainName !== '--' && fraudReason) {
        const popup = new FraudBusterPopup();
        await popup.handleDomainReport(domainName, fraudReason);
      }
    });
  }
}

// User feedback system
initializeUserFeedbackSystem();

// Listen for comprehensive analysis results from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showComprehensiveAnalysis') {
    const popup = new FraudBusterPopup();
    popup.showComprehensiveAnalysis(message.data);
  } else if (message.action === 'loadingProgress') {
    // Update loading screen from background script
    const popup = new FraudBusterPopup();
    popup.updateLoadingStateFromBackground(message.message, message.progress);
  }
});

// Check if there's already an analysis result for the current tab
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
  if (tabs[0]) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getAnalysisForPopup',
        tabId: tabs[0].id
      });
      
      if (response && response.analysisResult) {
        const popup = new FraudBusterPopup();
        popup.showComprehensiveAnalysis(response.analysisResult);
      }
    } catch (error) {
      console.log('No existing analysis result found');
    }
  }
});

// Initialize page classification feedback system
function initializePageClassificationFeedback() {
  const classificationCorrect = document.getElementById('classificationCorrect');
  const classificationIncorrect = document.getElementById('classificationIncorrect');
  const submitClassificationFeedback = document.getElementById('submitClassificationFeedback');
  
  if (classificationCorrect) {
    classificationCorrect.addEventListener('click', () => {
      handleClassificationFeedback('correct');
    });
  }
  
  if (classificationIncorrect) {
    classificationIncorrect.addEventListener('click', () => {
      handleClassificationFeedback('incorrect');
    });
  }
  
  if (submitClassificationFeedback) {
    submitClassificationFeedback.addEventListener('click', submitClassificationFeedback);
  }
}

// Handle classification feedback selection
function handleClassificationFeedback(feedbackType) {
  const feedbackDetails = document.getElementById('classificationFeedbackDetails');
  
  if (feedbackType === 'correct') {
    // Hide feedback details for correct classification
    if (feedbackDetails) {
      feedbackDetails.style.display = 'none';
    }
    
    // Submit positive feedback immediately
    submitClassificationFeedbackData('correct', null, null);
  } else if (feedbackType === 'incorrect') {
    // Show feedback details for incorrect classification
    if (feedbackDetails) {
      feedbackDetails.style.display = 'block';
    }
  }
}

// Submit classification feedback
async function submitClassificationFeedbackData(feedbackType, correctClassification, comment) {
  try {
    const tabs = await new Promise(resolve => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });
    
    if (!tabs[0]) {
      throw new Error('No active tab found');
    }
    
    const feedbackData = {
      feedbackType: feedbackType,
      correctClassification: correctClassification,
      comment: comment || '',
      url: tabs[0].url,
      domain: new URL(tabs[0].url).hostname,
      timestamp: new Date().toISOString()
    };
    
    // Send classification feedback to background script
    chrome.runtime.sendMessage({
      action: 'submitClassificationFeedback',
      data: feedbackData
    }, (response) => {
      if (response && response.success) {
        showNotification('Classification feedback submitted successfully', 'success');
        
        // Hide classification feedback section after successful submission
        const classificationFeedback = document.getElementById('classificationFeedback');
        if (classificationFeedback) {
          classificationFeedback.style.display = 'none';
        }
      } else {
        throw new Error(response?.error || 'Failed to submit classification feedback');
      }
    });
    
  } catch (error) {
    console.error('Error submitting classification feedback:', error);
    showNotification('Failed to submit classification feedback', 'error');
  }
}

// Submit classification feedback with details
function submitClassificationFeedback() {
  const correctClassification = document.getElementById('correctClassification').value;
  const comment = document.getElementById('classificationComment').value.trim();
  
  submitClassificationFeedbackData('incorrect', correctClassification, comment);
}

// Initialize learning system refresh
function initializeLearningSystem() {
  const refreshLearningData = document.getElementById('refreshLearningData');
  
  if (refreshLearningData) {
    refreshLearningData.addEventListener('click', async () => {
      try {
        // Show loading state
        refreshLearningData.disabled = true;
        refreshLearningData.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
          Refreshing...
        `;
        
        // Request learning data refresh from background script
        chrome.runtime.sendMessage({
          action: 'refreshLearningData'
        }, (response) => {
          if (response && response.success) {
            showNotification('Learning data refreshed successfully', 'success');
            
            // Update learning metrics display
            if (response.metrics) {
              updateLearningMetrics(response.metrics);
            }
          } else {
            throw new Error(response?.error || 'Failed to refresh learning data');
          }
          
          // Restore button state
          refreshLearningData.disabled = false;
          refreshLearningData.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
            Refresh Learning Data
          `;
        });
        
      } catch (error) {
        console.error('Error refreshing learning data:', error);
        showNotification('Failed to refresh learning data', 'error');
        
        // Restore button state
        refreshLearningData.disabled = false;
        refreshLearningData.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
          </svg>
          Refresh Learning Data
        `;
      }
    });
  }
}

// Update learning metrics display
function updateLearningMetrics(metrics) {
  const elements = {
    patternsLearnedValue: metrics.patternsLearned || '--',
    accuracyImprovementValue: metrics.accuracyImprovement ? `+${metrics.accuracyImprovement}%` : '--',
    falsePositivesReducedValue: metrics.falsePositivesReduced || '--',
    lastModelUpdateValue: metrics.lastModelUpdate || '--'
  };
  
  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  });
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create popup instance and store globally for standalone functions
  window.fraudBusterPopupInstance = new FraudBusterPopup();
  
  // Initialize comprehensive analysis event listeners
  initializeComprehensiveAnalysis();
  
  // Initialize page classification feedback system
  initializePageClassificationFeedback();
  
  // Initialize learning system
  initializeLearningSystem();
  
  // Update version from manifest
  updateVersionFromManifest();
});

// Function to update version from manifest.json
function updateVersionFromManifest() {
  const manifest = chrome.runtime.getManifest();
  const versionElement = document.querySelector('.version');
  
  if (versionElement && manifest.version) {
    versionElement.textContent = `v${manifest.version}`;
  }
}