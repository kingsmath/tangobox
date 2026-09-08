@echo off
chcp 65001 >nul
title Tango Box
echo.
echo   쎄븐 탱고 플레이어를 시작합니다...
echo.
echo   이 검은 창은 켜 둔 채로 두세요. 닫으면 재생이 멈춥니다.
echo   휴대폰에서 열 주소도 아래에 나옵니다.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0source\serve.ps1" -Root "%~dp0."
