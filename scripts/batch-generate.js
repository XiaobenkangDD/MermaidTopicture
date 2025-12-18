const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const config = {
  inputDir: './examples',
  outputDir: './output',
  formats: ['svg', 'png'], // 可选: 'svg', 'png', 'pdf'
  theme: 'default',
  backgroundColor: 'transparent',
  pngWidth: 2048, // PNG 输出宽度
};

// 确保输出目录存在
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
  console.log(`✅ 创建输出目录: ${config.outputDir}`);
}

// 获取所有 .mmd 文件
const mmdFiles = fs.readdirSync(config.inputDir)
  .filter(file => file.endsWith('.mmd'));

if (mmdFiles.length === 0) {
  console.log('⚠️  未找到任何 .mmd 文件');
  process.exit(0);
}

console.log(`\n📊 找到 ${mmdFiles.length} 个 Mermaid 文件，开始批量生成...\n`);

// 批量处理
let successCount = 0;
let errorCount = 0;

mmdFiles.forEach((file, index) => {
  const baseName = path.basename(file, '.mmd');
  const inputPath = path.join(config.inputDir, file);
  
  console.log(`[${index + 1}/${mmdFiles.length}] 处理: ${file}`);
  
  config.formats.forEach(format => {
    const outputPath = path.join(config.outputDir, `${baseName}.${format}`);
    
    try {
      let command = `mmdc -i "${inputPath}" -o "${outputPath}" -t ${config.theme} -b ${config.backgroundColor}`;
      
      // PNG 格式添加宽度参数
      if (format === 'png') {
        command += ` -w ${config.pngWidth}`;
      }
      
      // 如果有配置文件，添加配置参数
      if (fs.existsSync('./config.json')) {
        command += ` -c ./config.json`;
      }
      
      execSync(command, { stdio: 'pipe' });
      console.log(`  ✅ 生成 ${format.toUpperCase()}: ${outputPath}`);
      successCount++;
      
    } catch (error) {
      console.error(`  ❌ 生成 ${format.toUpperCase()} 失败: ${error.message}`);
      errorCount++;
    }
  });
  
  console.log('');
});

// 输出统计信息
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`\n📈 批量生成完成！`);
console.log(`   ✅ 成功: ${successCount} 个文件`);
if (errorCount > 0) {
  console.log(`   ❌ 失败: ${errorCount} 个文件`);
}
console.log(`\n📁 输出目录: ${path.resolve(config.outputDir)}\n`);

