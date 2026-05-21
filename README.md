<!-- Improved compatibility of back to top link: See: https://github.com/othneildrew/Best-README-Template/pull/73 -->
<a name="readme-top"></a>

<div align="center">
  <a href="https://github.com/rjmolina13/FRAUDBUSTER">
    <img src="icon48.svg" alt="FRAUDBUSTER" width="48" height="48" />
  </a>
  <h2>FRAUDBUSTER <span style="font-size: 0.7em; font-style: italic">v3.1.0 (dev)</span></h2>
  <p><strong>Version</strong>: 3.1.0 <span style="font-size: 0.8em">(source: <code>dev/manifest.json</code>)</span></p>
  <p>Chrome extension for detecting fraudulent job postings and scam websites</p>
  <p>
    <a href="https://github.com/rjmolina13/FRAUDBUSTER">View Repo</a>
    ·
    <a href="https://github.com/rjmolina13/FRAUDBUSTER/issues">Report Bug</a>
    ·
    <a href="https://github.com/rjmolina13/FRAUDBUSTER/issues">Request Feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#built-with">Built With</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#install-from-a-github-release">Install From A GitHub Release</a></li>
    <li><a href="#technical-stack">Technical Stack</a></li>
    <li><a href="#architecture">Architecture</a></li>
    <li><a href="#model-generation">Model Generation</a></li>
    <li><a href="#features">Features</a></li>
    <li><a href="#file-structure">File Structure</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

## About The Project

FRAUDBUSTER is an intelligent Chrome extension that helps users identify potentially fraudulent job postings using machine learning-inspired scoring, rule-based pattern matching, and multiple false-positive reduction techniques.

## Built With

- Chrome Extension Manifest V3
- JavaScript (ES2020+)
- Firebase (Firestore, Auth)
- Playwright (validation tooling)
- GitHub Actions

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Chrome, Chromium, Edge, Brave, Opera, or another Chromium-based browser
- Optional: Firebase project with Firestore and Authentication enabled

### Setup / Installation

1. Clone the repository

   ```bash
   git clone https://github.com/rjmolina13/FRAUDBUSTER
   cd FRAUDBUSTER
   ```

2. Install dependencies

   ```bash
   npm ci
   ```

3. Build the distributable using the package scripts

   ```bash
   npm run build:dists
   npm run verify:dists
   ```

4. Optional: generate release artifacts locally

   ```bash
   BUILD_NONINTERACTIVE=1 BUILD_VERSION=3.1.0 npm run release
   ```

   This produces `dists/` for unpacked loading and a versioned zip in `public/`.

5. Load the `dists/` build in a Chromium-based browser
   - Chrome: open `chrome://extensions/`
   - Edge: open `edge://extensions/`
   - Brave: open `brave://extensions/`
   - Opera: open `opera://extensions/`
   - Vivaldi: open `vivaldi://extensions/`
   - Enable Developer Mode
   - Click "Load unpacked" and select the `dists` directory

6. Configure Firebase (optional)
   - Create a Firebase project
   - Enable Firestore and Authentication
   - Update credentials in `dev/firebase-config.js` before building, or `dists/firebase-config.js` after building

## Install From A GitHub Release

Download the release zip from the GitHub Releases page, extract it locally, and then load the extracted folder as an unpacked extension.

### Browser Install Instructions

- Chrome
  - Open `chrome://extensions/`
  - Enable Developer Mode
  - Click "Load unpacked"
  - Select the extracted `FRAUDBUSTER_v<version>` folder
- Microsoft Edge
  - Open `edge://extensions/`
  - Enable Developer Mode
  - Click "Load unpacked"
  - Select the extracted folder
- Brave
  - Open `brave://extensions/`
  - Enable Developer Mode
  - Click "Load unpacked"
  - Select the extracted folder
- Opera
  - Open `opera://extensions/`
  - Enable Developer Mode
  - Click "Load unpacked"
  - Select the extracted folder
- Vivaldi
  - Open `vivaldi://extensions/`
  - Enable Developer Mode
  - Click "Load unpacked"
  - Select the extracted folder
- Firefox
  - Not currently supported because this repository ships a Chromium extension build
- Safari
  - Not currently supported because this repository does not include a Safari extension target

## Architecture

- Background service worker: `dev/background.js`
- Content scripts: `dev/content.js`, `dev/fraud-detector.js`, `dev/page-context-analyzer.js`
- False-positive reduction: `dev/content-density-analyzer.js`, `dev/firestore-false-positive-integration.js`
- Dynamic learning: `dev/dynamic-learning-engine.js`
- UI: `dev/popup.html`, `dev/popup.js`, `dev/popup.css`
- Manifest: `dev/manifest.json` (MV3)

## Technical Stack

### Build Pipeline

- Bundler: `esbuild` with `target: chrome100`, `bundle: false`, `minify: true`
- Background script build: separate `esbuild` run with `minifyWhitespace` and `minifySyntax` only
- HTML minification: `html-minifier-terser` removes comments and collapses whitespace
- Assets copied from `dev/` to `dists/`: `manifest.json`, `icon16.png`, `icon48.png`, `icon128.png`, `lib/`
- Manifest normalization during build:
  - Removes `(dev)` from `name`
  - Supports explicit version override via `BUILD_VERSION`
  - Skips the version prompt when `BUILD_NONINTERACTIVE=1`

```bash
# interactive build (may prompt to change version)
npm run build:dists

# non-interactive build with explicit version
BUILD_NONINTERACTIVE=1 BUILD_VERSION=3.1.0 npm run build:dists
```

### Manifest & Permissions

- `manifest_version: 3`
- Background: service worker `background.js`
- Content scripts: `firebase-config.js`, `fraud-detector.js`, `content.js` with `run_at: document_idle`
- Action icons: `16`, `48`, `128`
- `content_security_policy.extension_pages`: `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`
- Host permissions include Firebase endpoints:
  - `https://firestore.googleapis.com/*`
  - `https://firebasestorage.googleapis.com/*`
  - `https://identitytoolkit.googleapis.com/*`

### Verification & Packaging

- Syntax verification: Node `vm.Script` over all `dists/*.js` via `npm run verify:dists`
- CRX packaging: invokes Chrome/Chromium with `--pack-extension` if available
- Fallback archive: emits versioned `.zip` into `public/`
- Outputs are versioned using `manifest.json` in `dists/`

```bash
npm run verify:dists
npm run pack:crx
npm run release
# outputs to public/FRAUDBUSTER_v<version>.crx and .zip
```

### GitHub Release Automation

- Workflow file: `.github/workflows/release-extension.yml`
- Triggers on tags matching `v*.*.*`
- Supports manual release runs through `workflow_dispatch`
- Installs dependencies with `npm ci`
- Builds and verifies the extension with the tagged version
- Uploads `FRAUDBUSTER_v<version>.zip` as a workflow artifact
- Creates or updates a GitHub Release with autogenerated release notes

```bash
git add README.md .github/workflows/release-extension.yml dev/manifest.json dev/background.js .gitignore package-lock.json
git commit -m "feat(release): add GitHub zip release workflow"
git tag v3.1.0
git push origin HEAD
git push origin v3.1.0
```

### Firebase Integration

- Firestore-based model and analytics (optional, can run offline)
- Anonymous-friendly usage patterns; listeners for real-time updates
- Credentials configured in `dev/firebase-config.js` and copied into `dists/` on build

### Testing & Tooling

- `playwright` is available for browser automation and validation workflows
- Local test pages under `site/` support integration and job-posting scenarios

## Model Generation

### Data Sources

- Primary datasets under `datasets/`:
  - `datasets/csv-repo/Fake-Job-Posting-Prediction-master/data/fake_job_postings.csv`
  - Additional CSVs: `datasets/csv-repo/fake_job_postings.csv`, `datasets/csv-repo/job_train.csv`, `datasets/csv-repo/Fake Postings.csv`, `datasets/csv-repo/Fake_Real_Job_Posting.csv`
  - Webpages and word lists for pattern curation: `datasets/webpages/` and `datasets/webpages/sites_wordlist.json`

### Preprocessing & Features

- Text cleanup: HTML stripping, Unicode normalization, case handling, punctuation and whitespace normalization
- Tokenization: unigrams, bigrams, and trigrams with domain-specific stopword filtering
- Feature extraction: TF-IDF, keyword density, and heuristic fraud indicators
- Optional linguistic features: readability-style metrics and additional downstream scoring signals

### Training & Evaluation

- Notebook-driven pipeline in `datasets/csv-repo/Fake-Job-Posting-Prediction-master/Code/model.ipynb` and related EDA notebooks
- Typical classifiers include linear SVM or logistic-style models over TF-IDF vectors
- Validation uses confusion matrix, F1, accuracy, and domain-level calibration

### Serialization & Delivery

- Trained artifacts exported as serializable blobs:
  - `model_data`: serialized estimator
  - `vectorizer_data`: TF-IDF vocabulary and parameters
  - `metadata`: training metrics, dataset hashes, and build timestamp
- Delivery targets:
  - Firestore: `fraudbuster-c59d3/models/nlp_model_v3/{model_data, vectorizer_data, metadata}`
  - Local fallback: embedded patterns or cached blobs for offline operation

### Runtime Consumption

- `dev/firebase-config.js` fetches model and vectorizer, caches results, and listens for updates
- `dev/fraud-detector.js` applies feature-based scoring and combines thresholds with regex patterns and heuristic weights
- False-positive reduction integrates `dev/content-density-analyzer.js` and `dev/page-context-analyzer.js`

### Offline Module

- If present, `nlp_module/` houses Python scripts to automate training, evaluation, and export to Firestore-compatible blobs
- Otherwise, use the notebooks in `datasets/csv-repo/.../Code/` to reproduce results and generate artifacts

### Reproducibility Notes

- Environment: Python 3.x with a standard ML stack such as scikit-learn, pandas, and numpy
- Steps:
  - Load datasets from `datasets/`
  - Run preprocessing and TF-IDF vectorization
  - Train classifier and evaluate
  - Serialize model and vectorizer, then upload to Firestore or save locally for embedding

## Features

- Real-time page scanning with risk scoring
- Fraud pattern detection for salary promises, urgency, upfront payment, and suspicious communications
- Page classification to reduce false positives
- Adaptive thresholds with user feedback integration
- Optional Firebase-backed model updates and analytics

## File Structure

```
dev/
├── manifest.json
├── background.js
├── content.js
├── fraud-detector.js
├── page-context-analyzer.js
├── content-density-analyzer.js
├── dynamic-learning-engine.js
├── firestore-false-positive-integration.js
├── popup.html
├── popup.js
├── popup.css
├── icon16.png
├── icon48.png
└── icon128.png

site/
├── test-integration.html
├── test-job-page.html
└── test-pages/
```

## Usage

- Visit a job posting
- Click the FRAUDBUSTER toolbar icon
- Press "Scan Page" to analyze
- Review the risk level, confidence score, and detected indicators

## Roadmap

- [ ] Expand multi-language pattern support
- [ ] Enhance UI explanations for detections
- [ ] Optional cloud-based model A/B testing

## Contributing

1. Fork the project
2. Create a feature branch (`git checkout -b feature/NewFeature`)
3. Commit changes (`git commit -m 'Add NewFeature'`)
4. Push (`git push origin feature/NewFeature`)
5. Open a Pull Request

## License

This project is open source. See repository for license details.

## Contact

@rjmolina13 - rj.molina13.2@gmail.com

Project Link: https://github.com/rjmolina13/FRAUDBUSTER

## Acknowledgments

- Firebase
- Playwright
- Chrome Extensions (MV3)
- GitHub Actions
