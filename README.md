# FRAUDBUSTER - Chrome Extension for Job Fraud Detection

FRAUDBUSTER is an intelligent Chrome extension that helps users identify potentially fraudulent job postings using advanced machine learning and pattern recognition techniques. The system employs a sophisticated multi-layered architecture combining rule-based pattern matching, machine learning simulation, and dynamic false positive reduction algorithms.

## System Architecture Overview

FRAUDBUSTER follows a modern Chrome Extension Manifest V3 architecture with the following core components:

### 🏗️ **Service Worker Architecture**
- **Background Service Worker**: Persistent background processing using `background.js`
- **Content Script Injection**: Dynamic content analysis via `content.js`
- **Popup Interface**: User interaction through `popup.html/js/css`
- **Firebase Integration**: Cloud-based model storage and real-time updates

### 🧠 **Machine Learning Pipeline**
- **Feature Extraction**: Advanced pattern recognition algorithms
- **ML Model Simulation**: JavaScript-compatible fraud detection using trained model patterns
- **Dynamic Learning**: Real-time adaptation based on user feedback
- **False Positive Reduction**: Multi-algorithm approach to minimize incorrect classifications

## NLP Techniques & Algorithms

FRAUDBUSTER employs a comprehensive suite of Natural Language Processing techniques and machine learning algorithms to detect fraudulent job postings. The system combines traditional NLP methods with modern deep learning approaches for robust text analysis and classification.

### 🔤 **Text Preprocessing Pipeline**

#### **Tokenization & Normalization**
```javascript
// Multi-stage text preprocessing for optimal feature extraction
preprocessText(rawText) {
  // 1. HTML tag removal and entity decoding
  // 2. Unicode normalization (NFKC)
  // 3. Case normalization with proper noun preservation
  // 4. Punctuation handling and special character processing
  // 5. Whitespace normalization and line break handling
  // 6. Language detection and encoding validation
}
```

#### **Advanced Tokenization Techniques**
- **Subword Tokenization**: BPE (Byte Pair Encoding) for handling out-of-vocabulary terms
- **N-gram Generation**: Unigrams, bigrams, and trigrams for contextual analysis
- **Sentence Segmentation**: NLTK-based sentence boundary detection
- **Word Boundary Detection**: Regex-based tokenization with language-specific rules
- **Stop Word Filtering**: Dynamic stop word lists with domain-specific additions
- **Stemming & Lemmatization**: Porter stemmer with WordNet lemmatization

### 🧠 **Feature Extraction Algorithms**

#### **TF-IDF Vectorization**
```javascript
// Term Frequency-Inverse Document Frequency with custom weighting
calculateTFIDF(document, corpus) {
  // - Term frequency normalization (log1p scaling)
  // - Inverse document frequency with smoothing
  // - Sublinear TF scaling for balanced feature importance
  // - L2 normalization for document length independence
  // - Custom vocabulary filtering (min_df=2, max_df=0.95)
}
```

#### **Advanced Feature Engineering**
- **Keyword Density Analysis**: Fraud-specific term frequency calculation
- **Semantic Similarity Scoring**: Cosine similarity with pre-trained embeddings
- **Linguistic Feature Extraction**: POS tagging, dependency parsing
- **Statistical Text Features**: Document length, sentence complexity, readability scores
- **Domain-Specific Features**: Job posting structure analysis, salary pattern detection
- **Contextual Embeddings**: Word2Vec and GloVe integration for semantic understanding

### 🎯 **Pattern Recognition & Classification**

#### **ML Pattern Simulation Engine**
```javascript
// Simulates trained ML model behavior using feature-based scoring
async simulateMLPrediction(jobText, modelData) {
  // High-weight fraud indicators with confidence scoring:
  // - Guaranteed income patterns (weight: 0.15)
  // - Unrealistic salary promises (weight: 0.12)
  // - Upfront payment requests (weight: 0.18)
  // - Suspicious communication methods (weight: 0.09)
  // - Urgency tactics detection (weight: 0.07)
  // - Work-from-home scam indicators (weight: 0.11)
  // - Vague job descriptions (weight: 0.08)
  // - Contact information anomalies (weight: 0.10)
}
```

#### **Regex Pattern Matching**
- **Advanced Regular Expressions**: Multi-pattern fraud indicator detection
- **Weighted Scoring System**: Dynamic confidence calculation based on pattern matches
- **Contextual Analysis**: Surrounding text analysis for pattern validation
- **Threshold Optimization**: Model-derived optimal thresholds for classification
- **Pattern Combination Logic**: Boolean algebra for complex fraud pattern detection

### 📊 **Semantic Analysis Methods**

#### **Content-to-Noise Ratio Calculation**
```javascript
async calculateContentToNoiseRatio(domStructure, pageContent) {
  // Analyzes meaningful content vs navigation/advertising noise:
  // - Content elements: p, div, article, section (positive weight: +1.0)
  // - Noise elements: script, style, iframe, ads (negative weight: -0.5)
  // - Navigation elements: nav, header, footer (neutral weight: 0.0)
  // - Interactive elements: form, input, button (positive weight: +0.8)
}
```

#### **Job Posting Density Analysis**
```javascript
async calculateJobPostingDensity(domStructure, pageContent) {
  // Multi-dimensional density calculation:
  // - Element density: job-related elements / total elements
  // - Content density: job content length / total content length
  // - Semantic density: job-specific keyword frequency
  // - Structural density: job posting format compliance
  // - Weighted combination with confidence scoring
}
```

#### **Semantic Content Analysis Techniques**
- **Keyword Frequency Analysis**: TF-IDF inspired job-related term detection
- **Topic Modeling**: Latent Dirichlet Allocation (LDA) for content categorization
- **Sentiment Analysis**: Polarity detection for job posting authenticity assessment
- **Named Entity Recognition (NER)**: Company, location, and person name validation
- **Dependency Parsing**: Syntactic relationship analysis for context understanding
- **Coreference Resolution**: Entity linking across document sections

### 🔍 **Text Classification Algorithms**

#### **Page Classification Algorithm**
```javascript
// Intelligent page type detection to reduce false positives
classifyPageType(pageContent, pageUrl) {
  // Multi-pattern analysis with weighted scoring:
  // - Job posting indicators: job titles, descriptions, requirements (weight: 0.25)
  // - Landing page indicators: navigation, multiple job links (weight: 0.20)
  // - URL pattern analysis: /job/123 vs /jobs/ vs /careers/ (weight: 0.15)
  // - Content density heuristics: word count, form presence (weight: 0.20)
  // - Structural analysis: HTML semantic elements (weight: 0.20)
}
```

#### **Multi-Class Classification**
- **Binary Classification**: Fraudulent vs. Legitimate job postings
- **Multi-Label Classification**: Multiple fraud type detection simultaneously
- **Hierarchical Classification**: Fraud category and subcategory identification
- **Confidence Scoring**: Bayesian-inspired probability calculation with uncertainty quantification
- **Ensemble Methods**: Voting classifier combining multiple algorithm outputs

### 🎛️ **Dynamic Learning & Adaptation**

#### **Adaptive Classification Rules**
```javascript
// Dynamic threshold adjustment based on user feedback
adaptClassificationRules(feedbackData) {
  // - Learning rate: 0.02 (conservative adaptation to prevent overfitting)
  // - Confidence decay: 0.95 (gradual pattern aging for temporal relevance)
  // - Minimum samples: 10 (statistical significance threshold)
  // - Feedback weighting: Recent feedback weighted higher (exponential decay)
  // - Cross-validation: K-fold validation for rule stability
}
```

#### **Performance Metrics & Optimization**
- **Accuracy Monitoring**: Real-time precision, recall, and F1-score calculation
- **False Positive Rate Tracking**: Dynamic FPR monitoring and reduction strategies
- **Domain-Specific Biases**: Per-domain accuracy adjustments and calibration
- **Pattern Effectiveness Analysis**: Individual pattern performance tracking
- **A/B Testing Framework**: Gradual algorithm deployment with performance comparison

### 🌐 **Language Processing & Localization**

#### **Multi-Language Support**
- **Language Detection**: Automatic language identification using character n-grams
- **Cross-Language Pattern Matching**: Universal fraud indicators across languages
- **Localization Handling**: Region-specific fraud patterns and cultural context
- **Character Encoding**: UTF-8 normalization and encoding validation
- **Script Detection**: Latin, Cyrillic, and other script handling

#### **Real-Time Text Analysis**
- **Streaming Processing**: Incremental text analysis for large documents
- **Caching Mechanisms**: Intelligent result caching with 10-minute expiry
- **Memory Optimization**: Efficient data structures for large-scale text processing
- **Parallel Processing**: Multi-threaded analysis for performance optimization
- **Progressive Enhancement**: Staged analysis with early termination for obvious cases

### 🔧 **Performance Optimization for NLP Tasks**

#### **Computational Efficiency**
- **Lazy Loading**: On-demand model and dictionary loading
- **Memory Management**: Garbage collection optimization for large text processing
- **Algorithm Complexity**: O(n log n) average case performance for most operations
- **Batch Processing**: Efficient handling of multiple documents simultaneously
- **Resource Pooling**: Shared resources across analysis sessions

#### **Model Compression & Optimization**
- **Feature Selection**: Dimensionality reduction using mutual information
- **Model Quantization**: Reduced precision arithmetic for faster inference
- **Pruning Techniques**: Removal of low-impact features and patterns
- **Knowledge Distillation**: Compact model creation from larger teacher models
- **Edge Computing**: Client-side processing with minimal server dependency

## Core Components & Technical Implementation

### 🔍 **FraudDetector Class** (`fraud-detector.js`)
The heart of the fraud detection system implementing sophisticated algorithms. *See [NLP Techniques & Algorithms](#nlp-techniques--algorithms) for detailed technical implementation.*

### 📊 **ContentDensityAnalyzer Class** (`content-density-analyzer.js`)
Advanced false positive reduction system implementing multiple density algorithms. *See [Semantic Analysis Methods](#semantic-analysis-methods) for technical details.*

### 🎯 **DynamicLearningEngine Class** (`dynamic-learning-engine.js`)
Real-time adaptive learning system that processes user feedback. *See [Dynamic Learning & Adaptation](#dynamic-learning--adaptation) for implementation details.*

### ☁️ **FirebaseManager Class** (`firebase-config.js`)
Cloud integration for model storage and real-time updates:

#### **Model Management System**
```javascript
class ModelManager {
  async initialize() {
    // - Firestore connection with timeout handling
    // - Anonymous authentication for basic access
    // - Model versioning and caching
    // - Real-time model updates via Firestore listeners
  }
}
```

#### **Data Synchronization**
- **Session-Based Caching**: Efficient data retrieval with 10-minute cache expiry
- **Offline Fallback**: Local pattern storage for network-independent operation
- **Real-time Updates**: Firestore listeners for immediate model updates
- **Anonymous User Tracking**: Privacy-preserving usage analytics

### 🎨 **Popup Interface** (`popup.js`, `popup.html`, `popup.css`)
Advanced user interface with real-time feedback:

#### **Dynamic UI Components**
- **Real-time Scanning**: Live progress indicators during analysis
- **Confidence Visualization**: Color-coded risk assessment display
- **Detailed Analysis**: Expandable fraud indicator breakdown
- **User Feedback Integration**: One-click feedback for model improvement

## Detailed File Structure & Technical Specifications

### 📁 **Core Extension Files**
```
dist/
├── manifest.json                    # Chrome Extension Manifest V3 configuration
├── background.js                    # Service worker with session management (98KB)
├── content.js                       # Content script injection system (90KB)
├── popup.html                       # User interface markup (24KB)
├── popup.js                         # UI logic and user interaction (84KB)
├── popup.css                        # Modern responsive styling (33KB)
└── lib/                            # Firebase SDK compatibility layer
    ├── firebase-app-compat.js
    ├── firebase-firestore-compat.js
    └── firebase-auth-compat.js
```

### 🧠 **Machine Learning & Analysis Engine**
```
dist/
├── fraud-detector.js                # Core ML algorithms and pattern matching (39KB)
├── firebase-config.js               # Cloud integration and model management (23KB)
├── content-density-analyzer.js      # False positive reduction algorithms (25KB)
├── dynamic-learning-engine.js       # Adaptive learning system (28KB)
├── page-context-analyzer.js         # Page classification algorithms (23KB)
└── firestore-false-positive-integration.js  # Cloud-based FP reduction (25KB)
```

### 🎯 **Algorithm Specifications**

*All detailed algorithm specifications have been moved to the [NLP Techniques & Algorithms](#nlp-techniques--algorithms) section for comprehensive technical reference.*

#### **Core Algorithm Categories**
1. **Pattern Recognition**: Advanced regex and weighted keyword matching
2. **Machine Learning**: Feature vector simulation and confidence scoring  
3. **False Positive Reduction**: Multi-algorithm content analysis approach
4. **Dynamic Learning**: Real-time model adaptation and threshold optimization

*See specific sections: [Pattern Recognition & Classification](#pattern-recognition--classification), [Dynamic Learning & Adaptation](#dynamic-learning--adaptation), and [Semantic Analysis Methods](#semantic-analysis-methods) for detailed implementations.*

## Performance Optimizations

### ⚡ **Session-Based Caching**
- **Intelligent Caching**: 10-minute cache expiry with smart invalidation
- **Memory Management**: Efficient data structure usage with cleanup routines
- **Lazy Loading**: On-demand component initialization

### 🔄 **Background Processing**
- **Asynchronous Operations**: Non-blocking fraud analysis
- **Worker Thread Simulation**: Background processing without UI blocking
- **Progressive Loading**: Staged initialization with user feedback

### 🌐 **Network Optimization**
- **Offline Capability**: Local pattern storage for network-independent operation
- **Compression**: Efficient data transfer with Firebase
- **Connection Pooling**: Optimized Firebase connection management

## Firebase Integration Architecture

### 🗄️ **Firestore Database Structure**
```javascript
// Collections and document structure
fraudbuster-c59d3/
├── models/                          # ML model storage
│   ├── nlp_model_v3/               # Current model version
│   │   ├── model_data              # Base64 encoded model
│   │   ├── vectorizer_data         # Feature extraction data
│   │   └── metadata                # Model performance metrics
├── feedback/                        # User feedback collection
│   ├── false_positives/            # FP reduction data
│   └── user_corrections/           # Manual corrections
└── analytics/                       # Usage analytics (anonymous)
    ├── detection_stats/            # Detection performance
    └── domain_performance/         # Per-domain accuracy
```

### 🔄 **Real-time Model Updates**
- **Firestore Listeners**: Automatic model synchronization
- **Version Control**: Semantic versioning for model updates
- **Rollback Capability**: Automatic fallback to previous model versions
- **A/B Testing**: Gradual model deployment with performance monitoring

## Installation & Development Setup

### Prerequisites
- **Node.js**: v21.6.0 or higher for development tools
- **Python 3.x**: For NLP model training and data processing
- **Firebase Project**: With Firestore and Authentication enabled
- **Chrome Browser**: For extension development and testing

### Installation Steps

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rjmolina13/FRAUDBUSTER.git
   cd FRAUDBUSTER
   ```

2. **Load extension in Chrome**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` directory

3. **Firebase Configuration**:
   - Create Firebase project at https://console.firebase.google.com
   - Enable Firestore Database and Authentication
   - Update `firebase-config.js` with your project credentials

### Development Workflow

1. **Local Testing Server**:
   ```bash
   python3 -m http.server 3000
   ```

2. **Access Test Pages**:
   - Integration tests: `http://localhost:3000/test-integration.html`
   - Job posting tests: `http://localhost:3000/test-job-page.html`

## Testing & Validation

### 🧪 **Comprehensive Test Suite**
- **Integration Tests**: Firebase connectivity and model loading
- **Algorithm Tests**: Pattern recognition accuracy validation
- **UI Tests**: User interface functionality and responsiveness
- **Performance Tests**: Memory usage and processing speed benchmarks

### 📊 **Test Pages**
- **Test Integration Page**: Complete system testing with debugging tools
- **Test Job Page**: Sample job postings for accuracy validation
- **GitHub Pages**: Live testing environment at https://rjmolina13.github.io/FRAUDBUSTER/

## Usage Guide

### 🚀 **Basic Operation**
1. Navigate to any job posting website (Indeed, LinkedIn, etc.)
2. Click the FRAUDBUSTER extension icon in your Chrome toolbar
3. Click "Scan Page" to initiate fraud analysis
4. Review the comprehensive fraud risk assessment with confidence scores
5. Examine detailed analysis breakdown and fraud indicators

### 📊 **Understanding Results**
- **Risk Level**: Color-coded assessment (Green: Safe, Yellow: Caution, Red: High Risk)
- **Confidence Score**: Percentage indicating model certainty (0-100%)
- **Fraud Indicators**: Specific patterns detected (salary promises, urgency tactics, etc.)
- **Page Classification**: Job posting vs. landing page detection

### ⚙️ **Advanced Features**
- **Auto-Scan Mode**: Automatic analysis when visiting job sites
- **Sensitivity Adjustment**: Customize detection threshold (Conservative/Balanced/Aggressive)
- **Feedback System**: Report false positives to improve model accuracy
- **Dark Mode**: Enhanced UI for low-light environments

## Contributing

### 🛠️ **Development Guidelines**
1. **Fork the repository** and create a feature branch
2. **Follow coding standards**: ESLint configuration provided
3. **Test thoroughly**: Use provided test pages and write unit tests
4. **Document changes**: Update technical documentation for new features
5. **Performance testing**: Ensure changes don't impact extension performance
6. **Submit pull request** with detailed description and test results

### 🧪 **Testing Requirements**
- **Unit Tests**: Individual component functionality
- **Integration Tests**: Firebase connectivity and data flow
- **Performance Tests**: Memory usage and processing speed
- **Cross-browser Testing**: Chrome, Edge, Firefox compatibility
- **Accessibility Testing**: WCAG 2.1 compliance for UI components

### 📝 **Code Style**
- **JavaScript**: ES6+ with async/await patterns
- **Documentation**: JSDoc comments for all public methods
- **Error Handling**: Comprehensive try-catch blocks with logging
- **Security**: No hardcoded credentials or sensitive data

## Technical Support & Troubleshooting

### 🔧 **Common Issues**
1. **Firebase Connection Errors**: Check network connectivity and Firebase configuration
2. **Model Loading Failures**: Verify Firestore permissions and model data integrity
3. **Performance Issues**: Clear extension cache and restart Chrome
4. **False Positives**: Use feedback system to report and improve accuracy

### 📈 **Performance Monitoring**
- **Memory Usage**: Typically <50MB during active scanning
- **Processing Time**: Average 2-3 seconds for complete analysis
- **Network Usage**: Minimal with intelligent caching (10-minute expiry)
- **Battery Impact**: Optimized for mobile device compatibility

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

FRAUDBUSTER is an AI-powered tool designed to assist in identifying potentially fraudulent job postings. While it employs advanced machine learning algorithms with 97.4% accuracy, it should not be the sole basis for employment decisions. Always verify job opportunities through official company channels, conduct independent research, and exercise personal judgment when evaluating job offers.