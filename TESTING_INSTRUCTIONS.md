# FraudBuster Extension Testing Instructions

## Setup

1. **Load the Extension in Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `/Users/rjmolina13/Documents/Code_Stuff/FRAUDBUSTER-dev` folder
   - The FraudBuster extension should now appear in your extensions list

2. **Start the Test Server:**
   ```bash
   cd /Users/rjmolina13/Documents/Code_Stuff/FRAUDBUSTER-dev
   python3 -m http.server 3000
   ```

3. **Start the NLP Module Server:**
   ```bash
   cd /Users/rjmolina13/Documents/Code_Stuff/FRAUDBUSTER-dev/nlp_module
   python3 -m http.server 8080
   ```

## Testing the Fraud Detection Workflow

### Test Page
Navigate to: `http://localhost:3000/test-job-page.html`

This page contains:
- **Suspicious Job Postings**: High-paying work-from-home scams, mystery shopper scams
- **Legitimate Job Postings**: Normal software engineering positions
- **Test Controls**: Buttons to trigger extension functionality

### Expected Behavior

1. **Automatic Scanning:**
   - Extension should automatically scan the page when loaded
   - Check the extension popup for scan results
   - Look for fraud warnings on suspicious job postings

2. **Domain Checking:**
   - Extension first checks if `localhost` is in the Firebase fraud domains list
   - Since it's not, it should proceed to NLP analysis

3. **NLP Analysis:**
   - Suspicious job postings should be flagged by the ML model
   - Results should show in the extension popup
   - Fraud warnings should appear on the page

4. **Manual Reporting:**
   - If analysis is inconclusive, manual reporting interface should appear
   - Users can report domains as fraudulent or legitimate
   - Reports are stored in Firebase for future reference

### Testing Steps

1. **Load the test page** and open the extension popup
2. **Check for automatic scan results** in the popup
3. **Look for visual warnings** on suspicious job postings
4. **Test manual reporting** if prompted
5. **Verify Firebase integration** (check browser network tab for Firebase requests)

### Debugging

- **Check Console Logs**: Open Chrome DevTools → Console
- **Check Network Tab**: Look for Firebase and NLP module requests
- **Check Extension Popup**: Should show scan results and analysis
- **Check Background Script**: Go to `chrome://extensions/` → FraudBuster → "service worker" link

### Expected Console Output

```
FraudBuster: Extension loaded
FraudBuster: Scanning page for job postings
FraudBuster: Found X job postings
FraudBuster: Checking domain against Firebase fraud list
FraudBuster: Domain not in fraud list, proceeding to NLP analysis
FraudBuster: NLP analysis complete - Risk: HIGH/MEDIUM/LOW
FraudBuster: Displaying results in popup
```

### Troubleshooting

1. **Extension not loading**: Check manifest.json syntax and file paths
2. **Firebase errors**: Verify Firebase configuration and network connectivity
3. **NLP module errors**: Ensure the NLP server is running on port 8080
4. **No scan results**: Check if job postings are being detected properly

## Manual Testing Scenarios

### Scenario 1: Fraudulent Domain Detection
- Navigate to a known fraudulent job site
- Extension should immediately flag the domain
- No NLP analysis needed

### Scenario 2: NLP-Based Detection
- Navigate to legitimate job sites with suspicious postings
- Extension should analyze content and flag suspicious jobs
- Results should appear in popup and on page

### Scenario 3: Manual Review Required
- Navigate to unknown domains with ambiguous content
- Extension should prompt for manual review
- User can report as fraud or legitimate

### Scenario 4: User Feedback System
- After any analysis, users should be able to provide feedback
- Feedback should be stored in Firebase
- System should learn from user input

## Success Criteria

✅ Extension loads without errors
✅ Automatic page scanning works
✅ Firebase domain checking functions
✅ NLP analysis provides accurate results
✅ Manual reporting interface appears when needed
✅ User feedback is properly stored
✅ Visual warnings appear on fraudulent content
✅ Extension popup shows comprehensive results

## Files to Monitor

- `background.js` - Main extension logic
- `content.js` - Page scanning and UI injection
- `popup.js` - Extension popup functionality
- `fraud-detector.js` - Core fraud detection logic
- `firebase-config.js` - Firebase integration

The extension implements a comprehensive fraud detection workflow that combines domain blacklisting, ML-based content analysis, and community-driven reporting to protect users from fraudulent job postings.