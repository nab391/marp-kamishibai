@echo off
cd "%~dp0"
wsl docker run --rm -v "./src:/src" -v "./dist:/dist" marp-docker %*
