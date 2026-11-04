@echo off
chcp 65001 >nul
title Quality Control - SERVIDOR OFICINA
cd /d "%~dp0"

echo ============================================================
echo   Quality Control  -  servidor para la oficina (red local)
echo ============================================================
echo.

echo [1/4] Comprobando Docker...
docker info >nul 2>&1
if not errorlevel 1 goto docker_ok
echo      Docker no esta abierto. Abriendolo (puede tardar un minuto)...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
:esperar_docker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 goto esperar_docker
:docker_ok

echo [2/4] Arrancando el Supabase local...
pushd C:\supabase-qc
docker compose up -d --pull never
popd
:esperar_api
timeout /t 3 /nobreak >nul
curl -s -o nul -m 3 http://localhost:8200/auth/v1/health
if errorlevel 1 goto esperar_api

echo [3/4] Preparando la aplicacion (solo la primera vez o tras cambios)...
if exist dist-lan\index.html goto build_ok
call npx vite build --mode lan --base / --outDir dist-lan
:build_ok

echo [4/4] Sirviendo la aplicacion en la red local.
echo.
echo   Los companeros abren en el navegador:   http://192.168.1.131:5180
echo   Usuarios: ADMINISTRADOR, CALIDAD, IV GAMA, 1 GAMA
echo   NO cierres esta ventana ni apagues el PC mientras se use.
echo.
call npx vite preview --mode lan --outDir dist-lan --host 0.0.0.0 --port 5180 --strictPort
pause
