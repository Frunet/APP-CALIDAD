import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Caliber, Product, Supplier } from '../types'

export interface Masters {
  products: Product[]
  calibers: Caliber[]
  suppliers: Supplier[]
}

const EMPTY: Masters = { products: [], calibers: [], suppliers: [] }

export async function loadMasters(): Promise<Masters> {
  const [p, c, s] = await Promise.all([
    supabase.from('products').select('id, name, has_dry_matter, active').order('name'),
    supabase.from('calibers').select('id, product_id, name, active').order('name'),
    supabase.from('suppliers').select('id, name, active').order('name'),
  ])
  for (const r of [p, c, s]) if (r.error) throw r.error
  return {
    products: (p.data ?? []) as Product[],
    calibers: (c.data ?? []) as Caliber[],
    suppliers: (s.data ?? []) as Supplier[],
  }
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
      .catch(() => setError('No se pudieron cargar los maestros.'))
  }, [])

  useEffect(refresh, [refresh])
  return { ...masters, loaded, error, refresh }
}

/** Natural sort para calibres numéricos (2, 10, 12…). */
export function byCaliberName(a: Caliber, b: Caliber): number {
  return a.name.localeCompare(b.name, 'es', { numeric: true })
}
