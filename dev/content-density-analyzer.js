/**
 * Content Density Analyzer - Dynamic False Positive Reduction System
 * Implements algorithms to calculate content-to-noise ratio, job posting density,
 * navigation element presence, and semantic content analysis
 */

class ContentDensityAnalyzer {
  constructor() {
    this.densityCache = new Map();
    this.cacheExpiry = 10 * 60 * 1000; // 10 minutes
    
    // Content type weights for density calculation
    this.contentWeights = {
      jobTitle: 3.0,
      jobDescription: 2.5,
      companyInfo: 2.0,
      requirements: 2.0,
      benefits: 1.5,
      salary: 1.8,
      location: 1.2,
      applicationInfo: 1.0,
      navigation: -0.5,
      advertisements: -1.0,
      footer: -0.3,
      sidebar: -0.2
    };
    
    // Element type classifications
    this.contentElements = [
      'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'article', 'section', 'main', 'aside', 'ul', 'ol', 'li'
    ];
    
    this.noiseElements = [
      'script', 'style', 'noscript', 'meta', 'link', 'head',
      'iframe', 'embed', 'object', 'canvas'
    ];
    
    this.navigationElements = [
      'nav', 'header', 'footer', 'menu', 'breadcrumb'
    ];
  }

  /**
   * Main content density analysis method
   * @param {Object} domStructure - Parsed DOM structure
   * @param {string} pageContent - Raw HTML content
   * @param {Object} options - Analysis options
   * @returns {Object} Density analysis results
   */
  async analyzeContentDensity(domStructure, pageContent, options = {}) {
    try {
      const cacheKey = this.generateCacheKey(pageContent);
      const cachedResult = this.getCachedResult(cacheKey);
      
      if (cachedResult && !options.forceRefresh) {
        return cachedResult;
      }

      // Perform comprehensive density analysis
      const analysis = {
        contentToNoiseRatio: await this.calculateContentToNoiseRatio(domStructure, pageContent),
        jobPostingDensity: await this.calculateJobPostingDensity(domStructure, pageContent),
        navigationPresence: await this.analyzeNavigationPresence(domStructure),
        semanticDensity: await this.calculateSemanticDensity(pageContent),
        structuralDensity: await this.calculateStructuralDensity(domStructure),
        textualDensity: await this.calculateTextualDensity(pageContent),
        interactivityDensity: await this.calculateInteractivityDensity(domStructure),
        timestamp: Date.now()
      };

      // Calculate overall density score
      analysis.overallDensity = this.calculateOverallDensity(analysis);
      
      // Determine content classification
      analysis.contentClassification = this.classifyContent(analysis);
      
      // Cache the result
      this.cacheResult(cacheKey, analysis);
      
      return analysis;
    } catch (error) {
      console.error('Error in content density analysis:', error);
      return this.getDefaultAnalysis(error);
    }
  }

  /**
   * Calculate content-to-noise ratio
   */
  async calculateContentToNoiseRatio(domStructure, pageContent) {
    try {
      const contentMetrics = this.extractContentMetrics(domStructure, pageContent);
      
      const contentScore = contentMetrics.meaningfulContent;
      const noiseScore = contentMetrics.noise;
      const totalScore = contentScore + noiseScore;
      
      if (totalScore === 0) return 0.5;
      
      const ratio = contentScore / totalScore;
      
      return {
        ratio: ratio,
        contentScore: contentScore,
        noiseScore: noiseScore,
        meaningfulElements: contentMetrics.meaningfulElements,
        noiseElements: contentMetrics.noiseElements,
        confidence: this.calculateRatioConfidence(contentMetrics)
      };
    } catch (error) {
      console.error('Error calculating content-to-noise ratio:', error);
      return { ratio: 0.5, confidence: 0.3 };
    }
  }

  /**
   * Calculate job posting specific density
   */
  async calculateJobPostingDensity(domStructure, pageContent) {
    try {
      const jobElements = this.identifyJobElements(domStructure, pageContent);
      const totalElements = domStructure.totalElements || 1;
      
      // Calculate job element density
      const jobElementDensity = jobElements.count / totalElements;
      
      // Calculate job content density
      const jobContentDensity = jobElements.contentLength / (pageContent.length || 1);
      
      // Calculate job semantic density
      const jobSemanticDensity = this.calculateJobSemanticDensity(pageContent);
      
      // Weight the different density measures
      const weightedDensity = (
        jobElementDensity * 0.4 +
        jobContentDensity * 0.3 +
        jobSemanticDensity * 0.3
      );
      
      return {
        density: Math.min(1, weightedDensity),
        elementDensity: jobElementDensity,
        contentDensity: jobContentDensity,
        semanticDensity: jobSemanticDensity,
        jobElements: jobElements,
        confidence: this.calculateJobDensityConfidence(jobElements)
      };
    } catch (error) {
      console.error('Error calculating job posting density:', error);
      return { density: 0, confidence: 0.3 };
    }
  }

  /**
   * Analyze navigation element presence and patterns
   */
  async analyzeNavigationPresence(domStructure) {
    try {
      const navAnalysis = {
        primaryNavigation: 0,
        secondaryNavigation: 0,
        breadcrumbs: 0,
        pagination: 0,
        filters: 0,
        searchElements: 0,
        menuItems: 0
      };

      // Count different types of navigation elements
      navAnalysis.primaryNavigation = this.countNavigationElements(domStructure, [
        'nav', '.navbar', '.main-nav', '.primary-nav', '.header-nav'
      ]);

      navAnalysis.secondaryNavigation = this.countNavigationElements(domStructure, [
        '.sidebar', '.secondary-nav', '.sub-nav', '.side-menu'
      ]);

      navAnalysis.breadcrumbs = this.countNavigationElements(domStructure, [
        '.breadcrumb', '.breadcrumbs', '.crumb', '.path-nav'
      ]);

      navAnalysis.pagination = this.countNavigationElements(domStructure, [
        '.pagination', '.pager', '.page-nav', '.next', '.prev'
      ]);

      navAnalysis.filters = this.countNavigationElements(domStructure, [
        '.filters', '.filter', '.search-filters', '.facets'
      ]);

      navAnalysis.searchElements = this.countNavigationElements(domStructure, [
        '.search', '.search-form', '.search-bar', '.search-box'
      ]);

      // Calculate navigation density
      const totalElements = domStructure.totalElements || 1;
      const totalNavElements = Object.values(navAnalysis).reduce((sum, count) => sum + count, 0);
      
      navAnalysis.density = totalNavElements / totalElements;
      navAnalysis.totalNavElements = totalNavElements;
      
      // Determine navigation pattern
      navAnalysis.pattern = this.determineNavigationPattern(navAnalysis);
      
      return navAnalysis;
    } catch (error) {
      console.error('Error analyzing navigation presence:', error);
      return { density: 0, pattern: 'unknown' };
    }
  }

  /**
   * Calculate semantic content density
   */
  async calculateSemanticDensity(pageContent) {
    try {
      const textContent = this.extractTextContent(pageContent);
      const words = textContent.split(/\s+/).filter(word => word.length > 2);
      const totalWords = words.length;
      
      if (totalWords === 0) return { density: 0, confidence: 0 };
      
      // Job-related semantic categories
      const semanticCategories = {
        jobTitles: this.countSemanticMatches(textContent, [
          'developer', 'engineer', 'manager', 'analyst', 'specialist',
          'coordinator', 'assistant', 'director', 'consultant', 'architect'
        ]),
        
        skills: this.countSemanticMatches(textContent, [
          'javascript', 'python', 'java', 'react', 'angular', 'vue',
          'sql', 'aws', 'docker', 'kubernetes', 'agile', 'scrum'
        ]),
        
        requirements: this.countSemanticMatches(textContent, [
          'experience', 'years', 'degree', 'bachelor', 'master',
          'certification', 'required', 'preferred', 'must have'
        ]),
        
        benefits: this.countSemanticMatches(textContent, [
          'salary', 'benefits', 'insurance', 'vacation', 'remote',
          'flexible', 'bonus', 'stock', 'retirement', '401k'
        ]),
        
        company: this.countSemanticMatches(textContent, [
          'company', 'team', 'culture', 'mission', 'values',
          'growth', 'opportunity', 'career', 'development'
        ])
      };
      
      // Calculate semantic density for each category
      const categoryDensities = {};
      let totalSemanticWords = 0;
      
      Object.keys(semanticCategories).forEach(category => {
        const count = semanticCategories[category];
        categoryDensities[category] = count / totalWords;
        totalSemanticWords += count;
      });
      
      const overallSemanticDensity = totalSemanticWords / totalWords;
      
      return {
        density: overallSemanticDensity,
        categories: categoryDensities,
        totalSemanticWords: totalSemanticWords,
        totalWords: totalWords,
        confidence: Math.min(1, totalSemanticWords / 50) // Higher confidence with more semantic content
      };
    } catch (error) {
      console.error('Error calculating semantic density:', error);
      return { density: 0, confidence: 0 };
    }
  }

  /**
   * Calculate structural density based on DOM hierarchy
   */
  async calculateStructuralDensity(domStructure) {
    try {
      const structure = {
        depth: domStructure.maxDepth || 0,
        breadth: domStructure.maxBreadth || 0,
        contentSections: 0,
        headerSections: 0,
        listElements: 0,
        formElements: 0
      };

      // Count structural elements
      structure.contentSections = this.countStructuralElements(domStructure, [
        'section', 'article', 'main', 'div.content', '.job-section'
      ]);

      structure.headerSections = this.countStructuralElements(domStructure, [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header'
      ]);

      structure.listElements = this.countStructuralElements(domStructure, [
        'ul', 'ol', 'dl', '.list', '.requirements-list'
      ]);

      structure.formElements = this.countStructuralElements(domStructure, [
        'form', 'input', 'button', 'select', 'textarea'
      ]);

      // Calculate structural complexity
      const complexity = (structure.depth * 0.3) + (structure.breadth * 0.2) + 
                        (structure.contentSections * 0.5);
      
      structure.complexity = Math.min(1, complexity / 20); // Normalize to 0-1
      
      // Determine structural pattern
      structure.pattern = this.determineStructuralPattern(structure);
      
      return structure;
    } catch (error) {
      console.error('Error calculating structural density:', error);
      return { complexity: 0.5, pattern: 'unknown' };
    }
  }

  /**
   * Calculate textual content density
   */
  async calculateTextualDensity(pageContent) {
    try {
      const textContent = this.extractTextContent(pageContent);
      const htmlLength = pageContent.length;
      const textLength = textContent.length;
      
      if (htmlLength === 0) return { density: 0, confidence: 0 };
      
      // Basic text-to-HTML ratio
      const basicRatio = textLength / htmlLength;
      
      // Calculate meaningful text ratio
      const meaningfulText = this.extractMeaningfulText(textContent);
      const meaningfulRatio = meaningfulText.length / textLength;
      
      // Calculate sentence and paragraph density
      const sentences = textContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const paragraphs = textContent.split(/\n\s*\n/).filter(p => p.trim().length > 20);
      
      const sentenceDensity = sentences.length / Math.max(1, textLength / 100);
      const paragraphDensity = paragraphs.length / Math.max(1, textLength / 500);
      
      return {
        density: basicRatio,
        meaningfulRatio: meaningfulRatio,
        sentenceDensity: Math.min(1, sentenceDensity),
        paragraphDensity: Math.min(1, paragraphDensity),
        textLength: textLength,
        htmlLength: htmlLength,
        sentences: sentences.length,
        paragraphs: paragraphs.length,
        confidence: Math.min(1, textLength / 1000)
      };
    } catch (error) {
      console.error('Error calculating textual density:', error);
      return { density: 0.5, confidence: 0.3 };
    }
  }

  /**
   * Calculate interactivity density (forms, buttons, links)
   */
  async calculateInteractivityDensity(domStructure) {
    try {
      const interactiveElements = {
        buttons: 0,
        links: 0,
        forms: 0,
        inputs: 0,
        clickableElements: 0
      };

      // Count interactive elements
      interactiveElements.buttons = this.countInteractiveElements(domStructure, [
        'button', '.btn', '.button', 'input[type="button"]', 'input[type="submit"]'
      ]);

      interactiveElements.links = this.countInteractiveElements(domStructure, [
        'a', '.link', '.nav-link'
      ]);

      interactiveElements.forms = this.countInteractiveElements(domStructure, [
        'form', '.form', '.search-form'
      ]);

      interactiveElements.inputs = this.countInteractiveElements(domStructure, [
        'input', 'select', 'textarea', '.input'
      ]);

      interactiveElements.clickableElements = this.countInteractiveElements(domStructure, [
        '[onclick]', '[data-click]', '.clickable', '.interactive'
      ]);

      const totalElements = domStructure.totalElements || 1;
      const totalInteractive = Object.values(interactiveElements).reduce((sum, count) => sum + count, 0);
      
      const density = totalInteractive / totalElements;
      
      // Determine interactivity pattern
      const pattern = this.determineInteractivityPattern(interactiveElements);
      
      return {
        density: density,
        elements: interactiveElements,
        totalInteractive: totalInteractive,
        pattern: pattern,
        confidence: Math.min(1, totalInteractive / 10)
      };
    } catch (error) {
      console.error('Error calculating interactivity density:', error);
      return { density: 0, pattern: 'unknown', confidence: 0.3 };
    }
  }

  /**
   * Calculate overall density score
   */
  calculateOverallDensity(analysis) {
    try {
      const weights = {
        contentToNoise: 0.25,
        jobPosting: 0.30,
        semantic: 0.20,
        structural: 0.15,
        textual: 0.10
      };

      let overallScore = 0;
      let totalWeight = 0;

      // Content-to-noise ratio
      if (analysis.contentToNoiseRatio && analysis.contentToNoiseRatio.ratio !== undefined) {
        overallScore += analysis.contentToNoiseRatio.ratio * weights.contentToNoise;
        totalWeight += weights.contentToNoise;
      }

      // Job posting density
      if (analysis.jobPostingDensity && analysis.jobPostingDensity.density !== undefined) {
        overallScore += analysis.jobPostingDensity.density * weights.jobPosting;
        totalWeight += weights.jobPosting;
      }

      // Semantic density
      if (analysis.semanticDensity && analysis.semanticDensity.density !== undefined) {
        overallScore += analysis.semanticDensity.density * weights.semantic;
        totalWeight += weights.semantic;
      }

      // Structural density
      if (analysis.structuralDensity && analysis.structuralDensity.complexity !== undefined) {
        overallScore += analysis.structuralDensity.complexity * weights.structural;
        totalWeight += weights.structural;
      }

      // Textual density
      if (analysis.textualDensity && analysis.textualDensity.density !== undefined) {
        overallScore += analysis.textualDensity.density * weights.textual;
        totalWeight += weights.textual;
      }

      return totalWeight > 0 ? overallScore / totalWeight : 0.5;
    } catch (error) {
      console.error('Error calculating overall density:', error);
      return 0.5;
    }
  }

  /**
   * Classify content based on density analysis
   */
  classifyContent(analysis) {
    try {
      const scores = {
        jobPosting: 0,
        landingPage: 0,
        searchResults: 0,
        companyPage: 0,
        unknown: 0
      };

      // Job posting indicators
      if (analysis.jobPostingDensity && analysis.jobPostingDensity.density > 0.6) {
        scores.jobPosting += 0.4;
      }

      if (analysis.semanticDensity && analysis.semanticDensity.density > 0.3) {
        scores.jobPosting += 0.3;
      }

      // Landing page indicators
      if (analysis.navigationPresence && analysis.navigationPresence.density > 0.2) {
        scores.landingPage += 0.3;
      }

      if (analysis.interactivityDensity && analysis.interactivityDensity.density > 0.15) {
        scores.landingPage += 0.2;
      }

      // Search results indicators
      if (analysis.navigationPresence && analysis.navigationPresence.filters > 2) {
        scores.searchResults += 0.4;
      }

      if (analysis.structuralDensity && analysis.structuralDensity.listElements > 5) {
        scores.searchResults += 0.3;
      }

      // Find the highest scoring classification
      const maxScore = Math.max(...Object.values(scores));
      const classification = Object.keys(scores).find(key => scores[key] === maxScore);

      return {
        classification: classification || 'unknown',
        confidence: maxScore,
        scores: scores
      };
    } catch (error) {
      console.error('Error classifying content:', error);
      return { classification: 'unknown', confidence: 0.3, scores: {} };
    }
  }

  /**
   * Helper methods
   */
  extractContentMetrics(domStructure, pageContent) {
    let meaningfulContent = 0;
    let noise = 0;
    let meaningfulElements = 0;
    let noiseElements = 0;

    // Count content elements
    this.contentElements.forEach(element => {
      const count = this.countElementsByType(domStructure, element);
      meaningfulContent += count * this.contentWeights.jobDescription || 1;
      meaningfulElements += count;
    });

    // Count noise elements
    this.noiseElements.forEach(element => {
      const count = this.countElementsByType(domStructure, element);
      noise += count;
      noiseElements += count;
    });

    return {
      meaningfulContent,
      noise,
      meaningfulElements,
      noiseElements
    };
  }

  identifyJobElements(domStructure, pageContent) {
    const jobSelectors = [
      '.job-title', '.job-description', '.company-name', '.salary',
      '.location', '.requirements', '.qualifications', '.benefits',
      '.apply-button', '.job-details', '.posting-date'
    ];

    let count = 0;
    let contentLength = 0;
    const elements = [];

    jobSelectors.forEach(selector => {
      const elementCount = this.countElementsBySelector(domStructure, selector);
      count += elementCount;
      
      if (elementCount > 0) {
        elements.push({
          selector: selector,
          count: elementCount,
          weight: this.contentWeights[selector.replace('.', '')] || 1
        });
      }
    });

    // Estimate content length from job-related text
    const jobKeywords = [
      'responsibilities', 'requirements', 'qualifications', 'experience',
      'skills', 'education', 'benefits', 'salary', 'apply'
    ];

    const textContent = this.extractTextContent(pageContent);
    jobKeywords.forEach(keyword => {
      const matches = textContent.match(new RegExp(keyword, 'gi'));
      if (matches) {
        contentLength += matches.length * keyword.length * 10; // Estimate surrounding content
      }
    });

    return {
      count: count,
      contentLength: contentLength,
      elements: elements
    };
  }

  calculateJobSemanticDensity(pageContent) {
    const jobTerms = [
      'job', 'position', 'role', 'career', 'employment', 'work',
      'company', 'team', 'department', 'office', 'remote',
      'salary', 'compensation', 'benefits', 'insurance',
      'experience', 'skills', 'qualifications', 'education',
      'apply', 'application', 'resume', 'cv', 'interview'
    ];

    const textContent = this.extractTextContent(pageContent).toLowerCase();
    const words = textContent.split(/\s+/);
    
    let jobTermCount = 0;
    jobTerms.forEach(term => {
      const matches = textContent.match(new RegExp(`\\b${term}\\b`, 'g'));
      if (matches) {
        jobTermCount += matches.length;
      }
    });

    return words.length > 0 ? jobTermCount / words.length : 0;
  }

  countNavigationElements(domStructure, selectors) {
    return selectors.reduce((total, selector) => {
      return total + this.countElementsBySelector(domStructure, selector);
    }, 0);
  }

  countStructuralElements(domStructure, selectors) {
    return selectors.reduce((total, selector) => {
      return total + this.countElementsBySelector(domStructure, selector);
    }, 0);
  }

  countInteractiveElements(domStructure, selectors) {
    return selectors.reduce((total, selector) => {
      return total + this.countElementsBySelector(domStructure, selector);
    }, 0);
  }

  countElementsByType(domStructure, elementType) {
    try {
      const elementCounts = domStructure.elementCounts || {};
      return elementCounts[elementType] || 0;
    } catch (error) {
      return 0;
    }
  }

  countElementsBySelector(domStructure, selector) {
    try {
      const selectorCounts = domStructure.selectorCounts || {};
      return selectorCounts[selector] || 0;
    } catch (error) {
      return 0;
    }
  }

  countSemanticMatches(textContent, terms) {
    let count = 0;
    terms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = textContent.match(regex);
      if (matches) {
        count += matches.length;
      }
    });
    return count;
  }

  extractTextContent(htmlContent) {
    try {
      return htmlContent.replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (error) {
      return '';
    }
  }

  extractMeaningfulText(textContent) {
    // Remove common stop words and short words
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const words = textContent.toLowerCase().split(/\s+/);
    
    return words.filter(word => 
      word.length > 3 && 
      !stopWords.includes(word) &&
      /^[a-zA-Z]+$/.test(word)
    ).join(' ');
  }

  determineNavigationPattern(navAnalysis) {
    if (navAnalysis.filters > 2 && navAnalysis.searchElements > 0) {
      return 'search_interface';
    } else if (navAnalysis.pagination > 0 && navAnalysis.filters > 0) {
      return 'results_page';
    } else if (navAnalysis.primaryNavigation > 0 && navAnalysis.breadcrumbs > 0) {
      return 'content_page';
    } else if (navAnalysis.secondaryNavigation > 2) {
      return 'landing_page';
    }
    return 'simple_page';
  }

  determineStructuralPattern(structure) {
    if (structure.contentSections > 3 && structure.headerSections > 2) {
      return 'detailed_content';
    } else if (structure.listElements > 5) {
      return 'list_based';
    } else if (structure.formElements > 3) {
      return 'interactive_form';
    } else if (structure.depth > 8) {
      return 'complex_nested';
    }
    return 'simple_structure';
  }

  determineInteractivityPattern(elements) {
    if (elements.forms > 2 && elements.inputs > 5) {
      return 'form_heavy';
    } else if (elements.buttons > 3 && elements.clickableElements > 5) {
      return 'action_oriented';
    } else if (elements.links > 10) {
      return 'navigation_heavy';
    }
    return 'minimal_interaction';
  }

  calculateRatioConfidence(metrics) {
    const total = metrics.meaningfulElements + metrics.noiseElements;
    return Math.min(1, total / 20); // Higher confidence with more elements
  }

  calculateJobDensityConfidence(jobElements) {
    return Math.min(1, jobElements.count / 5); // Higher confidence with more job elements
  }

  generateCacheKey(content) {
    return this.simpleHash(content.substring(0, 2000));
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  getCachedResult(cacheKey) {
    const cached = this.densityCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.result;
    }
    return null;
  }

  cacheResult(cacheKey, result) {
    this.densityCache.set(cacheKey, {
      result: result,
      timestamp: Date.now()
    });

    // Clean old cache entries
    if (this.densityCache.size > 50) {
      const oldestKey = this.densityCache.keys().next().value;
      this.densityCache.delete(oldestKey);
    }
  }

  getDefaultAnalysis(error) {
    return {
      contentToNoiseRatio: { ratio: 0.5, confidence: 0.3 },
      jobPostingDensity: { density: 0, confidence: 0.3 },
      navigationPresence: { density: 0, pattern: 'unknown' },
      semanticDensity: { density: 0, confidence: 0 },
      structuralDensity: { complexity: 0.5, pattern: 'unknown' },
      textualDensity: { density: 0.5, confidence: 0.3 },
      interactivityDensity: { density: 0, pattern: 'unknown', confidence: 0.3 },
      overallDensity: 0.5,
      contentClassification: { classification: 'unknown', confidence: 0.3 },
      error: error.message,
      timestamp: Date.now()
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentDensityAnalyzer;
} else if (typeof window !== 'undefined') {
  window.ContentDensityAnalyzer = ContentDensityAnalyzer;
}