@echo off
REM Double-click this file to launch the Kilos mobile app in Chrome.
cd /d "d:\Devloft-work\Kilos-ERP\mobile-app"
echo Launching Kilos in Chrome... (first compile takes ~30-60s)
"D:\flutter\bin\flutter.bat" run -d chrome
pause
