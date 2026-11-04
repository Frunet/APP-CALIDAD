# Entorno local (Supabase en Docker)

Quality Control puede trabajar contra un **Supabase local** en lugar del de la nube. Sirve para desarrollar y probar sin tocar los
datos reales. La web publicada (GitHub Pages) **siempre** usa el Supabase de la nube: el local solo existe en este equipo.

## Qué hay montado

| Qué | Dónde |
|---|---|
| Instancia de Quality Control | `C:\supabase-qc` (Docker, proyecto `supabase-qc`) |
| API (Auth, REST y Storage) | http://localhost:8200 |
| Studio (panel de administración) | http://localhost:8200 en el navegador (usuario y contraseña en `C:\supabase-qc\.env`, variables `DASHBOARD_*`) |
| Base de datos (conexión directa) | `127.0.0.1:5532` · pooler de transacciones `127.0.0.1:6643` |
| Otra instancia, de la app **Campo** | `C:\supabase-campo`, API en el puerto 8100. **No se toca ni se comparte.** |

La instancia de Campo y la de Quality Control son independientes: tienen contenedores, puertos, volúmenes, claves y datos distintos.

## Usar la aplicación contra el Supabase local

**Atajo:** doble clic en **`Iniciar-Quality-Control-LOCAL.bat`** (en la carpeta del proyecto). Abre Docker si hace falta, arranca el Supabase
local y la aplicación, y abre el navegador. Hay que dejar su ventana abierta mientras se usa.

A mano:

1. Abrir **Docker Desktop** y esperar a que arranquen los contenedores `supabase-qc-*` (se inician solos con Docker).
2. `npm run dev` y abrir http://localhost:5173.
3. Entrar con `ADMINISTRADOR`, `CALIDAD`, `IV GAMA` o `1 GAMA` (contraseña de desarrollo, en `supabase/seed.local.sql`). El usuario se
   escribe sin importar mayúsculas, espacios o guiones: `IV GAMA`, `IVGAMA` e `iv-gama` son lo mismo.

La conexión la fija el archivo **`.env.development.local`** (no se sube a git), que `npm run dev` lee con prioridad sobre `.env.local`.
Para volver a trabajar contra la nube basta con **renombrar o borrar** `.env.development.local`. `npm run build` y la web publicada
usan siempre `.env.local` / las variables de GitHub Actions, es decir, la nube.

## Arrancar, parar y estado

```bash
cd C:\supabase-qc
docker compose up -d --pull never     # arrancar
docker compose stop                   # parar (conserva los datos)
docker compose ps                     # estado
```

## Esquema (migraciones)

El esquema es el de `supabase/migrations/*.sql`, que se aplica en orden por nombre de archivo. En la instancia local ya están
aplicadas las 12 primeras. Una migración nueva se aplica así (y, por separado, en la nube desde el panel o con la herramienta
de migraciones):

```bash
docker exec -i supabase-qc-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/<archivo>.sql
```

## Datos de desarrollo

`supabase/seed.local.sql` (no se sube a git) crea los 4 usuarios locales. Las listas iniciales (productos, defectos, orígenes) vienen
de las propias migraciones. Para empezar de cero: `docker compose down -v`, borrar el contenido de `C:\supabase-qc\volumes\db\data` y
`C:\supabase-qc\volumes\storage`, volver a arrancar, reaplicar las migraciones y el seed.

## Límites

- `localhost` solo vale en este PC: para otros equipos y móviles, ver «Modo oficina».
- Las copias de seguridad de Supabase Cloud no cubren el Supabase local: sus datos están solo en `C:\supabase-qc\volumes`.

## Modo oficina (compañeros en la misma red)

Los compañeros abren **http://192.168.1.131:5180** desde el móvil u otro ordenador conectado a la misma red (wifi o cable).
Este PC debe estar **encendido, con Docker abierto y la ventana del servidor abierta**.

1. Una vez: clic derecho en `Abrir-puertos-OFICINA.ps1` → *Ejecutar con PowerShell* como administrador (abre los puertos 5180 y 8200 solo a la red local).
2. Cada vez: doble clic en **`Servidor-Quality-Control-OFICINA.bat`**.
3. Recomendado: en el router, reservar la IP 192.168.1.131 para este PC (si cambia, hay que actualizar `C:\supabase-qc\.env`, `.env.lan.local` y reconstruir con `npx vite build --mode lan --base / --outDir dist-lan`).

`C:\supabase-qc\.env` ya apunta a esa IP (copia anterior: `.env.bak-localhost`). La compilación de oficina usa `.env.lan.local` (no se sube a git).

Limitaciones por usar http (no https): no se puede instalar como app (PWA) ni hay modo sin conexión con service worker, y el botón
de compartir del informe cae a descarga. La cámara/galería de fotos y el resto funcionan. Para instalar en el móvil y compartir
bien hace falta la versión en la nube (https).
