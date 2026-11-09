#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const OUT = path.join('/opt/cursor/artifacts');
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));

  await page.goto('http://127.0.0.1:5173/?t=' + Date.now(), { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => {
    const status = document.getElementById('syntaxStatus');
    const empty = document.getElementById('previewEmpty');
    const svg = document.querySelector('#previewInner svg');
    return status && svg && empty && empty.hidden === true;
  }, { timeout: 30000 });

  await page.screenshot({ path: path.join(OUT, 'studio_flowchart_preview.png'), fullPage: true });

  await page.select('#exampleSelect', 'sequence');
  await page.waitForFunction(() => {
    const code = document.getElementById('codeInput').value;
    const svg = document.querySelector('#previewInner svg');
    return code.includes('sequenceDiagram') && svg;
  }, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: path.join(OUT, 'studio_sequence_preview.png'), fullPage: true });

  await page.select('#themeSelect', 'dark');
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: path.join(OUT, 'studio_dark_theme.png'), fullPage: true });

  const exportResult = await page.evaluate(async () => {
    const btn = document.getElementById('btnExportSide');
    btn.click();
    await new Promise((r) => setTimeout(r, 8000));
    const toast = document.getElementById('globalToast');
    return {
      toastHidden: toast.hidden,
      toastText: toast.textContent,
      toastClass: toast.className,
    };
  });

  await page.screenshot({ path: path.join(OUT, 'studio_export_toast.png'), fullPage: true });

  const emptyHidden = await page.$eval('#previewEmpty', (el) => el.hidden && el.classList.contains('is-hidden'));
  const hasSvg = await page.$eval('#previewInner', (el) => !!el.querySelector('svg'));

  console.log(JSON.stringify({
    ok: emptyHidden && hasSvg && !exportResult.toastHidden && /成功|导出/.test(exportResult.toastText),
    emptyHidden,
    hasSvg,
    exportResult,
    pageErrors: errors,
  }, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
