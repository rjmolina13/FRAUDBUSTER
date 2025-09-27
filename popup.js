// FraudBuster Popup JavaScript
class FraudBusterPopup {
  constructor() {
    this.isExtensionActive = false;
    this.currentTab = null;
    this.scanResults = null;
    this.fraudDetectorStatus = null;
    this.jobPostings = [];
    this.fraudAnalysisResults = new Map();
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
    await this.loadSettings();
    await this.getCurrentTab();
    await this.checkFraudDetectorStatus();
    await this.detectJobPostings();
    this.setupEventListeners();
    this.updateUI();
    this.applyTheme();
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      console.error('Error getting current tab:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get({
        extensionActive: false,
        autoScan: false,
        sensitivity: 5,
        darkMode: 'auto',
        userContributions: 0
      });
      
      this.isExtensionActive = result.extensionActive;
      this.userSettings = {
        autoScan: result.autoScan,
        sensitivity: result.sensitivity,
        darkMode: result.darkMode
      };
      
      document.getElementById('userContributions').textContent = result.userContributions;
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        extensionActive: this.isExtensionActive,
        autoScan: this.userSettings.autoScan,
        sensitivity: this.userSettings.sensitivity,
        darkMode: this.userSettings.darkMode
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  setupEventListeners() {
    // Extension toggle
    const extensionToggle = document.getElementById('extensionToggle');
    extensionToggle.checked = this.isExtensionActive;
    extensionToggle.addEventListener('change', (e) => {
      this.isExtensionActive = e.target.checked;
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
      statusText.textContent = 'Ready';
      statusDot.className = 'status-dot';
    } else {
      scanButton.disabled = true;
      toggleLabel.textContent = 'Inactive';
      statusText.textContent = 'Inactive';
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
    if (!this.currentTab || !this.isExtensionActive) return;

    this.showLoading(true);
    this.updateScanStatus('Analyzing page...');

    try {
      // Send message to background script to start scan
      const response = await chrome.runtime.sendMessage({
        action: 'scanPage',
        data: {
          pageUrl: this.currentTab.url,
          domain: new URL(this.currentTab.url).hostname,
          tabId: this.currentTab.id,
          sensitivity: this.userSettings.sensitivity
        }
      });

      if (response.success) {
        this.scanResults = response.results;
        this.displayResults(response.results);
      } else {
        this.showError(response.error || 'Scan failed');
      }
    } catch (error) {
      console.error('Scan error:', error);
      this.showError('Failed to scan page');
    } finally {
      this.showLoading(false);
    }
  }

  displayResults(results) {
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

    // Update risk indicator
    const riskScore = Math.round(results.overallRisk * 100);
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

    // Update analysis details
    mlConfidence.textContent = `${Math.round(results.mlConfidence * 100)}%`;
    communityReports.textContent = results.communityReports || 0;
    domainStatus.textContent = results.isBlacklisted ? 'Blacklisted' : 'Clean';
    totalReports.textContent = results.totalReports || 0;
  }

  async reportURL() {
    if (!this.currentTab) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'reportURL',
        url: this.currentTab.url,
        reason: 'User reported suspicious content'
      });

      if (response.success) {
        this.showNotification('URL reported successfully', 'success');
        this.updateUserContributions();
      } else {
        this.showNotification('Failed to report URL', 'error');
      }
    } catch (error) {
      console.error('Report error:', error);
      this.showNotification('Failed to report URL', 'error');
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
        this.showNotification(`${voteType === 'upvote' ? 'Upvoted' : 'Downvoted'} successfully`, 'success');
        this.updateUserContributions();
      } else {
        this.showNotification('Failed to submit vote', 'error');
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
      statusElement.textContent = 'Checking...';
      statusElement.className = 'status-value';
      if (analyzeButton) analyzeButton.disabled = true;
      return;
    }
    
    // Update status display based on the enhanced status
    statusElement.textContent = this.fraudDetectorStatus.message || this.fraudDetectorStatus.status;
    
    // Apply appropriate CSS classes based on status
    switch (this.fraudDetectorStatus.status) {
      case 'ready':
        statusElement.className = 'status-value status-ready';
        break;
      case 'loading':
        statusElement.className = 'status-value status-loading';
        // Add loading animation if available
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

  displayJobAnalysisResults() {
    const resultsContainer = document.getElementById('jobAnalysisResults');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = '';

    if (this.fraudAnalysisResults.size === 0) {
      resultsContainer.innerHTML = '<p class="no-results">No analysis results available</p>';
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
        <div class="job-title">${job.title || 'Job Posting'}</div>
        <div class="risk-indicator risk-${riskLevel}">
          <span class="risk-score">${riskPercentage}%</span>
          <span class="risk-label">${riskLevel.toUpperCase()} RISK</span>
        </div>
        <div class="analysis-details">
          <div class="confidence">Confidence: ${Math.round(analysis.confidence * 100)}%</div>
          ${analysis.reasons.length > 0 ? `<div class="reasons">Reasons: ${analysis.reasons.join(', ')}</div>` : ''}
        </div>
      `;
      
      resultsContainer.appendChild(resultElement);
    }
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
  
  // User feedback system
  initializeUserFeedbackSystem();
  
  // Listen for comprehensive analysis results from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showComprehensiveAnalysis') {
      const popup = new FraudBusterPopup();
      popup.showComprehensiveAnalysis(message.data);
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
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create popup instance and store globally for standalone functions
  window.fraudBusterPopupInstance = new FraudBusterPopup();
  
  // Initialize comprehensive analysis event listeners
  initializeComprehensiveAnalysis();
});