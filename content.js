// FraudBuster Content Script
// This script runs in the context of web pages to extract data for fraud analysis

class FraudBusterContentScript {
  constructor() {
    this.pageData = null;
    this.isAnalyzing = false;
    this.jobPostings = [];
    this.fraudAnalysisResults = new Map();
    
    this.init();
  }

  init() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Extract initial page data and detect job postings
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.extractPageData();
        this.detectJobPostings();
      });
    } else {
      this.extractPageData();
      this.detectJobPostings();
    }

    // Auto-analyze job postings if on a job site
    this.autoAnalyzeJobPostings();
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
        
      case 'ping':
        sendResponse({ success: true, message: 'Content script is ready' });
        break;
        
      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
  }

  async extractPageData() {
    try {
      this.isAnalyzing = true;
      
      const data = {
        // Basic page information
        url: window.location.href,
        domain: window.location.hostname,
        title: document.title,
        
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
    const domain = window.location.hostname;
    
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

  // Job posting detection and analysis methods
  async detectJobPostings() {
    try {
      const hostname = window.location.hostname.toLowerCase();
      const jobPostings = [];
      
      // Detect job postings based on the current site
      if (hostname.includes('indeed.com')) {
        jobPostings.push(...this.detectIndeedJobs());
      } else if (hostname.includes('linkedin.com')) {
        jobPostings.push(...this.detectLinkedInJobs());
      } else if (hostname.includes('glassdoor.com')) {
        jobPostings.push(...this.detectGlassdoorJobs());
      } else if (hostname.includes('monster.com')) {
        jobPostings.push(...this.detectMonsterJobs());
      } else if (hostname.includes('ziprecruiter.com')) {
        jobPostings.push(...this.detectZipRecruiterJobs());
      } else {
        // Generic job posting detection
        jobPostings.push(...this.detectGenericJobs());
      }
      
      this.jobPostings = jobPostings;
      return jobPostings;
    } catch (error) {
      console.error('Error detecting job postings:', error);
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
    
    // Look for common job posting patterns
    const jobKeywords = ['job', 'position', 'career', 'employment', 'hiring', 'vacancy', 'opening'];
    const titleSelectors = ['h1', 'h2', 'h3', '.title', '.job-title', '.position-title'];
    
    titleSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element, index) => {
        const text = element.textContent.toLowerCase();
        const hasJobKeyword = jobKeywords.some(keyword => text.includes(keyword));
        
        if (hasJobKeyword) {
          const container = element.closest('div, article, section') || element;
          const description = this.extractTextFromContainer(container);
          
          jobs.push({
            id: `generic-${index}`,
            title: element.textContent.trim(),
            company: 'Unknown',
            description: description,
            location: '',
            url: window.location.href,
            element: container,
            site: 'generic'
          });
        }
      });
    });
    
    return jobs.slice(0, 10); // Limit generic detection
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
    // Wait a bit for page to fully load
    setTimeout(async () => {
      try {
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
      
      // Extract page data
      const pageData = this.extractPageData();
      
      // Add current page URL for domain checking
      pageData.pageUrl = window.location.href;
      pageData.domain = window.location.hostname;
      
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
    
    // Handle different types of fraud detection results
    if (result.fraudAnalysis) {
      this.processFraudAnalysis(result.fraudAnalysis);
    }
    
    // Handle suspicious elements highlighting
    if (result.suspiciousElements && result.suspiciousElements.length > 0) {
      this.highlightSuspiciousElements(result.suspiciousElements);
    }
  }
  
  processFraudAnalysis(analysis) {
    const { method, isFraud, riskLevel, confidence, needsManualReview } = analysis;
    
    // Create or update fraud warning banner
    this.updateFraudWarning(analysis);
    
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
}

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

// Log initialization
console.log('FraudBuster content script initialized on:', window.location.href);

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FraudBusterContentScript;
}