@echo off
:: Dogzilla Studio — Database Backup
:: Double-click this to backup your database manually
:: Or set it to run automatically (see instructions below)

set DB=E:\Git\dogzilla-studio\data\dogzilla.db
set BACKUP_FOLDER=E:\Git\dogzilla-studio\backups

:: Create backups folder if it doesn't exist
if not exist "%BACKUP_FOLDER%" mkdir "%BACKUP_FOLDER%"

:: Copy with today's date in the filename
set DATE_STR=%date:~10,4%-%date:~4,2%-%date:~7,2%
copy "%DB%" "%BACKUP_FOLDER%\dogzilla-backup-%DATE_STR%.db"

echo.
echo ✓ Backup saved to:
echo   %BACKUP_FOLDER%\dogzilla-backup-%DATE_STR%.db
echo.
echo TIP: Copy the backups folder to Google Drive or USB regularly.
echo.
pause
