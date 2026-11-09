#!/usr/bin/env bash
set -uo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1

run_and_return() {
  if ! "$@"; then
    echo
    echo "操作未成功，已返回菜单。"
  fi
}

menu() {
  cat <<'EOF'
==========================================
   Mermaid 高清流程图生成器
==========================================

请选择操作:
[1] 打开 Web 工作室 (实时预览 + 一键导出)
[2] 生成 SVG (矢量格式，推荐)
[3] 生成 PNG (高清位图)
[4] 生成 PDF
[5] 生成所有格式
[6] 批量生成 (处理 examples 目录下所有文件)
[7] 安装本地依赖
[8] 退出
EOF
}

while true; do
  menu
  read -r -p "请输入选项 (1-8): " choice
  case "$choice" in
    1)
      run_and_return npm run studio
      ;;
    2)
      run_and_return npm run generate
      ;;
    3)
      run_and_return npm run generate-png
      ;;
    4)
      run_and_return npm run generate-pdf
      ;;
    5)
      run_and_return npm run generate-all
      ;;
    6)
      run_and_return npm run batch-generate
      ;;
    7)
      echo "正在安装本地依赖..."
      if [[ -n "${PUPPETEER_DOWNLOAD_HOST:-}" ]]; then
        echo "已使用镜像: $PUPPETEER_DOWNLOAD_HOST"
      else
        echo "如遇网络问题，可先执行:"
        echo "  export PUPPETEER_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/chrome-for-testing"
      fi
      run_and_return npm install
      ;;
    8)
      echo "再见！"
      exit 0
      ;;
    *)
      echo "无效的选项，请重新选择"
      ;;
  esac
  echo
done
