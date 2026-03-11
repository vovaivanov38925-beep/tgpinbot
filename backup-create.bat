@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
:: BACKUP CREATOR для tgpinbot
:: Создает тег и ветку бекапа перед изменениями
:: ============================================

cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════╗
echo ║     🛡️  BACKUP CREATOR v1.0              ║
echo ╚══════════════════════════════════════════╝
echo.

:: Получаем текущую дату и время
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set BACKUP_DATE=%datetime:~0,4%%datetime:~4,2%%datetime:~6,2%-%datetime:~8,2%%datetime:~10,2%
set BACKUP_NAME=backup-%BACKUP_DATE%

:: Запрос описания бекапа
set /p BACKUP_DESC="📝 Описание бекапа: "

if "%BACKUP_DESC%"=="" set BACKUP_DESC=manual-backup

:: Заменяем пробелы на дефисы
set BACKUP_DESC=%BACKUP_DESC: =-%

echo.
echo 📦 Создание бекапа: %BACKUP_NAME%
echo 📝 Описание: %BACKUP_DESC%
echo.

:: Проверяем есть ли несохраненные изменения
git status --porcelain >nul 2>&1
if %errorlevel% equ 0 (
    for /f %%A in ('git status --porcelain') do (
        echo ⚠️  Есть несохраненные изменения!
        set /p COMMIT_CHANGES="Сохранить изменения? (y/n): "
        if /i "!COMMIT_CHANGES!"=="y" (
            git add .
            git commit -m "chore: auto-commit before backup %BACKUP_NAME%"
            git push
            echo ✅ Изменения сохранены
        )
    )
)

:: Создаем тег
echo.
echo 🏷️  Создание тега: v-%BACKUP_NAME%
git tag -a "v-%BACKUP_NAME%" -m "Backup: %BACKUP_DESC%"
if %errorlevel% neq 0 (
    echo ❌ Ошибка создания тега
    pause
    exit /b 1
)

:: Пушим тег
git push origin "v-%BACKUP_NAME%"
if %errorlevel% neq 0 (
    echo ❌ Ошибка отправки тега
    pause
    exit /b 1
)

:: Создаем backup ветку
echo 🌿 Создание ветки бекапа: backup/%BACKUP_NAME%
git branch "backup/%BACKUP_NAME%"
if %errorlevel% neq 0 (
    echo ⚠️  Ветка уже существует или ошибка
) else (
    git push origin "backup/%BACKUP_NAME%"
    echo ✅ Ветка бекапа создана
)

echo.
echo ╔══════════════════════════════════════════╗
echo ║  ✅ BACKUP СОЗДАН УСПЕШНО!               ║
echo ╠══════════════════════════════════════════╣
echo ║  Тег:   v-%BACKUP_NAME%            ║
echo ║  Ветка: backup/%BACKUP_NAME%       ║
echo ╚══════════════════════════════════════════╝
echo.
echo 💡 Для отката используй: backup-restore.bat
echo.

:: Показываем список последних бекапов
echo 📋 Последние бекапы (теги):
echo ─────────────────────────────────────────
git tag -l "v-backup-*" --sort=-creatordate | head -n 10
echo.

pause
