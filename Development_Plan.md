# Project Development Plan: FraudBuster 🚀

This plan outlines the development of a functional prototype for **FraudBuster**, a Chromium-based browser extension that detects fraudulent job offers using a client-server architecture powered by Firebase and a machine learning model.

---

## 1. Core Objectives

The primary goal is to create a secure, user-friendly, and effective browser extension that accomplishes the following:

1.  **Dual-Layer Fraud Detection:** Implement a two-pronged detection system:
    * **URL/Domain Blacklisting:** Check the current page's URL against a dynamic, community-vetted list of fraudulent domains stored in Firebase.
    * **Content Analysis (NLP):** Scan the text content of job postings on a given page using a trained NLP model to identify patterns and keywords indicative of scams.
2.  **User-Centric Interface & Control:**
    * Provide an intuitive UI with **automatic dark/light mode** based on system preferences.
    * Allow users to **activate or deactivate** the extension's functionality on a per-tab basis.
    * Present clear, actionable results, including a **confidence score** or percentage indicating the likelihood of fraud.
3.  **Community-Powered Database:**
    * Enable users to **report suspicious URLs**, contributing to the blacklist.
    * Implement an **upvote/downvote system** for reported URLs to ensure the database remains accurate and self-regulating.
4.  **Secure & Anonymous User Identification:**
    * Assign a **unique, anonymous identifier** to each user upon first launch to manage contributions (reports, votes) without collecting personal information. This ID will be synced across the user's browser profile.

---

## 2. Technology Stack

This stack is selected based on your project's requirements for a lightweight frontend, a powerful serverless backend, and machine learning integration.

* **Frontend (Browser Extension):**
    * **Languages:** HTML, CSS, JavaScript
    * **Framework:** None (Vanilla JS is sufficient for this scope)
    * **Icons:** Font Awesome
    * **Manifest Version:** Manifest V3 (for modern security and performance)
* **Backend (Serverless):**
    * **Platform:** **Google Firebase**
    * **Services:**
        * **Firestore:** For storing the URL database, user data, and NLP wordlists.
        * **Firebase Authentication:** (Optional, for future features) Can be used for anonymous authentication to generate user IDs.
        * **Cloud Functions for Firebase:** To host the API endpoints for URL checking, reporting, and voting.
        * **Firebase Storage:** To host the trained and compressed ML model file.
* **Machine Learning:**
    * **Language:** Python
    * **Libraries:** Scikit-learn, Pandas, NLTK (for training the model)



---

## 3. Development Roadmap (Phased Approach)

This roadmap breaks the project into manageable phases, following the SDLC model mentioned in your thesis.

#### Phase 1: Foundation & Backend Setup

1.  **Initialize Firebase Project:** Set up a new Firebase project. Enable Firestore, Cloud Functions, and Storage.
2.  **Extension Boilerplate:** Create the basic structure of a Chromium Manifest V3 extension (`manifest.json`, popup files, background service worker).
3.  **Anonymous User ID:** On the extension's first run, generate a unique user ID using Firebase Anonymous Authentication or a custom method. Store this ID in `chrome.storage.sync` so it persists across the user's devices.
4.  **Database Schema Design:** Define the Firestore collections:
    * `users`: `{ userId, firstSeen, totalVotes, totalReports }`
    * `reportedUrls`: `{ url, domain, reports: [userId], upvotes, downvotes, createdAt, status ('active' | 'archived') }`
    * `model`: `{ version, storagePath, metadata }`

#### Phase 2: Core Detection Logic & API

1.  **Develop NLP Model:**
    * **Algorithm:** Start with a **TF-IDF (Term Frequency-Inverse Document Frequency)** vectorizer combined with a lightweight classifier like **Naive Bayes** or **Logistic Regression**. This approach is fast, effective for text, and results in a small model file.
    * **Training:** Use your existing dataset of ~18,000 job postings to train the model.
    * **Export & Compress:** Export the trained model and the TF-IDF vocabulary into a compressed format (e.g., using `joblib` or `pickle` in Python, then compressing further if needed). Upload the final model file to Firebase Storage.
2.  **Create Firebase Cloud Functions (API):**
    * `checkUrl(url)`: An HTTP-triggered function that checks a given URL/domain against the `reportedUrls` collection in Firestore.
    * `reportUrl(url, userId)`: An HTTP-triggered function that allows users to submit a new URL or add their report to an existing one.
    * `voteUrl(urlId, userId, voteType)`: An HTTP-triggered function to handle upvotes and downvotes.
    * `getLatestModel()`: A function that returns the storage path for the latest version of the NLP model.

#### Phase 3: Frontend UI & User Interaction

1.  **Build the Popup UI:**
    * Design the main extension popup using HTML and CSS.
    * Implement **auto dark mode** using a CSS media query: `@media (prefers-color-scheme: dark) { ... }`.
    * Add the main toggle switch to activate/deactivate the extension for the current tab.
    * Create the "Scan Page" button, which is only visible when the extension is active.
2.  **Implement Scanning Logic:**
    * When a user clicks "Scan Page," the extension's content script will:
        1.  Send the current tab's URL to the background service worker.
        2.  The service worker calls the `checkUrl` Firebase function.
        3.  Simultaneously, the content script extracts relevant text from the page (e.g., from `<div>`s or `<p>`s that look like job descriptions).
        4.  The background worker fetches the NLP model (if not already cached), runs the extracted text through it, and calculates a fraud score.
3.  **Display Results:**
    * Design a results view in the popup that shows:
        * A clear warning status (e.g., "Safe," "Potentially Unsafe," "High Risk").
        * A fraud confidence percentage.
        * A brief explanation (e.g., "This domain has been reported by other users" or "The text contains suspicious language").

#### Phase 4: Testing & Deployment

1.  **Usability Testing:** Test the UI/UX with target users to ensure the warnings are clear and the workflow is intuitive, as planned in your methodology.
2.  **Functionality Testing:** Verify that all API calls work, the NLP model provides consistent results, and the state (active/inactive) is managed correctly per tab.
3.  **Deployment:** Package the extension for the Chrome Web Store and prepare the Firebase backend for production usage (update security rules, etc.).