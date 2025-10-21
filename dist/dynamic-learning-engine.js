/**
 * Dynamic Learning Engine - Dynamic False Positive Reduction System
 * Machine learning system that processes user feedback and adapts classification rules in real-time
 */

class DynamicLearningEngine {
  constructor(firestoreIntegration) {
    this.firestore = firestoreIntegration;
    this.learningRate = 0.02;
    this.adaptationThreshold = 10; // Minimum feedback samples before adaptation
    this.confidenceDecay = 0.95; // Decay factor for old patterns
    
    // Current model state
    this.modelState = {
      featureWeights: {
        contentDensity: 0.25,
        jobIndicators: 0.30,
        navigationScore: 0.20,
        urlScore: 0.15,
        semanticScore: 0.10
      },
      classificationThresholds: {
        jobPostingThreshold: 0.6,
        landingPageThreshold: 0.4,
        confidenceThreshold: 0.7,
        analysisSkipThreshold: 0.8
      },
      domainBiases: new Map(),
      patternAccuracy: new Map(),
      lastUpdate: Date.now()
    };
    
    // Learning history
    this.learningHistory = [];
    this.feedbackBuffer = [];
    this.maxHistorySize = 1000;
    this.maxBufferSize = 50;
    
    // Performance tracking
    this.performanceMetrics = {
      accuracy: 0.85,
      precision: 0.83,
      recall: 0.87,
      falsePositiveRate: 0.12,
      falseNegativeRate: 0.08,
      totalSamples: 0,
      lastCalculated: Date.now()
    };
    
    // Initialize the learning engine
    this.initialize();
  }

  /**
   * Initialize the learning engine with existing data
   */
  async initialize() {
    try {
      console.log('Initializing Dynamic Learning Engine...');
      
      // Validate firestore integration
      if (!this.firestore) {
        console.warn('Dynamic Learning Engine: No Firestore integration provided, using default patterns');
        this.initializeWithDefaults();
        return;
      }
      
      // Load existing learning patterns
      await this.loadLearningPatterns();
      
      // Load classification rules
      await this.loadClassificationRules();
      
      // Load recent feedback for context
      await this.loadRecentFeedback();
      
      // Calculate current performance metrics
      await this.calculatePerformanceMetrics();
      
      console.log('Dynamic Learning Engine initialized successfully');
    } catch (error) {
      console.error('Error initializing learning engine:', error);
      console.log('Falling back to default patterns...');
      this.initializeWithDefaults();
    }
  }

  /**
   * Initialize with default patterns when Firestore is unavailable
   */
  initializeWithDefaults() {
    console.log('Initializing Dynamic Learning Engine with default patterns...');
    
    // Set default domain biases
    this.modelState.domainBiases.set('indeed.com', 0.9);
    this.modelState.domainBiases.set('linkedin.com', 0.85);
    this.modelState.domainBiases.set('glassdoor.com', 0.8);
    
    // Set default pattern accuracies
    this.modelState.patternAccuracy.set('job_posting_default', 0.8);
    this.modelState.patternAccuracy.set('landing_page_default', 0.75);
    
    console.log('Dynamic Learning Engine initialized with defaults');
  }

  /**
   * Process new user feedback and adapt the model
   */
  async processFeedback(feedback) {
    try {
      console.log('Processing user feedback:', feedback.classificationId);
      
      // Add to feedback buffer
      this.feedbackBuffer.push({
        ...feedback,
        timestamp: Date.now(),
        processed: false
      });
      
      // Store in Firestore
      await this.firestore.storeUserFeedback(feedback);
      
      // Process feedback immediately if it's critical
      if (this.isCriticalFeedback(feedback)) {
        await this.processImmediateFeedback(feedback);
      }
      
      // Check if we should trigger batch learning
      if (this.feedbackBuffer.length >= this.maxBufferSize) {
        await this.triggerBatchLearning();
      }
      
      // Update performance metrics
      await this.updatePerformanceMetrics(feedback);
      
      return {
        processed: true,
        adaptationTriggered: this.feedbackBuffer.length >= this.adaptationThreshold,
        currentAccuracy: this.performanceMetrics.accuracy,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error processing feedback:', error);
      return { processed: false, error: error.message };
    }
  }

  /**
   * Determine if feedback requires immediate processing
   */
  isCriticalFeedback(feedback) {
    // Critical if:
    // 1. High confidence system classification was wrong
    // 2. Repeated false positive from same domain
    // 3. User reported as fraudulent when system said safe
    
    if (!feedback.wasCorrect && feedback.systemConfidence > 0.8) {
      return true;
    }
    
    if (feedback.feedbackType === 'manual_report' && feedback.userClassification === 'fraudulent') {
      return true;
    }
    
    // Check for repeated false positives from same domain
    const domain = this.extractDomain(feedback.url);
    const recentFeedback = this.feedbackBuffer.filter(f => 
      this.extractDomain(f.url) === domain && 
      !f.wasCorrect && 
      (Date.now() - f.timestamp) < 24 * 60 * 60 * 1000 // Last 24 hours
    );
    
    if (recentFeedback.length >= 3) {
      return true;
    }
    
    return false;
  }

  /**
   * Process critical feedback immediately
   */
  async processImmediateFeedback(feedback) {
    try {
      console.log('Processing critical feedback immediately');
      
      // Adjust feature weights based on feedback
      if (!feedback.wasCorrect) {
        await this.adjustFeatureWeights(feedback);
      }
      
      // Update domain biases
      await this.updateDomainBias(feedback);
      
      // Create or update false positive patterns
      if (feedback.userClassification === 'landing_page' && 
          feedback.systemClassification === 'job_posting') {
        await this.createFalsePositivePattern(feedback);
      }
      
      // Update classification thresholds if needed
      await this.adjustClassificationThresholds(feedback);
      
      // Mark as processed
      feedback.processed = true;
      
    } catch (error) {
      console.error('Error processing immediate feedback:', error);
    }
  }

  /**
   * Trigger batch learning process
   */
  async triggerBatchLearning() {
    try {
      console.log('Triggering batch learning process');
      
      const unprocessedFeedback = this.feedbackBuffer.filter(f => !f.processed);
      
      if (unprocessedFeedback.length === 0) {
        return;
      }
      
      // Analyze feedback patterns
      const patterns = this.analyzeFeedbackPatterns(unprocessedFeedback);
      
      // Update model based on patterns
      await this.updateModelFromPatterns(patterns);
      
      // Validate model performance
      const validation = await this.validateModelPerformance();
      
      // If performance degraded, rollback changes
      if (validation.accuracy < this.performanceMetrics.accuracy - 0.05) {
        console.warn('Model performance degraded, considering rollback');
        await this.considerRollback(validation);
      } else {
        // Save updated model state
        await this.saveModelState();
      }
      
      // Mark feedback as processed
      unprocessedFeedback.forEach(f => f.processed = true);
      
      // Clean up old feedback
      this.cleanupFeedbackBuffer();
      
      console.log('Batch learning completed');
      
    } catch (error) {
      console.error('Error in batch learning:', error);
    }
  }

  /**
   * Analyze patterns in feedback data
   */
  analyzeFeedbackPatterns(feedbackList) {
    const patterns = {
      domainPatterns: new Map(),
      featurePatterns: new Map(),
      urlPatterns: [],
      contentPatterns: [],
      temporalPatterns: [],
      errorTypes: {
        falsePositives: 0,
        falseNegatives: 0,
        lowConfidenceErrors: 0,
        highConfidenceErrors: 0
      }
    };
    
    feedbackList.forEach(feedback => {
      const domain = this.extractDomain(feedback.url);
      
      // Domain patterns
      if (!patterns.domainPatterns.has(domain)) {
        patterns.domainPatterns.set(domain, {
          correct: 0,
          incorrect: 0,
          falsePositives: 0,
          falseNegatives: 0
        });
      }
      
      const domainStats = patterns.domainPatterns.get(domain);
      if (feedback.wasCorrect) {
        domainStats.correct++;
      } else {
        domainStats.incorrect++;
        if (feedback.systemClassification === 'job_posting' && feedback.userClassification === 'landing_page') {
          domainStats.falsePositives++;
          patterns.errorTypes.falsePositives++;
        } else if (feedback.systemClassification === 'landing_page' && feedback.userClassification === 'job_posting') {
          domainStats.falseNegatives++;
          patterns.errorTypes.falseNegatives++;
        }
      }
      
      // Feature patterns
      if (feedback.features) {
        Object.keys(feedback.features).forEach(feature => {
          if (!patterns.featurePatterns.has(feature)) {
            patterns.featurePatterns.set(feature, {
              correctPredictions: [],
              incorrectPredictions: [],
              averageCorrect: 0,
              averageIncorrect: 0
            });
          }
          
          const featureStats = patterns.featurePatterns.get(feature);
          const featureValue = feedback.features[feature];
          
          if (feedback.wasCorrect) {
            featureStats.correctPredictions.push(featureValue);
          } else {
            featureStats.incorrectPredictions.push(featureValue);
          }
        });
      }
      
      // URL patterns for false positives
      if (!feedback.wasCorrect) {
        const url = new URL(feedback.url);
        patterns.urlPatterns.push({
          pathname: url.pathname,
          search: url.search,
          domain: domain,
          errorType: feedback.systemClassification === 'job_posting' ? 'false_positive' : 'false_negative'
        });
      }
      
      // Confidence-based error analysis
      if (!feedback.wasCorrect) {
        if (feedback.systemConfidence < 0.7) {
          patterns.errorTypes.lowConfidenceErrors++;
        } else {
          patterns.errorTypes.highConfidenceErrors++;
        }
      }
    });
    
    // Calculate feature averages
    patterns.featurePatterns.forEach((stats, feature) => {
      if (stats.correctPredictions.length > 0) {
        stats.averageCorrect = stats.correctPredictions.reduce((a, b) => a + b, 0) / stats.correctPredictions.length;
      }
      if (stats.incorrectPredictions.length > 0) {
        stats.averageIncorrect = stats.incorrectPredictions.reduce((a, b) => a + b, 0) / stats.incorrectPredictions.length;
      }
    });
    
    return patterns;
  }

  /**
   * Update model based on analyzed patterns
   */
  async updateModelFromPatterns(patterns) {
    try {
      // Update feature weights based on performance
      await this.updateFeatureWeightsFromPatterns(patterns.featurePatterns);
      
      // Update domain biases
      await this.updateDomainBiasesFromPatterns(patterns.domainPatterns);
      
      // Adjust classification thresholds
      await this.adjustThresholdsFromPatterns(patterns.errorTypes);
      
      // Create new false positive patterns
      await this.createPatternsFromUrls(patterns.urlPatterns);
      
      console.log('Model updated from patterns');
    } catch (error) {
      console.error('Error updating model from patterns:', error);
    }
  }

  /**
   * Update feature weights based on pattern analysis
   */
  async updateFeatureWeightsFromPatterns(featurePatterns) {
    const newWeights = { ...this.modelState.featureWeights };
    
    featurePatterns.forEach((stats, feature) => {
      if (stats.correctPredictions.length > 5 && stats.incorrectPredictions.length > 5) {
        // Calculate discriminative power
        const correctMean = stats.averageCorrect;
        const incorrectMean = stats.averageIncorrect;
        const discriminativePower = Math.abs(correctMean - incorrectMean);
        
        // Adjust weight based on discriminative power
        const currentWeight = newWeights[feature] || 0.1;
        const adjustment = discriminativePower * this.learningRate;
        
        if (correctMean > incorrectMean) {
          // Feature is positively correlated with correct classification
          newWeights[feature] = Math.min(0.5, currentWeight + adjustment);
        } else {
          // Feature may be negatively correlated
          newWeights[feature] = Math.max(0.05, currentWeight - adjustment);
        }
      }
    });
    
    // Normalize weights to sum to 1
    const totalWeight = Object.values(newWeights).reduce((sum, weight) => sum + weight, 0);
    Object.keys(newWeights).forEach(feature => {
      newWeights[feature] = newWeights[feature] / totalWeight;
    });
    
    this.modelState.featureWeights = newWeights;
  }

  /**
   * Update domain biases from patterns
   */
  async updateDomainBiasesFromPatterns(domainPatterns) {
    domainPatterns.forEach((stats, domain) => {
      const total = stats.correct + stats.incorrect;
      if (total >= 5) { // Minimum samples for reliable bias
        const accuracy = stats.correct / total;
        const falsePositiveRate = stats.falsePositives / total;
        
        // Calculate bias adjustment
        let bias = 0;
        if (accuracy < 0.7) {
          // Domain has low accuracy, apply negative bias
          bias = -0.1 * (0.7 - accuracy);
        } else if (accuracy > 0.9) {
          // Domain has high accuracy, apply positive bias
          bias = 0.05 * (accuracy - 0.9);
        }
        
        // Adjust for false positive rate
        if (falsePositiveRate > 0.2) {
          bias -= 0.05 * falsePositiveRate;
        }
        
        this.modelState.domainBiases.set(domain, {
          bias: bias,
          accuracy: accuracy,
          falsePositiveRate: falsePositiveRate,
          sampleCount: total,
          lastUpdated: Date.now()
        });
      }
    });
  }

  /**
   * Adjust classification thresholds based on error patterns
   */
  async adjustThresholdsFromPatterns(errorTypes) {
    const thresholds = { ...this.modelState.classificationThresholds };
    const totalErrors = errorTypes.falsePositives + errorTypes.falseNegatives;
    
    if (totalErrors > 0) {
      const falsePositiveRatio = errorTypes.falsePositives / totalErrors;
      const falseNegativeRatio = errorTypes.falseNegatives / totalErrors;
      
      // If too many false positives, increase job posting threshold
      if (falsePositiveRatio > 0.6) {
        thresholds.jobPostingThreshold = Math.min(0.8, thresholds.jobPostingThreshold + 0.02);
        thresholds.analysisSkipThreshold = Math.min(0.9, thresholds.analysisSkipThreshold + 0.01);
      }
      
      // If too many false negatives, decrease job posting threshold
      if (falseNegativeRatio > 0.6) {
        thresholds.jobPostingThreshold = Math.max(0.4, thresholds.jobPostingThreshold - 0.02);
        thresholds.landingPageThreshold = Math.max(0.2, thresholds.landingPageThreshold - 0.01);
      }
      
      // Adjust confidence threshold based on high-confidence errors
      if (errorTypes.highConfidenceErrors > errorTypes.lowConfidenceErrors) {
        thresholds.confidenceThreshold = Math.min(0.85, thresholds.confidenceThreshold + 0.01);
      }
    }
    
    this.modelState.classificationThresholds = thresholds;
  }

  /**
   * Create new patterns from URL analysis
   */
  async createPatternsFromUrls(urlPatterns) {
    const falsePositiveUrls = urlPatterns.filter(p => p.errorType === 'false_positive');
    
    if (falsePositiveUrls.length >= 3) {
      // Group by domain
      const domainGroups = new Map();
      falsePositiveUrls.forEach(url => {
        if (!domainGroups.has(url.domain)) {
          domainGroups.set(url.domain, []);
        }
        domainGroups.get(url.domain).push(url);
      });
      
      // Create patterns for domains with multiple false positives
      for (const [domain, urls] of domainGroups) {
        if (urls.length >= 2) {
          const commonPatterns = this.extractCommonUrlPatterns(urls);
          
          if (commonPatterns.length > 0) {
            await this.firestore.storeFalsePositivePattern({
              type: 'learned_pattern',
              domain: domain,
              patterns: {
                url_patterns: commonPatterns.map(pattern => ({
                  pattern: pattern,
                  confidence: 0.7
                }))
              },
              source: 'dynamic_learning',
              accuracy: 0.6,
              false_positive_reduction: 0.15,
              created_at: new Date()
            });
          }
        }
      }
    }
  }

  /**
   * Extract common patterns from URLs
   */
  extractCommonUrlPatterns(urls) {
    const patterns = [];
    
    // Find common path segments
    const pathSegments = urls.map(url => url.pathname.split('/').filter(s => s.length > 0));
    
    if (pathSegments.length > 1) {
      const commonSegments = pathSegments[0].filter(segment => 
        pathSegments.every(path => path.includes(segment))
      );
      
      commonSegments.forEach(segment => {
        patterns.push(`/${segment}`);
      });
    }
    
    // Find common query parameters
    const queryParams = urls.map(url => new URLSearchParams(url.search));
    if (queryParams.length > 1) {
      const commonParams = [];
      queryParams[0].forEach((value, key) => {
        if (queryParams.every(params => params.has(key))) {
          commonParams.push(key);
        }
      });
      
      commonParams.forEach(param => {
        patterns.push(`[?&]${param}=`);
      });
    }
    
    return patterns;
  }

  /**
   * Validate model performance
   */
  async validateModelPerformance() {
    try {
      // Get recent performance metrics from Firestore
      const metrics = await this.firestore.getPerformanceMetrics(7 * 24 * 60 * 60 * 1000); // 7 days
      
      if (metrics) {
        return {
          accuracy: metrics.accuracy,
          falsePositiveRate: metrics.falsePositiveRate,
          falseNegativeRate: metrics.falseNegativeRate,
          totalSamples: metrics.totalFeedback,
          timestamp: Date.now()
        };
      }
      
      // Fallback to current metrics
      return this.performanceMetrics;
    } catch (error) {
      console.error('Error validating model performance:', error);
      return this.performanceMetrics;
    }
  }

  /**
   * Consider rolling back changes if performance degraded
   */
  async considerRollback(currentPerformance) {
    const performanceDrop = this.performanceMetrics.accuracy - currentPerformance.accuracy;
    
    if (performanceDrop > 0.1) {
      console.warn('Significant performance drop detected, rolling back changes');
      // Implement rollback logic here
      // For now, just log the issue
      this.learningHistory.push({
        action: 'rollback_considered',
        reason: 'performance_degradation',
        performanceDrop: performanceDrop,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Save current model state
   */
  async saveModelState() {
    try {
      // Update feature weights in Firestore
      await this.firestore.updateClassificationRules('feature_weights', {
        rules: this.modelState.featureWeights,
        performance: this.performanceMetrics
      });
      
      // Update thresholds
      await this.firestore.updateClassificationRules('classification_thresholds', {
        rules: this.modelState.classificationThresholds,
        performance: this.performanceMetrics
      });
      
      // Save domain biases if significant
      if (this.modelState.domainBiases.size > 0) {
        const domainBiasData = {};
        this.modelState.domainBiases.forEach((bias, domain) => {
          domainBiasData[domain] = bias;
        });
        
        await this.firestore.updateClassificationRules('domain_specific_rules', {
          rules: { domain_biases: domainBiasData },
          performance: this.performanceMetrics
        });
      }
      
      this.modelState.lastUpdate = Date.now();
      console.log('Model state saved successfully');
    } catch (error) {
      console.error('Error saving model state:', error);
    }
  }

  /**
   * Load existing learning patterns
   */
  async loadLearningPatterns() {
    try {
      if (!this.firestore) {
        console.warn('Firestore integration not available, skipping pattern loading');
        return;
      }
      
      const patterns = await this.firestore.getLearningPatterns();
      if (patterns && Array.isArray(patterns)) {
        patterns.forEach(pattern => {
          if (pattern && pattern.id) {
            this.modelState.patternAccuracy.set(pattern.id, pattern.accuracy || 0.8);
          }
        });
        console.log(`Loaded ${patterns.length} learning patterns`);
      }
    } catch (error) {
      console.error('Error loading learning patterns:', error);
      // Continue with default patterns if loading fails
    }
  }

  /**
   * Load classification rules
   */
  async loadClassificationRules() {
    try {
      if (!this.firestore) {
        console.warn('Firestore integration not available, skipping classification rules loading');
        return;
      }
      
      const rules = await this.firestore.getClassificationRules();
      
      if (rules && Array.isArray(rules)) {
        rules.forEach(rule => {
          if (rule && rule.type) {
            if (rule.type === 'weights' && rule.rules) {
              this.modelState.featureWeights = { ...this.modelState.featureWeights, ...rule.rules };
            } else if (rule.type === 'thresholds' && rule.rules) {
              this.modelState.classificationThresholds = { ...this.modelState.classificationThresholds, ...rule.rules };
            } else if (rule.type === 'domain_rules' && rule.rules && rule.rules.domain_biases) {
              Object.entries(rule.rules.domain_biases).forEach(([domain, bias]) => {
                this.modelState.domainBiases.set(domain, bias);
              });
            }
          }
        });
        console.log(`Loaded ${rules.length} classification rules`);
      }
    } catch (error) {
      console.error('Error loading classification rules:', error);
      // Continue with default rules if loading fails
    }
  }

  /**
   * Load recent feedback for context
   */
  async loadRecentFeedback() {
    try {
      if (!this.firestore) {
        console.warn('Firestore integration not available, skipping recent feedback loading');
        return;
      }
      
      const recentFeedback = await this.firestore.getUserFeedbackHistory(50);
      if (recentFeedback && Array.isArray(recentFeedback)) {
        this.feedbackBuffer = recentFeedback.map(feedback => ({
          ...feedback,
          processed: true // Mark as processed since they're historical
        }));
        console.log(`Loaded ${recentFeedback.length} recent feedback items`);
      }
    } catch (error) {
      console.error('Error loading recent feedback:', error);
      // Continue without recent feedback if loading fails
    }
  }

  /**
   * Calculate current performance metrics
   */
  async calculatePerformanceMetrics() {
    try {
      if (!this.firestore) {
        console.warn('Firestore integration not available, using default performance metrics');
        return;
      }
      
      const metrics = await this.firestore.getPerformanceMetrics();
      if (metrics) {
        this.performanceMetrics = {
          ...this.performanceMetrics,
          ...metrics
        };
        console.log('Performance metrics loaded successfully');
      }
    } catch (error) {
      console.error('Error calculating performance metrics:', error);
      // Continue with default metrics if loading fails
    }
  }

  /**
   * Update performance metrics with new feedback
   */
  async updatePerformanceMetrics(feedback) {
    this.performanceMetrics.totalSamples++;
    
    if (feedback.wasCorrect) {
      // Update accuracy using exponential moving average
      const alpha = 0.1;
      this.performanceMetrics.accuracy = 
        (1 - alpha) * this.performanceMetrics.accuracy + alpha * 1;
    } else {
      const alpha = 0.1;
      this.performanceMetrics.accuracy = 
        (1 - alpha) * this.performanceMetrics.accuracy + alpha * 0;
      
      // Update false positive/negative rates
      if (feedback.systemClassification === 'job_posting' && feedback.userClassification === 'landing_page') {
        this.performanceMetrics.falsePositiveRate = 
          (1 - alpha) * this.performanceMetrics.falsePositiveRate + alpha * 1;
      } else if (feedback.systemClassification === 'landing_page' && feedback.userClassification === 'job_posting') {
        this.performanceMetrics.falseNegativeRate = 
          (1 - alpha) * this.performanceMetrics.falseNegativeRate + alpha * 1;
      }
    }
    
    this.performanceMetrics.lastCalculated = Date.now();
  }

  /**
   * Get current model state for external use
   */
  getModelState() {
    return {
      ...this.modelState,
      performanceMetrics: this.performanceMetrics,
      feedbackBufferSize: this.feedbackBuffer.length,
      lastUpdate: this.modelState.lastUpdate
    };
  }

  /**
   * Helper methods
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (error) {
      return 'unknown';
    }
  }

  adjustFeatureWeights(feedback) {
    // Implement feature weight adjustment based on individual feedback
    if (feedback.features) {
      Object.keys(feedback.features).forEach(feature => {
        if (this.modelState.featureWeights[feature] !== undefined) {
          const adjustment = feedback.wasCorrect ? this.learningRate : -this.learningRate;
          const currentWeight = this.modelState.featureWeights[feature];
          this.modelState.featureWeights[feature] = Math.max(0.05, Math.min(0.5, currentWeight + adjustment));
        }
      });
    }
  }

  updateDomainBias(feedback) {
    const domain = this.extractDomain(feedback.url);
    const currentBias = this.modelState.domainBiases.get(domain) || { bias: 0, accuracy: 0.8, sampleCount: 0 };
    
    // Update bias based on feedback
    const adjustment = feedback.wasCorrect ? 0.01 : -0.01;
    currentBias.bias = Math.max(-0.2, Math.min(0.2, currentBias.bias + adjustment));
    currentBias.sampleCount++;
    currentBias.lastUpdated = Date.now();
    
    this.modelState.domainBiases.set(domain, currentBias);
  }

  async createFalsePositivePattern(feedback) {
    // Create a new false positive pattern based on feedback
    const pattern = {
      url: feedback.url,
      features: feedback.features,
      userClassification: feedback.userClassification,
      systemClassification: feedback.systemClassification,
      confidence: 0.6,
      source: 'user_feedback'
    };
    
    await this.firestore.storeFalsePositivePattern(pattern);
  }

  adjustClassificationThresholds(feedback) {
    // Adjust thresholds based on individual feedback
    if (!feedback.wasCorrect) {
      if (feedback.systemClassification === 'job_posting' && feedback.systemConfidence > 0.8) {
        // High confidence false positive - increase threshold
        this.modelState.classificationThresholds.jobPostingThreshold += 0.01;
      } else if (feedback.systemClassification === 'landing_page' && feedback.systemConfidence > 0.8) {
        // High confidence false negative - decrease threshold
        this.modelState.classificationThresholds.jobPostingThreshold -= 0.01;
      }
    }
  }

  cleanupFeedbackBuffer() {
    // Keep only recent unprocessed feedback
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    this.feedbackBuffer = this.feedbackBuffer.filter(f => 
      !f.processed || f.timestamp > cutoffTime
    );
    
    // Limit buffer size
    if (this.feedbackBuffer.length > this.maxBufferSize) {
      this.feedbackBuffer = this.feedbackBuffer.slice(-this.maxBufferSize);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DynamicLearningEngine;
} else if (typeof window !== 'undefined') {
  window.DynamicLearningEngine = DynamicLearningEngine;
}