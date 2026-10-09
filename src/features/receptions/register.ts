import { supabase } from '../../lib/supabase'

/** Recepción con todos sus datos, sin fotos (para el registro en Excel). */
export interface RegisterReception {
  id: string
  received_at: string
  status: 'draft' | 'closed'
  product: string
  caliber: string
  supplier_name: string
  format: string
  lot: string
  origin: string
  truck: string
  boxes_per_pallet: number
  min_kg_box: number
  tare_box: number
  tare_pallet: number
  tare_other: number
  temperature: number | null
  firmness: string
  brix: number | null
  lab_ref: string
  dry_matter: number | null
  notes: string
  inspector: string
  pallets: { position: number; boxes: number; gross_kg: number | null }[]
  defects: { name: string; percent: number | null }[]
  photoCount: number
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

/** Carga en bloque (pocas consultas) las recepciones indicadas, respetando el orden de `ids`. */
export async function loadRegister(ids: string[]): Promise<RegisterReception[]> {
  const byId = new Map<string, RegisterReception>()
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const [rec, pal, def, pho] = await Promise.all([
      supabase.from('receptions').select('*, profiles(full_name)').in('id', chunk),
      supabase.from('pallets').select('reception_id, position, boxes, gross_kg').in('reception_id', chunk).order('position'),
      supabase.from('defects').select('reception_id, name, percent').in('reception_id', chunk),
      supabase.from('photos').select('reception_id').in('reception_id', chunk),
    ])
    for (const r of [rec, pal, def, pho]) if (r.error) throw r.error
    for (const r of rec.data ?? []) {
      byId.set(r.id, {
        id: r.id,
        received_at: r.received_at,
        status: r.status,
        product: r.product,
        caliber: r.caliber,
        supplier_name: r.supplier_name,
        format: r.format,
        lot: r.lot,
        origin: r.origin,
        truck: r.truck,
        boxes_per_pallet: r.boxes_per_pallet,
        min_kg_box: Number(r.min_kg_box),
        tare_box: Number(r.tare_box),
        tare_pallet: Number(r.tare_pallet),
        tare_other: Number(r.tare_other),
        temperature: num(r.temperature),
        firmness: r.firmness,
        brix: num(r.brix),
        lab_ref: r.lab_ref,
        dry_matter: num(r.dry_matter),
        notes: r.notes,
        inspector: (r.profiles as { full_name: string } | null)?.full_name ?? '',
        pallets: [],
        defects: [],
        photoCount: 0,
      })
    }
    for (const p of pal.data ?? []) {
      byId.get(p.reception_id)?.pallets.push({ position: p.position, boxes: p.boxes, gross_kg: num(p.gross_kg) })
    }
    for (const d of def.data ?? []) {
      byId.get(d.reception_id)?.defects.push({ name: d.name, percent: num(d.percent) })
    }
    for (const p of pho.data ?? []) {
      const r = byId.get(p.reception_id)
      if (r) r.photoCount++
    }
  }
  return ids.map((id) => byId.get(id)).filter((r): r is RegisterReception => !!r)
}
