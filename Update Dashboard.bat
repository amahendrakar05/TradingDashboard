@echo off
setlocal
title Update Market Signal Console

set "ANALYZER=D:\Pyhton code\FINAL Scripts\1Extract S&P Data from Yahoo.py"
set "SITE_DIR=%~dp0"

echo ============================================================
echo  MARKET SIGNAL CONSOLE - ONE CLICK UPDATE
echo ============================================================
echo.

if not exist "%ANALYZER%" (
  echo ERROR: Analyzer was not found:
  echo %ANALYZER%
  goto :failed
)

echo [1/4] Downloading and analyzing current market data...
py "%ANALYZER%"
if errorlevel 1 goto :failed

echo.
echo [2/4] Updating the website data...
py "%SITE_DIR%update_dashboard.py"
if errorlevel 1 goto :failed

echo.
echo [3/4] Publishing updated data to GitHub...
git -C "%SITE_DIR%" rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: The website folder is not a Git repository.
  goto :failed
)

git -C "%SITE_DIR%" add -- public/stocks.json
git -C "%SITE_DIR%" diff --cached --quiet -- public/stocks.json
if errorlevel 1 (
  for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set "STAMP=%%i"
  git -C "%SITE_DIR%" commit -m "Refresh stock analytics %STAMP%"
  if errorlevel 1 goto :failed
  git -C "%SITE_DIR%" push origin main
  if errorlevel 1 goto :failed
) else (
  echo No stock-data changes were detected. Nothing new to publish.
)

echo.
echo [4/4] Opening the published dashboard...
start "" "https://amahendrakar05.github.io/TradingDashboard/"

echo.
echo Update complete.
echo GitHub Pages may take 1-5 minutes to deploy the new data.
echo Press Ctrl+F5 in the browser after deployment to bypass cached data.
echo.
pause
exit /b 0

:failed
echo.
echo UPDATE FAILED. Review the error shown above.
echo The existing dashboard data was not intentionally removed.
echo.
pause
exit /b 1
