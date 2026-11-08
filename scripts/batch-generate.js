#!/usr/bin/env node
/**
 * Mermaid 批量高清导出脚本
 * - 优先使用本地 node_modules/.bin/mmdc
 * - 支持 CLI 参数与并行渲染
 * - 自动加载 config.json / puppeteer-config.json
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DEFAULTS = {
  inputDir: path.join(ROOT, 'examples'),
  outputDir: path.join(ROOT, 'output'),
  formats: ['svg', 'png'],
  theme: 'default',
  backgroundColor: 'transparent',
  size: 2048,
  scale: 2,
  concurrency: Math.max(1, Math.min(4, os.cpus().length || 2)),
  configFile: path.join(ROOT, 'config.json'),
  puppeteerConfigFile: path.join(ROOT, 'puppeteer-config.json'),
  quiet: false,
};

function printHelp() {
  console.log(`
Mermaid 批量高清导出

用法:
  node scripts/batch-generate.js [选项]

选项:
  -i, --input <dir>           输入目录 (默认: ./examples)
  -o, --output <dir>          输出目录 (默认: ./output)
  -f, --formats <list>        格式，逗号分隔: svg,png,pdf (默认: svg,png)
  -t, --theme <name>          主题: default|forest|dark|neutral|base
  -b, --background <color>    背景色 (默认: transparent)
  --size <px>                 PNG/PDF 最大边长 (默认: 2048，mermaid-cli v12+)
  -s, --scale <n>             Puppeteer 缩放倍率 (默认: 2)
  -c, --config <file>         Mermaid 配置文件
  -p, --puppeteer <file>      Puppeteer 配置文件
  -j, --concurrency <n>       并行任务数 (默认: ${DEFAULTS.concurrency})
  -q, --quiet                 精简日志
  -h, --help                  显示帮助
`);
}

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  const args = [...argv];

  while (args.length > 0) {
    const arg = args.shift();

    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-i':
      case '--input':
        options.inputDir = path.resolve(args.shift());
        break;
      case '-o':
      case '--output':
        options.outputDir = path.resolve(args.shift());
        break;
      case '-f':
      case '--formats':
        options.formats = String(args.shift())
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
        break;
      case '-t':
      case '--theme':
        options.theme = args.shift();
        break;
      case '-b':
      case '--background':
        options.backgroundColor = args.shift();
        break;
      case '-w':
      case '--width':
      case '--size':
        // mermaid-cli v12 使用 --size；保留 -w/--width 作为兼容别名
        options.size = Number(args.shift());
        break;
      case '-s':
      case '--scale':
        options.scale = Number(args.shift());
        break;
      case '-c':
      case '--config':
        options.configFile = path.resolve(args.shift());
        break;
      case '-p':
      case '--puppeteer':
        options.puppeteerConfigFile = path.resolve(args.shift());
        break;
      case '-j':
      case '--concurrency':
        options.concurrency = Math.max(1, Number(args.shift()) || 1);
        break;
      case '-q':
      case '--quiet':
        options.quiet = true;
        break;
      default:
        throw new Error(`未知参数: ${arg}\n使用 --help 查看用法`);
    }
  }

  return options;
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

  // 回退到 npx，避免强制要求全局安装
  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    prefixArgs: ['--yes', '@mermaid-js/mermaid-cli'],
  };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function listMmdFiles(inputDir) {
  if (!fs.existsSync(inputDir)) {
    throw new Error(`输入目录不存在: ${inputDir}`);
  }

  return fs
    .readdirSync(inputDir)
    .filter((file) => file.toLowerCase().endsWith('.mmd'))
    .sort()
    .map((file) => path.join(inputDir, file));
}

function buildCommandArgs(mmdc, options, inputPath, outputPath, format) {
  const args = [
    ...mmdc.prefixArgs,
    '-i',
    inputPath,
    '-o',
    outputPath,
    '-t',
    options.theme,
    '-b',
    options.backgroundColor,
  ];

  if (format === 'png' || format === 'pdf' || format === 'svg') {
    if (Number.isFinite(options.size) && options.size > 0) {
      args.push('--size', String(options.size));
    }
  }

  if ((format === 'png' || format === 'pdf') && Number.isFinite(options.scale) && options.scale > 0) {
    args.push('-s', String(options.scale));
  }

  if (options.configFile && fs.existsSync(options.configFile)) {
    args.push('-c', options.configFile);
  }

  if (options.puppeteerConfigFile && fs.existsSync(options.puppeteerConfigFile)) {
    args.push('-p', options.puppeteerConfigFile);
  }

  return args;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
      shell: process.platform === 'win32',
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

      const detail = (stderr || stdout || `exit code ${code}`).trim();
      reject(new Error(detail));
    });
  });
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runNext() {
    const current = nextIndex;
    nextIndex += 1;
    if (current >= items.length) {
      return;
    }

    results[current] = await worker(items[current], current);
    await runNext();
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => runNext());
  await Promise.all(runners);
  return results;
}

function createJobs(files, options) {
  const jobs = [];

  for (const inputPath of files) {
    const baseName = path.basename(inputPath, path.extname(inputPath));
    for (const format of options.formats) {
      jobs.push({
        inputPath,
        format,
        outputPath: path.join(options.outputDir, `${baseName}.${format}`),
        label: `${baseName}.${format}`,
      });
    }
  }

  return jobs;
}

async function main() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  if (options.help) {
    printHelp();
    return;
  }

  const allowedFormats = new Set(['svg', 'png', 'pdf']);
  const invalidFormats = options.formats.filter((format) => !allowedFormats.has(format));
  if (invalidFormats.length > 0) {
    console.error(`❌ 不支持的格式: ${invalidFormats.join(', ')}`);
    process.exit(1);
  }

  ensureDir(options.outputDir);

  let files;
  try {
    files = listMmdFiles(options.inputDir);
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('⚠️  未找到任何 .mmd 文件');
    return;
  }

  const mmdc = resolveMmdc();
  const jobs = createJobs(files, options);
  const startedAt = Date.now();

  if (!options.quiet) {
    console.log('\n📊 Mermaid 批量导出');
    console.log(`   输入: ${options.inputDir}`);
    console.log(`   输出: ${options.outputDir}`);
    console.log(`   文件: ${files.length} 个 · 任务: ${jobs.length} 个`);
    console.log(`   格式: ${options.formats.join(', ')}`);
    console.log(`   主题: ${options.theme} · 背景: ${options.backgroundColor}`);
    console.log(`   并行: ${options.concurrency}`);
    console.log(`   CLI : ${mmdc.command}${mmdc.prefixArgs.length ? ' ' + mmdc.prefixArgs.join(' ') : ''}`);
    console.log('');
  }

  let successCount = 0;
  let errorCount = 0;
  const failures = [];

  await mapWithConcurrency(jobs, options.concurrency, async (job, index) => {
    const progress = `[${index + 1}/${jobs.length}]`;
    try {
      const args = buildCommandArgs(mmdc, options, job.inputPath, job.outputPath, job.format);
      await runCommand(mmdc.command, args);
      successCount += 1;
      if (!options.quiet) {
        console.log(`  ✅ ${progress} ${job.label}`);
      }
    } catch (error) {
      errorCount += 1;
      failures.push({ label: job.label, message: error.message });
      console.error(`  ❌ ${progress} ${job.label}`);
      if (!options.quiet) {
        console.error(`     ${error.message.split('\n')[0]}`);
      }
    }
  });

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 批量生成完成');
  console.log(`   ✅ 成功: ${successCount}`);
  if (errorCount > 0) {
    console.log(`   ❌ 失败: ${errorCount}`);
  }
  console.log(`   ⏱  耗时: ${elapsed}s`);
  console.log(`   📁 输出: ${options.outputDir}`);

  if (failures.length > 0) {
    console.log('\n失败详情:');
    for (const failure of failures) {
      console.log(` - ${failure.label}: ${failure.message.split('\n')[0]}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`❌ 未处理异常: ${error.message}`);
  process.exit(1);
});
