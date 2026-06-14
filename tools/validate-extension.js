#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const jsFiles = [
  'chrome/background.js',
  'chrome/popup.js',
  'firefox/background.js',
  'firefox/popup.js',
  'test.js',
];
const manifestFiles = ['chrome/manifest.json', 'firefox/manifest.json'];

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function readJson(file) {
  try {
    return JSON.parse(read(file));
  } catch (error) {
    fail(`${file}: invalid JSON: ${error.message}`);
    return null;
  }
}

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(`${file}: JavaScript syntax check failed\n${result.stderr || result.stdout}`);
  }
}

const chromeManifest = readJson('chrome/manifest.json');
const firefoxManifest = readJson('firefox/manifest.json');

for (const file of manifestFiles) {
  const manifest = readJson(file);
  if (!manifest) continue;
  const base = path.dirname(file);
  for (const [size, iconPath] of Object.entries(manifest.icons || {})) {
    if (!fs.existsSync(path.join(root, base, iconPath))) {
      fail(`${file}: missing icon ${size}: ${iconPath}`);
    }
  }
}

if (chromeManifest && chromeManifest.manifest_version !== 3) {
  fail('chrome/manifest.json should be Manifest V3');
}
if (firefoxManifest && firefoxManifest.manifest_version !== 2) {
  fail('firefox/manifest.json should be Manifest V2');
}
if (chromeManifest && firefoxManifest && chromeManifest.version !== firefoxManifest.version) {
  fail(`manifest versions differ: Chrome=${chromeManifest.version}, Firefox=${firefoxManifest.version}`);
}

const firefoxPopup = read('firefox/popup.js');
if (firefoxPopup.includes('alert(')) {
  fail('firefox/popup.js should not contain alert() debug popups');
}
if (/browser\.runtime\.sendMessage\([^\n]+,\s*function/.test(firefoxPopup)) {
  fail('firefox/popup.js should use Promise-style browser.runtime.sendMessage');
}

const result = spawnSync(process.execPath, ['test.js'], { cwd: root, encoding: 'utf8' });
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
if (result.status !== 0) {
  fail('test.js failed');
}

if (!process.exitCode) {
  console.log('extension static validation passed');
}
