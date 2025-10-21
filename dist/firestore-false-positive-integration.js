/**
 * Firestore False Positive Integration - Dynamic False Positive Reduction System
 * Handles all Firestore operations for the new collections:
 * - learning_patterns
 * - page_classification_rules
 * - false_positive_patterns
 * - page_analysis_cache
 * - user_feedback_history
 */

class FirestoreFalsePositiveIntegration {
  constructor(firebaseManager) {
    if (!firebaseManager) {
      console.error('FirestoreFalsePositiveIntegration: Firebase manager is required but not provided');
      throw new Error('Firebase manager is required for FirestoreFalsePositiveIntegration');
    }
    
    this.firebaseManager = firebaseManager;
    this.db = firebaseManager.db;
    this.collections = {
      learningPatterns: 'learning_patterns',
      classificationRules: 'page_classification_rules',
      falsePositivePatterns: 'false_positive_patterns',
      analysisCache: 'page_analysis_cache',
      feedbackHistory: 'user_feedback_history'
    };
    
    // Cache for frequently accessed data
    this.cache = new Map();
    this.cacheExpiry = 15 * 60 * 1000; // 15 minutes
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      console.log('Initializing FirestoreFalsePositiveIntegration...');
      
      // Ensure Firebase is initialized
      if (!this.firebaseManager.initialized) {
        await this.firebaseManager.initialize();
      }
      
      // Update db reference after Firebase initialization
      this.db = this.firebaseManager.db;
      
      if (!this.db) {
        throw new Error('Firestore database instance not available');
      }
      
      // Initialize collections with default data
      await this.initializeCollections();
      
      this.initialized = true;
      console.log('✅ FirestoreFalsePositiveIntegration initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize FirestoreFalsePositiveIntegration:', error);
      throw error;
    }
  }

  /**
   * Initialize Firestore collections with default data
   */
  async initializeCollections() {
    try {
      await this.initializeLearningPatterns();
      await this.initializeClassificationRules();
      await this.initializeFalsePositivePatterns();
      console.log('Firestore collections initialized successfully');
    } catch (error) {
      console.error('Error initializing Firestore collections:', error);
    }
  }

  /**
   * Initialize learning patterns collection
   */
  async initializeLearningPatterns() {
    try {
      const collection = this.db.collection(this.collections.learningPatterns);
      
      // Check if collection already has data
      const snapshot = await collection.limit(1).get();
      if (!snapshot.empty) {
        return; // Collection already initialized
      }

      // Default learning patterns
      const defaultPatterns = [
        {
          id: 'job_posting_indicators',
          type: 'job_posting',
          patterns: {
            selectors: ['.job-title', '.job-description', '.company-name', '.salary', '.apply-button'],
            keywords: ['responsibilities', 'qualifications', 'requirements', 'apply now', 'job description'],
            urlPatterns: ['/job/', '/position/', '/career/', '/opening/'],
            confidence: 0.85
          },
          accuracy: 0.87,
          usage_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'landing_page_indicators',
          type: 'landing_page',
          patterns: {
            selectors: ['.search-form', '.job-search', '.filters', '.job-list', '.pagination'],
            keywords: ['search jobs', 'find careers', 'browse opportunities', 'job categories'],
            urlPatterns: ['/jobs', '/careers', '/search', '/browse'],
            confidence: 0.82
          },
          accuracy: 0.84,
          usage_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'content_density_thresholds',
          type: 'density_rules',
          patterns: {
            job_posting_min_density: 0.6,
            landing_page_max_density: 0.4,
            semantic_density_threshold: 0.3,
            navigation_density_threshold: 0.2,
            confidence: 0.78
          },
          accuracy: 0.81,
          usage_count: 0,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      // Add default patterns to Firestore
      const batch = this.db.batch();
      defaultPatterns.forEach(pattern => {
        const docRef = collection.doc(pattern.id);
        batch.set(docRef, pattern);
      });
      
      await batch.commit();
      console.log('Learning patterns initialized');
    } catch (error) {
      console.error('Error initializing learning patterns:', error);
    }
  }

  /**
   * Initialize page classification rules collection
   */
  async initializeClassificationRules() {
    try {
      const collection = this.db.collection(this.collections.classificationRules);
      
      // Check if collection already has data
      const snapshot = await collection.limit(1).get();
      if (!snapshot.empty) {
        return;
      }

      // Default classification rules
      const defaultRules = [
        {
          id: 'feature_weights',
          type: 'weights',
          rules: {
            contentDensity: 0.25,
            jobIndicators: 0.30,
            navigationScore: 0.20,
            urlScore: 0.15,
            semanticScore: 0.10
          },
          performance: {
            accuracy: 0.86,
            precision: 0.84,
            recall: 0.88
          },
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'classification_thresholds',
          type: 'thresholds',
          rules: {
            job_posting_threshold: 0.6,
            landing_page_threshold: 0.4,
            confidence_threshold: 0.7,
            analysis_skip_threshold: 0.8
          },
          performance: {
            false_positive_rate: 0.12,
            false_negative_rate: 0.08,
            overall_accuracy: 0.87
          },
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'domain_specific_rules',
          type: 'domain_rules',
          rules: {
            job_sites: {
              'indeed.com': { bias: 0.1, confidence_boost: 0.05 },
              'linkedin.com': { bias: 0.15, confidence_boost: 0.08 },
              'glassdoor.com': { bias: 0.12, confidence_boost: 0.06 },
              'monster.com': { bias: 0.08, confidence_boost: 0.04 }
            },
            company_sites: {
              patterns: ['/careers', '/jobs', '/opportunities'],
              bias: 0.05,
              confidence_boost: 0.03
            }
          },
          performance: {
            domain_accuracy: 0.91,
            improvement_rate: 0.15
          },
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      // Add default rules to Firestore
      const batch = this.db.batch();
      defaultRules.forEach(rule => {
        const docRef = collection.doc(rule.id);
        batch.set(docRef, rule);
      });
      
      await batch.commit();
      console.log('Classification rules initialized');
    } catch (error) {
      console.error('Error initializing classification rules:', error);
    }
  }

  /**
   * Initialize false positive patterns collection
   */
  async initializeFalsePositivePatterns() {
    try {
      const collection = this.db.collection(this.collections.falsePositivePatterns);
      
      // Check if collection already has data
      const snapshot = await collection.limit(1).get();
      if (!snapshot.empty) {
        return;
      }

      // Default false positive patterns
      const defaultPatterns = [
        {
          id: 'common_landing_pages',
          type: 'landing_page_patterns',
          patterns: {
            url_patterns: [
              { pattern: '/jobs/?$', confidence: 0.9 },
              { pattern: '/careers/?$', confidence: 0.88 },
              { pattern: '/search.*jobs', confidence: 0.85 },
              { pattern: '/browse.*careers', confidence: 0.82 }
            ],
            content_patterns: [
              { pattern: 'search for jobs', confidence: 0.8 },
              { pattern: 'browse all jobs', confidence: 0.78 },
              { pattern: 'find your next career', confidence: 0.75 },
              { pattern: 'job search results', confidence: 0.85 }
            ],
            dom_patterns: [
              { selector: '.search-results', min_count: 1, confidence: 0.82 },
              { selector: '.job-list .job-item', min_count: 3, confidence: 0.88 },
              { selector: '.pagination', min_count: 1, confidence: 0.75 }
            ]
          },
          accuracy: 0.89,
          false_positive_reduction: 0.34,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'search_result_pages',
          type: 'search_patterns',
          patterns: {
            url_patterns: [
              { pattern: '[?&]q=', confidence: 0.85 },
              { pattern: '[?&]search=', confidence: 0.83 },
              { pattern: '[?&]query=', confidence: 0.81 },
              { pattern: '[?&]location=', confidence: 0.75 }
            ],
            content_patterns: [
              { pattern: 'showing \\d+ jobs', confidence: 0.9 },
              { pattern: 'results for', confidence: 0.78 },
              { pattern: 'refine your search', confidence: 0.82 },
              { pattern: 'sort by:', confidence: 0.76 }
            ],
            dom_patterns: [
              { selector: '.search-filters', min_count: 1, confidence: 0.85 },
              { selector: '.sort-options', min_count: 1, confidence: 0.78 },
              { selector: '.filter-tags', min_count: 1, confidence: 0.73 }
            ]
          },
          accuracy: 0.87,
          false_positive_reduction: 0.41,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: 'company_career_pages',
          type: 'company_patterns',
          patterns: {
            url_patterns: [
              { pattern: '/about.*careers', confidence: 0.8 },
              { pattern: '/company.*jobs', confidence: 0.78 },
              { pattern: '/work-with-us', confidence: 0.75 },
              { pattern: '/join.*team', confidence: 0.72 }
            ],
            content_patterns: [
              { pattern: 'why work with us', confidence: 0.82 },
              { pattern: 'company culture', confidence: 0.75 },
              { pattern: 'our values', confidence: 0.70 },
              { pattern: 'employee benefits', confidence: 0.78 }
            ],
            dom_patterns: [
              { selector: '.company-info', min_count: 1, confidence: 0.8 },
              { selector: '.culture-section', min_count: 1, confidence: 0.75 },
              { selector: '.benefits-list', min_count: 1, confidence: 0.73 }
            ]
          },
          accuracy: 0.84,
          false_positive_reduction: 0.28,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      // Add default patterns to Firestore
      const batch = this.db.batch();
      defaultPatterns.forEach(pattern => {
        const docRef = collection.doc(pattern.id);
        batch.set(docRef, pattern);
      });
      
      await batch.commit();
      console.log('False positive patterns initialized');
    } catch (error) {
      console.error('Error initializing false positive patterns:', error);
    }
  }

  /**
   * Store page classification result
   */
  async storePageClassification(classificationResult) {
    try {
      const doc = {
        url: classificationResult.url,
        domain: new URL(classificationResult.url).hostname,
        page_type: classificationResult.pageType,
        confidence: classificationResult.confidence,
        should_analyze: classificationResult.shouldAnalyze,
        features: classificationResult.features,
        classification_id: classificationResult.classificationId,
        method: classificationResult.method,
        timestamp: new Date(classificationResult.timestamp),
        created_at: new Date()
      };

      await this.db.collection(this.collections.analysisCache).add(doc);
      console.log('Page classification stored:', classificationResult.classificationId);
    } catch (error) {
      console.error('Error storing page classification:', error);
    }
  }

  /**
   * Get cached page classification
   */
  async getCachedPageClassification(url, maxAge = 3600000) { // 1 hour default
    try {
      const cacheKey = `classification_${this.simpleHash(url)}`;
      
      // Check memory cache first
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      // Query Firestore
      const cutoffTime = new Date(Date.now() - maxAge);
      const snapshot = await this.db.collection(this.collections.analysisCache)
        .where('url', '==', url)
        .where('timestamp', '>', cutoffTime)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const result = doc.data();
        
        // Cache in memory
        this.cacheResult(cacheKey, result);
        
        return result;
      }

      return null;
    } catch (error) {
      console.error('Error getting cached page classification:', error);
      return null;
    }
  }

  /**
   * Store user feedback
   */
  async storeUserFeedback(feedback) {
    try {
      const doc = {
        classification_id: feedback.classificationId,
        url: feedback.url,
        user_classification: feedback.userClassification,
        system_classification: feedback.systemClassification,
        was_correct: feedback.wasCorrect,
        confidence_rating: feedback.confidenceRating,
        feedback_type: feedback.feedbackType, // 'manual_report', 'url_vote', 'correction'
        features: feedback.features,
        user_agent: navigator.userAgent,
        timestamp: new Date(),
        created_at: new Date()
      };

      const docRef = await this.db.collection(this.collections.feedbackHistory).add(doc);
      console.log('User feedback stored:', docRef.id);
      
      // Update learning patterns based on feedback
      await this.updateLearningFromFeedback(feedback);
      
      return docRef.id;
    } catch (error) {
      console.error('Error storing user feedback:', error);
      return null;
    }
  }

  /**
   * Update learning patterns based on user feedback
   */
  async updateLearningFromFeedback(feedback) {
    try {
      if (!feedback.wasCorrect) {
        // Incorrect classification - update patterns
        const patternType = feedback.userClassification === 'job_posting' ? 'job_posting' : 'landing_page';
        
        // Get current learning patterns
        const patternsSnapshot = await this.db.collection(this.collections.learningPatterns)
          .where('type', '==', patternType)
          .get();

        if (!patternsSnapshot.empty) {
          const batch = this.db.batch();
          
          patternsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const updatedData = {
              ...data,
              accuracy: this.adjustAccuracy(data.accuracy, false),
              usage_count: (data.usage_count || 0) + 1,
              updated_at: new Date()
            };
            
            batch.update(doc.ref, updatedData);
          });
          
          await batch.commit();
        }

        // Store new false positive pattern if applicable
        if (feedback.userClassification === 'landing_page' && feedback.systemClassification === 'job_posting') {
          await this.storeFalsePositivePattern(feedback);
        }
      } else {
        // Correct classification - boost confidence
        const patternType = feedback.systemClassification === 'job_posting' ? 'job_posting' : 'landing_page';
        
        const patternsSnapshot = await this.db.collection(this.collections.learningPatterns)
          .where('type', '==', patternType)
          .get();

        if (!patternsSnapshot.empty) {
          const batch = this.db.batch();
          
          patternsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const updatedData = {
              ...data,
              accuracy: this.adjustAccuracy(data.accuracy, true),
              usage_count: (data.usage_count || 0) + 1,
              updated_at: new Date()
            };
            
            batch.update(doc.ref, updatedData);
          });
          
          await batch.commit();
        }
      }
    } catch (error) {
      console.error('Error updating learning from feedback:', error);
    }
  }

  /**
   * Store new false positive pattern
   */
  async storeFalsePositivePattern(feedback) {
    try {
      const url = new URL(feedback.url);
      const pattern = {
        id: `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'user_reported',
        patterns: {
          url_patterns: [{ pattern: url.pathname, confidence: 0.7 }],
          domain: url.hostname,
          features: feedback.features
        },
        accuracy: 0.6, // Start with moderate accuracy
        false_positive_reduction: 0.1,
        source: 'user_feedback',
        created_at: new Date(),
        updated_at: new Date()
      };

      await this.db.collection(this.collections.falsePositivePatterns).add(pattern);
      console.log('New false positive pattern stored');
    } catch (error) {
      console.error('Error storing false positive pattern:', error);
    }
  }

  /**
   * Get learning patterns
   */
  async getLearningPatterns(type = null) {
    try {
      const cacheKey = `patterns_${type || 'all'}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      let query = this.db.collection(this.collections.learningPatterns);
      if (type) {
        query = query.where('type', '==', type);
      }

      const snapshot = await query.get();
      const patterns = [];
      
      snapshot.forEach(doc => {
        patterns.push({ id: doc.id, ...doc.data() });
      });

      // Cache the result
      this.cacheResult(cacheKey, patterns);
      
      return patterns;
    } catch (error) {
      console.error('Error getting learning patterns:', error);
      return [];
    }
  }

  /**
   * Get classification rules
   */
  async getClassificationRules(type = null) {
    try {
      const cacheKey = `rules_${type || 'all'}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      let query = this.db.collection(this.collections.classificationRules);
      if (type) {
        query = query.where('type', '==', type);
      }

      const snapshot = await query.get();
      const rules = [];
      
      snapshot.forEach(doc => {
        rules.push({ id: doc.id, ...doc.data() });
      });

      // Cache the result
      this.cacheResult(cacheKey, rules);
      
      return rules;
    } catch (error) {
      console.error('Error getting classification rules:', error);
      return [];
    }
  }

  /**
   * Get false positive patterns
   */
  async getFalsePositivePatterns(type = null) {
    try {
      const cacheKey = `fp_patterns_${type || 'all'}`;
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return cached;
      }

      let query = this.db.collection(this.collections.falsePositivePatterns);
      if (type) {
        query = query.where('type', '==', type);
      }

      const snapshot = await query.get();
      const patterns = [];
      
      snapshot.forEach(doc => {
        patterns.push({ id: doc.id, ...doc.data() });
      });

      // Cache the result
      this.cacheResult(cacheKey, patterns);
      
      return patterns;
    } catch (error) {
      console.error('Error getting false positive patterns:', error);
      return [];
    }
  }

  /**
   * Get user feedback history
   */
  async getUserFeedbackHistory(limit = 100, startAfter = null) {
    try {
      let query = this.db.collection(this.collections.feedbackHistory)
        .orderBy('timestamp', 'desc')
        .limit(limit);

      if (startAfter) {
        query = query.startAfter(startAfter);
      }

      const snapshot = await query.get();
      const feedback = [];
      
      snapshot.forEach(doc => {
        feedback.push({ id: doc.id, ...doc.data() });
      });

      return feedback;
    } catch (error) {
      console.error('Error getting user feedback history:', error);
      return [];
    }
  }

  /**
   * Update classification rules based on performance
   */
  async updateClassificationRules(ruleId, updates) {
    try {
      const docRef = this.db.collection(this.collections.classificationRules).doc(ruleId);
      const updateData = {
        ...updates,
        updated_at: new Date()
      };

      await docRef.update(updateData);
      
      // Clear related cache
      this.clearCacheByPattern('rules_');
      
      console.log('Classification rules updated:', ruleId);
    } catch (error) {
      console.error('Error updating classification rules:', error);
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(timeRange = 7 * 24 * 60 * 60 * 1000) { // 7 days default
    try {
      const cutoffTime = new Date(Date.now() - timeRange);
      
      // Get feedback data
      const feedbackSnapshot = await this.db.collection(this.collections.feedbackHistory)
        .where('timestamp', '>', cutoffTime)
        .get();

      let totalFeedback = 0;
      let correctClassifications = 0;
      let falsePositives = 0;
      let falseNegatives = 0;

      feedbackSnapshot.forEach(doc => {
        const data = doc.data();
        totalFeedback++;
        
        if (data.was_correct) {
          correctClassifications++;
        } else {
          if (data.system_classification === 'job_posting' && data.user_classification === 'landing_page') {
            falsePositives++;
          } else if (data.system_classification === 'landing_page' && data.user_classification === 'job_posting') {
            falseNegatives++;
          }
        }
      });

      const accuracy = totalFeedback > 0 ? correctClassifications / totalFeedback : 0;
      const falsePositiveRate = totalFeedback > 0 ? falsePositives / totalFeedback : 0;
      const falseNegativeRate = totalFeedback > 0 ? falseNegatives / totalFeedback : 0;

      return {
        totalFeedback,
        accuracy,
        falsePositiveRate,
        falseNegativeRate,
        correctClassifications,
        falsePositives,
        falseNegatives,
        timeRange,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return null;
    }
  }

  /**
   * Helper methods
   */
  adjustAccuracy(currentAccuracy, wasCorrect) {
    const learningRate = 0.01;
    const adjustment = wasCorrect ? learningRate : -learningRate;
    return Math.max(0.1, Math.min(0.99, currentAccuracy + adjustment));
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
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.cacheExpiry) {
      return cached.result;
    }
    return null;
  }

  cacheResult(cacheKey, result) {
    this.cache.set(cacheKey, {
      result: result,
      timestamp: Date.now()
    });

    // Clean old cache entries
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  clearCacheByPattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clean up old cache entries and analysis data
   */
  async cleanupOldData(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days default
    try {
      const cutoffTime = new Date(Date.now() - maxAge);
      
      // Clean up old analysis cache
      const oldCacheSnapshot = await this.db.collection(this.collections.analysisCache)
        .where('timestamp', '<', cutoffTime)
        .limit(100)
        .get();

      if (!oldCacheSnapshot.empty) {
        const batch = this.db.batch();
        oldCacheSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`Cleaned up ${oldCacheSnapshot.size} old cache entries`);
      }

      // Clean memory cache
      this.cache.clear();
      
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirestoreFalsePositiveIntegration;
} else if (typeof window !== 'undefined') {
  window.FirestoreFalsePositiveIntegration = FirestoreFalsePositiveIntegration;
}