@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ABRIR_PANEL_TANTALO.ps1" %*
if errorlevel 1 (
  echo.
  echo No fue posible abrir el Centro de Control Tantalo.
  pause
)
endlocal
