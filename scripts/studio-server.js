#!/usr/bin/env node
/**
 * Mermaid Studio 本地服务
 * - 静态页面：实时预览 / 主题切换 / 示例加载
 * - API：示例列表、高清导出（走本地 mermaid-cli）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const WEB_DIR = path.join(ROOT, 'web');
const EXAMPLES_DIR = path.join(ROOT, 'examples');
const OUTPUT_DIR = path.join(ROOT, 'output');
const CONFIG_FILE = path.join(ROOT, 'config.json');
const PUPPETEER_FILE = path.join(ROOT, 'puppeteer-config.json');
const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.ico': 'image/x-icon',
  '.mmd': 'text/plain; charset=utf-8',
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 2 * 1024 * 1024) {
        reject(new Error('请求体过大（上限 2MB）'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function resolveMmdc() {
  const localBin = path.join(
    ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'mmdc.cmd' : 'mmdc'
  );
  if (fs.existsSync(localBin)) {
    return { command: localBin, prefixArgs: [] };
  }
  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    prefixArgs: ['--yes', '@mermaid-js/mermaid-cli'],
  };
}

function listExamples() {
  if (!fs.existsSync(EXAMPLES_DIR)) return [];
  return fs
    .readdirSync(EXAMPLES_DIR)
    .filter((name) => name.toLowerCase().endsWith('.mmd'))
    .sort()
    .map((name) => ({
      id: name.replace(/\.mmd$/i, ''),
      name,
      label: name.replace(/\.mmd$/i, ''),
    }));
}

function safeExampleName(name) {
  const base = path.basename(String(name || ''));
  if (!/^[a-zA-Z0-9._-]+$/.test(base)) {
    throw new Error('非法示例文件名');
  }
  return base.endsWith('.mmd') ? base : `${base}.mmd`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function runMmdc(args) {
  const mmdc = resolveMmdc();
  return new Promise((resolve, reject) => {
    const child = spawn(mmdc.command, [...mmdc.prefixArgs, ...args], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error((stderr || stdout || `mmdc exit ${code}`).trim()));
    });
  });
}

async function exportDiagram(options) {
  const {
    code,
    format = 'svg',
    theme = 'default',
    background = 'transparent',
    size = 2048,
    scale = 2,
    filename = 'diagram',
  } = options;

  const allowed = new Set(['svg', 'png', 'pdf']);
  if (!allowed.has(format)) {
    throw new Error(`不支持的格式: ${format}`);
  }

  const safeName = String(filename || 'diagram')
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, '_')
    .slice(0, 64) || 'diagram';

  ensureDir(OUTPUT_DIR);
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mermaid-studio-'));
  const inputPath = path.join(tempDir, `${safeName}.mmd`);
  const outputName = `${safeName}-${Date.now()}.${format}`;
  const outputPath = path.join(OUTPUT_DIR, outputName);

  fs.writeFileSync(inputPath, code, 'utf8');

  const args = [
    '-i',
    inputPath,
    '-o',
    outputPath,
    '-t',
    theme,
    '-b',
    background,
    '--size',
    String(size || 2048),
  ];

  if ((format === 'png' || format === 'pdf') && scale) {
    args.push('-s', String(scale));
  }
  if (fs.existsSync(CONFIG_FILE)) {
    args.push('-c', CONFIG_FILE);
  }
  if (fs.existsSync(PUPPETEER_FILE)) {
    args.push('-p', PUPPETEER_FILE);
  }

  try {
    await runMmdc(args);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  const buffer = fs.readFileSync(outputPath);
  return {
    filename: outputName,
    path: path.relative(ROOT, outputPath),
    mime: MIME[`.${format}`] || 'application/octet-stream',
    size: buffer.length,
    base64: buffer.toString('base64'),
  };
}

function serveStatic(req, res, urlPath) {
  let relative = decodeURIComponent(urlPath.split('?')[0]);
  if (relative === '/' || relative === '') relative = '/index.html';
  const filePath = path.normalize(path.join(WEB_DIR, relative));

  if (!filePath.startsWith(WEB_DIR)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, 'Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
  });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      version: '1.2.0',
      examples: listExamples().length,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/examples') {
    sendJson(res, 200, { examples: listExamples() });
    return;
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/examples/')) {
    const id = decodeURIComponent(url.pathname.replace('/api/examples/', ''));
    const fileName = safeExampleName(id);
    const filePath = path.join(EXAMPLES_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: '示例不存在' });
      return;
    }
    sendJson(res, 200, {
      id: fileName.replace(/\.mmd$/i, ''),
      name: fileName,
      code: fs.readFileSync(filePath, 'utf8'),
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/config') {
    const config = fs.existsSync(CONFIG_FILE)
      ? JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
      : {};
    sendJson(res, 200, { config });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/export') {
    const raw = await readBody(req);
    let payload;
    try {
      payload = JSON.parse(raw || '{}');
    } catch {
      sendJson(res, 400, { error: 'JSON 无效' });
      return;
    }

    if (!payload.code || !String(payload.code).trim()) {
      sendJson(res, 400, { error: '请先输入 Mermaid 代码' });
      return;
    }

    try {
      const result = await exportDiagram(payload);
      sendJson(res, 200, {
        ok: true,
        ...result,
        requestId: randomUUID(),
      });
    } catch (error) {
      sendJson(res, 500, { error: error.message || '导出失败' });
    }
    return;
  }

  sendJson(res, 404, { error: 'API 不存在' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);

    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    serveStatic(req, res, url.pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message || '服务器错误' });
  }
});

server.listen(PORT, HOST, () => {
  const address = `http://${HOST}:${PORT}`;
  console.log('\n🎨 Mermaid Studio 已启动');
  console.log(`   打开浏览器: ${address}`);
  console.log('   Ctrl+C 退出\n');
});
