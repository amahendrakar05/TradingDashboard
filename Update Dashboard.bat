@echo off
setlocal
title Update Market Signal Console and News

set "ANALYZER=D:\Pyhton code\FINAL Scripts\1Extract S&P Data from Yahoo.py"
set "SITE_DIR=%~dp0"

echo ============================================================
echo  MARKET SIGNAL CONSOLE + NEWS - ONE CLICK UPDATE
echo ============================================================
echo.

if not exist "%ANALYZER%" (
  echo ERROR: Analyzer was not found:
  echo %ANALYZER%
  goto :failed
)

echo [1/5] Downloading and analyzing current market data...
py "%ANALYZER%"
if errorlevel 1 goto :failed

echo.
echo [2/5] Updating the website data...
py "%SITE_DIR%update_dashboard.py"
if errorlevel 1 goto :failed

echo.
echo [3/5] Updating news and articles...
py "%SITE_DIR%update_articles.py"
if errorlevel 1 goto :failed

echo.
echo [4/5] Publishing updated data to GitHub...
git -C "%SITE_DIR%" rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: The website folder is not a Git repository.
  goto :failed
)

git -C "%SITE_DIR%" add -A -- public
git -C "%SITE_DIR%" diff --cached --quiet -- public
if errorlevel 1 (
  for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set "STAMP=%%i"
  git -C "%SITE_DIR%" commit -m "Refresh stock analytics and articles %STAMP%"
  if errorlevel 1 goto :failed
) else (
  echo No stock-data changes were detected. Nothing new to publish.
)

git -C "%SITE_DIR%" push origin main
if errorlevel 1 goto :failed

echo.
echo [5/5] Opening the published website...
start "" "https://amahendrakar05.github.io/TradingDashboard/"
start "" "https://amahendrakar05.github.io/TradingDashboard/news.html"

echo.
echo Update complete.
echo Stock data and News ^& Articles have been refreshed and published.
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
