@echo off
chcp 65001 >nul
rem Windows launcher: double-click to configure (first run) and start ArguMentor.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 需要 Node.js 20.3 或以上版本，请先从 https://nodejs.org 安装。
  echo Node.js 20.3 or newer is required. Install it from https://nodejs.org
  pause
  exit /b 1
)
if not exist "%APPDATA%\ArguMentor\env" if not exist ".env" (
  echo 首次使用：请按提示输入 DeepSeek 模型与 API 密钥。
  echo First run: enter your DeepSeek model and API key when prompted.
  node setup.mjs || (pause & exit /b 1)
)
echo 浏览器打开 / Open in your browser: http://localhost:4186
echo 关闭此窗口会停止服务 / Closing this window stops the service.
node server.mjs
pause
