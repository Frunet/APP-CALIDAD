import { PHOTO_BUCKET, supabase } from '../../lib/supabase'
import { toNumber } from '../../lib/calculations'
import type { Agreement, PhotoKind, ReceptionDraft, ReceptionSummary } from '../../types'

export function newId(): string {
  return crypto.randomUUID()
}

export function localDatetimeNow(): string {
  return toLocalInput(new Date().toISOString())
}

function toLocalInput(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export function emptyDraft(): ReceptionDraft {
  return {
    id: null,
    received_at: localDatetimeNow(),
    product_id: null,
    product: '',
    caliber_id: null,
    caliber: '',
    supplier_id: null,
    supplier_name: '',
    lot: '',
    origin: '',
    truck: '',
    format: '',
    boxes_per_pallet: '80',
    min_kg_box: '12',
    tare_box: '0',
    tare_pallet: '0',
    tare_other: '0',
    temperature: '',
    firmness: '',
    brix: '',
    lab_ref: '',
    dry_matter: '',
    notes: '',
    status: 'draft',
    pallets: [{ boxes: '80', gross: '' }],
    defects: [{ id: newId(), name: '', percent: '' }],
    photos: [],
  }
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))

export interface HistoryFilters {
  search: string
  status: '' | 'draft' | 'closed'
  inspectorId: string
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
}

export async function listReceptions(f: HistoryFilters): Promise<ReceptionSummary[]> {
  let q = supabase
    .from('receptions')
    .select('id, received_at, product, supplier_name, lot, status, inspector_id, profiles(full_name)')
    .order('received_at', { ascending: false })
    .limit(300)
  const term = f.search.trim().replace(/[%,()]/g, ' ')
  if (term) q = q.or(`supplier_name.ilike.%${term}%,lot.ilike.%${term}%`)
  if (f.status) q = q.eq('status', f.status)
  if (f.inspectorId) q = q.eq('inspector_id', f.inspectorId)
  if (f.from) q = q.gte('received_at', new Date(`${f.from}T00:00:00`).toISOString())
  if (f.to) q = q.lte('received_at', new Date(`${f.to}T23:59:59`).toISOString())
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as ReceptionSummary[]
}

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {}
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600)
  if (error) throw error
  const out: Record<string, string> = {}
  for (const item of data ?? []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl
  return out
}

export async function loadReception(id: string): Promise<ReceptionDraft> {
  const [rec, pal, def, pho] = await Promise.all([
    supabase.from('receptions').select('*').eq('id', id).single(),
    supabase.from('pallets').select('position, boxes, gross_kg').eq('reception_id', id).order('position'),
    supabase.from('defects').select('id, name, percent').eq('reception_id', id),
    supabase.from('photos').select('id, kind, defect_id, storage_path').eq('reception_id', id).order('created_at'),
  ])
  for (const r of [rec, pal, def, pho]) if (r.error) throw r.error
  const r = rec.data!
  const urls = await signedUrls((pho.data ?? []).map((p) => p.storage_path))
  const defects = (def.data ?? []).map((d) => ({ id: d.id, name: d.name, percent: s(d.percent) }))
  return {
    id: r.id,
    received_at: toLocalInput(r.received_at),
    product_id: r.product_id,
    product: r.product,
    caliber_id: r.caliber_id,
    caliber: r.caliber,
    supplier_id: r.supplier_id,
    supplier_name: r.supplier_name,
    lot: r.lot,
    origin: r.origin,
    truck: r.truck,
    format: r.format,
    boxes_per_pallet: s(r.boxes_per_pallet),
    min_kg_box: s(r.min_kg_box),
    tare_box: s(r.tare_box),
    tare_pallet: s(r.tare_pallet),
    tare_other: s(r.tare_other),
    temperature: s(r.temperature),
    firmness: r.firmness,
    brix: s(r.brix),
    lab_ref: r.lab_ref,
    dry_matter: s(r.dry_matter),
    notes: r.notes,
    status: r.status,
    pallets: (pal.data ?? []).map((p) => ({ boxes: s(p.boxes), gross: s(p.gross_kg) })),
    defects: defects.length ? defects : [{ id: newId(), name: '', percent: '' }],
    photos: (pho.data ?? []).map((p) => ({
      id: p.id,
      kind: p.kind as PhotoKind,
      defectId: p.defect_id,
      path: p.storage_path,
      file: null,
      url: urls[p.storage_path] ?? '',
    })),
  }
}

export async function saveReception(draft: ReceptionDraft): Promise<string> {
  const id = draft.id ?? newId()

  const { error: e1 } = await supabase.from('receptions').upsert({
    id,
    received_at: new Date(draft.received_at).toISOString(),
    product_id: draft.product_id,
    product: draft.product,
    caliber_id: draft.caliber_id,
    caliber: draft.caliber,
    supplier_id: draft.supplier_id,
    supplier_name: draft.supplier_name.trim(),
    lot: draft.lot.trim(),
    origin: draft.origin.trim(),
    truck: draft.truck.trim(),
    format: draft.format.trim(),
    boxes_per_pallet: Math.round(toNumber(draft.boxes_per_pallet) ?? 0),
    min_kg_box: toNumber(draft.min_kg_box) ?? 0,
    tare_box: toNumber(draft.tare_box) ?? 0,
    tare_pallet: toNumber(draft.tare_pallet) ?? 0,
    tare_other: toNumber(draft.tare_other) ?? 0,
    temperature: toNumber(draft.temperature),
    firmness: draft.firmness.trim(),
    brix: toNumber(draft.brix),
    lab_ref: draft.lab_ref.trim(),
    dry_matter: toNumber(draft.dry_matter),
    notes: draft.notes.trim(),
    status: draft.status,
  })
  if (e1) throw e1

  // Palets: se reescriben completos.
  const { error: e2 } = await supabase.from('pallets').delete().eq('reception_id', id)
  if (e2) throw e2
  if (draft.pallets.length) {
    const { error } = await supabase.from('pallets').insert(
      draft.pallets.map((p, i) => ({
        reception_id: id,
        position: i + 1,
        boxes: Math.round(toNumber(p.boxes) ?? 0),
        gross_kg: toNumber(p.gross),
      })),
    )
    if (error) throw error
  }

  // Defectos: upsert por id y borrado de los eliminados (sus fotos caen en cascada).
  const keepDefects = draft.defects.filter((d) => d.name.trim() || d.percent.trim() || draft.photos.some((p) => p.defectId === d.id))
  const { data: existingDefects, error: e3 } = await supabase.from('defects').select('id').eq('reception_id', id)
  if (e3) throw e3
  const keepIds = new Set(keepDefects.map((d) => d.id))
  const removedDefects = (existingDefects ?? []).map((d) => d.id).filter((x) => !keepIds.has(x))
  if (removedDefects.length) {
    const { data: gone } = await supabase.from('photos').select('storage_path').in('defect_id', removedDefects)
    if (gone?.length) await supabase.storage.from(PHOTO_BUCKET).remove(gone.map((g) => g.storage_path))
    const { error } = await supabase.from('defects').delete().in('id', removedDefects)
    if (error) throw error
  }
  if (keepDefects.length) {
    const { error } = await supabase.from('defects').upsert(
      keepDefects.map((d) => ({ id: d.id, reception_id: id, name: d.name.trim(), percent: toNumber(d.percent) })),
    )
    if (error) throw error
  }

  // Fotos: borrar las quitadas, subir las nuevas.
  const photos = draft.photos.filter((p) => p.kind !== 'defect' || (p.defectId && keepIds.has(p.defectId)))
  const { data: existingPhotos, error: e4 } = await supabase.from('photos').select('id, storage_path').eq('reception_id', id)
  if (e4) throw e4
  const keepPhotoIds = new Set(photos.map((p) => p.id))
  const removedPhotos = (existingPhotos ?? []).filter((p) => !keepPhotoIds.has(p.id))
  if (removedPhotos.length) {
    await supabase.storage.from(PHOTO_BUCKET).remove(removedPhotos.map((p) => p.storage_path))
    const { error } = await supabase.from('photos').delete().in('id', removedPhotos.map((p) => p.id))
    if (error) throw error
  }
  for (const p of photos.filter((x) => x.file)) {
    const path = `${id}/${p.id}.jpg`
    const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, p.file!, { contentType: 'image/jpeg', upsert: true })
    if (up.error) throw up.error
    const { error } = await supabase
      .from('photos')
      .upsert({ id: p.id, reception_id: id, defect_id: p.defectId, kind: p.kind, storage_path: path })
    if (error) throw error
  }
  return id
}

export async function deleteReception(id: string): Promise<void> {
  const { data } = await supabase.from('photos').select('storage_path').eq('reception_id', id)
  if (data?.length) await supabase.storage.from(PHOTO_BUCKET).remove(data.map((p) => p.storage_path))
  const { error } = await supabase.from('receptions').delete().eq('id', id)
  if (error) throw error
}

export interface AgreementWithSupplier extends Agreement {
  suppliers: { name: string } | null
  products: { name: string } | null
}

export async function listAgreements(): Promise<AgreementWithSupplier[]> {
  const { data, error } = await supabase
    .from('agreements')
    .select('*, suppliers(name), products(name)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as AgreementWithSupplier[]
}

/** Especificación del proveedor+producto: formato exacto, si no el genérico (sin formato). */
export function findAgreement(
  list: AgreementWithSupplier[],
  supplierId: string | null,
  productId: string | null,
  format: string,
): AgreementWithSupplier | undefined {
  if (!supplierId || !productId) return undefined
  const fmt = format.trim().toLowerCase()
  const candidates = list.filter((a) => a.supplier_id === supplierId && a.product_id === productId)
  return (
    candidates.find((a) => a.format.toLowerCase() === fmt) ??
    candidates.find((a) => !a.format) ??
    (fmt ? undefined : candidates[0])
  )
}
