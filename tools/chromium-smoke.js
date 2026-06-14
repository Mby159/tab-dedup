#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const extDir = path.join(root, 'chrome');

function chromeBinary() {
  if (process.env.CHROMIUM && fs.existsSync(process.env.CHROMIUM)) return process.env.CHROMIUM;
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome']) {
    const res = spawnSync('sh', ['-lc', `command -v ${name}`], { encoding: 'utf8' });
    if (res.status === 0 && res.stdout.trim()) return res.stdout.trim();
  }
  return '';
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.setTimeout(1000, () => req.destroy(new Error('timeout')));
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const browser = chromeBinary();
  if (!browser) {
    console.error('No Chromium/Chrome binary found. Set CHROMIUM=/path/to/browser.');
    process.exit(2);
  }

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tab-dedup-chrome-profile-'));
  const port = 9222 + Math.floor(Math.random() * 1000);
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-default-apps',
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${port}`,
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    'about:blank',
  ];

  const child = spawn(browser, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  const timeout = setTimeout(() => {
    child.kill('SIGKILL');
  }, 30000);

  try {
    let version = null;
    for (let i = 0; i < 30; i += 1) {
      if (child.exitCode !== null) break;
      try {
        version = await getJson(`http://127.0.0.1:${port}/json/version`);
        break;
      } catch (_) {
        await wait(500);
      }
    }
    if (!version || !version.Browser) {
      throw new Error('Chromium DevTools endpoint did not become available');
    }
    await getJson(`http://127.0.0.1:${port}/json/list`).catch(() => []);
    child.kill('SIGTERM');
    await wait(500);
    if (child.exitCode === null) child.kill('SIGKILL');
    clearTimeout(timeout);

    const combined = `${stdout}\n${stderr}`;
    if (/Failed to load extension|Manifest is not valid|Extension error/i.test(combined)) {
      console.error(combined);
      throw new Error('Chromium reported extension load errors');
    }
    console.log(`chromium extension load smoke passed: ${version.Browser}`);
  } catch (error) {
    child.kill('SIGKILL');
    clearTimeout(timeout);
    console.error(stderr || stdout);
    console.error(`Chromium smoke failed: ${error.message}`);
    process.exit(1);
  }
}

main();
