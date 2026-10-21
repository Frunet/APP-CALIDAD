# Quality Control

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
| **Administrador** | Todo lo de Calidad + **Maestros** (proveedores, productos, calibres, defectos), **especificaciones** y **usuarios**. |

El **primer usuario** que se crea queda como administrador (trigger `handle_new_user`); los siguientes son inspectores.
Los roles se cambian en Maestros → Usuarios. El login acepta el nombre de usuario (`IV GAMA` → `iv-gama@frutacheck.test`).

### Crear usuarios

La app no tiene registro público. En el panel de Supabase: *Authentication → Users → Add user* (marca *Auto Confirm*).
Recomendado: en *Authentication → Sign In / Providers* desactiva *Allow new users to sign up*.

## Datos

Tablas: `profiles`, `suppliers`, `products`, `calibers`, `defect_types`, `agreements` (especificaciones), `receptions`, `pallets`, `defects`, `photos`. Fotos en el bucket privado
`reception-photos` (`{reception_id}/{photo_id}.jpg`), servidas con URLs firmadas. Seguridad por filas en todas las tablas.

## Límites de calidad y resultado

Cada especificación puede definir límites opcionales: temperatura máxima, °Brix mínimo, defectos máximos (% total), materia seca
mínima y temperatura máxima de transporte. La recepción guarda los límites con que se evaluó y avisa en rojo al incumplirlos
(más el peso mínimo por palet, que se vigila siempre). Propuesta automática: 0 incumplimientos = aceptada, 1-2 = aceptada con
reservas, 3 o más = rechazada. **Calidad y el administrador pueden decidir el resultado final** (con comentario); un trigger
impide que lo haga un inspector. El informe, el PDF, el Excel y el Historial muestran el resultado final.

## Estadísticas

Pantalla **Estadísticas** (Calidad y administrador): filtros por fechas, producto y proveedor; KPIs (recepciones, toneladas, % palets
bajo mínimo, % aceptadas/con reservas/rechazadas), ranking de proveedores, palets bajo mínimo por proveedor, defectos más frecuentes
y evolución del °Brix y de la temperatura. Las gráficas son SVG/CSS propios (sin librerías). Los cálculos están en
`src/lib/stats.ts` con tests.

## Registro de cambios

Triggers de base de datos anotan en `audit_log` quién creó, modificó o eliminó cada recepción (campos, pesos de palets,
defectos y fotos). Los guardados seguidos se agrupan y los guardados sin cambios reales no aparecen. Solo lo ve el
administrador (Maestros → Registro) y no se puede escribir desde la app.

## Trabajo sin conexión

- La app (PWA) se precarga en el dispositivo y abre sin red; proveedores, productos, calibres, defectos y especificaciones se copian
  en el dispositivo en cada carga.
- Si no hay conexión al guardar una recepción, se guarda en **IndexedDB** (con las fotos) y se envía sola al volver la red
  (evento `online`, al volver a la app, cada 30 s o con "Enviar ahora"). El id se fija al encolar, así que reintentar es
  idempotente (no duplica recepciones, palets ni fotos aunque el envío se corte a medias).
- Cada elemento de la cola solo se envía con la sesión del usuario que lo creó.
- Limitación: sin red no se pueden ver ni modificar recepciones ya guardadas (Historial, informes).

## Pendiente / ideas

- PDF generado en servidor (hoy se genera en el navegador con jsPDF; tarda más con muchas fotos).
- El Excel y el PDF se generan en el navegador; con miles de recepciones convendría hacerlo en servidor.
- Importar especificaciones/recepciones del `localStorage` de la v1.6.
- Despliegue (Vercel/Netlify/Cloudflare Pages) con las dos variables `VITE_*`.
