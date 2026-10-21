import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (copia .env.example a .env.local).')
}

// fetch se resuelve en cada llamada (no al crear el cliente): permite simular la falta de conexión en pruebas.
export const supabase = createClient(url, key, { global: { fetch: (...args) => fetch(...args) } })
export const PHOTO_BUCKET = 'reception-photos'
