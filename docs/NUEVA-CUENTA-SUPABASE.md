# Pasar Quality Control a un proyecto de Supabase nuevo (cuenta nueva)

Motivo: la cuenta actual ya tiene el máximo de proyectos activos del plan gratuito (2), y `AppCalidad` está pausado.
Esta guía crea una cuenta de Supabase con el GitHub de Jose y deja Quality Control funcionando en ella.

> **Quién hace qué.** Los pasos 1 a 5 los hace una persona en el panel de Supabase (crear una cuenta no se puede delegar).
> El paso 6 lo hace Claude: apuntar la aplicación al proyecto nuevo, probarla y publicarla.

## 1. Crear la cuenta y la organización

1. Entrar en https://supabase.com → **Sign in** → **Continue with GitHub** con la cuenta de GitHub de Jose.
2. Crear una **organización** (por ejemplo «Frunet»), plan **Free**.
3. **Recomendado:** en la organización → *Team* → **Invite** y añadir también a la cuenta principal de Frunet como **Owner**, para
   que el proyecto no dependa de una sola persona.

## 2. Crear el proyecto

1. **New project** → nombre `AppCalidad` (o `Quality Control`).
2. **Región:** Europa (la más cercana, p. ej. *West EU (Ireland)* o *Central EU (Frankfurt)*).
3. **Database password:** generar una y **guardarla** en un gestor de contraseñas (no se vuelve a mostrar).
4. Esperar 1-2 minutos a que el proyecto esté listo.

## 3. Cargar el esquema

1. En el proyecto: **SQL Editor** → **New query**.
2. Abrir `supabase/bootstrap/schema-completo.sql` de este repositorio, copiar **todo** su contenido y pegarlo.
3. Pulsar **Run**. Debe terminar sin errores («Success»). **No ejecutarlo dos veces.**

Crea las tablas, los permisos por perfil (RLS), el almacén privado de fotos `reception-photos` y las listas iniciales
(productos, defectos y orígenes).

## 4. Crear los usuarios

### Opción A (recomendada): mantener los mismos usuarios y contraseñas

El archivo **`supabase/seed.local.sql`** crea de una vez los 4 usuarios de siempre, con **los mismos nombres de usuario, la misma
contraseña y los mismos perfiles** (ADMINISTRADOR, CALIDAD, IV GAMA y 1 GAMA). Así nadie tiene que enterarse del cambio.

1. En el proyecto nuevo: **SQL Editor** → **New query** → pegar el contenido de `seed.local.sql` → **Run**. Debe mostrar una tabla con
   los 4 usuarios y su perfil.
2. **Ese archivo contiene la contraseña, por eso no está en GitHub.** Hay que pasarlo por un medio privado (no por el repositorio).
3. Los usuarios tendrán que **iniciar sesión de nuevo** en cada dispositivo (la sesión de la base de datos antigua no vale).

La contraseña actual es sencilla y la comparten los cuatro. Cuando el proyecto esté funcionando, conviene cambiarla por una distinta
para cada persona (se hace desde **Authentication → Users** en el panel de Supabase).

### Opción B: crearlos a mano con contraseñas nuevas

**Authentication → Users → Add user → Create new user.** Marcar **Auto Confirm User**. El **primero** que se crea queda como
administrador, así que crear **ADMINISTRADOR el primero**:

| Orden | Email (la app lo forma sola con el nombre de usuario, sin espacios ni guiones) | Perfil |
|---|---|---|
| 1 | `administrador@frutacheck.test` | Administrador (automático) |
| 2 | `calidad@frutacheck.test` | Calidad |
| 3 | `ivgama@frutacheck.test` | Inspector |
| 4 | `1gama@frutacheck.test` | Inspector |

Después, ya dentro de la aplicación como administrador: **Maestros → Usuarios**, poner a CALIDAD el perfil *Calidad* y revisar los
nombres. **Elegir una contraseña distinta y segura para cada persona** (no repetir la de pruebas).

## 5. Seguridad del proyecto

- **Authentication → Sign In / Providers → Email:** desactivar **Allow new users to sign up** (la app no tiene registro público).
- Anotar, en **Project Settings → API**: la **Project URL** (`https://xxxxx.supabase.co`) y la **publishable key** (`sb_publishable_…`).
  Son datos pensados para ir en el navegador (no son secretos): se pueden pasar a Claude.
  **No** compartir la `service_role` / secret key ni la contraseña de la base de datos.

## 6. Apuntar la aplicación al proyecto nuevo (lo hace Claude)

Con la *Project URL* y la *publishable key*, Claude:

1. Cambia `.github/workflows/deploy.yml` (variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`) y `.env.local`.
2. Prueba el inicio de sesión, una recepción con fotos y el informe contra el proyecto nuevo.
3. Publica. La web de siempre (`https://frunet.github.io/APP-CALIDAD/`) pasa a usar la base de datos nueva.

## Qué NO se traslada

- **Los datos del proyecto antiguo** (la recepción de ejemplo `L-DEMO-001`, la especificación de prueba y sus fotos) y sus usuarios:
  eran datos de prueba. Si hubiera datos reales que conservar, hay que exportarlos **antes** de que el proyecto antiguo caduque
  (Supabase solo restaura proyectos gratuitos pausados durante un tiempo limitado, de unos 90 días).
- Proveedores, calibres y especificaciones: hay que **volver a cargarlos** en Maestros y Especificaciones.

## Riesgos a tener en cuenta

- El plan gratuito **pausa el proyecto tras unos días sin uso**. Un proyecto de uso diario no suele pausarse, pero si hay festivos o
  vacaciones largas puede ocurrir. Con el plan Pro no se pausa y hay copias de seguridad.
- Las **cuentas gratuitas no incluyen copias de seguridad** descargables fáciles: conviene exportar los datos de vez en cuando.
- Los móviles que tengan la app abierta o instalada seguirán apuntando al proyecto antiguo hasta recargar la web (Ctrl + Shift + R)
  tras publicarse el cambio.
