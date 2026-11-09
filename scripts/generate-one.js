#!/usr/bin/env node
/**
 * 单文件导出封装：统一走本地 mmdc + 项目配置
 *
 * 用法:
 *   node scripts/generate-one.js <input.mmd> <output> [--theme default] [--bg transparent] [--size 2048] [--scale 2]
 */

const fs = require('fs');
const path = require('path');
const { ROOT, assertTheme, configWithTheme, runMmdc } = require('./mmdc-util');

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

  opts.theme = assertTheme(opts.theme);
  const preparedConfig = configWithTheme(opts.config, opts.theme);
  const args = [
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

  if (preparedConfig) {
    args.push('-c', preparedConfig.file);
  }
  if (fs.existsSync(opts.puppeteer)) {
    args.push('-p', opts.puppeteer);
  }

  try {
    const result = runMmdc(args, { inherit: true });
    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
  } finally {
    if (preparedConfig) preparedConfig.cleanup();
  }

  console.log(`✅ 已生成: ${opts.output}`);
}

try {
  main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}
