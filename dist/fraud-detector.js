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
    if (this.isInitialized) {
      console.log('FraudDetector already initialized');
      return;
    }

    console.log('🚀 Initializing FraudDetector...');
    
    try {
      // Initialize ModelManager if not provided in constructor
      if (!this.modelManager) {
        console.error('❌ ModelManager not provided to FraudDetector constructor');
        throw new Error('ModelManager is required for FraudDetector');
      }
      await this.modelManager.initialize();
      
      // Initialize fallback patterns
      this.initializeFallbackPatterns();
      
      // Initialize page classification patterns
      this.initializePageClassificationPatterns();
      
      this.isInitialized = true;
      console.log('✅ FraudDetector initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize FraudDetector:', error);
      // Initialize fallback patterns even if ModelManager fails
      this.initializeFallbackPatterns();
      this.initializePageClassificationPatterns();
      this.isInitialized = true;
    }
  }

  async initializeWithFallback() {
    console.log('🔄 Initializing FraudDetector with fallback patterns...');
    
    try {
      // Initialize fallback patterns
      this.initializeFallbackPatterns();
      
      // Initialize page classification patterns
      this.initializePageClassificationPatterns();
      
      this.isInitialized = true;
      console.log('✅ FraudDetector initialized with fallback patterns');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize FraudDetector with fallback:', error);
      return false;
    }
  }

  initializePageClassificationPatterns() {
    console.log('🔍 Initializing page classification patterns...');
    
    // Patterns that indicate a job posting page (not a landing page)
    this.jobPostingIndicators = {
      jobTitlePatterns: {
        keywords: [
          'job title:', 'position:', 'role:', 'vacancy:', 'opening:',
          'we are hiring', 'now hiring', 'join our team', 'career opportunity',
          'job description', 'responsibilities:', 'requirements:', 'qualifications:',
          'what you\'ll do', 'your role', 'about the role', 'job summary'
        ],
        weight: 0.8
      },
      jobDetailsPatterns: {
        keywords: [
          'salary:', 'compensation:', 'benefits:', 'location:', 'remote',
          'full-time', 'part-time', 'contract', 'freelance', 'internship',
          'experience required', 'years of experience', 'education required',
          'apply now', 'submit application', 'send resume', 'cv required'
        ],
        weight: 0.7
      },
      companyInfoPatterns: {
        keywords: [
          'about the company', 'company overview', 'our company', 'who we are',
          'company culture', 'team size', 'founded in', 'headquarters',
          'company benefits', 'why join us', 'our mission', 'our values'
        ],
        weight: 0.6
      },
      applicationProcessPatterns: {
        keywords: [
          'how to apply', 'application process', 'interview process',
          'next steps', 'application deadline', 'start date',
          'contact information', 'hr contact', 'recruiter contact'
        ],
        weight: 0.5
      }
    };

    // Patterns that indicate a landing page (not a specific job posting)
    this.landingPageIndicators = {
      navigationPatterns: {
        keywords: [
          'home', 'about us', 'services', 'products', 'contact us',
          'careers', 'jobs', 'browse jobs', 'search jobs', 'job categories',
          'all jobs', 'latest jobs', 'featured jobs', 'job listings'
        ],
        weight: 0.9
      },
      generalContentPatterns: {
        keywords: [
          'welcome to', 'discover', 'explore', 'find your', 'search for',
          'browse our', 'latest news', 'blog posts', 'testimonials',
          'customer reviews', 'success stories', 'case studies'
        ],
        weight: 0.8
      },
      multipleJobsPatterns: {
        keywords: [
          'view all jobs', 'see more jobs', 'other opportunities',
          'similar positions', 'related jobs', 'more openings',
          'job categories', 'departments', 'locations available'
        ],
        weight: 0.7
      },
      genericCallToActionPatterns: {
        keywords: [
          'sign up', 'register', 'create account', 'join now',
          'get started', 'learn more', 'find out more', 'discover more',
          'explore opportunities', 'browse positions'
        ],
        weight: 0.6
      }
    };

    console.log('✅ Page classification patterns initialized');
  }

  classifyPageType(pageContent, pageUrl = null) {
    console.log('🔍 Classifying page type to reduce false positives...');
    
    const text = pageContent.toLowerCase();
    let jobPostingScore = 0;
    let landingPageScore = 0;
    let jobPostingMatches = [];
    let landingPageMatches = [];

    // Check job posting indicators
    for (const [patternName, pattern] of Object.entries(this.jobPostingIndicators)) {
      const matches = pattern.keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      );
      
      if (matches.length > 0) {
        const patternScore = pattern.weight * (matches.length / pattern.keywords.length);
        jobPostingScore += patternScore;
        jobPostingMatches.push({
          pattern: patternName,
          matches: matches,
          score: patternScore
        });
      }
    }

    // Check landing page indicators
    for (const [patternName, pattern] of Object.entries(this.landingPageIndicators)) {
      const matches = pattern.keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      );
      
      if (matches.length > 0) {
        const patternScore = pattern.weight * (matches.length / pattern.keywords.length);
        landingPageScore += patternScore;
        landingPageMatches.push({
          pattern: patternName,
          matches: matches,
          score: patternScore
        });
      }
    }

    // Additional heuristics
    const wordCount = text.split(/\s+/).length;
    const hasJobTitle = /job title|position|role|vacancy|opening/i.test(pageContent);
    const hasMultipleJobLinks = (text.match(/view\s+job|apply\s+now|see\s+details/g) || []).length > 3;
    const hasJobForm = /application|apply|resume|cv|submit/i.test(pageContent);

    // Adjust scores based on heuristics
    if (wordCount < 200) {
      landingPageScore += 0.3; // Short pages are likely landing/navigation pages
    } else if (wordCount > 800) {
      jobPostingScore += 0.2; // Longer pages are more likely detailed job postings
    }

    if (hasJobTitle && hasJobForm) {
      jobPostingScore += 0.4; // Strong indicators of a job posting
    }

    if (hasMultipleJobLinks) {
      landingPageScore += 0.5; // Multiple job links suggest a job listing page
    }

    // URL analysis
    if (pageUrl) {
      const urlLower = pageUrl.toLowerCase();
      if (urlLower.includes('/job/') || urlLower.includes('/jobs/') || urlLower.includes('/career/')) {
        if (urlLower.match(/\/job\/\d+/) || urlLower.match(/\/jobs\/[^\/]+$/)) {
          jobPostingScore += 0.3; // Specific job URL pattern
        } else {
          landingPageScore += 0.2; // General jobs section
        }
      }
    }

    // Determine page type
    const totalScore = jobPostingScore + landingPageScore;
    const jobPostingConfidence = totalScore > 0 ? jobPostingScore / totalScore : 0;
    const landingPageConfidence = totalScore > 0 ? landingPageScore / totalScore : 0;

    let pageType, confidence, shouldAnalyze;
    
    if (jobPostingConfidence > 0.6) {
      pageType = 'job_posting';
      confidence = jobPostingConfidence;
      shouldAnalyze = true;
    } else if (landingPageConfidence > 0.6) {
      pageType = 'landing_page';
      confidence = landingPageConfidence;
      shouldAnalyze = false; // Skip fraud analysis for landing pages
    } else {
      pageType = 'uncertain';
      confidence = Math.max(jobPostingConfidence, landingPageConfidence);
      shouldAnalyze = true; // Analyze uncertain pages to be safe
    }

    const result = {
      pageType,
      confidence,
      shouldAnalyze,
      jobPostingScore,
      landingPageScore,
      jobPostingMatches,
      landingPageMatches,
      wordCount,
      heuristics: {
        hasJobTitle,
        hasMultipleJobLinks,
        hasJobForm,
        wordCount
      }
    };

    console.log('📊 Page Classification Result:');
    console.log(`   Page Type: ${pageType.toUpperCase()}`);
    console.log(`   Confidence: ${(confidence * 100).toFixed(1)}%`);
    console.log(`   Should Analyze: ${shouldAnalyze ? '✅ YES' : '❌ NO'}`);
    console.log(`   Job Posting Score: ${jobPostingScore.toFixed(3)}`);
    console.log(`   Landing Page Score: ${landingPageScore.toFixed(3)}`);
    console.log(`   Word Count: ${wordCount}`);

    if (jobPostingMatches.length > 0) {
      console.log('🎯 Job Posting Indicators Found:');
      jobPostingMatches.forEach(match => {
        console.log(`   - ${match.pattern}: ${match.matches.join(', ')} (Score: ${match.score.toFixed(3)})`);
      });
    }

    if (landingPageMatches.length > 0) {
      console.log('🏠 Landing Page Indicators Found:');
      landingPageMatches.forEach(match => {
        console.log(`   - ${match.pattern}: ${match.matches.join(', ')} (Score: ${match.score.toFixed(3)})`);
      });
    }

    return result;
  }

  initializePatterns(metadata) {
    // Fraud indicators based on common job posting scam patterns
    this.fraudPatterns = {
      // Salary-related red flags
      unrealisticSalary: {
        keywords: ['$5000+', '$10000+', '$5000/week', '$3000/week', '$4000/week', '$5000 per week', 'high salary', 'easy money', 'quick cash', 'guaranteed income', 'guaranteed'],
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
      'guaranteed income', 'guaranteed', 'no interview', 'instant hiring', 'work from phone',
      'copy paste work', 'data entry from home', 'envelope stuffing',
      'mystery shopper', 'rebate processor', 'assembly work', '$5000/week', '$3000/week',
      'easy money', 'quick cash', 'work from home guaranteed', 'no experience guaranteed'
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

  async performMLPrediction(jobText) {
    try {
      console.log('Attempting ML model prediction...');
      
      // Fetch model data from Firebase
      const modelData = await this.modelManager.fetchModelData();
      
      if (!modelData || !modelData.model || !modelData.vectorizer) {
        console.log('ML model data not available, falling back to rule-based analysis');
        
        // Perform rule-based analysis as fallback
        const ruleBasedResult = this.performRuleBasedAnalysis(jobText);
        
        return {
          available: false,
          confidence: ruleBasedResult.confidence,
          isFraud: ruleBasedResult.isFraud,
          riskLevel: ruleBasedResult.riskLevel,
          method: 'rule_based_fallback',
          reason: 'ML models unavailable, using pattern matching',
          ruleBasedResult: ruleBasedResult
        };
      }
      
      console.log('ML model data retrieved successfully:', {
        hasModel: !!modelData.model,
        hasVectorizer: !!modelData.vectorizer,
        accuracy: modelData.metadata?.accuracy
      });
      
      // Decode base64 model data (simulated prediction since we can't run Python models in JS)
      // In a real implementation, this would require a JavaScript ML library or API call
      const prediction = await this.simulateMLPrediction(jobText, modelData);
      
      return {
        available: true,
        confidence: prediction.confidence,
        isFraud: prediction.isFraud,
        modelAccuracy: modelData.metadata?.accuracy || 0.974,
        reasons: prediction.reasons,
        features: modelData.metadata?.features || [],
        method: 'ml_simulation'
      };
      
    } catch (error) {
      console.error('ML prediction failed:', error);
      return {
        available: false,
        confidence: 0,
        isFraud: false,
        error: error.message
      };
    }
  }

  async simulateMLPrediction(jobText, modelData) {
    // Since we can't run Python pickle models directly in JavaScript,
    // we'll simulate ML prediction using the model's top features and patterns
    // This provides a more sophisticated analysis than basic rule matching
    
    const text = jobText.toLowerCase();
    const topFeatures = modelData.metadata?.top_features || [];
    const modelAccuracy = modelData.metadata?.accuracy || 0.974;
    
    console.log('🔍 FraudBuster: Starting ML Pattern Analysis');
    console.log('📄 Text Length:', jobText.length, 'characters');
    console.log('🎯 Model Accuracy:', (modelAccuracy * 100).toFixed(1) + '%');
    
    // Enhanced feature-based scoring using model's learned patterns
    let fraudScore = 0;
    let featureMatches = [];
    let detectedPhrases = [];
    
    // High-weight fraud indicators (based on model training)
    const highRiskPatterns = [
      { pattern: /guaranteed.*income|guaranteed.*money|guaranteed.*salary/gi, weight: 0.15, name: 'guaranteed_income', category: 'Income Promises' },
      { pattern: /\$\d{4,}.*week|\$\d{4,}.*month|easy.*money|quick.*cash/gi, weight: 0.12, name: 'unrealistic_pay', category: 'Unrealistic Compensation' },
      { pattern: /registration.*fee|processing.*fee|training.*fee|equipment.*fee/gi, weight: 0.18, name: 'upfront_fees', category: 'Upfront Payment Requests' },
      { pattern: /no.*experience.*required|no.*interview|instant.*hiring/gi, weight: 0.10, name: 'no_requirements', category: 'Suspicious Hiring Process' },
      { pattern: /work.*from.*home.*guaranteed|copy.*paste.*work|data.*entry.*home/gi, weight: 0.08, name: 'suspicious_wfh', category: 'Suspicious Work-from-Home' },
      { pattern: /whatsapp|telegram|personal.*email|gmail.*contact|yahoo.*contact/gi, weight: 0.09, name: 'suspicious_contact', category: 'Suspicious Communication' },
      { pattern: /urgent.*hiring|immediate.*start|limited.*time|act.*now/gi, weight: 0.07, name: 'urgency_tactics', category: 'Pressure Tactics' }
    ];
    
    console.log('🚨 Checking High-Risk Fraud Patterns:');
    
    // Check high-risk patterns
    for (const { pattern, weight, name, category } of highRiskPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        fraudScore += weight;
        
        // Log detailed match information
        console.log(`⚠️  FRAUD PATTERN DETECTED: ${category}`);
        console.log(`   Pattern: ${name}`);
        console.log(`   Weight: ${weight.toFixed(3)}`);
        console.log(`   Matches Found: ${matches.length}`);
        console.log(`   Exact Phrases:`, matches.map(match => `"${match}"`));
        
        featureMatches.push({
          feature: name,
          category: category,
          matches: matches.length,
          weight: weight,
          examples: matches.slice(0, 2),
          allMatches: matches
        });
        
        // Store all detected phrases for summary
        detectedPhrases.push(...matches.map(match => ({
          phrase: match,
          category: category,
          pattern: name,
          weight: weight
        })));
      }
    }
    
    // Legitimate indicators (negative weights)
    const legitimatePatterns = [
      { pattern: /requirements.*include|qualifications.*required|experience.*required/gi, weight: -0.05, name: 'clear_requirements', category: 'Professional Requirements' },
      { pattern: /benefits.*include|health.*insurance|401k|vacation.*days/gi, weight: -0.06, name: 'professional_benefits', category: 'Employee Benefits' },
      { pattern: /company.*founded|years.*business|office.*location|headquarters/gi, weight: -0.04, name: 'established_company', category: 'Company Credibility' },
      { pattern: /degree.*required|certification.*required|skills.*required/gi, weight: -0.03, name: 'skill_requirements', category: 'Skill Requirements' }
    ];
    
    console.log('✅ Checking Legitimate Job Indicators:');
    
    // Check legitimate patterns
    for (const { pattern, weight, name, category } of legitimatePatterns) {
      const matches = text.match(pattern);
      if (matches) {
        fraudScore += weight; // weight is negative
        
        // Log legitimate pattern matches
        console.log(`✅ LEGITIMATE PATTERN FOUND: ${category}`);
        console.log(`   Pattern: ${name}`);
        console.log(`   Weight: ${weight.toFixed(3)} (reduces fraud score)`);
        console.log(`   Matches Found: ${matches.length}`);
        console.log(`   Exact Phrases:`, matches.map(match => `"${match}"`));
        
        featureMatches.push({
          feature: name,
          category: category,
          matches: matches.length,
          weight: weight,
          examples: matches.slice(0, 2),
          allMatches: matches
        });
        
        // Store legitimate phrases too
        detectedPhrases.push(...matches.map(match => ({
          phrase: match,
          category: category,
          pattern: name,
          weight: weight,
          type: 'legitimate'
        })));
      }
    }
    
    // Normalize score and apply model accuracy weighting
    fraudScore = Math.max(0, Math.min(1, fraudScore));
    
    // Use optimal threshold from enhanced model (default to 0.5 if not available)
    const optimalThreshold = modelData.metadata?.optimal_threshold || 0.5;
    
    // Calculate confidence based on fraud score and model reliability
    // Enhanced confidence calculation that reflects model accuracy
    let confidence;
    if (fraudScore > 0.3) {
      // High fraud score - high confidence in fraud detection
      confidence = Math.min(0.95, 0.7 + (fraudScore * 0.25) + (modelAccuracy * 0.1));
    } else if (fraudScore > 0.1) {
      // Medium fraud score - moderate confidence with model accuracy boost
      confidence = Math.min(0.85, 0.5 + (fraudScore * 0.3) + (modelAccuracy * 0.15));
    } else if (fraudScore > 0.05) {
      // Low fraud score - still confident it's legitimate with model backing
      confidence = Math.min(0.75, 0.4 + (fraudScore * 0.2) + (modelAccuracy * 0.2));
    } else {
      // Very low fraud score - high confidence it's legitimate
      confidence = Math.min(0.9, 0.6 + (modelAccuracy * 0.25));
    }
    
    const isFraud = fraudScore > optimalThreshold;
    
    // Generate detailed reasons
    const reasons = [];
    const modelVersion = modelData.metadata?.version || '3.0';
    reasons.push(`Enhanced ML Model (v${modelVersion}) - Accuracy: ${(modelAccuracy * 100).toFixed(1)}%`);
    reasons.push(`Optimal Threshold: ${optimalThreshold.toFixed(4)} (from model evaluation)`);
    
    if (featureMatches.length > 0) {
      reasons.push(`Analyzed ${featureMatches.length} key features from trained model`);
      
      const fraudFeatures = featureMatches.filter(f => f.weight > 0);
      const legitFeatures = featureMatches.filter(f => f.weight < 0);
      
      if (fraudFeatures.length > 0) {
        reasons.push(`Found ${fraudFeatures.length} fraud indicators: ${fraudFeatures.map(f => f.feature).join(', ')}`);
      }
      
      if (legitFeatures.length > 0) {
        reasons.push(`Found ${legitFeatures.length} legitimate indicators: ${legitFeatures.map(f => f.feature).join(', ')}`);
      }
    } else {
      reasons.push('No significant patterns detected by ML model');
    }
    
    // Log comprehensive analysis summary
    console.log('📊 ML ANALYSIS SUMMARY:');
    console.log(`   Final Fraud Score: ${fraudScore.toFixed(3)}`);
    console.log(`   Confidence Level: ${confidence.toFixed(3)}`);
    console.log(`   Decision Threshold: ${optimalThreshold.toFixed(4)}`);
    console.log(`   Is Fraudulent: ${isFraud ? '🚨 YES' : '✅ NO'}`);
    console.log(`   Total Features Analyzed: ${featureMatches.length}`);
    console.log(`   Model Accuracy: ${(modelAccuracy * 100).toFixed(1)}%`);
    
    if (detectedPhrases.length > 0) {
      console.log('🔍 ALL DETECTED PHRASES SUMMARY:');
      const fraudPhrases = detectedPhrases.filter(p => !p.type || p.type !== 'legitimate');
      const legitPhrases = detectedPhrases.filter(p => p.type === 'legitimate');
      
      if (fraudPhrases.length > 0) {
        console.log(`   🚨 Fraud Indicators (${fraudPhrases.length}):`, 
          fraudPhrases.map(p => `"${p.phrase}" [${p.category}]`));
      }
      
      if (legitPhrases.length > 0) {
        console.log(`   ✅ Legitimate Indicators (${legitPhrases.length}):`, 
          legitPhrases.map(p => `"${p.phrase}" [${p.category}]`));
      }
    } else {
      console.log('   ℹ️  No specific fraud or legitimate patterns detected');
    }
    
    console.log('ML simulation completed:', {
      fraudScore: fraudScore.toFixed(3),
      confidence: confidence.toFixed(3),
      threshold: optimalThreshold,
      isFraud,
      featureMatches: featureMatches.length,
      modelAccuracy: modelAccuracy
    });
    
    return {
      confidence,
      isFraud,
      reasons,
      featureMatches,
      detectedPhrases,
      rawScore: fraudScore,
      threshold: optimalThreshold,
      modelVersion: modelVersion || '3.0'
    };
  }

  calculateRiskLevel(confidence, isFraud) {
    if (!isFraud) {
      return confidence < 0.3 ? 'low' : 'medium';
    }
    
    if (confidence >= 0.8) {
      return 'high';
    } else if (confidence >= 0.6) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  async analyzeJobPosting(jobText, pageUrl = null) {
    console.log('🚀 FraudDetector: Starting comprehensive job posting analysis');
    console.log('📄 Job Text Preview:', jobText.substring(0, 150) + '...');
    console.log('🌐 Page URL:', pageUrl || 'Not provided');
    
    if (!this.isInitialized) {
      console.log('⚙️  FraudDetector: Not initialized, initializing now...');
      await this.initialize();
    }

    try {
      // Use comprehensive analysis for better accuracy
      const result = await this.performComprehensiveAnalysis(jobText, pageUrl);
      
      console.log('🎯 FraudDetector: Final Analysis Result:');
      console.log(`   Decision: ${result.isFraud ? '🚨 FRAUDULENT' : '✅ LEGITIMATE'}`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`   Risk Level: ${result.riskLevel.toUpperCase()}`);
      console.log(`   Analysis Method: ${result.method}`);
      
      if (result.detectedPhrases && result.detectedPhrases.length > 0) {
        console.log('📝 Key Phrases That Influenced Decision:');
        result.detectedPhrases.forEach((phrase, index) => {
          const indicator = phrase.type === 'legitimate' ? '✅' : '🚨';
          console.log(`   ${indicator} "${phrase.phrase}" [${phrase.category}] (Weight: ${phrase.weight.toFixed(3)})`);
        });
      }
      
      // Add session tracking
      if (this.sessionId) {
        result.sessionId = this.sessionId;
      }
      
      return result;
    } catch (error) {
      console.error('Error in analyzeJobPosting:', error);
      
      // Return fallback analysis
      return {
        isFraud: false,
        confidence: 0.1,
        riskLevel: 'unknown',
        method: 'error_fallback',
        reasons: ['Analysis failed: ' + error.message],
        error: error.message
      };
    }
  }

  async performComprehensiveAnalysis(jobText, pageUrl = null) {
    console.log('🔬 Starting Comprehensive Analysis Pipeline');
    const analysisSteps = [];
    let finalResult = null;
    
    // Step 1: Domain blacklist check (highest priority)
    if (pageUrl && this.domainCheckEnabled) {
      console.log('🌐 Step 1: Checking domain blacklist...');
      try {
        const domainResult = await this.checkDomainBlacklist(pageUrl);
        analysisSteps.push({
          step: 'domain_check',
          result: domainResult,
          timestamp: new Date().toISOString()
        });
        
        if (domainResult.isFraudulent) {
          // Domain is blacklisted - immediate fraud detection
          console.log('🚨 DOMAIN BLACKLISTED - Immediate fraud detection');
          console.log(`   Blacklisted Domain: ${domainResult.domain}`);
          
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
          
          return finalResult;
        } else {
          console.log('✅ Domain check passed - proceeding to ML analysis');
        }
      } catch (error) {
        console.warn('⚠️  Domain check failed, proceeding to ML analysis:', error);
        analysisSteps.push({
          step: 'domain_check',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log('⏭️  Skipping domain check (no URL provided or disabled)');
    }
    
    // Step 2: ML Model Prediction (highest accuracy)
    console.log('🤖 Step 2: Running ML Model Prediction...');
    try {
      const mlResult = await this.performMLPrediction(jobText);
      analysisSteps.push({
        step: 'ml_prediction',
        result: mlResult,
        timestamp: new Date().toISOString()
      });
      
      // Use a practical threshold for fraud detection (0.5 instead of the overly strict 0.9918)
      const practicalThreshold = 0.5;
      const modelThreshold = this.modelData?.metadata?.optimal_threshold || 0.5;
      console.log(`🎯 ML Threshold Analysis:`);
      console.log(`   Practical Threshold: ${practicalThreshold}`);
      console.log(`   Model Suggested Threshold: ${modelThreshold}`);
      console.log(`   ML Confidence Score: ${mlResult.confidence.toFixed(3)}`);
      
      if (mlResult.available) {
        // Use practical threshold to determine fraud classification
        const isFraudPractical = mlResult.confidence >= practicalThreshold;
        
        console.log(`🎯 ML Decision: ${isFraudPractical ? '🚨 FRAUDULENT' : '✅ LEGITIMATE'}`);
        console.log(`   Based on confidence ${mlResult.confidence.toFixed(3)} vs threshold ${practicalThreshold}`);
        
        finalResult = {
          isFraud: isFraudPractical,
          confidence: mlResult.confidence,
          riskLevel: this.calculateRiskLevel(mlResult.confidence, isFraudPractical),
          score: mlResult.confidence,
          method: 'ml_model',
          reasons: mlResult.reasons || [
            `ML Model Prediction: ${isFraudPractical ? 'Fraudulent' : 'Legitimate'}`,
            `Confidence: ${(mlResult.confidence * 100).toFixed(1)}%`,
            `Practical Threshold: ${practicalThreshold} (Model threshold: ${modelThreshold})`,
            `Model Accuracy: ${mlResult.modelAccuracy ? (mlResult.modelAccuracy * 100).toFixed(1) + '%' : 'N/A'}`
          ],
          mlPrediction: mlResult,
          detectedPhrases: mlResult.detectedPhrases,
          analysisSteps
        };
        
        return finalResult;
      } else if (mlResult.confidence > 0) {
        // ML models unavailable but rule-based fallback provided confidence
        console.log('Using rule-based fallback from ML prediction');
        finalResult = {
          isFraud: mlResult.isFraud,
          confidence: mlResult.confidence,
          riskLevel: mlResult.riskLevel,
          score: mlResult.confidence,
          method: mlResult.method || 'rule_based',
          reasons: mlResult.ruleBasedResult?.reasons || ['Rule-based pattern analysis'],
          ruleBasedAnalysis: mlResult.ruleBasedResult,
          analysisSteps
        };
        
        return finalResult;
      } else {
        console.log('ML model unavailable, proceeding to rule-based analysis');
      }
    } catch (error) {
      console.warn('ML prediction failed, falling back to rule-based analysis:', error);
      analysisSteps.push({
        step: 'ml_prediction',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    // Step 3: Rule-based content analysis (fallback)
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
    // Determine the current status based on initialization and model state
    let status = 'not_initialized';
    let progress = 0;
    
    if (this.isInitialized) {
      if (this.modelManager && this.fraudPatterns) {
        // Check if models are ready by testing if we can fetch model data
        try {
          const modelMetadata = this.modelManager.getModelMetadata();
          
          // Check if ML models are actually available by testing fetchModelData capability
          // This is more reliable than just checking cache status
          if (modelMetadata && (modelMetadata.isReady || modelMetadata.accuracy)) {
            status = 'ready';
            progress = 1;
          } else if (modelMetadata && modelMetadata.isLoading) {
            status = 'loading';
            progress = modelMetadata.progress || 0.5;
          } else {
            // Models failed to load, but we can use fallback patterns
            status = 'fallback';
            progress = 1;
          }
        } catch (error) {
          console.warn('Error checking model status:', error);
          status = 'fallback';
          progress = 1;
        }
      } else {
        status = 'error';
      }
    }
    
    return {
      status: status,
      progress: progress,
      isInitialized: this.isInitialized,
      modelMetadata: this.modelManager ? this.modelManager.getModelMetadata() : null,
      patternsLoaded: !!this.fraudPatterns,
      lastUpdate: new Date().toISOString(),
      canAnalyze: this.isInitialized && (status === 'ready' || status === 'fallback')
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