// JavaScript-compatible Fraud Detection System
// This system uses rule-based patterns derived from NLP model features
// Compatible with Chrome extensions and web environments

class FraudDetector {
  constructor(modelManager) {
    this.modelManager = modelManager;
    this.isInitialized = false;
    this.fraudPatterns = null;
    this.suspiciousKeywords = null;
    this.legitimateIndicators = null;
    this.domainCheckEnabled = true;
  }

  async initialize() {
    try {
      console.log('Initializing Fraud Detector...');
      
      // Fetch model data and metadata
      const modelData = await this.modelManager.fetchModelData();
      
      // Initialize rule-based patterns based on model features
      this.initializePatterns(modelData.metadata);
      
      this.isInitialized = true;
      console.log('Fraud Detector initialized successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize Fraud Detector:', error);
      // Fallback to basic patterns if model data is unavailable
      this.initializeFallbackPatterns();
      this.isInitialized = true;
      return false;
    }
  }

  initializePatterns(metadata) {
    // Fraud indicators based on common job posting scam patterns
    this.fraudPatterns = {
      // Salary-related red flags
      unrealisticSalary: {
        keywords: ['$5000+', '$10000+', 'high salary', 'easy money', 'quick cash'],
        weight: 0.8
      },
      
      // Communication red flags
      suspiciousCommunication: {
        keywords: ['whatsapp', 'telegram', 'personal email', 'gmail', 'yahoo', 'hotmail'],
        weight: 0.7
      },
      
      // Payment/fee red flags
      upfrontPayment: {
        keywords: ['registration fee', 'processing fee', 'training fee', 'equipment fee', 'deposit required'],
        weight: 0.9
      },
      
      // Urgency and pressure tactics
      urgencyTactics: {
        keywords: ['urgent', 'immediate start', 'limited time', 'act now', 'don\'t miss'],
        weight: 0.6
      },
      
      // Vague job descriptions
      vagueDescription: {
        keywords: ['easy work', 'simple tasks', 'no experience', 'work from home', 'flexible hours'],
        weight: 0.5
      },
      
      // Suspicious company information
      suspiciousCompany: {
        keywords: ['new company', 'startup opportunity', 'international company', 'remote only'],
        weight: 0.4
      }
    };

    // Legitimate job indicators
    this.legitimateIndicators = {
      professionalLanguage: {
        keywords: ['requirements', 'qualifications', 'responsibilities', 'benefits', 'company culture'],
        weight: -0.3
      },
      
      specificDetails: {
        keywords: ['specific skills', 'years of experience', 'degree required', 'certifications'],
        weight: -0.4
      },
      
      establishedCompany: {
        keywords: ['established', 'founded', 'years in business', 'office location', 'website'],
        weight: -0.5
      }
    };

    // Suspicious keywords for quick detection
    this.suspiciousKeywords = [
      'guaranteed income', 'no interview', 'instant hiring', 'work from phone',
      'copy paste work', 'data entry from home', 'envelope stuffing',
      'mystery shopper', 'rebate processor', 'assembly work'
    ];
  }

  initializeFallbackPatterns() {
    console.log('Using fallback fraud detection patterns');
    
    // Basic fallback patterns when model data is unavailable
    this.suspiciousKeywords = [
      'guaranteed income', 'easy money', 'work from home', 'no experience required',
      'registration fee', 'processing fee', 'urgent hiring', 'immediate start'
    ];
    
    this.fraudPatterns = {
      basicSuspicious: {
        keywords: this.suspiciousKeywords,
        weight: 0.7
      }
    };
    
    this.legitimateIndicators = {
      basicLegitimate: {
        keywords: ['requirements', 'qualifications', 'experience', 'skills'],
        weight: -0.3
      }
    };
  }

  async analyzeJobPosting(jobText, pageUrl = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Multi-stage fraud detection workflow
      const analysis = await this.performComprehensiveAnalysis(jobText, pageUrl);
      
      // Log analysis for debugging
      console.log('Comprehensive fraud analysis result:', analysis);
      
      return analysis;
    } catch (error) {
      console.error('Error analyzing job posting:', error);
      return {
        isFraud: false,
        confidence: 0,
        riskLevel: 'unknown',
        reasons: ['Analysis failed'],
        score: 0,
        method: 'error',
        error: error.message
      };
    }
  }

  async performComprehensiveAnalysis(jobText, pageUrl = null) {
    const analysisSteps = [];
    let finalResult = null;
    
    // Step 1: Domain blacklist check (highest priority)
    if (pageUrl && this.domainCheckEnabled) {
      try {
        const domainResult = await this.checkDomainBlacklist(pageUrl);
        analysisSteps.push({
          step: 'domain_check',
          result: domainResult,
          timestamp: new Date().toISOString()
        });
        
        if (domainResult.isFraudulent) {
          // Domain is blacklisted - immediate fraud detection
          finalResult = {
            isFraud: true,
            confidence: 0.95,
            riskLevel: 'high',
            score: 0.95,
            method: 'domain_blacklist',
            reasons: [
              'Domain is in fraud blacklist',
              `Domain: ${domainResult.domain}`,
              'This site has been reported as fraudulent'
            ],
            domainCheck: domainResult,
            analysisSteps
          };
          
          console.log('Fraud detected via domain blacklist:', domainResult.domain);
          return finalResult;
        } else {
          console.log('Domain not in blacklist, proceeding to NLP analysis');
        }
      } catch (error) {
        console.warn('Domain check failed, proceeding to NLP analysis:', error);
        analysisSteps.push({
          step: 'domain_check',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Step 2: NLP-based content analysis (fallback)
    try {
      const nlpResult = this.performRuleBasedAnalysis(jobText);
      analysisSteps.push({
        step: 'nlp_analysis',
        result: nlpResult,
        timestamp: new Date().toISOString()
      });
      
      // If NLP analysis indicates fraud or high suspicion
      if (nlpResult.isFraud || nlpResult.riskLevel === 'high' || nlpResult.riskLevel === 'medium') {
        finalResult = {
          ...nlpResult,
          method: 'nlp_analysis',
          domainCheck: analysisSteps.find(step => step.step === 'domain_check')?.result || null,
          analysisSteps
        };
        
        console.log('Fraud detected via NLP analysis:', nlpResult.riskLevel);
        return finalResult;
      }
    } catch (error) {
      console.warn('NLP analysis failed:', error);
      analysisSteps.push({
        step: 'nlp_analysis',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Step 3: Inconclusive result - manual review needed
    const inconclusiveResult = {
      isFraud: false,
      confidence: 0.1,
      riskLevel: 'unknown',
      score: 0.1,
      method: 'inconclusive',
      reasons: [
        'Unable to determine fraud status automatically',
        'Domain not in blacklist',
        'Content analysis inconclusive',
        'Manual review recommended'
      ],
      needsManualReview: true,
      domainCheck: analysisSteps.find(step => step.step === 'domain_check')?.result || null,
      nlpAnalysis: analysisSteps.find(step => step.step === 'nlp_analysis')?.result || null,
      analysisSteps
    };
    
    console.log('Analysis inconclusive, manual review needed');
    return inconclusiveResult;
  }
  
  async checkDomainBlacklist(pageUrl) {
    try {
      const url = new URL(pageUrl);
      const domain = url.hostname;
      
      // Use ModelManager to check if domain is fraudulent
      const domainResult = await this.modelManager.isDomainFraudulent(domain);
      
      return {
        ...domainResult,
        method: 'domain_blacklist',
        url: pageUrl
      };
    } catch (error) {
      console.error('Error checking domain blacklist:', error);
      throw new Error(`Domain check failed: ${error.message}`);
    }
  }

  performRuleBasedAnalysis(jobText) {
    const text = jobText.toLowerCase();
    let fraudScore = 0;
    let matchedPatterns = [];
    let legitimateScore = 0;
    let legitimatePatterns = [];

    // Check fraud patterns
    for (const [patternName, pattern] of Object.entries(this.fraudPatterns)) {
      const matches = pattern.keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      );
      
      if (matches.length > 0) {
        const patternScore = pattern.weight * (matches.length / pattern.keywords.length);
        fraudScore += patternScore;
        matchedPatterns.push({
          pattern: patternName,
          matches: matches,
          score: patternScore
        });
      }
    }

    // Check legitimate indicators
    for (const [patternName, pattern] of Object.entries(this.legitimateIndicators)) {
      const matches = pattern.keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      );
      
      if (matches.length > 0) {
        const patternScore = Math.abs(pattern.weight) * (matches.length / pattern.keywords.length);
        legitimateScore += patternScore;
        legitimatePatterns.push({
          pattern: patternName,
          matches: matches,
          score: patternScore
        });
      }
    }

    // Calculate final score
    const finalScore = fraudScore - legitimateScore;
    const normalizedScore = Math.max(0, Math.min(1, finalScore));
    
    // Determine risk level and fraud probability
    let riskLevel, isFraud, confidence;
    
    if (normalizedScore >= 0.7) {
      riskLevel = 'high';
      isFraud = true;
      confidence = normalizedScore;
    } else if (normalizedScore >= 0.4) {
      riskLevel = 'medium';
      isFraud = true;
      confidence = normalizedScore * 0.8;
    } else if (normalizedScore >= 0.2) {
      riskLevel = 'low';
      isFraud = false;
      confidence = 1 - normalizedScore;
    } else {
      riskLevel = 'very_low';
      isFraud = false;
      confidence = 1 - normalizedScore;
    }

    return {
      isFraud,
      confidence: Math.round(confidence * 100) / 100,
      riskLevel,
      score: Math.round(normalizedScore * 100) / 100,
      fraudScore: Math.round(fraudScore * 100) / 100,
      legitimateScore: Math.round(legitimateScore * 100) / 100,
      matchedFraudPatterns: matchedPatterns,
      matchedLegitimatePatterns: legitimatePatterns,
      reasons: this.generateReasons(matchedPatterns, legitimatePatterns, riskLevel)
    };
  }

  generateReasons(fraudPatterns, legitimatePatterns, riskLevel) {
    const reasons = [];
    
    if (riskLevel === 'high' || riskLevel === 'medium') {
      reasons.push('Suspicious patterns detected in job posting');
      
      fraudPatterns.forEach(pattern => {
        switch (pattern.pattern) {
          case 'unrealisticSalary':
            reasons.push('Unrealistic salary promises detected');
            break;
          case 'upfrontPayment':
            reasons.push('Requests for upfront payments or fees');
            break;
          case 'suspiciousCommunication':
            reasons.push('Suspicious communication methods mentioned');
            break;
          case 'urgencyTactics':
            reasons.push('High-pressure urgency tactics used');
            break;
          case 'vagueDescription':
            reasons.push('Vague or overly simple job description');
            break;
          default:
            reasons.push(`Suspicious pattern: ${pattern.pattern}`);
        }
      });
    } else {
      reasons.push('Job posting appears legitimate');
      
      if (legitimatePatterns.length > 0) {
        reasons.push('Contains professional language and specific requirements');
      }
    }
    
    return reasons;
  }

  // Quick fraud check for real-time analysis
  async quickFraudCheck(text, pageUrl = null) {
    try {
      const result = await this.analyzeJobPosting(text, pageUrl);
      return {
        isFraud: result.isFraud,
        confidence: result.confidence,
        riskLevel: result.riskLevel,
        method: result.method,
        needsManualReview: result.needsManualReview || false
      };
    } catch (error) {
      console.error('Quick fraud check failed:', error);
      return {
        isFraud: false,
        confidence: 0,
        riskLevel: 'unknown',
        method: 'error',
        needsManualReview: true
      };
    }
  }

  // Get detector status and metadata
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      modelMetadata: this.modelManager.getModelMetadata(),
      patternsLoaded: !!this.fraudPatterns,
      lastUpdate: new Date().toISOString()
    };
  }
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  window.FraudDetector = FraudDetector;
}

// For service worker/background script
if (typeof self !== 'undefined' && typeof importScripts === 'function') {
  self.FraudDetector = FraudDetector;
}

// CommonJS export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FraudDetector;
}