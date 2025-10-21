/**
 * Page Context Analyzer - Dynamic False Positive Reduction System
 * Analyzes DOM structure, content density, URL patterns, and page metadata
 * to classify pages as either "landing_page" or "job_posting"
 */

class PageContextAnalyzer {
  constructor() {
    this.classificationCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    this.learningPatterns = [];
    this.classificationRules = [];
    this.falsePositivePatterns = [];
    
    // Initialize default classification weights
    this.featureWeights = {
      contentDensity: 0.25,
      jobIndicators: 0.30,
      navigationScore: 0.20,
      urlScore: 0.15,
      semanticScore: 0.10
    };
    
    // Job posting element selectors
    this.jobPostingSelectors = [
      '.job-title', '.job-header', '.job-description', '.job-details',
      '.company-name', '.company-info', '.salary', '.location',
      '.apply-button', '.job-apply', '.apply-now', '.job-requirements',
      '.qualifications', '.responsibilities', '.job-summary',
      '[data-job-id]', '[data-job-title]', '[data-company]',
      '.posting-date', '.job-date', '.employment-type'
    ];
    
    // Landing page indicators
    this.landingPageSelectors = [
      '.hero-section', '.search-form', '.category-nav', '.job-search',
      '.search-bar', '.filters', '.pagination', '.job-list',
      '.browse-jobs', '.featured-jobs', '.job-categories',
      '.search-results', '.job-grid', '.company-logos'
    ];
    
    // Navigation elements
    this.navigationSelectors = [
      'nav', '.navigation', '.navbar', '.menu', '.header-nav',
      '.sidebar', '.breadcrumb', '.tabs', '.tab-nav',
      '.main-menu', '.primary-nav', '.secondary-nav'
    ];
  }

  /**
   * Main classification method
   * @param {string} pageContent - HTML content of the page
   * @param {Object} domStructure - Parsed DOM structure
   * @param {string} urlPattern - Current page URL
   * @param {Object} options - Additional options
   * @returns {Object} Classification result
   */
  async classifyPageContext(pageContent, domStructure, urlPattern, options = {}) {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(urlPattern, pageContent);
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult && !options.forceRefresh) {
        return cachedResult;
      }

      // Extract page features
      const features = await this.extractPageFeatures(pageContent, domStructure, urlPattern);
      
      // Perform classification
      const classification = await this.performClassification(features);
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(classification, features);
      
      // Determine if fraud analysis should proceed
      const shouldAnalyze = this.shouldProceedWithAnalysis(classification, confidence, features);
      
      const result = {
        pageType: classification.pageType,
        confidence: confidence,
        shouldAnalyze: shouldAnalyze,
        features: features,
        classificationId: this.generateClassificationId(),
        timestamp: Date.now(),
        method: 'ml_classification'
      };
      
      // Cache the result
      this.cacheResult(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error in page classification:', error);
      return {
        pageType: 'unknown',
        confidence: 0.5,
        shouldAnalyze: true, // Default to analyzing when uncertain
        features: {},
        error: error.message,
        timestamp: Date.now(),
        method: 'error_fallback'
      };
    }
  }

  /**
   * Extract comprehensive page features for classification
   */
  async extractPageFeatures(pageContent, domStructure, urlPattern) {
    const features = {};
    
    // 1. Content Density Analysis
    features.contentDensity = this.calculateContentDensity(domStructure);
    
    // 2. Job Posting Indicators
    features.jobIndicators = this.detectJobPostingElements(domStructure);
    
    // 3. Navigation Pattern Analysis
    features.navigationScore = this.analyzeNavigationPatterns(domStructure);
    
    // 4. URL Pattern Analysis
    features.urlScore = this.analyzeUrlPatterns(urlPattern);
    
    // 5. Semantic Content Analysis
    features.semanticScore = await this.analyzeSemanticContent(pageContent);
    
    // 6. Page Structure Analysis
    features.structureScore = this.analyzePageStructure(domStructure);
    
    // 7. Landing Page Indicators
    features.landingPageScore = this.detectLandingPageElements(domStructure);
    
    return features;
  }

  /**
   * Calculate content density (content-to-noise ratio)
   */
  calculateContentDensity(domStructure) {
    try {
      const totalElements = domStructure.totalElements || 0;
      const textElements = domStructure.textElements || 0;
      const navigationElements = domStructure.navigationElements || 0;
      const contentElements = domStructure.contentElements || 0;
      
      if (totalElements === 0) return 0;
      
      // Calculate content density as ratio of meaningful content to total elements
      const meaningfulContent = textElements + contentElements;
      const noise = navigationElements + (domStructure.scriptElements || 0) + (domStructure.styleElements || 0);
      
      const density = meaningfulContent / Math.max(totalElements, 1);
      const noiseRatio = noise / Math.max(totalElements, 1);
      
      // Adjust density based on noise ratio
      return Math.max(0, Math.min(1, density - (noiseRatio * 0.3)));
    } catch (error) {
      console.error('Error calculating content density:', error);
      return 0.5; // Default neutral value
    }
  }

  /**
   * Detect job posting specific elements
   */
  detectJobPostingElements(domStructure) {
    try {
      let jobScore = 0;
      let totalPossible = this.jobPostingSelectors.length;
      
      // Check for job posting selectors
      this.jobPostingSelectors.forEach(selector => {
        const elements = domStructure.querySelector ? 
          domStructure.querySelector(selector) : 
          this.countElementsBySelector(domStructure, selector);
        
        if (elements && elements.length > 0) {
          jobScore += 1;
        }
      });
      
      // Check for job-specific attributes and data
      const jobAttributes = [
        'data-job-id', 'data-job-title', 'data-company',
        'data-salary', 'data-location', 'data-posting-date'
      ];
      
      jobAttributes.forEach(attr => {
        if (domStructure.hasAttribute && domStructure.hasAttribute(attr)) {
          jobScore += 0.5;
        }
      });
      
      // Check for job-related text patterns
      const jobKeywords = [
        'job description', 'responsibilities', 'qualifications',
        'requirements', 'apply now', 'salary', 'benefits',
        'employment type', 'company overview', 'job summary'
      ];
      
      const pageText = domStructure.textContent || '';
      jobKeywords.forEach(keyword => {
        if (pageText.toLowerCase().includes(keyword)) {
          jobScore += 0.3;
        }
      });
      
      return Math.min(1, jobScore / (totalPossible + jobAttributes.length + jobKeywords.length));
    } catch (error) {
      console.error('Error detecting job posting elements:', error);
      return 0;
    }
  }

  /**
   * Analyze navigation patterns to identify landing pages
   */
  analyzeNavigationPatterns(domStructure) {
    try {
      let navScore = 0;
      let totalNavElements = 0;
      
      // Count navigation elements
      this.navigationSelectors.forEach(selector => {
        const elements = this.countElementsBySelector(domStructure, selector);
        totalNavElements += elements;
      });
      
      // Check for landing page navigation patterns
      const landingNavPatterns = [
        '.search-filters', '.job-categories', '.location-filter',
        '.salary-filter', '.company-filter', '.date-filter',
        '.sort-options', '.view-options', '.results-per-page'
      ];
      
      landingNavPatterns.forEach(selector => {
        const elements = this.countElementsBySelector(domStructure, selector);
        if (elements > 0) {
          navScore += 0.2;
        }
      });
      
      // Calculate navigation density
      const totalElements = domStructure.totalElements || 1;
      const navDensity = totalNavElements / totalElements;
      
      // Higher navigation density suggests landing page
      return Math.min(1, navScore + (navDensity * 2));
    } catch (error) {
      console.error('Error analyzing navigation patterns:', error);
      return 0;
    }
  }

  /**
   * Analyze URL patterns for page type indicators
   */
  analyzeUrlPatterns(urlPattern) {
    try {
      if (!urlPattern) return 0;
      
      const url = new URL(urlPattern);
      const pathname = url.pathname.toLowerCase();
      const searchParams = url.searchParams;
      
      let urlScore = 0;
      
      // Landing page URL patterns
      const landingPatterns = [
        /\/jobs\/?$/,
        /\/careers\/?$/,
        /\/search\/?$/,
        /\/browse\/?$/,
        /\/find-jobs\/?$/,
        /\/job-search\/?$/,
        /\/opportunities\/?$/
      ];
      
      // Job posting URL patterns
      const jobPostingPatterns = [
        /\/job\/[^\/]+/,
        /\/jobs\/\d+/,
        /\/career\/[^\/]+/,
        /\/position\/[^\/]+/,
        /\/opening\/[^\/]+/,
        /\/vacancy\/[^\/]+/
      ];
      
      // Check for landing page patterns
      landingPatterns.forEach(pattern => {
        if (pattern.test(pathname)) {
          urlScore -= 0.3; // Negative score for landing page
        }
      });
      
      // Check for job posting patterns
      jobPostingPatterns.forEach(pattern => {
        if (pattern.test(pathname)) {
          urlScore += 0.4; // Positive score for job posting
        }
      });
      
      // Check URL parameters
      const landingParams = ['q', 'query', 'search', 'location', 'category', 'filter'];
      const jobParams = ['jobid', 'job_id', 'position_id', 'posting_id'];
      
      landingParams.forEach(param => {
        if (searchParams.has(param)) {
          urlScore -= 0.1;
        }
      });
      
      jobParams.forEach(param => {
        if (searchParams.has(param)) {
          urlScore += 0.2;
        }
      });
      
      // Normalize score to 0-1 range (0 = landing page, 1 = job posting)
      return Math.max(0, Math.min(1, (urlScore + 0.5)));
    } catch (error) {
      console.error('Error analyzing URL patterns:', error);
      return 0.5; // Neutral score on error
    }
  }

  /**
   * Analyze semantic content for job posting indicators
   */
  async analyzeSemanticContent(pageContent) {
    try {
      if (!pageContent) return 0;
      
      // Extract text content
      const textContent = this.extractTextContent(pageContent);
      const wordCount = textContent.split(/\s+/).length;
      
      // Job posting semantic indicators
      const jobSemanticPatterns = [
        /job\s+description/gi,
        /responsibilities/gi,
        /qualifications/gi,
        /requirements/gi,
        /apply\s+now/gi,
        /salary\s+range/gi,
        /employment\s+type/gi,
        /company\s+overview/gi,
        /benefits/gi,
        /experience\s+required/gi
      ];
      
      // Landing page semantic indicators
      const landingSemanticPatterns = [
        /search\s+jobs/gi,
        /find\s+careers/gi,
        /browse\s+opportunities/gi,
        /job\s+categories/gi,
        /featured\s+employers/gi,
        /popular\s+searches/gi,
        /recent\s+jobs/gi,
        /job\s+alerts/gi
      ];
      
      let jobSemanticScore = 0;
      let landingSemanticScore = 0;
      
      // Count job posting patterns
      jobSemanticPatterns.forEach(pattern => {
        const matches = textContent.match(pattern);
        if (matches) {
          jobSemanticScore += matches.length;
        }
      });
      
      // Count landing page patterns
      landingSemanticPatterns.forEach(pattern => {
        const matches = textContent.match(pattern);
        if (matches) {
          landingSemanticScore += matches.length;
        }
      });
      
      // Calculate semantic density
      const totalSemanticMatches = jobSemanticScore + landingSemanticScore;
      if (totalSemanticMatches === 0) return 0.5;
      
      // Return job posting probability (0 = landing page, 1 = job posting)
      return jobSemanticScore / totalSemanticMatches;
    } catch (error) {
      console.error('Error analyzing semantic content:', error);
      return 0.5;
    }
  }

  /**
   * Analyze overall page structure
   */
  analyzePageStructure(domStructure) {
    try {
      let structureScore = 0;
      
      // Check for single-job-posting structure
      const jobContainers = this.countElementsBySelector(domStructure, '.job-container, .job-posting, .job-detail');
      if (jobContainers === 1) {
        structureScore += 0.4;
      }
      
      // Check for multiple job listings (landing page indicator)
      const jobListings = this.countElementsBySelector(domStructure, '.job-list, .job-results, .job-grid');
      if (jobListings > 0) {
        structureScore -= 0.3;
      }
      
      // Check for detailed content sections
      const detailSections = this.countElementsBySelector(domStructure, 
        '.job-description, .requirements, .qualifications, .responsibilities');
      if (detailSections >= 2) {
        structureScore += 0.3;
      }
      
      // Check for search/filter elements (landing page indicators)
      const searchElements = this.countElementsBySelector(domStructure, 
        '.search-form, .filters, .search-bar');
      if (searchElements > 0) {
        structureScore -= 0.2;
      }
      
      return Math.max(0, Math.min(1, structureScore + 0.5));
    } catch (error) {
      console.error('Error analyzing page structure:', error);
      return 0.5;
    }
  }

  /**
   * Detect landing page specific elements
   */
  detectLandingPageElements(domStructure) {
    try {
      let landingScore = 0;
      
      this.landingPageSelectors.forEach(selector => {
        const elements = this.countElementsBySelector(domStructure, selector);
        if (elements > 0) {
          landingScore += 0.1;
        }
      });
      
      // Check for multiple job cards/listings
      const jobCards = this.countElementsBySelector(domStructure, 
        '.job-card, .job-item, .job-listing, .search-result');
      if (jobCards > 3) {
        landingScore += 0.3;
      }
      
      // Check for pagination
      const pagination = this.countElementsBySelector(domStructure, 
        '.pagination, .pager, .page-nav, .next-page, .prev-page');
      if (pagination > 0) {
        landingScore += 0.2;
      }
      
      return Math.min(1, landingScore);
    } catch (error) {
      console.error('Error detecting landing page elements:', error);
      return 0;
    }
  }

  /**
   * Perform ML-based classification using extracted features
   */
  async performClassification(features) {
    try {
      // Calculate weighted score
      let score = 0;
      
      score += features.contentDensity * this.featureWeights.contentDensity;
      score += features.jobIndicators * this.featureWeights.jobIndicators;
      score += (1 - features.navigationScore) * this.featureWeights.navigationScore; // Invert navigation score
      score += features.urlScore * this.featureWeights.urlScore;
      score += features.semanticScore * this.featureWeights.semanticScore;
      
      // Apply structure and landing page adjustments
      score += features.structureScore * 0.1;
      score -= features.landingPageScore * 0.15;
      
      // Normalize score
      score = Math.max(0, Math.min(1, score));
      
      // Determine page type based on threshold
      const threshold = 0.6;
      const pageType = score > threshold ? 'job_posting' : 'landing_page';
      
      return {
        pageType: pageType,
        score: score,
        threshold: threshold,
        features: features
      };
    } catch (error) {
      console.error('Error in ML classification:', error);
      return {
        pageType: 'unknown',
        score: 0.5,
        threshold: 0.6,
        features: features
      };
    }
  }

  /**
   * Calculate confidence score for the classification
   */
  calculateConfidence(classification, features) {
    try {
      const score = classification.score;
      const threshold = classification.threshold;
      
      // Calculate distance from threshold
      const distance = Math.abs(score - threshold);
      
      // Base confidence on distance from threshold
      let confidence = distance * 2; // Scale to 0-1 range
      
      // Adjust confidence based on feature consistency
      const featureConsistency = this.calculateFeatureConsistency(features, classification.pageType);
      confidence = (confidence + featureConsistency) / 2;
      
      // Apply historical accuracy if available
      const historicalAccuracy = this.getHistoricalAccuracy(classification.pageType);
      if (historicalAccuracy > 0) {
        confidence = (confidence * 0.7) + (historicalAccuracy * 0.3);
      }
      
      return Math.max(0.1, Math.min(0.99, confidence));
    } catch (error) {
      console.error('Error calculating confidence:', error);
      return 0.5;
    }
  }

  /**
   * Calculate feature consistency for confidence scoring
   */
  calculateFeatureConsistency(features, pageType) {
    try {
      let consistentFeatures = 0;
      let totalFeatures = 0;
      
      if (pageType === 'job_posting') {
        // Check if features align with job posting classification
        if (features.jobIndicators > 0.5) consistentFeatures++;
        if (features.contentDensity > 0.4) consistentFeatures++;
        if (features.semanticScore > 0.5) consistentFeatures++;
        if (features.structureScore > 0.5) consistentFeatures++;
        totalFeatures = 4;
      } else {
        // Check if features align with landing page classification
        if (features.navigationScore > 0.5) consistentFeatures++;
        if (features.landingPageScore > 0.3) consistentFeatures++;
        if (features.urlScore < 0.5) consistentFeatures++;
        if (features.contentDensity < 0.6) consistentFeatures++;
        totalFeatures = 4;
      }
      
      return totalFeatures > 0 ? consistentFeatures / totalFeatures : 0.5;
    } catch (error) {
      console.error('Error calculating feature consistency:', error);
      return 0.5;
    }
  }

  /**
   * Determine if fraud analysis should proceed
   */
  shouldProceedWithAnalysis(classification, confidence, features) {
    try {
      // Skip analysis for high-confidence landing page classifications
      if (classification.pageType === 'landing_page' && confidence > 0.8) {
        return false;
      }
      
      // Always analyze job postings with reasonable confidence
      if (classification.pageType === 'job_posting' && confidence > 0.6) {
        return true;
      }
      
      // For uncertain classifications, use additional heuristics
      if (confidence < 0.7) {
        // Check for strong job posting indicators
        if (features.jobIndicators > 0.7 || features.semanticScore > 0.8) {
          return true;
        }
        
        // Check for strong landing page indicators
        if (features.landingPageScore > 0.6 || features.navigationScore > 0.8) {
          return false;
        }
      }
      
      // Default to analyzing when uncertain
      return true;
    } catch (error) {
      console.error('Error determining analysis decision:', error);
      return true; // Default to analyzing on error
    }
  }

  /**
   * Helper methods
   */
  generateCacheKey(url, content) {
    const urlHash = this.simpleHash(url);
    const contentHash = this.simpleHash(content.substring(0, 1000));
    return `${urlHash}_${contentHash}`;
  }

  generateClassificationId() {
    return `cls_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  getCachedResult(cacheKey) {
    const cached = this.classificationCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.result;
    }
    return null;
  }

  cacheResult(cacheKey, result) {
    this.classificationCache.set(cacheKey, {
      result: result,
      timestamp: Date.now()
    });
    
    // Clean old cache entries
    if (this.classificationCache.size > 100) {
      const oldestKey = this.classificationCache.keys().next().value;
      this.classificationCache.delete(oldestKey);
    }
  }

  countElementsBySelector(domStructure, selector) {
    try {
      if (domStructure.querySelector) {
        const elements = domStructure.querySelectorAll(selector);
        return elements ? elements.length : 0;
      }
      
      // Fallback for simplified DOM structure
      const selectorCounts = domStructure.selectorCounts || {};
      return selectorCounts[selector] || 0;
    } catch (error) {
      return 0;
    }
  }

  extractTextContent(htmlContent) {
    try {
      // Simple text extraction (remove HTML tags)
      return htmlContent.replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    } catch (error) {
      return '';
    }
  }

  getHistoricalAccuracy(pageType) {
    // This would be populated from Firestore learning data
    // For now, return default values
    return pageType === 'job_posting' ? 0.85 : 0.82;
  }

  /**
   * Update learning patterns from user feedback
   */
  updateLearningPatterns(feedback) {
    try {
      this.learningPatterns.push({
        feedback: feedback,
        timestamp: Date.now(),
        features: feedback.features
      });
      
      // Update feature weights based on feedback
      if (feedback.wasCorrect === false) {
        this.adjustFeatureWeights(feedback);
      }
    } catch (error) {
      console.error('Error updating learning patterns:', error);
    }
  }

  /**
   * Adjust feature weights based on feedback
   */
  adjustFeatureWeights(feedback) {
    try {
      const learningRate = 0.01;
      const features = feedback.features;
      const wasCorrect = feedback.wasCorrect;
      
      // Adjust weights based on feedback
      Object.keys(this.featureWeights).forEach(feature => {
        if (features[feature] !== undefined) {
          const adjustment = wasCorrect ? learningRate : -learningRate;
          this.featureWeights[feature] += adjustment * features[feature];
          
          // Keep weights in reasonable bounds
          this.featureWeights[feature] = Math.max(0.05, Math.min(0.5, this.featureWeights[feature]));
        }
      });
    } catch (error) {
      console.error('Error adjusting feature weights:', error);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageContextAnalyzer;
} else if (typeof window !== 'undefined') {
  window.PageContextAnalyzer = PageContextAnalyzer;
}