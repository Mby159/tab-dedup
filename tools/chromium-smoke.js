#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const extDir = path.join(root, 'chrome');

function chromeBinary() {
  if (process.env.CHROMIUM && fs.existsSync(process.env.CHROMIUM)) return process.env.CHROMIUM;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    const res = spawnSync('sh', ['-lc', `command -v ${name}`], { encoding: 'utf8' });
    if (res.status === 0 && res.stdout.trim()) return res.stdout.trim();
  }
  return '';
}

const browser = chromeBinary();
if (!browser) {
  console.error('No Chromium/Chrome binary found. Set CHROMIUM=/path/to/browser.');
  process.exit(2);
}

const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tab-dedup-chrome-profile-'));
const smokeHtml = path.join(profileDir, 'smoke.html');
fs.writeFileSync(smokeHtml, '<!doctype html><title>tab dedup smoke</title><h1>tab dedup smoke</h1>');

const args = [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  `--user-data-dir=${profileDir}`,
  `--disable-extensions-except=${extDir}`,
  `--load-extension=${extDir}`,
  '--dump-dom',
  `file://${smokeHtml}`,
];

const res = spawnSync(browser, args, { encoding: 'utf8' });
process.stdout.write(res.stdout || '');
process.stderr.write(res.stderr || '');

if (res.status !== 0) {
  console.error(`Chromium smoke failed with exit code ${res.status}`);
  process.exit(res.status || 1);
}
if (!String(res.stdout || '').includes('tab dedup smoke')) {
  console.error('Chromium smoke did not render smoke page.');
  process.exit(1);
}
console.log('chromium extension load smoke passed');
