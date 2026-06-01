@echo off
echo Starting Dogzilla Studio...
echo.
echo Once you see "Ready", open on your phone:
ipconfig | findstr /i "IPv4"
echo :3000
echo.
npm run dev
pause
