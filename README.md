# MermaidTopicture

本地 **Web 工作室 + CLI**，把 Mermaid 源码导出为高清 **SVG / PNG / PDF**。

## 功能特点

- Web 实时预览：边写边看，语法错误即时提示
- 一键导出高清图（主题 / 背景 / 尺寸 / 清晰度）
- 示例一键加载，快捷键导出
- SVG / PNG / PDF 多格式；批量并行导出
- 本地 CLI，无需全局安装 `mmdc`
- 监听模式与 Puppeteer 配置，兼容 CI / 容器

## 快速开始

### 1. 安装依赖

```bash
npm install
```

国内网络如遇 Chromium 下载失败：

```bash
# Windows
set PUPPETEER_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/chrome-for-testing

# Linux / macOS
export PUPPETEER_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/chrome-for-testing

npm install
```

### 2. 打开 Web 工作室（推荐）

```bash
npm run studio
```

浏览器访问 [http://127.0.0.1:5173](http://127.0.0.1:5173)：

- 左侧编辑 Mermaid
- 中间即时预览
- 右侧设置主题、格式、尺寸后一键导出到 `output/`

快捷键：`Ctrl/⌘ + S` 导出，`Ctrl/⌘ + Enter` 刷新预览。

### 3. 命令行导出

```bash
# 单文件：SVG / PNG / PDF
npm run generate
npm run generate-png
npm run generate-pdf
npm run generate-all

# 批量：examples 下全部 .mmd
npm run batch-generate
npm run batch-generate:all
npm run batch-generate:4k
npm run batch-generate:dark

# 监听修改并自动导出
npm run watch
```

图形菜单：

- Windows：双击 `generate.bat`
- Linux / macOS：`bash generate.sh`

## 批量脚本参数

```bash
node scripts/batch-generate.js --help

node scripts/batch-generate.js \
  -i ./examples \
  -o ./output \
  -f svg,png,pdf \
  -t default \
  -b transparent \
  --size 2048 \
  -s 2 \
  -j 4
```

| 参数 | 说明 |
|------|------|
| `-i` | 输入目录 |
| `-o` | 输出目录 |
| `-f` | 格式：`svg,png,pdf` |
| `-t` | 主题 |
| `-b` | 背景色 |
| `--size` | PNG/PDF 最大边长（兼容别名 `-w`） |
| `-s` | Puppeteer 缩放倍率（默认 2） |
| `-j` | 并行任务数 |
| `-c` | Mermaid 配置 |
| `-p` | Puppeteer 配置 |

## 项目结构

```
├── web/                   # Web 工作室前端
├── examples/              # Mermaid 源文件
├── output/                # 导出结果（gitignore）
├── scripts/
│   ├── studio-server.js   # 本地 Web 服务 + 导出 API
│   ├── mmdc-util.js       # 本地 mmdc：不经 shell，主题以本次选择为准
│   ├── batch-generate.js  # 批量并行导出
│   ├── generate-one.js    # 单文件导出
│   └── watch-generate.js  # 监听自动导出
├── config.json            # Mermaid 主题与布局
├── puppeteer-config.json  # 无沙箱等渲染参数
├── generate.bat / .sh     # 交互菜单
└── package.json
```

## 配置说明

`config.json` 可调整主题色、中文字体、flowchart / sequence / gantt 间距。命令行 `-t` 和 Web 工作室里选择的主题会覆盖配置文件中的 `theme`，字体和间距仍沿用该文件。需要 Node.js 22.13 及以上。  
`puppeteer-config.json` 默认开启 `--no-sandbox`，便于 Linux CI 与容器运行。

常用主题：`default` / `forest` / `dark` / `neutral` / `base`

## 常见问题

**中文乱码 / 方框**  
在 `config.json` 中设置系统已安装的中文字体，例如：

```json
"fontFamily": "Microsoft YaHei, Noto Sans CJK SC, WenQuanYi Micro Hei, Arial"
```

**图片被截断**  
增大 `flowchart.padding` / `diagramPadding`，或提高 `--size` / `-s`。

**Puppeteer / Chromium 安装失败**  
设置 `PUPPETEER_DOWNLOAD_HOST` 镜像后重新 `npm install`。

## 参考

- [Mermaid 文档](https://mermaid.js.org/)
- [Mermaid CLI](https://github.com/mermaid-js/mermaid-cli)
- [在线编辑器](https://mermaid.live/)

## 许可证

MIT
