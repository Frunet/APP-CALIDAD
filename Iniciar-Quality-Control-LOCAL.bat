@echo off
chcp 65001 >nul
title Quality Control - Supabase LOCAL
cd /d "%~dp0"

echo ============================================================
echo   Quality Control  -  trabajando con el Supabase LOCAL
echo ============================================================
echo.

echo [1/3] Comprobando Docker...
docker info >nul 2>&1
if not errorlevel 1 goto docker_ok
echo      Docker no esta abierto. Abriendolo (puede tardar un minuto)...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
:esperar_docker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 goto esperar_docker
:docker_ok
echo      Docker listo.

echo [2/3] Arrancando el Supabase local (C:\supabase-qc)...
pushd C:\supabase-qc
docker compose up -d --pull never
popd
:esperar_api
timeout /t 3 /nobreak >nul
curl -s -o nul -m 3 http://localhost:8200/auth/v1/health
if errorlevel 1 goto esperar_api
echo      Supabase local listo en http://localhost:8200

echo [3/3] Arrancando la aplicacion (se abrira el navegador)...
echo.
echo   Usuarios: ADMINISTRADOR, CALIDAD, IV GAMA, 1 GAMA
echo   NO cierres esta ventana mientras uses la aplicacion.
echo.
call npm run dev -- --open
pause
