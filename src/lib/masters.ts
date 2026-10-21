import { useCallback, useEffect, useState } from 'react'
import { cacheGet, cacheSet } from './cache'
import { supabase } from './supabase'
import type { Caliber, DefectType, Product, Supplier } from '../types'

export interface Masters {
  products: Product[]
  calibers: Caliber[]
  suppliers: Supplier[]
  defectTypes: DefectType[]
}

const EMPTY: Masters = { products: [], calibers: [], suppliers: [], defectTypes: [] }

export async function loadMasters(): Promise<Masters> {
  const [p, c, s, d] = await Promise.all([
    supabase.from('products').select('id, name, has_dry_matter, active').order('name'),
    supabase.from('calibers').select('id, product_id, name, active').order('name'),
    supabase.from('suppliers').select('id, name, active').order('name'),
    supabase.from('defect_types').select('id, name, active').order('name'),
  ])
  for (const r of [p, c, s, d]) if (r.error) throw r.error
  const masters: Masters = {
    products: (p.data ?? []) as Product[],
    calibers: (c.data ?? []) as Caliber[],
    suppliers: (s.data ?? []) as Supplier[],
    defectTypes: (d.data ?? []) as DefectType[],
  }
  cacheSet('masters', masters)
  return masters
}

/** Carga los maestros (proveedores, productos y calibres) y permite refrescarlos. */
export function useMasters() {
  const [masters, setMasters] = useState<Masters>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    loadMasters()
      .then((m) => {
        setMasters(m)
        setError(null)
        setLoaded(true)
      })
      .catch(() => {
        // Sin conexión se usa la copia de la última vez que se cargaron.
        const cached = cacheGet<Masters>('masters')
        if (cached) {
          setMasters(cached)
          setError(null)
          setLoaded(true)
        } else setError('No se pudieron cargar los maestros.')
      })
  }, [])

  useEffect(refresh, [refresh])
  return { ...masters, loaded, error, refresh }
}

/** Natural sort para calibres numéricos (2, 10, 12…). */
export function byCaliberName(a: Caliber, b: Caliber): number {
  return a.name.localeCompare(b.name, 'es', { numeric: true })
}
