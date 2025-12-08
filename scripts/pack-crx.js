const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ];
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

async function pack() {
  const root = process.cwd();
  const srcDir = path.join(root, 'dists');
  const outDir = path.join(root, 'public');
  ensureDir(outDir);
  if (!fs.existsSync(srcDir)) {
    console.error('Missing dists folder. Run build first.');
    process.exit(1);
  }
  const chrome = findChrome();
  if (!chrome) {
    console.error('Chrome binary not found on this system.');
    process.exit(1);
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
  for (const p of pemCandidates) moveIfExists(p, outDir);
  if (!movedCrx) {
    const altCrx = path.join(srcDir, 'dists.crx');
    const altPem = path.join(srcDir, 'dists.pem');
    moveIfExists(altCrx, outDir);
    moveIfExists(altPem, outDir);
  }
  const hasCrx = fs.readdirSync(outDir).some(f => f.endsWith('.crx'));
  if (!hasCrx) {
    const zipName = path.join(outDir, 'extension.zip');
    console.log('No CRX produced, creating ZIP as fallback');
    await new Promise((resolve, reject) => {
      const p = spawn('zip', ['-r', zipName, '.'], { cwd: srcDir, stdio: 'inherit' });
      p.on('exit', code => (code === 0 ? resolve() : reject(new Error('zip failed ' + code))));
      p.on('error', reject);
    });
  }
  console.log('Output written to', outDir);
}

pack().catch(err => {
  console.error(err.message || String(err));
  process.exit(1);
});
