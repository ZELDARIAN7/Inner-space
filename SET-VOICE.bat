@echo off
title Inner Space - Voice
cd /d "%~dp0server"
if not exist ".env" (
  echo Run START-WINDOWS.bat once first.
  pause
  exit /b
)
findstr /v /b /c:"ELEVENLABS_API_KEY=" /c:"ELEVENLABS_VOICE_NAME=" .env > .env.tmp
move /y .env.tmp .env >nul
if exist voice-config.json del voice-config.json
echo.
echo  CHANGE THE VOICE (ElevenLabs)
echo  Paste your ElevenLabs API key and press Enter.
echo  (Press Enter alone to turn ElevenLabs off and use the device voice.)
echo.
set "XI="
set /p XI=ElevenLabs key: 
>>.env echo.
>>.env echo ELEVENLABS_API_KEY=%XI%
if "%XI%"=="" goto done
echo.
echo  Type the voice name, the way it is written in ElevenLabs "My Voices".
echo.
set "VN="
set /p VN=Voice name: 
>>.env echo ELEVENLABS_VOICE_NAME=%VN%
:done
echo.
echo  Saved. Close the black Inner Space window if it is open,
echo  then double-click START-WINDOWS.bat.
echo.
pause
