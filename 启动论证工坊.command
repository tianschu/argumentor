#!/bin/zsh
# macOS launcher: double-click to configure (first run) and start ArguMentor.
cd -- "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  print '需要 Node.js 20.3 或以上版本，请先从 https://nodejs.org 安装。'
  print 'Node.js 20.3 or newer is required. Install it from https://nodejs.org'
  read -k 1 '?按任意键关闭 / Press any key to close.'
  exit 1
fi
CONFIG="${XDG_CONFIG_HOME:-$HOME/.config}/argumentor/env"
if [[ ! -f "$CONFIG" && ! -f .env ]]; then
  print '首次使用：请按提示输入 DeepSeek 模型与 API 密钥。'
  print 'First run: enter your DeepSeek model and API key when prompted.'
  node setup.mjs || { read -k 1 '?按任意键关闭 / Press any key to close.'; exit 1; }
fi
print '浏览器打开 / Open in your browser: http://localhost:4186'
print '关闭此窗口会停止服务 / Closing this window stops the service.'
node server.mjs
