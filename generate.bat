@echo off
chcp 65001 >nul
setlocal

:menu
echo ==========================================
echo    Mermaid 高清流程图生成器
echo ==========================================
echo.
echo 请选择操作:
echo [1] 生成 SVG (矢量格式，推荐)
echo [2] 生成 PNG (高清位图)
echo [3] 生成 PDF
echo [4] 生成所有格式
echo [5] 批量生成 (处理 examples 目录下所有文件)
echo [6] 安装本地依赖
echo [7] 退出
echo.

set /p choice=请输入选项 (1-7): 

if "%choice%"=="1" goto svg
if "%choice%"=="2" goto png
if "%choice%"=="3" goto pdf
if "%choice%"=="4" goto all
if "%choice%"=="5" goto batch
if "%choice%"=="6" goto install
if "%choice%"=="7" goto end

echo 无效的选项，请重新选择
echo.
goto menu

:svg
echo.
echo 正在生成 SVG...
call npm run generate
echo.
pause
goto menu

:png
echo.
echo 正在生成 PNG (2048px 宽度, 2x scale)...
call npm run generate-png
echo.
pause
goto menu

:pdf
echo.
echo 正在生成 PDF...
call npm run generate-pdf
echo.
pause
goto menu

:all
echo.
echo 正在生成所有格式...
call npm run generate-all
echo.
pause
goto menu

:batch
echo.
echo 正在批量生成...
call npm run batch-generate
echo.
pause
goto menu

:install
echo.
echo 正在安装本地依赖...
echo 如果遇到网络问题，请先设置镜像:
echo set PUPPETEER_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/chrome-for-testing
echo.
call npm install
echo.
echo 安装完成！
pause
goto menu

:end
echo.
echo 再见！
exit /b 0
