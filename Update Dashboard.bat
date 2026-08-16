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

echo [1/3] Downloading and analyzing current market data...
py "%ANALYZER%"
if errorlevel 1 goto :failed

echo.
echo [2/3] Updating the website data...
py "%SITE_DIR%update_dashboard.py"
if errorlevel 1 goto :failed

echo.
echo [3/3] Opening the refreshed dashboard...
powershell -NoProfile -Command "try { $null = Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  start "Market Signal Console Server" /min py -m http.server 3000 --directory "%SITE_DIR%"
  timeout /t 2 /nobreak >nul
)
start "" "http://localhost:3000/"

echo.
echo Update complete. Refresh the browser if the previous data is cached.
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
