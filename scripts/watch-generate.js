#!/usr/bin/env node
/**
 * 监听 examples 目录变化并自动批量导出
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INPUT_DIR = path.join(ROOT, 'examples');
const DEBOUNCE_MS = 400;

let timer = null;
let running = false;
let pending = false;

function runBatch() {
  if (running) {
    pending = true;
    return;
  }

  running = true;
  console.log(`\n🔄 检测到变更，开始重新生成... (${new Date().toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai' })} Asia/Shanghai)`);

  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'batch-generate.js')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('close', (code) => {
    running = false;
    if (code === 0) {
      console.log('✅ 监听导出完成');
    } else {
      console.error(`⚠️  导出退出码: ${code}`);
    }

    if (pending) {
      pending = false;
      runBatch();
    }
  });
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(runBatch, DEBOUNCE_MS);
}

if (!fs.existsSync(INPUT_DIR)) {
  console.error(`❌ 输入目录不存在: ${INPUT_DIR}`);
  process.exit(1);
}

console.log(`👀 正在监听: ${INPUT_DIR}`);
console.log('   修改 .mmd 文件后会自动批量导出；Ctrl+C 退出\n');

fs.watch(INPUT_DIR, { persistent: true }, (eventType, filename) => {
  if (!filename || !filename.toLowerCase().endsWith('.mmd')) {
    return;
  }
  console.log(`📝 ${eventType}: ${filename}`);
  schedule();
});

// 启动时先跑一次
runBatch();
