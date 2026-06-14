#!/usr/bin/env node
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright-core');

const root = path.resolve(__dirname, '..');
const extDir = path.join(root, 'chrome');
const artifactDir = path.resolve(process.env.ARTIFACT_DIR || path.join(root, 'playwright-artifacts'));

function chromeBinary() {
  const candidates = [process.env.CHROMIUM, process.env.CHROME, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'].filter(Boolean);
  for (const name of candidates) {
    if (fs.existsSync(name)) return name;
    const res = spawnSync('sh', ['-lc', `command -v ${name}`], { encoding: 'utf8' });
    if (res.status === 0 && res.stdout.trim()) return res.stdout.trim();
  }
  return '';
}

function startServer() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><title>Duplicate Test Page</title><h1>Duplicate Test Page</h1><p>${req.url}</p>`);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function extensionId(context) {
  let workers = context.serviceWorkers();
  if (!workers.length) {
    const worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
    workers = [worker];
  }
  const workerUrl = workers[0].url();
  const match = workerUrl.match(/^chrome-extension:\/\/([^/]+)\//);
  if (!match) throw new Error(`cannot parse extension id from ${workerUrl}`);
  return match[1];
}

async function main() {
  fs.mkdirSync(artifactDir, { recursive: true });
  const executablePath = chromeBinary();
  if (!executablePath) throw new Error('Chromium/Chrome binary not found');

  const server = await startServer();
  const port = server.address().port;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tab-dedup-interaction-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless: false,
    viewport: { width: 900, height: 700 },
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--disable-extensions-except=${extDir}`,
      `--load-extension=${extDir}`,
    ],
  });

  try {
    const url = `http://127.0.0.1:${port}/same-page?case=duplicate`;
    const p1 = await context.newPage();
    await p1.goto(url);
    const p2 = await context.newPage();
    await p2.goto(url);
    const p3 = await context.newPage();
    await p3.goto(`http://127.0.0.1:${port}/unique-page`);

    const id = await extensionId(context);
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForSelector('.tab-group', { timeout: 10000 });
    await popup.waitForSelector('.badge-red', { timeout: 10000 });

    const badge = await popup.locator('.badge-red').innerText();
    if (!/重复/.test(badge)) throw new Error(`expected duplicate badge, got: ${badge}`);
    const groupCount = await popup.locator('.tab-group:not(.single)').count();
    if (groupCount < 1) throw new Error('expected at least one duplicate group');

    await popup.screenshot({ path: path.join(artifactDir, 'tab-dedup-popup-duplicates.png'), fullPage: true });

    await popup.locator('.close-group-btn').first().click();
    await popup.waitForTimeout(800);
    const pages = context.pages().filter((p) => !p.url().startsWith('chrome-extension://'));
    if (pages.length > 3) throw new Error(`expected duplicate close to reduce tabs, pages=${pages.length}`);
    await popup.screenshot({ path: path.join(artifactDir, 'tab-dedup-popup-after-close.png'), fullPage: true });

    console.log('interaction smoke passed: duplicate group rendered and close action executed');
  } finally {
    await context.close().catch(() => {});
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
