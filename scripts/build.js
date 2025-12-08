const fs = require('fs');
const path = require('path');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_) { return ''; }
}

function writeFileSafe(p, data) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, data);
}

function stripHtmlComments(s) {
  return s.replace(/<!--([\s\S]*?)-->/g, '');
}

function stripBlockComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripCommentsJs(input) {
  let out = '';
  let i = 0;
  const len = input.length;
  let inSingle = false, inDouble = false, inTemplate = false;
  let inLine = false, inBlock = false;
  while (i < len) {
    const ch = input[i];
    const next = i + 1 < len ? input[i + 1] : '';
    if (inLine) {
      if (ch === '\n' || ch === '\r') {
        inLine = false;
        out += ch;
      }
      i++;
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    if (inSingle) {
      out += ch;
      if (ch === '\\') {
        if (i + 1 < len) { out += input[i + 1]; i += 2; continue; }
      } else if (ch === '\'') {
        inSingle = false;
      }
      i++;
      continue;
    }
    if (inDouble) {
      out += ch;
      if (ch === '\\') {
        if (i + 1 < len) { out += input[i + 1]; i += 2; continue; }
      } else if (ch === '"') {
        inDouble = false;
      }
      i++;
      continue;
    }
    if (inTemplate) {
      out += ch;
      if (ch === '`') {
        inTemplate = false;
      } else if (ch === '\\') {
        if (i + 1 < len) { out += input[i + 1]; i += 2; continue; }
      }
      i++;
      continue;
    }
    // Not in string/comment
    if (ch === '\'') { inSingle = true; out += ch; i++; continue; }
    if (ch === '"') { inDouble = true; out += ch; i++; continue; }
    if (ch === '`') { inTemplate = true; out += ch; i++; continue; }
    if (ch === '/' && next === '/') { inLine = true; i += 2; continue; }
    if (ch === '/' && next === '*') { inBlock = true; i += 2; continue; }
    out += ch;
    i++;
  }
  return out;
}

function processContent(content, ext) {
  if (ext === '.html') return stripHtmlComments(content);
  if (ext === '.css') return stripBlockComments(content);
  if (ext === '.js') return stripCommentsJs(stripBlockComments(content));
  if (ext === '.json') return content;
  return content;
}

function copyDirStripComments(srcDir, outDir) {
  ensureDir(outDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  entries.forEach(e => {
    const srcPath = path.join(srcDir, e.name);
    const outPath = path.join(outDir, e.name);
    if (e.isDirectory()) {
      copyDirStripComments(srcPath, outPath);
    } else {
      const ext = path.extname(e.name).toLowerCase();
      const content = readFileSafe(srcPath);
      if (content !== '') {
        const processed = processContent(content, ext);
        writeFileSafe(outPath, processed);
      } else {
        fs.copyFileSync(srcPath, outPath);
      }
    }
  });
}

function main() {
  const root = process.cwd();
  const src = path.join(root, 'dev');
  const out = path.join(root, 'dists');
  ensureDir(out);
  copyDirStripComments(src, out);
  console.log('Dists built to', out);
}

main();
