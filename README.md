# FRAUDBUSTER - Chrome Extension for Job Fraud Detection

FRAUDBUSTER is an intelligent Chrome extension that helps users identify potentially fraudulent job postings using advanced machine learning and pattern recognition techniques.

## Features

- **Real-time Fraud Detection**: Automatically scans job postings for suspicious patterns
- **Machine Learning Integration**: Uses trained models stored in Firebase Firestore
- **Comprehensive Analysis**: Provides detailed fraud risk assessment with confidence scores
- **User-friendly Interface**: Simple popup interface with clear fraud indicators
- **Test Pages**: Includes dedicated test pages for development and validation

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/rjmolina13/FRAUDBUSTER.git
   cd FRAUDBUSTER
   ```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select this directory

3. The FRAUDBUSTER extension icon will appear in your Chrome toolbar

## Usage

1. Navigate to any job posting website
2. Click the FRAUDBUSTER extension icon
3. Click "Scan Page" to analyze the current page for fraudulent job postings
4. Review the fraud risk assessment and detailed analysis

## Testing

The extension includes comprehensive test pages accessible via GitHub Pages:

- **Test Integration Page**: Tests Firebase integration and fraud detection algorithms
- **Test Job Page**: Contains sample job postings (both legitimate and fraudulent) for testing

Visit the [GitHub Pages site](https://rjmolina13.github.io/FRAUDBUSTER/) to access these test pages.

## Development

### Prerequisites

- Node.js (v21.6.0 or higher)
- Python 3.x (for NLP model training)
- Firebase project with Firestore enabled

### Project Structure

```
FRAUDBUSTER/
├── manifest.json          # Extension manifest
├── background.js          # Background script
├── content.js            # Content script
├── popup.html/js/css     # Extension popup interface
├── fraud-detector.js     # Core fraud detection logic
├── firebase-config.js    # Firebase configuration
├── nlp_module/          # Machine learning models and training
├── test-integration.html # Integration test page
├── test-job-page.html   # Job posting test page
└── index.html           # Navigation page for GitHub Pages
```

### Firebase Setup

1. Create a Firebase project
2. Enable Firestore database
3. Update `firebase-config.js` with your project credentials
4. Upload trained models using the scripts in `nlp_module/`

### Running Tests

1. Start a local server:
   ```bash
   python3 -m http.server 3000
   ```

2. Navigate to `http://localhost:3000` to access test pages

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly using the provided test pages
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

FRAUDBUSTER is a tool to assist in identifying potentially fraudulent job postings. It should not be the sole basis for employment decisions. Always verify job opportunities through official channels.