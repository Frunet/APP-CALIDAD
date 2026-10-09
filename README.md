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

- **Inspector:** crea y edita sus recepciones; ve las especificaciones.
- **Administrador:** ve todas las recepciones, gestiona los maestros (proveedores, productos, calibres), las especificaciones y los usuarios.

El **primer usuario** que se crea queda como administrador (trigger `handle_new_user`); los siguientes son inspectores.

### Crear usuarios

La app no tiene registro público. En el panel de Supabase: *Authentication → Users → Add user* (marca *Auto Confirm*).
Recomendado: en *Authentication → Sign In / Providers* desactiva *Allow new users to sign up*.

## Datos

Tablas: `profiles`, `suppliers`, `products`, `calibers`, `agreements` (especificaciones), `receptions`, `pallets`, `defects`, `photos`. Fotos en el bucket privado
`reception-photos` (`{reception_id}/{photo_id}.jpg`), servidas con URLs firmadas. Seguridad por filas en todas las tablas.

## Pendiente / ideas

- Cola sin conexión para guardar recepciones sin cobertura (hoy la PWA cachea la app, pero guardar requiere red).
- PDF generado en servidor (hoy: imprimir → guardar como PDF).
- Importar especificaciones/recepciones del `localStorage` de la v1.6.
- Despliegue (Vercel/Netlify/Cloudflare Pages) con las dos variables `VITE_*`.
