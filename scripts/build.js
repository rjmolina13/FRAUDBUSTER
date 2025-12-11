const esbuild = require('esbuild');
const fs = require('fs-extra');
const { glob } = require('glob');
const { minify } = require('html-minifier-terser');
const path = require('path');
const readline = require('readline');

const SRC_DIR = path.join(process.cwd(), 'dev');
const OUT_DIR = path.join(process.cwd(), 'dists');

async function build() {
  await fs.emptyDir(OUT_DIR);
  const assets = ['manifest.json', 'icon16.png', 'icon48.png', 'icon128.png', 'lib'];
  for (const a of assets) {
    const sp = path.join(SRC_DIR, a);
    if (await fs.pathExists(sp)) {
      const dp = path.join(OUT_DIR, a);
      if (a === 'manifest.json') {
        try {
          const txt = await fs.readFile(sp, 'utf8');
          let json = JSON.parse(txt);
          const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
          const forceVersion = process.env.BUILD_VERSION;
          const skipPrompt = process.env.BUILD_NONINTERACTIVE === '1';
          if (forceVersion && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(forceVersion)) {
            json.version = forceVersion;
            await fs.outputFile(sp, JSON.stringify(json, null, 2));
            console.log('Using version from BUILD_VERSION', forceVersion);
          } else if (!skipPrompt && isInteractive) {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const ask = q => new Promise(res => rl.question(q, ans => res(ans)));
            try {
              const ans = (await ask(`Current version is ${json.version || 'unknown'}. Change version? (y/N): `)).trim().toLowerCase();
              if (ans === 'y' || ans === 'yes') {
                const newVer = (await ask('Enter new version: ')).trim();
                if (newVer && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(newVer)) {
                  json.version = newVer;
                  await fs.outputFile(sp, JSON.stringify(json, null, 2));
                  console.log('Updated dev manifest version to', newVer);
                } else {
                  console.log('Invalid version, keeping', json.version || 'unknown');
                }
              }
            } finally {
              rl.close();
            }
          }
          const baseName = typeof json.name === 'string' ? json.name.replace(/\s*\(dev\)\s*$/i, '') : 'FraudBuster';
          json.name = baseName || 'FraudBuster';
          await fs.outputFile(dp, JSON.stringify(json, null, 2));
        } catch (_) {
          await fs.copy(sp, dp);
        }
      } else {
        await fs.copy(sp, dp);
      }
    }
  }
  const jsFilesAll = await glob(path.join(SRC_DIR, '*.js'));
  const jsFiles = jsFilesAll.filter(f => path.basename(f) !== 'background.js');
  if (jsFiles.length) {
    await esbuild.build({
      entryPoints: jsFiles,
      outdir: OUT_DIR,
      minify: true,
      bundle: false,
      target: ['chrome100'],
      allowOverwrite: true
    });
  }
  const bgSrc = path.join(SRC_DIR, 'background.js');
  if (await fs.pathExists(bgSrc)) {
    await esbuild.build({
      entryPoints: [bgSrc],
      outfile: path.join(OUT_DIR, 'background.js'),
      bundle: false,
      minify: false,
      minifyWhitespace: true,
      minifySyntax: true,
      minifyIdentifiers: false,
      legalComments: 'none',
      allowOverwrite: true
    });
  }
  const popupSrc = path.join(SRC_DIR, 'popup.js');
  if (await fs.pathExists(popupSrc)) {
    const src = await fs.readFile(popupSrc, 'utf8');
    const stripped = src
      .replace(/async\s+function\s+fbLoadingStart\s*\([\s\S]*?\}\s*/g, '')
      .replace(/function\s+fbLoadingResume\s*\([\s\S]*?\}\s*/g, '')
      .replace(/function\s+fbLoadingSet\s*\([\s\S]*?\}\s*/g, '')
      .replace(/window\.fbLoadingStart\s*=\s*fbLoadingStart\s*;\s*/g, '')
      .replace(/window\.fbLoadingResume\s*=\s*fbLoadingResume\s*;\s*/g, '')
      .replace(/window\.fbLoadingSet\s*=\s*fbLoadingSet\s*;\s*/g, '');
    const result = await esbuild.transform(stripped, { minify: true, target: 'chrome100' });
    await fs.outputFile(path.join(OUT_DIR, 'popup.js'), result.code);
  }
  const cssFiles = await glob(path.join(SRC_DIR, '*.css'));
  if (cssFiles.length) {
    await esbuild.build({
      entryPoints: cssFiles,
      outdir: OUT_DIR,
      minify: true,
      bundle: false,
      allowOverwrite: true
    });
  }
  const htmlFiles = await glob(path.join(SRC_DIR, '*.html'));
  for (const file of htmlFiles) {
    const html = await fs.readFile(file, 'utf8');
    const minifiedHtml = await minify(html, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true
    });
    await fs.outputFile(path.join(OUT_DIR, path.basename(file)), minifiedHtml);
  }
  console.log('Dists built to', OUT_DIR);
}

build().catch(err => {
  console.error('Build failed', err);
  process.exit(1);
});
