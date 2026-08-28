@echo off
call "%~dp0_npm-setup.bat"
if not defined NPM (
  echo [Hata] Node.js bulunamadi. https://nodejs.org/
  exit /b 1
)
"%NPM%" %*
