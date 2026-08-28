@echo off
call "%~dp0_npm-setup.bat"
if not defined NPX (
  if defined NPM set "NPX=%NPM:npm.cmd=npx.cmd%"
)
if not defined NPX (
  echo [Hata] npx bulunamadi.
  exit /b 1
)
"%NPX%" %*
