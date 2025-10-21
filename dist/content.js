// FraudBuster Content Script
// This script runs in the context of web pages to extract data for fraud analysis

// Prevent duplicate initialization
if (window.fraudBusterContentScriptLoaded) {
  console.log('FraudBuster content script already loaded, skipping...');
} else {
  window.fraudBusterContentScriptLoaded = true;

class FraudBusterContentScript {
  constructor() {
    console.log('🔍 FraudBuster Content Script loaded on:', window.location.href);
    this.pageData = null;
    this.isAnalyzing = false;
    this.jobPostings = [];
    this.fraudAnalysisResults = new Map();
    this.jobKeywords = null;
    this.fraudPatterns = null;
    this.isDataLoaded = false;
    
    this.init();
  }

  async init() {
    console.log('FraudBuster content script initializing on:', window.location.href);
    
    // Check if extension is active for current domain BEFORE running any background processes
    try {
      const currentDomain = window.location.hostname;
      const settings = await chrome.storage.sync.get(['domainStates']);
      const domainStates = settings.domainStates || {};
      
      if (!domainStates[currentDomain]) {
        console.log(`🔍 FraudBuster: Extension inactive for domain ${currentDomain} - skipping all background processes`);
        
        // Still listen for messages in case user toggles extension on
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          this.handleMessage(request, sender, sendResponse);
          return true; // Keep message channel open for async response
        });
        
        return; // Exit early - no background processes will run
      }
      
      console.log(`🔍 FraudBuster: Extension active for domain ${currentDomain} - proceeding with initialization`);
    } catch (error) {
      console.error('Error checking extension status during initialization:', error);
      // If we can't check status, don't run background processes for safety
      console.log('🔍 FraudBuster: Cannot verify domain status - skipping background processes for safety');
      
      // Still listen for messages
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        this.handleMessage(request, sender, sendResponse);
        return true;
      });
      
      return;
    }
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Load job detection data from Firebase first (only if extension is active)
    this.loadJobDetectionData().then(() => {
      // Extract initial page data and detect job postings
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          console.log('DOM loaded, extracting page data and detecting jobs');
          this.extractPageData();
          this.detectJobPostings();
        });
      } else {
        console.log('DOM already loaded, extracting page data and detecting jobs');
        this.extractPageData();
        this.detectJobPostings();
      }

      // Auto-analyze job postings if on a job site
      this.autoAnalyzeJobPostings();
    }).catch(error => {
      console.error('Failed to load job detection data, using fallback:', error);
      this.initializeFallbackKeywords();
      // Continue with fallback data
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.extractPageData();
          this.detectJobPostings();
        });
      } else {
        this.extractPageData();
        this.detectJobPostings();
      }
      this.autoAnalyzeJobPostings();
    });
  }

  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'extractPageData':
        this.extractPageData()
          .then(data => {
            sendResponse({ success: true, data });
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
        break;
        
      case 'detectJobPostings':
        this.detectJobPostings()
          .then(jobPostings => {
            sendResponse({ success: true, jobPostings });
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
        break;
        
      case 'analyzeJobPosting':
        this.analyzeJobPosting(request.jobText, request.jobId)
          .then(result => {
            sendResponse({ success: true, result });
          })
          .catch(error => {
            sendResponse({ success: false, error: error.message });
          });
        break;
        
      case 'highlightFraudulentJobs':
        this.highlightFraudulentJobs(request.jobIds);
        sendResponse({ success: true });
        break;
        
      case 'highlightSuspiciousElements':
        this.highlightSuspiciousElements(request.elements);
        sendResponse({ success: true });
        break;
        
      case 'removeSuspiciousHighlights':
        this.removeSuspiciousHighlights();
        sendResponse({ success: true });
        break;
        
      case 'scanPage':
        this.scanPage();
        sendResponse({ success: true });
        break;
        
      case 'manualFraudReport':
        this.handleManualFraudReport(request.data);
        sendResponse({ success: true });
        break;
        
      case 'displayToast':
        console.log('DEBUG: Received displayToast message:', request);
        this.displayToast(request.data);
        sendResponse({ success: true });
        break;
        
      case 'ping':
        sendResponse({ success: true, message: 'Content script is ready' });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  async loadJobDetectionData() {
    try {
      console.log('Loading job detection data from Firestore...');
      
      // Request enhanced job detection data from background script (now includes Firestore data)
      const response = await chrome.runtime.sendMessage({
        action: 'getJobDetectionData'
      });
      
      if (response && response.success) {
        this.jobKeywords = response.data.jobKeywords || [];
        this.fraudPatterns = response.data.fraudPatterns || {};
        
        // New Firestore-based data for improved classification
        this.falsePositivePatterns = response.data.falsePositivePatterns || [];
        this.pageClassificationRules = response.data.pageClassificationRules || {};
        this.domainWhitelist = response.data.domainWhitelist || [];
        this.domainBlacklist = response.data.domainBlacklist || [];
        
        this.isDataLoaded = true;
        console.log('Enhanced job detection data loaded from Firestore:', {
          keywordsCount: this.jobKeywords.length,
          patternsCount: Object.keys(this.fraudPatterns).length,
          falsePositivePatternsCount: this.falsePositivePatterns.length,
          whitelistedDomains: this.domainWhitelist.length,
          blacklistedDomains: this.domainBlacklist.length
        });
      } else {
        throw new Error(response?.error || 'Failed to load job detection data');
      }
    } catch (error) {
      console.error('Error loading job detection data:', error);
      throw error;
    }
  }

  initializeFallbackKeywords() {
    console.log('Initializing fallback job keywords...');
    
    // Fallback job keywords when Firestore data is unavailable
    this.jobKeywords = [
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
      'accounting', 'human resources', 'operations', 'project', 'business'
    ];
    
    this.fraudPatterns = {
      suspicious: [
        'easy money', 'guaranteed income', 'no experience', 'mystery shopper',
        'data entry', 'envelope stuffing', 'work from phone', 'copy paste work'
      ]
    };
    
    // Initialize fallback false positive patterns and domain lists
    this.falsePositivePatterns = [
      'legitimate company', 'established business', 'verified employer',
      'official website', 'corporate careers page', 'hr department'
    ];
    
    this.pageClassificationRules = {
      job_posting_indicators: ['apply now', 'job description', 'requirements', 'qualifications'],
      landing_page_indicators: ['about us', 'services', 'contact us', 'home page']
    };
    
    this.domainWhitelist = ['indeed.com', 'linkedin.com', 'glassdoor.com', 'monster.com'];
    this.domainBlacklist = [];
    
    this.isDataLoaded = true;
  }

  async extractPageData() {
    try {
      console.log('🔍 [FRAUDBUSTER DEBUG] extractPageData called');
      this.isAnalyzing = true;
      
      // Detect job postings first
      console.log('🔍 [FRAUDBUSTER DEBUG] About to call detectJobPostings from extractPageData');
      const jobPostings = await this.detectJobPostings();
      console.log('🔍 [FRAUDBUSTER DEBUG] extractPageData: Detected job postings:', jobPostings.length);
      console.log('🔍 [FRAUDBUSTER DEBUG] extractPageData: Job postings data:', jobPostings);
      
      // Extract page features for classification
      const pageFeatures = this.extractPageFeatures();
      
      const data = {
        // Basic page information
        url: window.location.href,
        domain: window.location.hostname,
        title: document.title,
        
        // Job postings data - CRITICAL for fraud analysis
        jobPostings: jobPostings,
        
        // Page classification features
        pageFeatures: pageFeatures,
        
        // Text content analysis
        textContent: this.extractTextContent(),
        headings: this.extractHeadings(),
        
        // Form analysis
        forms: this.analyzeForms(),
        hasPasswordField: this.hasPasswordField(),
        hasEmailField: this.hasEmailField(),
        hasCreditCardField: this.hasCreditCardField(),
        
        // Link analysis
        links: this.analyzeLinks(),
        hasExternalLinks: this.hasExternalLinks(),
        suspiciousLinks: this.findSuspiciousLinks(),
        
        // Image analysis
        images: this.analyzeImages(),
        
        // Script analysis
        scripts: this.analyzeScripts(),
        
        // Meta information
        metaTags: this.extractMetaTags(),
        
        // Security indicators
        isHTTPS: window.location.protocol === 'https:',
        hasSSLCert: window.location.protocol === 'https:',
        
        // Domain analysis
        isDomainNew: this.isDomainNew(),
        domainLength: window.location.hostname.length,
        hasSubdomains: window.location.hostname.split('.').length > 2,
        
        // Page structure
        elementCounts: this.getElementCounts(),
        
        // Timestamp
        extractedAt: new Date().toISOString()
      };
      
      this.pageData = data;
      this.isAnalyzing = false;
      
      return data;
    } catch (error) {
      this.isAnalyzing = false;
      console.error('Error extracting page data:', error);
      throw error;
    }
  }

  extractTextContent() {
    // Get visible text content, excluding script and style elements
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // Check if element is visible
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let textContent = '';
    let node;
    
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      if (text.length > 0) {
        textContent += text + ' ';
      }
    }
    
    return textContent.trim();
  }

  extractHeadings() {
    const headings = [];
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    headingElements.forEach(heading => {
      headings.push({
        level: parseInt(heading.tagName.charAt(1)),
        text: heading.textContent.trim(),
        id: heading.id || null
      });
    });
    
    return headings;
  }

  analyzeForms() {
    const forms = [];
    const formElements = document.querySelectorAll('form');
    
    formElements.forEach((form, index) => {
      const inputs = form.querySelectorAll('input, select, textarea');
      const inputTypes = [];
      const inputNames = [];
      
      inputs.forEach(input => {
        inputTypes.push(input.type || input.tagName.toLowerCase());
        if (input.name) inputNames.push(input.name.toLowerCase());
        if (input.id) inputNames.push(input.id.toLowerCase());
      });
      
      forms.push({
        index,
        action: form.action || '',
        method: form.method || 'get',
        inputCount: inputs.length,
        inputTypes,
        inputNames,
        hasSubmitButton: form.querySelector('input[type="submit"], button[type="submit"], button:not([type])') !== null
      });
    });
    
    return forms;
  }

  hasPasswordField() {
    return document.querySelector('input[type="password"]') !== null;
  }

  hasEmailField() {
    const emailInputs = document.querySelectorAll('input[type="email"]');
    const emailNameInputs = document.querySelectorAll('input[name*="email"], input[id*="email"]');
    return emailInputs.length > 0 || emailNameInputs.length > 0;
  }

  hasCreditCardField() {
    const ccPatterns = ['card', 'credit', 'cc', 'cvv', 'cvc', 'expir'];
    const inputs = document.querySelectorAll('input');
    
    for (const input of inputs) {
      const name = (input.name || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      const placeholder = (input.placeholder || '').toLowerCase();
      
      for (const pattern of ccPatterns) {
        if (name.includes(pattern) || id.includes(pattern) || placeholder.includes(pattern)) {
          return true;
        }
      }
    }
    
    return false;
  }

  analyzeLinks() {
    const links = [];
    const linkElements = document.querySelectorAll('a[href]');
    
    linkElements.forEach(link => {
      const href = link.href;
      const text = link.textContent.trim();
      
      links.push({
        href,
        text,
        isExternal: this.isExternalLink(href),
        isSuspicious: this.isSuspiciousLink(href, text),
        domain: this.extractDomain(href)
      });
    });
    
    return links.slice(0, 50); // Limit to first 50 links
  }

  hasExternalLinks() {
    const links = document.querySelectorAll('a[href]');
    const currentDomain = window.location.hostname;
    
    for (const link of links) {
      if (this.isExternalLink(link.href)) {
        return true;
      }
    }
    
    return false;
  }

  findSuspiciousLinks() {
    const suspiciousLinks = [];
    const links = document.querySelectorAll('a[href]');
    
    links.forEach(link => {
      const href = link.href;
      const text = link.textContent.trim();
      
      if (this.isSuspiciousLink(href, text)) {
        suspiciousLinks.push({
          href,
          text,
          reason: this.getSuspiciousLinkReason(href, text)
        });
      }
    });
    
    return suspiciousLinks;
  }

  isExternalLink(href) {
    try {
      const url = new URL(href, window.location.href);
      return url.hostname !== window.location.hostname;
    } catch {
      return false;
    }
  }

  isSuspiciousLink(href, text) {
    const suspiciousPatterns = [
      /bit\.ly|tinyurl|t\.co|goo\.gl/, // URL shorteners
      /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/, // IP addresses
      /[a-z0-9]{20,}\.(com|net|org)/, // Random domain names
    ];
    
    const suspiciousTexts = [
      'click here', 'verify now', 'update account', 'confirm identity',
      'urgent action', 'limited time', 'act now', 'claim reward'
    ];
    
    // Check URL patterns
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(href)) return true;
    }
    
    // Check link text
    const lowerText = text.toLowerCase();
    for (const suspiciousText of suspiciousTexts) {
      if (lowerText.includes(suspiciousText)) return true;
    }
    
    return false;
  }

  getSuspiciousLinkReason(href, text) {
    if (/bit\.ly|tinyurl|t\.co|goo\.gl/.test(href)) return 'URL shortener';
    if (/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/.test(href)) return 'IP address';
    if (/[a-z0-9]{20,}\.(com|net|org)/.test(href)) return 'Random domain';
    if (text.toLowerCase().includes('click here')) return 'Suspicious text';
    return 'Unknown';
  }

  extractDomain(href) {
    try {
      const url = new URL(href, window.location.href);
      return url.hostname;
    } catch {
      return null;
    }
  }

  analyzeImages() {
    const images = [];
    const imgElements = document.querySelectorAll('img[src]');
    
    imgElements.forEach(img => {
      images.push({
        src: img.src,
        alt: img.alt || '',
        width: img.width || 0,
        height: img.height || 0,
        isExternal: this.isExternalLink(img.src)
      });
    });
    
    return images.slice(0, 20); // Limit to first 20 images
  }

  analyzeScripts() {
    const scripts = [];
    const scriptElements = document.querySelectorAll('script[src]');
    
    scriptElements.forEach(script => {
      scripts.push({
        src: script.src,
        isExternal: this.isExternalLink(script.src),
        async: script.async,
        defer: script.defer
      });
    });
    
    return scripts;
  }

  extractMetaTags() {
    const metaTags = {};
    const metaElements = document.querySelectorAll('meta');
    
    metaElements.forEach(meta => {
      const name = meta.name || meta.property || meta.httpEquiv;
      const content = meta.content;
      
      if (name && content) {
        metaTags[name.toLowerCase()] = content;
      }
    });
    
    return metaTags;
  }

  isDomainNew() {
    // This is a simplified check - in a real implementation,
    // you would check domain registration date via an API
    let domain;
    try {
      domain = window.location.hostname;
    } catch (error) {
      console.error('Error getting hostname:', error);
      return false;
    }
    
    // Check for patterns that might indicate a new/suspicious domain
    const suspiciousPatterns = [
      /[0-9]{4,}/, // Contains long numbers
      /[a-z]{20,}/, // Very long domain name
      /-{2,}/, // Multiple consecutive hyphens
      /\d+[a-z]+\d+/, // Mixed numbers and letters
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(domain));
  }

  getElementCounts() {
    return {
      divs: document.querySelectorAll('div').length,
      spans: document.querySelectorAll('span').length,
      paragraphs: document.querySelectorAll('p').length,
      links: document.querySelectorAll('a').length,
      images: document.querySelectorAll('img').length,
      forms: document.querySelectorAll('form').length,
      inputs: document.querySelectorAll('input').length,
      buttons: document.querySelectorAll('button').length,
      scripts: document.querySelectorAll('script').length,
      iframes: document.querySelectorAll('iframe').length
    };
  }

  // Job posting detection and analysis methods - Optimized for speed
  async detectJobPostings() {
    try {
      const startTime = performance.now();
      let hostname;
      try {
        hostname = window.location.hostname.toLowerCase();
      } catch (error) {
        console.error('Error getting hostname:', error);
        return [];
      }
      const jobPostings = [];
      
      console.log('🔍 [FRAUDBUSTER DEBUG] detectJobPostings called');
      console.log('🔍 [FRAUDBUSTER DEBUG] Hostname:', hostname);
      console.log('🔍 [FRAUDBUSTER DEBUG] Current URL:', window.location.href);
      console.log('🔍 [FRAUDBUSTER DEBUG] Document ready state:', document.readyState);
      
      // Use optimized detection methods for speed
      if (hostname.includes('indeed.com')) {
        console.log('🔍 [FRAUDBUSTER DEBUG] Using Indeed detection');
        jobPostings.push(...this.detectIndeedJobsFast());
      } else if (hostname.includes('linkedin.com')) {
        console.log('🔍 [FRAUDBUSTER DEBUG] Using LinkedIn detection');
        jobPostings.push(...this.detectLinkedInJobsFast());
      } else if (hostname.includes('glassdoor.com')) {
        console.log('🔍 [FRAUDBUSTER DEBUG] Using Glassdoor detection');
        jobPostings.push(...this.detectGlassdoorJobsFast());
      } else if (hostname.includes('monster.com')) {
        console.log('🔍 [FRAUDBUSTER DEBUG] Using Monster detection');
        jobPostings.push(...this.detectMonsterJobsFast());
      } else if (hostname.includes('ziprecruiter.com')) {
        console.log('🔍 [FRAUDBUSTER DEBUG] Using ZipRecruiter detection');
        jobPostings.push(...this.detectZipRecruiterJobsFast());
      } else {
        // Fast generic job posting detection
        console.log('🔍 [FRAUDBUSTER DEBUG] Using fast generic job detection for hostname:', hostname);
        const genericJobs = this.detectGenericJobsFast();
        console.log('🔍 [FRAUDBUSTER DEBUG] Fast generic job detection found:', genericJobs.length, 'jobs');
        console.log('🔍 [FRAUDBUSTER DEBUG] Generic jobs result:', genericJobs);
        jobPostings.push(...genericJobs);
      }
      
      const endTime = performance.now();
      console.log(`🔍 [FRAUDBUSTER DEBUG] Job detection completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log('🔍 [FRAUDBUSTER DEBUG] Total job postings detected:', jobPostings.length);
      console.log('🔍 [FRAUDBUSTER DEBUG] Final jobPostings array:', jobPostings);
      this.jobPostings = jobPostings;
      return jobPostings;
    } catch (error) {
      console.error('🔍 [FRAUDBUSTER DEBUG] Error detecting job postings:', error);
      return [];
    }
  }

  detectIndeedJobs() {
    const jobs = [];
    const jobElements = document.querySelectorAll('[data-jk], .jobsearch-SerpJobCard, .job_seen_beacon');
    
    jobElements.forEach((element, index) => {
      const titleElement = element.querySelector('h2 a, .jobTitle a, [data-testid="job-title"]');
      const companyElement = element.querySelector('.companyName, [data-testid="company-name"]');
      const descriptionElement = element.querySelector('.summary, [data-testid="job-snippet"]');
      const locationElement = element.querySelector('[data-testid="job-location"], .companyLocation');
      
      if (titleElement) {
        jobs.push({
          id: `indeed-${index}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Unknown',
          description: descriptionElement ? descriptionElement.textContent.trim() : '',
          location: locationElement ? locationElement.textContent.trim() : '',
          url: titleElement.href || window.location.href,
          element: element,
          site: 'indeed'
        });
      }
    });
    
    return jobs;
  }

  detectLinkedInJobs() {
    const jobs = [];
    const jobElements = document.querySelectorAll('.job-card-container, .jobs-search-results__list-item');
    
    jobElements.forEach((element, index) => {
      const titleElement = element.querySelector('.job-card-list__title, .job-card-container__link');
      const companyElement = element.querySelector('.job-card-container__company-name, .job-card-list__company');
      const descriptionElement = element.querySelector('.job-card-list__snippet, .job-card-container__job-insight');
      const locationElement = element.querySelector('.job-card-container__metadata-item, .job-card-list__metadata');
      
      if (titleElement) {
        jobs.push({
          id: `linkedin-${index}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Unknown',
          description: descriptionElement ? descriptionElement.textContent.trim() : '',
          location: locationElement ? locationElement.textContent.trim() : '',
          url: titleElement.href || window.location.href,
          element: element,
          site: 'linkedin'
        });
      }
    });
    
    return jobs;
  }

  detectGlassdoorJobs() {
    const jobs = [];
    const jobElements = document.querySelectorAll('[data-test="job-listing"], .react-job-listing');
    
    jobElements.forEach((element, index) => {
      const titleElement = element.querySelector('[data-test="job-title"], .jobLink');
      const companyElement = element.querySelector('[data-test="employer-name"], .employerName');
      const descriptionElement = element.querySelector('.jobDescription, [data-test="job-description"]');
      const locationElement = element.querySelector('[data-test="job-location"], .loc');
      
      if (titleElement) {
        jobs.push({
          id: `glassdoor-${index}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Unknown',
          description: descriptionElement ? descriptionElement.textContent.trim() : '',
          location: locationElement ? locationElement.textContent.trim() : '',
          url: titleElement.href || window.location.href,
          element: element,
          site: 'glassdoor'
        });
      }
    });
    
    return jobs;
  }

  detectMonsterJobs() {
    const jobs = [];
    const jobElements = document.querySelectorAll('.job-listing, .job-card');
    
    jobElements.forEach((element, index) => {
      const titleElement = element.querySelector('.job-title a, h3 a');
      const companyElement = element.querySelector('.company-name, .company');
      const descriptionElement = element.querySelector('.job-summary, .description');
      const locationElement = element.querySelector('.location, .job-location');
      
      if (titleElement) {
        jobs.push({
          id: `monster-${index}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Unknown',
          description: descriptionElement ? descriptionElement.textContent.trim() : '',
          location: locationElement ? locationElement.textContent.trim() : '',
          url: titleElement.href || window.location.href,
          element: element,
          site: 'monster'
        });
      }
    });
    
    return jobs;
  }

  detectZipRecruiterJobs() {
    const jobs = [];
    const jobElements = document.querySelectorAll('[data-testid="job-card"], .job_content');
    
    jobElements.forEach((element, index) => {
      const titleElement = element.querySelector('[data-testid="job-title"], .job_title a');
      const companyElement = element.querySelector('[data-testid="company-name"], .company_name');
      const descriptionElement = element.querySelector('.job_snippet, .job_description');
      const locationElement = element.querySelector('[data-testid="job-location"], .location');
      
      if (titleElement) {
        jobs.push({
          id: `ziprecruiter-${index}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Unknown',
          description: descriptionElement ? descriptionElement.textContent.trim() : '',
          location: locationElement ? locationElement.textContent.trim() : '',
          url: titleElement.href || window.location.href,
          element: element,
          site: 'ziprecruiter'
        });
      }
    });
    
    return jobs;
  }

  detectGenericJobs() {
    const jobs = [];
    
    console.log('Starting generic job detection...');
    
    if (!this.isDataLoaded) {
      console.warn('Job detection data not loaded yet, using basic detection');
      this.initializeFallbackKeywords();
    }
    
    // Enhanced job posting selectors including test page structure
    const jobContainers = document.querySelectorAll('.job-posting, .job-post, .job-item, .job-card, .posting, [data-job-id], .job-container, .job-offer');
    console.log('Found job containers:', jobContainers.length);
    
    jobContainers.forEach((container, index) => {
      const titleElement = container.querySelector('.job-title, .title, .position-title, h1, h2, h3');
      const companyElement = container.querySelector('.company, .employer, .company-name');
      const descriptionElement = container.querySelector('.description, .job-description, .content');
      
      if (titleElement) {
        const title = titleElement.textContent.trim();
        const company = companyElement ? companyElement.textContent.trim() : 'Unknown';
        const description = descriptionElement ? 
          descriptionElement.textContent.trim().substring(0, 500) : 
          this.extractTextFromContainer(container);
        
        jobs.push({
          id: `generic-container-${index}`,
          title: title,
          company: company,
          description: description,
          location: '',
          url: window.location.href,
          element: container,
          site: 'generic'
        });
      }
    });
    
    // Use loaded job keywords or fallback
    const jobKeywords = this.jobKeywords || [
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
      // Suspicious terms often in fraud jobs
      'easy money', 'work from home', 'no experience', 'guaranteed income',
      'mystery shopper', 'data entry', 'envelope stuffing'
    ];
    
    const titleSelectors = ['h1', 'h2', 'h3', 'h4', '.title', '.job-title', '.position-title', '.heading'];
    
    titleSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element, index) => {
        const text = element.textContent.toLowerCase();
        const hasJobKeyword = jobKeywords.some(keyword => text.includes(keyword.toLowerCase()));
        
        if (hasJobKeyword) {
          // Skip if we already found this element in a container
          const alreadyFound = jobs.some(job => job.element.contains(element));
          if (alreadyFound) return;
          
          const container = element.closest('div, article, section, .job-posting') || element;
          const companyElement = container.querySelector('.company, .employer, .company-name');
          const descriptionElement = container.querySelector('.description, .job-description, .content');
          
          const company = companyElement ? companyElement.textContent.trim() : 'Unknown';
          const description = descriptionElement ? 
            descriptionElement.textContent.trim().substring(0, 500) : 
            this.extractTextFromContainer(container);
          
          jobs.push({
            id: `generic-title-${index}`,
            title: element.textContent.trim(),
            company: company,
            description: description,
            location: '',
            url: window.location.href,
            element: container,
            site: 'generic'
          });
        }
      });
    });
    
    // Look for additional job containers using keyword matching
    if (jobKeywords.length > 0) {
      const allElements = document.querySelectorAll('div, article, section');
      allElements.forEach((element, index) => {
        const text = element.textContent?.toLowerCase() || '';
        const hasJobKeyword = jobKeywords.some(keyword => 
          text.includes(keyword.toLowerCase())
        );
        
        if (hasJobKeyword && element.children.length > 0) {
          // Check if this looks like a job container
          const hasJobStructure = element.querySelector('.job-title, .title, h1, h2, h3') ||
                                 element.querySelector('.company, .employer') ||
                                 element.querySelector('.description, .summary');
          
          // Skip if already found
          const alreadyFound = jobs.some(job => job.element === element || job.element.contains(element));
          
          if (hasJobStructure && !alreadyFound) {
            const titleElement = element.querySelector('.job-title, .title, h1, h2, h3');
            const companyElement = element.querySelector('.company, .employer, .company-name');
            const descriptionElement = element.querySelector('.description, .job-description, .content');
            
            if (titleElement) {
              const title = titleElement.textContent.trim();
              const company = companyElement ? companyElement.textContent.trim() : 'Unknown';
              const description = descriptionElement ? 
                descriptionElement.textContent.trim().substring(0, 500) : 
                this.extractTextFromContainer(element);
              
              jobs.push({
                id: `generic-keyword-${index}`,
                title: title,
                company: company,
                description: description,
                location: '',
                url: window.location.href,
                element: element,
                site: 'generic'
              });
            }
          }
        }
      });
    }
    
    // Remove duplicates based on title similarity
    const uniqueJobs = [];
    jobs.forEach(job => {
      const isDuplicate = uniqueJobs.some(existing => 
        existing.title.toLowerCase() === job.title.toLowerCase() ||
        (existing.title.toLowerCase().includes(job.title.toLowerCase()) && 
         job.title.toLowerCase().includes(existing.title.toLowerCase()))
      );
      if (!isDuplicate) {
        uniqueJobs.push(job);
      }
    });
    
    console.log(`Detected ${uniqueJobs.length} unique job postings`);
    return uniqueJobs.slice(0, 10); // Limit generic detection
  }

  // Fast detection methods - optimized for speed over completeness
  detectIndeedJobsFast() {
    const jobs = [];
    // Use most common selectors first for speed
    const jobElements = document.querySelectorAll('[data-jk]');
    
    for (let i = 0; i < Math.min(jobElements.length, 20); i++) {
      const element = jobElements[i];
      const titleElement = element.querySelector('h2 a, .jobTitle a');
      const companyElement = element.querySelector('.companyName');
      
      if (titleElement) {
        jobs.push({
          id: `indeed-fast-${i}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Unknown',
          description: '', // Skip description for speed
          location: '',
          url: titleElement.href || window.location.href,
          element: element,
          site: 'indeed'
        });
      }
    }
    
    return jobs;
  }

  detectLinkedInJobsFast() {
    const jobs = [];
    const jobElements = document.querySelectorAll('.job-card-container');
    
    for (let i = 0; i < Math.min(jobElements.length, 20); i++) {
      const element = jobElements[i];
      const titleElement = element.querySelector('.job-card-list__title');
      const companyElement = element.querySelector('.job-card-container__company-name');
      
      if (titleElement) {
        jobs.push({
          id: `linkedin-fast-${i}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Unknown',
          description: '',
          location: '',
          url: titleElement.href || window.location.href,
          element: element,
          site: 'linkedin'
        });
      }
    }
    
    return jobs;
  }

  detectGlassdoorJobsFast() {
    const jobs = [];
    const jobElements = document.querySelectorAll('[data-test="job-listing"]');
    
    for (let i = 0; i < Math.min(jobElements.length, 20); i++) {
      const element = jobElements[i];
      const titleElement = element.querySelector('[data-test="job-title"]');
      const companyElement = element.querySelector('[data-test="employer-name"]');
      
      if (titleElement) {
        jobs.push({
          id: `glassdoor-fast-${i}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Unknown',
          description: '',
          location: '',
          url: titleElement.href || window.location.href,
          element: element,
          site: 'glassdoor'
        });
      }
    }
    
    return jobs;
  }

  detectMonsterJobsFast() {
    const jobs = [];
    const jobElements = document.querySelectorAll('.job-listing, .job-card');
    
    for (let i = 0; i < Math.min(jobElements.length, 20); i++) {
      const element = jobElements[i];
      const titleElement = element.querySelector('.job-title a, h3 a');
      const companyElement = element.querySelector('.company-name, .company');
      
      if (titleElement) {
        jobs.push({
          id: `monster-fast-${i}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Unknown',
          description: '',
          location: '',
          url: titleElement.href || window.location.href,
          element: element,
          site: 'monster'
        });
      }
    }
    
    return jobs;
  }

  detectZipRecruiterJobsFast() {
    const jobs = [];
    const jobElements = document.querySelectorAll('[data-testid="job-card"]');
    
    for (let i = 0; i < Math.min(jobElements.length, 20); i++) {
      const element = jobElements[i];
      const titleElement = element.querySelector('[data-testid="job-title"]');
      const companyElement = element.querySelector('[data-testid="company-name"]');
      
      if (titleElement) {
        jobs.push({
          id: `ziprecruiter-fast-${i}`,
          title: titleElement.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Unknown',
          description: '',
          location: '',
          url: titleElement.href || window.location.href,
          element: element,
          site: 'ziprecruiter'
        });
      }
    }
    
    return jobs;
  }

  detectGenericJobsFast() {
    console.log('🔍 [FRAUDBUSTER DEBUG] detectGenericJobsFast called');
    const jobs = [];
    const startTime = performance.now();
    
    // Fast job keywords for quick detection
    const quickJobKeywords = ['job', 'position', 'career', 'hiring', 'vacancy', 'opening', 'work', 'employment'];
    
    // Priority selectors for fastest detection
    const prioritySelectors = [
      '.job-posting', '.job-post', '.job-item', '.job-card', 
      '[data-job-id]', '.job-container', '.job-offer'
    ];
    
    console.log('🔍 [FRAUDBUSTER DEBUG] Priority selectors:', prioritySelectors);
    console.log('🔍 [FRAUDBUSTER DEBUG] Document body exists:', !!document.body);
    console.log('🔍 [FRAUDBUSTER DEBUG] Total elements in document:', document.querySelectorAll('*').length);
    
    // Try priority selectors first
    for (const selector of prioritySelectors) {
      console.log('🔍 [FRAUDBUSTER DEBUG] Trying selector:', selector);
      const elements = document.querySelectorAll(selector);
      console.log('🔍 [FRAUDBUSTER DEBUG] Found', elements.length, 'elements for selector:', selector);
      
      if (elements.length > 0) {
        console.log('🔍 [FRAUDBUSTER DEBUG] Processing elements for selector:', selector);
        for (let i = 0; i < Math.min(elements.length, 15); i++) {
          const element = elements[i];
          console.log('🔍 [FRAUDBUSTER DEBUG] Processing element', i, ':', element);
          console.log('🔍 [FRAUDBUSTER DEBUG] Element HTML:', element.outerHTML.substring(0, 200));
          
          const titleElement = element.querySelector('.job-title, .title, .position-title, h1, h2, h3');
          console.log('🔍 [FRAUDBUSTER DEBUG] Title element found:', !!titleElement);
          
          if (titleElement) {
            const title = titleElement.textContent.trim();
            const companyElement = element.querySelector('.company, .employer, .company-name');
            console.log('🔍 [FRAUDBUSTER DEBUG] Extracted title:', title);
            console.log('🔍 [FRAUDBUSTER DEBUG] Company element found:', !!companyElement);
            
            const jobData = {
              id: `generic-fast-${jobs.length}`,
              title: title,
              company: companyElement ? companyElement.textContent.trim() : 'Unknown',
              description: this.extractTextFromContainer(element),
              location: '',
              url: window.location.href,
              element: element,
              site: 'generic'
            };
            
            jobs.push(jobData);
            console.log('🔍 [FRAUDBUSTER DEBUG] Added job:', jobData);
            console.log('🔍 [FRAUDBUSTER DEBUG] Total jobs so far:', jobs.length);
          } else {
            console.log('🔍 [FRAUDBUSTER DEBUG] No title element found in element', i);
          }
        }
        
        // If we found jobs with priority selectors, return early
        if (jobs.length > 0) {
          console.log(`🔍 [FRAUDBUSTER DEBUG] Fast generic detection found ${jobs.length} jobs in ${(performance.now() - startTime).toFixed(2)}ms`);
          console.log('🔍 [FRAUDBUSTER DEBUG] Returning jobs early:', jobs);
          return jobs;
        }
      }
    }
    
    console.log('🔍 [FRAUDBUSTER DEBUG] No jobs found with priority selectors, trying keyword-based detection');
    
    // Fallback: Quick keyword-based detection
    const headings = document.querySelectorAll('h1, h2, h3, h4');
    console.log('🔍 [FRAUDBUSTER DEBUG] Found', headings.length, 'headings for keyword search');
    
    for (let i = 0; i < Math.min(headings.length, 50); i++) {
      const heading = headings[i];
      const text = heading.textContent.toLowerCase();
      console.log('🔍 [FRAUDBUSTER DEBUG] Checking heading', i, ':', text);
      
      if (quickJobKeywords.some(keyword => text.includes(keyword))) {
        console.log('🔍 [FRAUDBUSTER DEBUG] Heading contains job keywords');
        const container = heading.closest('div, article, section') || heading;
        const companyElement = container.querySelector('.company, .employer, .company-name');
        
        const jobData = {
          id: `generic-keyword-fast-${jobs.length}`,
          title: heading.textContent.trim(),
          company: companyElement ? companyElement.textContent.trim() : 'Unknown',
          description: this.extractTextFromContainer(container),
          location: '',
          url: window.location.href,
          element: container,
          site: 'generic'
        };
        
        jobs.push(jobData);
        console.log('🔍 [FRAUDBUSTER DEBUG] Added keyword-based job:', jobData);
        
        // Limit to prevent slowdown
        if (jobs.length >= 10) {
          console.log('🔍 [FRAUDBUSTER DEBUG] Reached job limit, breaking');
          break;
        }
      }
    }
    
    console.log(`🔍 [FRAUDBUSTER DEBUG] Fast generic detection completed in ${(performance.now() - startTime).toFixed(2)}ms`);
    console.log('🔍 [FRAUDBUSTER DEBUG] Final jobs array:', jobs);
    console.log('🔍 [FRAUDBUSTER DEBUG] Total jobs found:', jobs.length);
    return jobs;
  }

  extractTextFromContainer(container) {
    const clone = container.cloneNode(true);
    
    // Remove script and style elements
    const scriptsAndStyles = clone.querySelectorAll('script, style');
    scriptsAndStyles.forEach(el => el.remove());
    
    return clone.textContent.trim().substring(0, 500); // Limit to 500 chars
  }

  async analyzeJobPosting(jobText, jobId) {
    try {
      // Send job text to background script for fraud analysis
      const response = await chrome.runtime.sendMessage({
        action: 'analyzeJobPosting',
        jobText: jobText
      });
      
      if (response.success) {
        // Cache the result
        this.fraudAnalysisResults.set(jobId, response.analysis);
        return response.analysis;
      } else {
        throw new Error(response.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing job posting:', error);
      throw error;
    }
  }

  async autoAnalyzeJobPostings() {
    // Declare currentDomain at the method level for proper scoping
    let currentDomain;
    
    // Check if extension is active for current domain before auto-analyzing
    try {
      currentDomain = window.location.hostname;
      const settings = await chrome.storage.sync.get(['domainStates']);
      const domainStates = settings.domainStates || {};
      
      if (!domainStates[currentDomain]) {
        console.log(`FraudBuster: Extension inactive for domain ${currentDomain} - skipping auto-analysis`);
        return;
      }
    } catch (error) {
      console.error('Error checking extension status:', error);
      return; // Don't auto-analyze if we can't check status
    }

    // Wait a bit for page to fully load
    setTimeout(async () => {
      try {
        // Enhanced page classification with Firestore-based false positive reduction
        const pageContent = document.body ? document.body.innerText : '';
        const pageUrl = window.location.href;
        
        console.log('🔍 FraudBuster: Performing enhanced page classification with Firestore data...');
        
        // Check domain whitelist/blacklist first
        const shouldSkipDomain = this.shouldSkipDomainAnalysis(currentDomain);
        if (shouldSkipDomain.skip) {
          console.log(`🚫 FraudBuster: ${shouldSkipDomain.reason}`);
          
          // Store classification result for popup display
          chrome.storage.local.set({
            [`pageClassification_${currentDomain}`]: {
              pageType: 'whitelisted_domain',
              confidence: 1.0,
              shouldAnalyze: false,
              reason: shouldSkipDomain.reason,
              timestamp: Date.now(),
              url: pageUrl
            }
          });
          
          return;
        }
        
        // Apply false positive pattern matching
        const falsePositiveCheck = this.checkForFalsePositivePatterns(pageContent, pageUrl);
        if (falsePositiveCheck.isFalsePositive) {
          console.log(`🚫 FraudBuster: Skipping analysis - ${falsePositiveCheck.reason}`);
          
          // Store classification result
          chrome.storage.local.set({
            [`pageClassification_${currentDomain}`]: {
              pageType: 'false_positive_filtered',
              confidence: falsePositiveCheck.confidence,
              shouldAnalyze: false,
              reason: falsePositiveCheck.reason,
              patterns: falsePositiveCheck.matchedPatterns,
              timestamp: Date.now(),
              url: pageUrl
            }
          });
          
          return;
        }
        
        // Send enhanced page classification request to background script
        const classificationResponse = await chrome.runtime.sendMessage({
          action: 'classifyPageType',
          pageContent: pageContent,
          pageUrl: pageUrl,
          domainInfo: {
            domain: currentDomain,
            isWhitelisted: this.domainWhitelist.includes(currentDomain),
            isBlacklisted: this.domainBlacklist.includes(currentDomain)
          }
        });
        
        if (classificationResponse.success) {
          const classification = classificationResponse.classification;
          
          console.log(`📊 Enhanced Page Classification Result: ${classification.pageType.toUpperCase()}`);
          console.log(`   Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
          console.log(`   Should Analyze: ${classification.shouldAnalyze ? '✅ YES' : '❌ NO'}`);
          console.log(`   False Positive Check: ${falsePositiveCheck.isFalsePositive ? '❌ FILTERED' : '✅ PASSED'}`);
          
          // Only proceed with fraud analysis if page classification indicates we should
          if (!classification.shouldAnalyze) {
            console.log('🚫 FraudBuster: Skipping fraud analysis - page classified as landing page');
            
            // Store enhanced classification result for popup display
            chrome.storage.local.set({
              [`pageClassification_${currentDomain}`]: {
                ...classification,
                falsePositiveCheck: falsePositiveCheck,
                timestamp: Date.now(),
                url: pageUrl
              }
            });
            
            return;
          }
          
          console.log('✅ FraudBuster: Proceeding with fraud analysis - page classified as job posting page');
          
          // Store enhanced classification result
          chrome.storage.local.set({
            [`pageClassification_${currentDomain}`]: {
              ...classification,
              falsePositiveCheck: falsePositiveCheck,
              timestamp: Date.now(),
              url: pageUrl
            }
          });
        } else {
          console.warn('⚠️ Page classification failed, proceeding with fraud analysis as fallback');
        }
        
        const jobPostings = await this.detectJobPostings();
        
        // Analyze each job posting
        for (const job of jobPostings.slice(0, 5)) { // Limit to first 5 jobs
          try {
            const fullText = `${job.title} ${job.company} ${job.description} ${job.location}`;
            const analysis = await this.analyzeJobPosting(fullText, job.id);
            
            // If high risk, highlight the job
            if (analysis.riskLevel === 'high') {
              this.highlightFraudulentJob(job.element, analysis);
            }
          } catch (error) {
            console.error(`Error analyzing job ${job.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Error in auto-analysis:', error);
      }
    }, 2000);
  }

  highlightFraudulentJob(element, analysis) {
    if (!element) return;
    
    // Add warning styling with animation
    element.classList.add('fraudbuster-fraudulent-job');
    
    // Apply visual styling based on risk level
    const riskLevel = analysis.riskScore > 0.7 ? 'high' : analysis.riskScore > 0.4 ? 'medium' : 'low';
    
    let borderColor, backgroundColor, badgeColor;
    switch (riskLevel) {
      case 'high':
        borderColor = '#dc2626'; // red-600
        backgroundColor = 'rgba(220, 38, 38, 0.1)';
        badgeColor = '#dc2626';
        break;
      case 'medium':
        borderColor = '#d97706'; // amber-600
        backgroundColor = 'rgba(217, 119, 6, 0.1)';
        badgeColor = '#d97706';
        break;
      default:
        borderColor = '#16a34a'; // green-600
        backgroundColor = 'rgba(22, 163, 74, 0.1)';
        badgeColor = '#16a34a';
    }
    
    element.style.cssText += `
      border: 2px solid ${borderColor} !important;
      background-color: ${backgroundColor} !important;
      position: relative !important;
      animation: fraudbuster-pulse 2s ease-in-out 3;
    `;
    
    // Create enhanced warning badge
    const badge = document.createElement('div');
    badge.className = 'fraudbuster-warning-badge';
    
    const riskText = riskLevel.toUpperCase() + ' RISK';
    const icon = riskLevel === 'high' ? '🚨' : riskLevel === 'medium' ? '⚠️' : '⚡';
    
    badge.innerHTML = `${icon} ${riskText}`;
    badge.style.cssText = `
      position: absolute !important;
      top: 8px !important;
      right: 8px !important;
      background: ${badgeColor} !important;
      color: white !important;
      padding: 6px 10px !important;
      border-radius: 6px !important;
      font-size: 11px !important;
      font-weight: bold !important;
      z-index: 10000 !important;
      cursor: pointer !important;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
      transition: all 0.2s ease !important;
      user-select: none !important;
    `;
    
    // Add hover effect
    badge.addEventListener('mouseenter', () => {
      badge.style.transform = 'scale(1.05)';
      badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
    });
    
    badge.addEventListener('mouseleave', () => {
      badge.style.transform = 'scale(1)';
      badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    });
    
    element.appendChild(badge);
    
    // Add click handler for detailed analysis
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      const confidencePercent = Math.round(analysis.confidence * 100);
      const riskPercent = Math.round(analysis.riskScore * 100);
      
      const message = `🔍 FRAUD ANALYSIS RESULTS\n\n` +
        `🎯 Risk Score: ${riskPercent}% (${riskLevel.toUpperCase()})\n` +
        `📊 Confidence: ${confidencePercent}%\n\n` +
        `⚠️ Warning Signs Detected:\n${analysis.reasons.map(reason => `• ${reason}`).join('\n')}\n\n` +
        `💡 Recommendation: ${riskLevel === 'high' ? 'AVOID - High fraud risk detected' : 
                            riskLevel === 'medium' ? 'CAUTION - Verify details carefully' : 
                            'LOW RISK - Proceed with normal caution'}`;
      
      alert(message);
    });
    
    // Add pulsing animation for high-risk jobs
    if (riskLevel === 'high') {
      setTimeout(() => {
        element.style.animation = 'fraudbuster-pulse 3s ease-in-out infinite';
      }, 6000); // Start continuous pulse after initial animation
    }
  }

  highlightFraudulentJobs(jobIds) {
    jobIds.forEach(jobId => {
      const job = this.jobPostings.find(j => j.id === jobId);
      const analysis = this.fraudAnalysisResults.get(jobId);
      
      if (job && job.element && analysis) {
        this.highlightFraudulentJob(job.element, analysis);
      }
    });
  }

  highlightSuspiciousElements(elements) {
    // Remove existing highlights
    this.removeSuspiciousHighlights();
    
    elements.forEach(elementInfo => {
      const element = document.querySelector(elementInfo.selector);
      if (element) {
        element.style.outline = '2px solid #ff4444';
        element.style.backgroundColor = 'rgba(255, 68, 68, 0.1)';
        element.classList.add('fraudbuster-suspicious');
        
        // Add tooltip
        element.title = `Suspicious: ${elementInfo.reason}`;
      }
    });
  }

  removeSuspiciousHighlights() {
    // Remove suspicious element highlights
    const highlightedElements = document.querySelectorAll('.fraudbuster-suspicious');
    highlightedElements.forEach(element => {
      element.style.outline = '';
      element.style.backgroundColor = '';
      element.classList.remove('fraudbuster-suspicious');
      element.removeAttribute('title');
    });
    
    // Remove fraudulent job highlights
    const fraudulentJobs = document.querySelectorAll('.fraudbuster-fraudulent-job');
    fraudulentJobs.forEach(element => {
      element.style.border = '';
      element.style.backgroundColor = '';
      element.style.position = '';
      element.classList.remove('fraudbuster-fraudulent-job');
      
      // Remove warning badges
      const badges = element.querySelectorAll('.fraudbuster-warning-badge');
      badges.forEach(badge => badge.remove());
    });
  }

  async scanPage() {
    try {
      console.log('Starting comprehensive page scan...');
      
      // Check if extension is active for current domain before scanning
      let currentDomain;
      try {
        currentDomain = window.location.hostname;
        const settings = await chrome.storage.sync.get(['domainStates']);
        const domainStates = settings.domainStates || {};
        
        if (!domainStates[currentDomain]) {
          console.log(`FraudBuster: Extension inactive for domain ${currentDomain} - scan cancelled`);
          return { success: false, error: `Extension is not active for domain: ${currentDomain}` };
        }
      } catch (error) {
        console.error('Error checking extension status:', error);
        return { success: false, error: 'Unable to verify extension status' };
      }
      
      // Extract page data (await since it calls detectJobPostings)
      const pageData = await this.extractPageData();
      
      // Add current page URL for domain checking
      pageData.pageUrl = window.location.href;
      pageData.domain = window.location.hostname;
      
      // DEBUG: Log the pageData being sent to background
      console.log('🔍 [FRAUDBUSTER DEBUG] scanPage: About to send pageData to background:', {
        hasJobPostings: pageData.jobPostings ? 'yes' : 'no',
        jobPostingsCount: pageData.jobPostings ? pageData.jobPostings.length : 0,
        jobPostingsType: typeof pageData.jobPostings,
        pageDataKeys: Object.keys(pageData),
        jobPostingsData: pageData.jobPostings
      });
      
      // Send to background for comprehensive analysis
      const response = await chrome.runtime.sendMessage({
        action: 'scanPage',
        data: pageData
      });
      
      if (response && response.success) {
        console.log('Comprehensive page scan completed:', response.result);
        this.handleScanResult(response.result);
      } else {
        console.error('Page scan failed:', response?.error);
      }
    } catch (error) {
      console.error('Error during page scan:', error);
    }
  }

  handleScanResult(result) {
    console.log('Processing scan result:', result);
    
    // Check if extension is still active before processing results
    chrome.storage.sync.get(['extensionActive']).then(storageResult => {
      if (!storageResult.extensionActive) {
        console.log('FraudBuster: Extension inactive - skipping result processing');
        return;
      }
      
      // Handle different types of fraud detection results
      // Check both result.fraudAnalysis and result.results.fraudAnalysis for compatibility
      const fraudAnalysis = result.fraudAnalysis || (result.results && result.results.fraudAnalysis);
      if (fraudAnalysis) {
        this.processFraudAnalysis(fraudAnalysis);
      } else {
        console.log('No fraud analysis found in result:', result);
      }
      
      // Handle suspicious elements highlighting
      const suspiciousElements = result.suspiciousElements || (result.results && result.results.suspiciousElements);
      if (suspiciousElements && suspiciousElements.length > 0) {
        this.highlightSuspiciousElements(suspiciousElements);
      }
    }).catch(error => {
      console.error('Error checking extension status for result processing:', error);
    });
  }
  
  processFraudAnalysis(analysis) {
    console.log('DEBUG: processFraudAnalysis called with:', analysis);
    const { method, isFraud, riskLevel, confidence, needsManualReview } = analysis;
    
    // Create or update fraud warning banner
    console.log('DEBUG: Calling updateFraudWarning');
    this.updateFraudWarning(analysis);
    
    // Show toast notification
    console.log('DEBUG: Calling showToastNotification');
    this.showToastNotification(analysis);
    
    // Log detection method for debugging
    console.log(`Fraud detection via ${method}:`, {
      isFraud,
      riskLevel,
      confidence,
      needsManualReview
    });
    
    // Store analysis result for popup access
    this.lastAnalysis = analysis;
    
    // Notify background script about the analysis result
    chrome.runtime.sendMessage({
      action: 'analysisComplete',
      data: {
        url: window.location.href,
        analysis: analysis,
        timestamp: new Date().toISOString()
      }
    }).catch(error => {
      console.warn('Failed to notify background about analysis:', error);
    });
  }
  
  updateFraudWarning(analysis) {
    // Remove existing warning if present
    const existingWarning = document.getElementById('fraudbuster-warning');
    if (existingWarning) {
      existingWarning.remove();
    }
    
    // Only show warning for fraud or manual review cases
    if (!analysis.isFraud && !analysis.needsManualReview) {
      return;
    }
    
    // Create warning banner
    const warning = document.createElement('div');
    warning.id = 'fraudbuster-warning';
    warning.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 10000;
      padding: 12px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      border-bottom: 3px solid;
    `;
    
    if (analysis.isFraud) {
      // High-risk fraud warning
      warning.style.backgroundColor = analysis.method === 'domain_blacklist' ? '#dc2626' : '#ea580c';
      warning.style.color = 'white';
      warning.style.borderBottomColor = '#991b1b';
      
      const methodText = analysis.method === 'domain_blacklist' 
        ? 'This domain is in our fraud blacklist!' 
        : 'Potential fraud detected by AI analysis!';
      
      warning.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span style="font-size: 18px;">⚠️</span>
          <span><strong>FRAUD ALERT:</strong> ${methodText}</span>
          <button id="fraudbuster-details" style="
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          ">Details</button>
        </div>
      `;
    } else if (analysis.needsManualReview) {
      // Manual review needed
      warning.style.backgroundColor = '#f59e0b';
      warning.style.color = 'white';
      warning.style.borderBottomColor = '#d97706';
      
      warning.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span style="font-size: 18px;">🤔</span>
          <span><strong>REVIEW NEEDED:</strong> Unable to determine if this is fraudulent</span>
          <button id="fraudbuster-report" style="
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
          ">Report</button>
        </div>
      `;
    }
    
    // Add to page
    document.body.insertBefore(warning, document.body.firstChild);
    
    // Add click handlers
    const detailsBtn = document.getElementById('fraudbuster-details');
    const reportBtn = document.getElementById('fraudbuster-report');
    
    if (detailsBtn) {
      detailsBtn.addEventListener('click', () => {
        this.showAnalysisDetails(analysis);
      });
    }
    
    if (reportBtn) {
      reportBtn.addEventListener('click', () => {
        this.showReportInterface(analysis);
      });
    }
    
    // Auto-hide after 10 seconds for manual review cases
    if (analysis.needsManualReview) {
      setTimeout(() => {
        if (warning.parentNode) {
          warning.style.transform = 'translateY(-100%)';
          warning.style.transition = 'transform 0.3s ease-out';
          setTimeout(() => warning.remove(), 300);
        }
      }, 10000);
    }
  }
  
  showAnalysisDetails(analysis) {
    // Open extension popup or show modal with detailed analysis
    chrome.runtime.sendMessage({
      action: 'showAnalysisDetails',
      data: analysis
    }).catch(error => {
      console.warn('Failed to show analysis details:', error);
    });
  }
  
  showReportInterface(analysis) {
    // Open extension popup for manual reporting
    chrome.runtime.sendMessage({
      action: 'showReportInterface',
      data: {
        url: window.location.href,
        domain: window.location.hostname,
        analysis: analysis
      }
    }).catch(error => {
      console.warn('Failed to show report interface:', error);
    });
  }

  showToastNotification(analysis) {
    console.log('DEBUG: showToastNotification started with analysis:', analysis);
    
    // Remove any existing toast
    const existingToast = document.getElementById('fraudbuster-toast');
    if (existingToast) {
      console.log('DEBUG: Removing existing toast');
      existingToast.remove();
    }

    const { isFraud, riskLevel, confidence, needsManualReview, method } = analysis;
    console.log('DEBUG: Toast analysis data:', { isFraud, riskLevel, confidence, needsManualReview, method });
    
    // Determine toast content and styling based on analysis result
    let backgroundColor, icon, title, message;
    
    if (isFraud) {
      backgroundColor = method === 'domain_blacklist' ? '#dc2626' : '#ea580c';
      icon = '⚠️';
      title = 'FRAUD DETECTED';
      message = method === 'domain_blacklist' 
        ? 'Domain is blacklisted'
        : `AI detected fraud (${Math.round(confidence * 100)}% confidence)`;
    } else if (needsManualReview) {
      backgroundColor = '#f59e0b';
      icon = '🤔';
      title = 'REVIEW NEEDED';
      message = 'Unable to determine fraud status';
    } else {
      backgroundColor = '#059669';
      icon = '✅';
      title = 'SAFE';
      message = `No fraud detected (${Math.round(confidence * 100)}% confidence)`;
    }

    // Create toast container
    const toast = document.createElement('div');
    toast.id = 'fraudbuster-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10001;
      min-width: 320px;
      max-width: 400px;
      background: ${backgroundColor};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      transform: translateX(100%);
      transition: transform 0.3s ease-out;
    `;

    // Create toast content
    toast.innerHTML = `
      <div style="padding: 16px; display: flex; align-items: flex-start; gap: 12px;">
        <div style="font-size: 20px; flex-shrink: 0;">${icon}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${title}</div>
          <div style="font-size: 13px; opacity: 0.9; line-height: 1.4;">${message}</div>
          ${riskLevel ? `<div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">Risk Level: ${riskLevel.toUpperCase()}</div>` : ''}
        </div>
        <button id="fraudbuster-toast-close" style="
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
          flex-shrink: 0;
        ">×</button>
      </div>
      <div id="fraudbuster-toast-progress" style="
        height: 3px;
        background: rgba(255,255,255,0.3);
        position: relative;
        overflow: hidden;
      ">
        <div id="fraudbuster-toast-progress-bar" style="
          height: 100%;
          background: rgba(255,255,255,0.8);
          width: 100%;
          transform: translateX(-100%);
          transition: transform 5s linear;
        "></div>
      </div>
    `;

    // Add to page
    document.body.appendChild(toast);
    console.log('DEBUG: Toast appended to DOM, element:', toast);
    console.log('DEBUG: Toast in DOM check:', document.getElementById('fraudbuster-toast'));

    // Animate in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      console.log('DEBUG: Toast animation started');
    });

    // Start progress bar animation
    const progressBar = document.getElementById('fraudbuster-toast-progress-bar');
    requestAnimationFrame(() => {
      progressBar.style.transform = 'translateX(0)';
    });

    // Add close button handler
    const closeBtn = document.getElementById('fraudbuster-toast-close');
    closeBtn.addEventListener('click', () => {
      this.hideToast(toast);
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        this.hideToast(toast);
      }
    }, 5000);
  }

  hideToast(toast) {
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 300);
  }

  displayToast(data) {
    console.log('DEBUG: displayToast called with data:', data);
    
    // Remove any existing toast
    const existingToast = document.getElementById('fraudbuster-toast');
    if (existingToast) {
      console.log('DEBUG: Removing existing toast');
      existingToast.remove();
    }

    // Extract analysis data
    const analysis = data.fraudAnalysis || data;
    console.log('DEBUG: Toast analysis data:', analysis);
    
    // Determine toast content and styling based on analysis result
    let backgroundColor, icon, title, message, riskLevel;
    
    if (analysis.fraudPercentage >= 70) {
      backgroundColor = '#dc2626'; // Red for high fraud
      icon = '⚠️';
      title = 'HIGH FRAUD RISK';
      message = `${analysis.fraudPercentage}% of jobs appear fraudulent`;
      riskLevel = 'high';
    } else if (analysis.fraudPercentage >= 30) {
      backgroundColor = '#f59e0b'; // Orange for medium fraud
      icon = '🤔';
      title = 'MODERATE RISK';
      message = `${analysis.fraudPercentage}% of jobs may be fraudulent`;
      riskLevel = 'medium';
    } else {
      backgroundColor = '#059669'; // Green for low/no fraud
      icon = '✅';
      title = 'LOW RISK';
      message = `${analysis.fraudPercentage}% fraud detected`;
      riskLevel = 'low';
    }

    // Create toast container
    const toast = document.createElement('div');
    toast.id = 'fraudbuster-toast';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10001;
      min-width: 320px;
      max-width: 400px;
      background: ${backgroundColor};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
      transform: translateX(100%);
      transition: transform 0.3s ease-out;
    `;

    // Create toast content
    toast.innerHTML = `
      <div style="padding: 16px; display: flex; align-items: flex-start; gap: 12px;">
        <div style="font-size: 20px; flex-shrink: 0;">${icon}</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${title}</div>
          <div style="font-size: 13px; opacity: 0.9; line-height: 1.4;">${message}</div>
          <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">Confidence: ${Math.round(analysis.confidence * 100)}%</div>
        </div>
        <button id="fraudbuster-toast-close" style="
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0.7;
          flex-shrink: 0;
        ">×</button>
      </div>
      <div id="fraudbuster-toast-progress" style="
        height: 3px;
        background: rgba(255,255,255,0.3);
        position: relative;
        overflow: hidden;
      ">
        <div id="fraudbuster-toast-progress-bar" style="
          height: 100%;
          background: rgba(255,255,255,0.8);
          width: 100%;
          transform: translateX(-100%);
          transition: transform 5s linear;
        "></div>
      </div>
    `;

    // Add to page
    document.body.appendChild(toast);
    console.log('DEBUG: Toast appended to DOM, element:', toast);
    console.log('DEBUG: Toast in DOM check:', document.getElementById('fraudbuster-toast'));

    // Animate in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
      console.log('DEBUG: Toast animation started');
    });

    // Start progress bar animation
    const progressBar = document.getElementById('fraudbuster-toast-progress-bar');
    requestAnimationFrame(() => {
      progressBar.style.transform = 'translateX(0)';
    });

    // Add close button handler
    const closeBtn = document.getElementById('fraudbuster-toast-close');
    closeBtn.addEventListener('click', () => {
      this.hideToast(toast);
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        this.hideToast(toast);
      }
    }, 5000);
  }
  
  handleManualFraudReport(data) {
    console.log('Processing manual fraud report:', data);
    
    // Add visual indicator that report was submitted
    const existingWarning = document.getElementById('fraudbuster-warning');
    if (existingWarning) {
      existingWarning.style.backgroundColor = '#059669';
      existingWarning.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
          <span style="font-size: 18px;">✅</span>
          <span><strong>REPORT SUBMITTED:</strong> Thank you for helping keep the web safe!</span>
        </div>
      `;
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        if (existingWarning.parentNode) {
          existingWarning.style.transform = 'translateY(-100%)';
          existingWarning.style.transition = 'transform 0.3s ease-out';
          setTimeout(() => existingWarning.remove(), 300);
        }
      }, 3000);
    }
    
    // Forward to background script for processing
    chrome.runtime.sendMessage({
      action: 'processManualFraudReport',
      data: {
        ...data,
        url: window.location.href,
        domain: window.location.hostname,
        timestamp: new Date().toISOString(),
        pageData: this.getCachedPageData()
      }
    }).catch(error => {
      console.error('Failed to process manual fraud report:', error);
    });
  }

  // Utility method to check if content script is ready
  isReady() {
    return !this.isAnalyzing && this.pageData !== null;
  }

  // Get cached page data
  getCachedPageData() {
    return this.pageData;
  }
  
  // Get current analysis state
  getCurrentAnalysis() {
    return this.lastAnalysis || null;
  }
  
  // Get detected job postings
  getJobPostings() {
    return this.jobPostings || [];
  }
  
  // Get fraud analysis results
  getFraudAnalysisResults() {
    return Object.fromEntries(this.fraudAnalysisResults);
  }

  // New methods for enhanced false positive reduction using Firestore data
  
  shouldSkipDomainAnalysis(domain) {
    // Check if domain is whitelisted (trusted job sites)
    if (this.domainWhitelist && this.domainWhitelist.includes(domain)) {
      return {
        skip: true,
        reason: `Domain ${domain} is whitelisted as a trusted job site`
      };
    }
    
    // Check if domain is blacklisted (known fraudulent sites)
    if (this.domainBlacklist && this.domainBlacklist.includes(domain)) {
      return {
        skip: false, // Don't skip, but flag for high priority analysis
        reason: `Domain ${domain} is blacklisted as potentially fraudulent`,
        priority: 'high'
      };
    }
    
    return { skip: false };
  }
  
  checkForFalsePositivePatterns(pageContent, pageUrl) {
    if (!this.falsePositivePatterns || !pageContent) {
      return { isFalsePositive: false };
    }
    
    const content = pageContent.toLowerCase();
    const url = pageUrl.toLowerCase();
    const matchedPatterns = [];
    
    // Check for false positive patterns in content
    for (const pattern of this.falsePositivePatterns) {
      if (content.includes(pattern.toLowerCase())) {
        matchedPatterns.push(pattern);
      }
    }
    
    // Additional checks for legitimate business indicators
    const legitimateIndicators = [
      'privacy policy', 'terms of service', 'about us', 'contact us',
      'established', 'founded', 'years of experience', 'corporate',
      'headquarters', 'office locations', 'customer service',
      'support team', 'professional', 'certified', 'accredited'
    ];
    
    let legitimateScore = 0;
    for (const indicator of legitimateIndicators) {
      if (content.includes(indicator)) {
        legitimateScore++;
      }
    }
    
    // Check URL patterns for legitimate sites
    const legitimateUrlPatterns = [
      '/careers', '/jobs', '/about', '/contact', '/privacy',
      '/terms', '/support', '/help'
    ];
    
    let legitimateUrlScore = 0;
    for (const pattern of legitimateUrlPatterns) {
      if (url.includes(pattern)) {
        legitimateUrlScore++;
      }
    }
    
    // Determine if this is likely a false positive
    const totalLegitimateScore = legitimateScore + legitimateUrlScore;
    const isFalsePositive = matchedPatterns.length > 0 || totalLegitimateScore >= 3;
    
    if (isFalsePositive) {
      return {
        isFalsePositive: true,
        confidence: Math.min(0.9, (matchedPatterns.length * 0.3 + totalLegitimateScore * 0.1)),
        reason: matchedPatterns.length > 0 
          ? `Matched false positive patterns: ${matchedPatterns.join(', ')}`
          : `High legitimate business score: ${totalLegitimateScore}`,
        matchedPatterns: matchedPatterns,
        legitimateScore: totalLegitimateScore
      };
    }
    
    return { isFalsePositive: false };
  }
  
  // Enhanced page classification using Firestore rules
  classifyPageLocally(pageContent, pageUrl) {
    if (!this.pageClassificationRules || !pageContent) {
      return { pageType: 'uncertain', confidence: 0.5, shouldAnalyze: true };
    }
    
    const content = pageContent.toLowerCase();
    const url = pageUrl.toLowerCase();
    
    // Check for job posting indicators
    const jobIndicators = this.pageClassificationRules.job_posting_indicators || [];
    let jobScore = 0;
    for (const indicator of jobIndicators) {
      if (content.includes(indicator.toLowerCase())) {
        jobScore++;
      }
    }
    
    // Check for landing page indicators
    const landingIndicators = this.pageClassificationRules.landing_page_indicators || [];
    let landingScore = 0;
    for (const indicator of landingIndicators) {
      if (content.includes(indicator.toLowerCase())) {
        landingScore++;
      }
    }
    
    // Additional job posting signals
    const additionalJobSignals = [
      'salary', 'benefits', 'qualifications', 'experience required',
      'job type', 'employment type', 'location', 'apply online',
      'submit resume', 'job posting', 'position available'
    ];
    
    for (const signal of additionalJobSignals) {
      if (content.includes(signal)) {
        jobScore += 0.5;
      }
    }
    
    // URL-based classification
    if (url.includes('/job') || url.includes('/career') || url.includes('/position')) {
      jobScore += 2;
    }
    
    if (url.includes('/about') || url.includes('/home') || url === window.location.origin + '/') {
      landingScore += 2;
    }
    
    // Determine page type
    let pageType, confidence, shouldAnalyze;
    
    if (jobScore > landingScore && jobScore >= 2) {
      pageType = 'job_posting';
      confidence = Math.min(0.95, 0.6 + (jobScore * 0.1));
      shouldAnalyze = true;
    } else if (landingScore > jobScore && landingScore >= 2) {
      pageType = 'landing_page';
      confidence = Math.min(0.95, 0.6 + (landingScore * 0.1));
      shouldAnalyze = false;
    } else {
      pageType = 'uncertain';
      confidence = 0.5;
      shouldAnalyze = true; // Analyze uncertain pages to be safe
    }
    
    return {
      pageType,
      confidence,
      shouldAnalyze,
      scores: { jobScore, landingScore },
      method: 'local_firestore_rules'
    };
  }

  // Extract page features for classification system
  extractPageFeatures() {
    try {
      const features = {
        // DOM structure analysis
        domStructure: this.analyzeDOMStructure(),
        
        // Content density analysis
        contentDensity: this.calculateContentDensity(),
        
        // URL pattern analysis
        urlPattern: this.analyzeURLPattern(),
        
        // Navigation elements
        navigationScore: this.calculateNavigationScore(),
        
        // Job posting indicators
        jobIndicators: this.calculateJobIndicators(),
        
        // Page metadata
        metadata: this.extractPageMetadata(),
        
        // Content semantic analysis
        semanticContent: this.analyzeSemanticContent()
      };
      
      return features;
    } catch (error) {
      console.error('Error extracting page features:', error);
      return {};
    }
  }
  
  analyzeDOMStructure() {
    const structure = {
      totalElements: document.querySelectorAll('*').length,
      headingCount: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
      paragraphCount: document.querySelectorAll('p').length,
      listCount: document.querySelectorAll('ul, ol').length,
      formCount: document.querySelectorAll('form').length,
      inputCount: document.querySelectorAll('input').length,
      linkCount: document.querySelectorAll('a').length,
      imageCount: document.querySelectorAll('img').length,
      divCount: document.querySelectorAll('div').length,
      sectionCount: document.querySelectorAll('section, article').length
    };
    
    // Calculate structure ratios
    structure.contentToStructureRatio = (structure.paragraphCount + structure.headingCount) / structure.totalElements;
    structure.interactiveElementRatio = (structure.formCount + structure.inputCount + structure.linkCount) / structure.totalElements;
    
    return structure;
  }
  
  calculateContentDensity() {
    const textContent = this.extractTextContent();
    const totalElements = document.querySelectorAll('*').length;
    const visibleElements = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }).length;
    
    return {
      textLength: textContent.length,
      wordsCount: textContent.split(/\s+/).filter(word => word.length > 0).length,
      textToElementRatio: textContent.length / totalElements,
      visibilityRatio: visibleElements / totalElements,
      averageWordsPerElement: textContent.split(/\s+/).length / visibleElements
    };
  }
  
  analyzeURLPattern() {
    let url, pathname, hostname;
    try {
      url = window.location.href;
      pathname = window.location.pathname;
      hostname = window.location.hostname;
    } catch (error) {
      console.error('Error accessing window.location:', error);
      return {
        url: '',
        pathname: '',
        hostname: '',
        pathSegments: [],
        hasJobKeywords: false,
        error: 'Unable to access location data'
      };
    }
    
    return {
      url: url,
      pathname: pathname,
      hostname: hostname,
      pathSegments: pathname.split('/').filter(segment => segment.length > 0),
      hasJobKeywords: /job|career|position|vacancy|hiring|employment/i.test(url),
      hasLandingKeywords: /home|about|index|main|welcome/i.test(url),
      isRootPath: pathname === '/' || pathname === '',
      hasParameters: url.includes('?'),
      pathDepth: pathname.split('/').filter(segment => segment.length > 0).length
    };
  }
  
  calculateNavigationScore() {
    const navElements = document.querySelectorAll('nav, .nav, .navigation, .menu, header, footer');
    const navLinks = document.querySelectorAll('nav a, .nav a, .navigation a, .menu a, header a');
    const breadcrumbs = document.querySelectorAll('.breadcrumb, .breadcrumbs, nav ol, nav ul');
    
    return {
      navigationElements: navElements.length,
      navigationLinks: navLinks.length,
      breadcrumbs: breadcrumbs.length,
      hasMainNavigation: navElements.length > 0,
      navigationDensity: navLinks.length / Math.max(1, navElements.length)
    };
  }
  
  calculateJobIndicators() {
    const textContent = this.extractTextContent().toLowerCase();
    const title = document.title.toLowerCase();
    
    const jobKeywords = [
      'job', 'position', 'career', 'employment', 'hiring', 'vacancy', 'opening',
      'apply', 'resume', 'cv', 'salary', 'benefits', 'qualifications',
      'experience', 'skills', 'requirements', 'responsibilities'
    ];
    
    let keywordCount = 0;
    const foundKeywords = [];
    
    for (const keyword of jobKeywords) {
      if (textContent.includes(keyword) || title.includes(keyword)) {
        keywordCount++;
        foundKeywords.push(keyword);
      }
    }
    
    // Check for job-specific form elements
    const jobFormElements = document.querySelectorAll(
      'input[name*="resume"], input[name*="cv"], input[name*="application"], ' +
      'input[type="file"], textarea[name*="cover"], textarea[name*="letter"]'
    );
    
    return {
      keywordCount: keywordCount,
      foundKeywords: foundKeywords,
      keywordDensity: keywordCount / Math.max(1, textContent.split(/\s+/).length) * 1000,
      hasJobForms: jobFormElements.length > 0,
      jobFormElements: jobFormElements.length
    };
  }
  
  extractPageMetadata() {
    const metaTags = {};
    const metaElements = document.querySelectorAll('meta');
    
    metaElements.forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (name && content) {
        metaTags[name] = content;
      }
    });
    
    return {
      title: document.title,
      description: metaTags.description || '',
      keywords: metaTags.keywords || '',
      ogType: metaTags['og:type'] || '',
      ogTitle: metaTags['og:title'] || '',
      ogDescription: metaTags['og:description'] || '',
      viewport: metaTags.viewport || '',
      robots: metaTags.robots || ''
    };
  }
  
  analyzeSemanticContent() {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map(h => h.textContent.trim().toLowerCase());
    
    const semanticElements = {
      articles: document.querySelectorAll('article').length,
      sections: document.querySelectorAll('section').length,
      asides: document.querySelectorAll('aside').length,
      headers: document.querySelectorAll('header').length,
      footers: document.querySelectorAll('footer').length,
      mains: document.querySelectorAll('main').length
    };
    
    // Analyze content structure
    const contentStructure = {
      hasMainContent: semanticElements.mains > 0 || document.querySelector('[role="main"]') !== null,
      hasArticleStructure: semanticElements.articles > 0,
      hasSectionStructure: semanticElements.sections > 0,
      hasHeaderFooter: semanticElements.headers > 0 && semanticElements.footers > 0
    };
    
    return {
      headings: headings,
      semanticElements: semanticElements,
      contentStructure: contentStructure,
      semanticScore: Object.values(semanticElements).reduce((sum, count) => sum + count, 0)
    };
  }
}

// Log initialization
console.log('FraudBuster content script initialized on:', window.location.href);

// Initialize content script
const fraudBusterContent = new FraudBusterContentScript();

// Make it available globally for debugging
window.fraudBusterContent = fraudBusterContent;

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fraudbuster-pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
  }
  
  .fraudbuster-fraudulent-job {
    transition: all 0.3s ease !important;
  }
  
  .fraudbuster-warning-badge:hover {
    transform: scale(1.05) !important;
  }
`;
document.head.appendChild(style);

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FraudBusterContentScript;
}

} // End of duplicate prevention check