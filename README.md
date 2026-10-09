# FrutaCheck QA

Control de calidad de recepción de fruta (piña, mango, aguacate). PWA instalable en el móvil.

**Stack:** React 18 + Vite + TypeScript · Supabase (Auth, Postgres con RLS, Storage) · vite-plugin-pwa.

## Puesta en marcha

Requiere [Node.js LTS](https://nodejs.org).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # cálculos de peso/tara
npm run build      # producción en dist/
```

Las claves están en `.env.local` (no se sube a git). Plantilla: `.env.example`.

## Estructura

```
legacy/index.html          v1.6 de un solo archivo (referencia)
src/
  auth/                    sesión, login, perfil
  components/              Layout, PhotoPicker
  features/receptions/     editor (4 pasos), historial, informe
  features/agreements/     especificaciones por proveedor/producto/formato
  features/admin/          maestros (proveedores, productos, calibres) y usuarios (solo admin)
  lib/                     supabase, calculations (+tests), image
supabase/migrations/       esquema SQL, RLS y storage
```

## Roles

| Rol | Puede |
|---|---|
| **Inspector** | Crear recepciones (con fotos). No ve el historial ni los informes. |
| **Calidad** | Todo lo del inspector + **Historial** e **informes** de todas las recepciones: filtros, Excel, PDF, modificar y eliminar. |
| **Administrador** | Todo lo de Calidad + **Maestros** (proveedores, productos, calibres), **especificaciones** y **usuarios**. |

El **primer usuario** que se crea queda como administrador (trigger `handle_new_user`); los siguientes son inspectores.
Los roles se cambian en Maestros → Usuarios. El login acepta el nombre de usuario (`IV GAMA` → `iv-gama@frutacheck.test`).

### Crear usuarios

La app no tiene registro público. En el panel de Supabase: *Authentication → Users → Add user* (marca *Auto Confirm*).
Recomendado: en *Authentication → Sign In / Providers* desactiva *Allow new users to sign up*.

## Datos

Tablas: `profiles`, `suppliers`, `products`, `calibers`, `agreements` (especificaciones), `receptions`, `pallets`, `defects`, `photos`. Fotos en el bucket privado
`reception-photos` (`{reception_id}/{photo_id}.jpg`), servidas con URLs firmadas. Seguridad por filas en todas las tablas.

## Pendiente / ideas

- Cola sin conexión para guardar recepciones sin cobertura (hoy la PWA cachea la app, pero guardar requiere red).
- PDF generado en servidor (hoy se genera en el navegador con jsPDF; tarda más con muchas fotos).
- El Excel y el PDF se generan en el navegador; con miles de recepciones convendría hacerlo en servidor.
- Importar especificaciones/recepciones del `localStorage` de la v1.6.
- Despliegue (Vercel/Netlify/Cloudflare Pages) con las dos variables `VITE_*`.
