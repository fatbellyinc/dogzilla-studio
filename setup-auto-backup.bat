@echo off
:: Run this ONCE to set up automatic daily backup at 11PM
:: Right-click and "Run as administrator"

echo Setting up automatic daily backup...

schtasks /create /tn "DogzillaStudioBackup" /tr "E:\Git\dogzilla-studio\backup.bat" /sc daily /st 23:00 /f

echo.
echo ✓ Done! Your database will automatically backup every day at 11:00 PM
echo   Backups saved to: E:\Git\dogzilla-studio\backups\
echo.
echo IMPORTANT: Also copy your backups folder to Google Drive or USB weekly.
echo.
pause
