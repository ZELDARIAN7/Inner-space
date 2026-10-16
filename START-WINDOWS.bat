@echo off
title Inner Space
cd /d "%~dp0server"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Get the LTS version from https://nodejs.org , install it, then run this file again.
  echo.
  pause
  exit /b
)
if not exist ".env" (
  echo.
  echo First run: paste your Anthropic API key and press Enter.
  echo It is saved only on this PC, in server\.env
  echo.
  set /p KEY=Key: 
  (call echo ANTHROPIC_API_KEY=%%KEY%%)> .env
  echo REFLECTION_MODEL=claude-sonnet-5-5>> .env
  cls
)
findstr /b /c:"ELEVENLABS_API_KEY=" .env >nul 2>nul
if errorlevel 1 goto askvoice
goto run

:askvoice
echo.
echo  REAL VOICE (ElevenLabs) - one time only
echo  Paste your ElevenLabs API key and press Enter.
echo  (No ElevenLabs? Just press Enter to skip.)
echo.
set "XI="
set /p XI=ElevenLabs key: 
>>.env echo.
>>.env echo ELEVENLABS_API_KEY=%XI%
if "%XI%"=="" goto run
echo.
echo  Now type the name of the voice, the way it is written in
echo  ElevenLabs "My Voices", and press Enter.
echo.
set "VN="
set /p VN=Voice name: 
>>.env echo ELEVENLABS_VOICE_NAME=%VN%
cls

:run
start "" http://localhost:3000
node server.js
pause
