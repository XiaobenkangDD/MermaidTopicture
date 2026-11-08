#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

menu() {
  cat <<'EOF'
==========================================
   Mermaid 高清流程图生成器
==========================================

请选择操作:
[1] 生成 SVG (矢量格式，推荐)
[2] 生成 PNG (高清位图)
[3] 生成 PDF
[4] 生成所有格式
[5] 批量生成 (处理 examples 目录下所有文件)
[6] 安装本地依赖
[7] 退出
EOF
}

while true; do
  menu
  read -r -p "请输入选项 (1-7): " choice
  case "$choice" in
    1)
      npm run generate
      ;;
    2)
      npm run generate-png
      ;;
    3)
      npm run generate-pdf
      ;;
    4)
      npm run generate-all
      ;;
    5)
      npm run batch-generate
      ;;
    6)
      echo "正在安装本地依赖..."
      if [[ -n "${PUPPETEER_DOWNLOAD_HOST:-}" ]]; then
        echo "已使用镜像: $PUPPETEER_DOWNLOAD_HOST"
      else
        echo "如遇网络问题，可先执行:"
        echo "  export PUPPETEER_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/chrome-for-testing"
      fi
      npm install
      ;;
    7)
      echo "再见！"
      exit 0
      ;;
    *)
      echo "无效的选项，请重新选择"
      ;;
  esac
  echo
done
