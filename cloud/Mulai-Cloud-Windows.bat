@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Memulai HVEN Cloud di PC...
py -3 hven-cloud.py 2>nul
if %errorlevel%==0 goto end
python hven-cloud.py 2>nul
if %errorlevel%==0 goto end
echo Python 3 belum ada. Instal dari https://www.python.org/downloads/ lalu centang "Add Python to PATH".
pause
:end
pause
