@echo off
echo.
echo ========================================
echo   PSC Project Plan - GitHub Sync
echo ========================================
echo.

cd /d C:\Users\pransriv\psc-project-dashboard

REM Set your GitHub token before running this script:
REM $env:GITHUB_TOKEN = "your-token-here"
IF "%GITHUB_TOKEN%"=="" (
    echo ERROR: GITHUB_TOKEN not set!
    echo Run: set GITHUB_TOKEN=your-token-here
    pause
    exit /b 1
)

echo Starting sync...
echo.

node sync-local.cjs

echo.
echo ========================================
echo   Sync complete! Press any key to exit
echo ========================================
pause > nul
