const fs = require('fs');
const path = require('path');
const vm = require('vm');

function verifyJs(file) {
  const code = fs.readFileSync(file, 'utf8');
  try {
    new vm.Script(code, { filename: file });
    return null;
  } catch (e) {
    return e.message;
  }
}

function main() {
  const root = process.cwd();
  const dir = path.join(root, 'dists');
  if (!fs.existsSync(dir)) {
    console.error('dists not found');
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  let hasError = false;
  for (const f of files) {
    const file = path.join(dir, f);
    const err = verifyJs(file);
    if (err) {
      hasError = true;
      console.error('Syntax error in', f, '\n', err);
    }
  }
  if (!hasError) console.log('All JS files in dists passed syntax check');
  process.exit(hasError ? 1 : 0);
}

main();
