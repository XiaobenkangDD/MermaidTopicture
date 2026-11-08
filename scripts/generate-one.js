#!/usr/bin/env node
/**
 * 单文件导出封装：统一走本地 mmdc + 项目配置
 *
 * 用法:
 *   node scripts/generate-one.js <input.mmd> <output> [--theme default] [--bg transparent] [--size 2048] [--scale 2]
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

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

function parseArgs(argv) {
  const positional = [];
  const options = {
    theme: 'default',
    background: 'transparent',
    size: 2048,
    scale: 2,
    config: path.join(ROOT, 'config.json'),
    puppeteer: path.join(ROOT, 'puppeteer-config.json'),
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--theme') options.theme = argv[++i];
    else if (arg === '--bg') options.background = argv[++i];
    else if (arg === '--size' || arg === '--width') options.size = Number(argv[++i]);
    else if (arg === '--scale') options.scale = Number(argv[++i]);
    else if (arg === '--config') options.config = path.resolve(argv[++i]);
    else if (arg === '--puppeteer') options.puppeteer = path.resolve(argv[++i]);
    else if (arg.startsWith('-')) {
      throw new Error(`未知参数: ${arg}`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length < 2) {
    throw new Error('用法: node scripts/generate-one.js <input.mmd> <output> [选项]');
  }

  return {
    input: path.resolve(positional[0]),
    output: path.resolve(positional[1]),
    ...options,
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const ext = path.extname(opts.output).toLowerCase().replace('.', '');
  const outDir = path.dirname(opts.output);

  if (!fs.existsSync(opts.input)) {
    throw new Error(`输入文件不存在: ${opts.input}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const mmdc = resolveMmdc();
  const args = [
    ...mmdc.prefixArgs,
    '-i',
    opts.input,
    '-o',
    opts.output,
    '-t',
    opts.theme,
    '-b',
    opts.background,
  ];

  if (opts.size) {
    args.push('--size', String(opts.size));
  }

  if ((ext === 'png' || ext === 'pdf') && opts.scale) {
    args.push('-s', String(opts.scale));
  }

  if (fs.existsSync(opts.config)) {
    args.push('-c', opts.config);
  }
  if (fs.existsSync(opts.puppeteer)) {
    args.push('-p', opts.puppeteer);
  }

  const result = spawnSync(mmdc.command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }

  console.log(`✅ 已生成: ${opts.output}`);
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
