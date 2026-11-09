#!/usr/bin/env node
/**
 * 本地 mmdc 调用的共用约束：
 * - 始终用 argv 启动 Node，不经过 shell
 * - 主题以调用方传入为准，避免 config.json 里的 theme 覆盖 -t
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const THEMES = new Set(['default', 'forest', 'dark', 'neutral', 'base']);

function assertTheme(theme) {
  const value = String(theme || 'default');
  if (!THEMES.has(value)) {
    throw new Error(`不支持的主题: ${value}（可选 default、forest、dark、neutral、base）`);
  }
  return value;
}

function resolveMmdc() {
  const cli = path.join(ROOT, 'node_modules', '@mermaid-js', 'mermaid-cli', 'src', 'cli.js');
  if (fs.existsSync(cli)) {
    return { command: process.execPath, prefixArgs: [cli] };
  }

  throw new Error('未找到本地 mermaid-cli，请先在项目根目录执行 npm install');
}

/**
 * mermaid-cli 会用配置文件 Object.assign 覆盖 -t。
 * 写出一份临时配置，把 theme 改成本次指定的主题。
 */
function configWithTheme(configFile, theme) {
  if (!configFile || !fs.existsSync(configFile)) {
    return null;
  }

  const parsed = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`配置文件不是 JSON 对象: ${configFile}`);
  }

  parsed.theme = assertTheme(theme);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmdc-config-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(parsed));

  return {
    file,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

function runMmdc(args, { inherit = false } = {}) {
  const mmdc = resolveMmdc();
  const fullArgs = [...mmdc.prefixArgs, ...args];
  const spawnOptions = {
    cwd: ROOT,
    env: process.env,
    shell: false,
  };

  if (inherit) {
    return spawnSync(mmdc.command, fullArgs, {
      ...spawnOptions,
      stdio: 'inherit',
    });
  }

  return new Promise((resolve, reject) => {
    const child = spawn(mmdc.command, fullArgs, {
      ...spawnOptions,
      stdio: ['ignore', 'pipe', 'pipe'],
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

module.exports = {
  ROOT,
  THEMES,
  assertTheme,
  resolveMmdc,
  configWithTheme,
  runMmdc,
};
