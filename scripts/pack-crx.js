const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function findChrome() {
  const envPath = process.env.CHROME_PATH;
  if (envPath && fs.existsSync(envPath)) return envPath;
  const plat = process.platform;
  let candidates = [];
  if (plat === 'darwin') {
    candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
  } else if (plat === 'win32') {
    candidates = [
      'C\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      'C\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
      process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
      'C\\\\Program Files\\\\Chromium\\\\Application\\\\chrome.exe',
      'C\\\\Program Files (x86)\\\\Chromium\\\\Application\\\\chrome.exe'
    ].filter(Boolean);
  } else {
    candidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    ];
  }
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

function moveIfExists(src, destDir) {
  if (fs.existsSync(src)) {
    const dest = path.join(destDir, path.basename(src));
    fs.renameSync(src, dest);
    return dest;
  }
  return null;
}

function getVersionFromManifest(manifestPath) {
  try {
    const txt = fs.readFileSync(manifestPath, 'utf8');
    const json = JSON.parse(txt);
    return json.version || '0.0.0';
  } catch (e) {
    return '0.0.0';
  }
}

async function pack() {
  const root = process.cwd();
  const srcDir = path.join(root, 'dists');
  const outDir = path.join(root, 'public');
  ensureDir(outDir);
  if (!fs.existsSync(srcDir)) {
    console.error('Missing dists folder. Run build first.');
    process.exit(1);
  }
  const version = getVersionFromManifest(path.join(srcDir, 'manifest.json'));
  const baseName = `FRAUDBUSTER_v${version}`;
  const chrome = findChrome();
  console.log('Detected platform:', process.platform);
  console.log('Source directory:', srcDir);
  console.log('Output directory:', outDir);
  console.log('Manifest version:', version);
  if (!chrome) {
    console.error('Chrome binary not found. Set CHROME_PATH env to the executable or install Chrome/Chromium.');
    const zipName = path.join(outDir, `${baseName}.zip`);
    try { if (fs.existsSync(zipName)) fs.unlinkSync(zipName); } catch (_) {}
    console.log('Creating ZIP archive as fallback');
    await new Promise((resolve, reject) => {
      const p = spawn('zip', ['-r', zipName, '.'], { cwd: srcDir, stdio: 'inherit' });
      p.on('exit', code => (code === 0 ? resolve() : reject(new Error('zip failed ' + code))));
      p.on('error', reject);
    });
    try {
      const files = listFiles(srcDir);
      console.log('ZIP contents count:', files.length);
      console.log('ZIP contents sample:', files.slice(0, 20));
    } catch (_) {}
    console.log('Output written to', outDir);
    return;
  }
  const keyPath = process.env.EXT_KEY ? path.resolve(process.env.EXT_KEY) : null;
  const args = [`--pack-extension=${srcDir}`];
  if (keyPath && fs.existsSync(keyPath)) args.push(`--pack-extension-key=${keyPath}`);
  console.log('Packing CRX with', chrome);
  await new Promise((resolve, reject) => {
    const p = spawn(chrome, args, { stdio: 'inherit' });
    p.on('exit', code => (code === 0 ? resolve() : reject(new Error('Chrome pack failed ' + code))));
    p.on('error', reject);
  });
  const crxCandidates = [path.join(root, 'dists.crx'), path.join(root, 'extension.crx')];
  const pemCandidates = [path.join(root, 'dists.pem'), path.join(root, 'extension.pem')];
  let movedCrx = null;
  for (const c of crxCandidates) { const m = moveIfExists(c, outDir); if (m) { movedCrx = m; break; } }
  let movedPem = null;
  for (const p of pemCandidates) { const m = moveIfExists(p, outDir); if (m) { movedPem = m; } }
  if (!movedCrx) {
    const altCrx = path.join(srcDir, 'dists.crx');
    const altPem = path.join(srcDir, 'dists.pem');
    movedCrx = moveIfExists(altCrx, outDir) || movedCrx;
    movedPem = moveIfExists(altPem, outDir) || movedPem;
  }
  // Rename outputs to versioned names
  try {
    if (movedCrx && fs.existsSync(movedCrx)) {
      const targetCrx = path.join(outDir, `${baseName}.crx`);
      if (fs.existsSync(targetCrx)) fs.unlinkSync(targetCrx);
      fs.renameSync(movedCrx, targetCrx);
      movedCrx = targetCrx;
      console.log('CRX output:', movedCrx);
    }
    if (movedPem && fs.existsSync(movedPem)) {
      const targetPem = path.join(outDir, `${baseName}.pem`);
      if (fs.existsSync(targetPem)) fs.unlinkSync(targetPem);
      fs.renameSync(movedPem, targetPem);
      movedPem = targetPem;
      console.log('PEM output:', movedPem);
    }
  } catch (e) {
    console.warn('Renaming versioned outputs failed:', e.message);
  }
  const hasCrx = fs.readdirSync(outDir).some(f => f.endsWith('.crx'));
  const zipName = path.join(outDir, `${baseName}.zip`);
  try { if (fs.existsSync(zipName)) fs.unlinkSync(zipName); } catch (_) {}
  await new Promise((resolve, reject) => {
    const p = spawn('zip', ['-r', zipName, '.'], { cwd: srcDir, stdio: 'inherit' });
    p.on('exit', code => (code === 0 ? resolve() : reject(new Error('zip failed ' + code))));
    p.on('error', reject);
  });
  try {
    const files = listFiles(srcDir);
    console.log('ZIP contents count:', files.length);
    console.log('ZIP contents sample:', files.slice(0, 20));
  } catch (_) {}
  console.log('Output written to', outDir);
}

function listFiles(dir) {
  const out = [];
  function walk(d, base) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(d, e.name);
      const rel = path.join(base, e.name);
      if (e.isDirectory()) walk(p, rel);
      else out.push(rel);
    }
  }
  walk(dir, '.');
  return out;
}

pack().catch(err => {
  console.error(err.message || String(err));
  process.exit(1);
});
