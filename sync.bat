@echo off
echo.
echo ========================================
echo   PSC Project Plan Sync Tool
echo ========================================
echo.

:: Check if GITHUB_TOKEN is set
if "%GITHUB_TOKEN%"=="" (
    echo ERROR: GITHUB_TOKEN not set!
    echo.
    echo Please set your GitHub token first:
    echo   set GITHUB_TOKEN=your_token_here
    echo.
    echo To get a token:
    echo   1. Go to https://github.com/settings/tokens
    echo   2. Generate new token (classic)
    echo   3. Select scope: repo
    echo.
    pause
    exit /b 1
)

:: Run the sync
cd /d "%~dp0"
node sync-local.js

echo.
pause

