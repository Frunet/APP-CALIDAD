import { PHOTO_BUCKET, supabase } from '../../lib/supabase'
import { toNumber } from '../../lib/calculations'
import { cacheGet, cacheSet } from '../../lib/cache'
import type { ThermoStats } from '../../lib/thermo'
import type { Agreement, PhotoKind, ReceptionDraft, ReceptionSummary, ThermoDraft } from '../../types'

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
    limit_max_temperature: '',
    limit_min_brix: '',
    limit_max_defect_pct: '',
    limit_min_dry_matter: '',
    limit_max_transport_temp: '',
    breaches: 0,
    auto_result: null,
    decision: null,
    decision_note: '',
    decided_by: null,
    decided_at: null,
    thermos: [],
    pallets: [{ boxes: '80', gross: '' }],
    defects: [{ id: newId(), defectTypeId: null, name: '', percent: '' }],
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
  result: '' | 'accepted' | 'reserves' | 'rejected'
}

export async function listReceptions(f: HistoryFilters): Promise<ReceptionSummary[]> {
  let q = supabase
    .from('receptions')
    .select('id, received_at, product, supplier_name, lot, status, inspector_id, breaches, auto_result, decision, profiles:profiles!receptions_inspector_id_fkey(full_name)')
    .order('received_at', { ascending: false })
    .limit(300)
  const term = f.search.trim().replace(/[%,()]/g, ' ')
  if (term) q = q.or(`supplier_name.ilike.%${term}%,lot.ilike.%${term}%`)
  if (f.status) q = q.eq('status', f.status)
  if (f.inspectorId) q = q.eq('inspector_id', f.inspectorId)
  // resultado final = decisión de Calidad si existe; si no, la propuesta automática
  if (f.result) q = q.or(`decision.eq.${f.result},and(decision.is.null,auto_result.eq.${f.result})`)
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
  const [rec, pal, def, pho, thr] = await Promise.all([
    supabase.from('receptions').select('*, profiles:profiles!receptions_inspector_id_fkey(full_name)').eq('id', id).single(),
    supabase.from('pallets').select('position, boxes, gross_kg').eq('reception_id', id).order('position'),
    supabase.from('defects').select('id, name, percent, defect_type_id').eq('reception_id', id),
    supabase.from('photos').select('id, kind, defect_id, pallet_position, storage_path').eq('reception_id', id).order('created_at'),
    supabase.from('thermographs').select('*').eq('reception_id', id).order('created_at'),
  ])
  for (const r of [rec, pal, def, pho, thr]) if (r.error) throw r.error
  const r = rec.data!
  const urls = await signedUrls([...(pho.data ?? []).map((p) => p.storage_path), ...(thr.data ?? []).flatMap((t) => (t.storage_path ? [t.storage_path] : []))])
  const defects = (def.data ?? []).map((d) => ({ id: d.id, defectTypeId: d.defect_type_id as string | null, name: d.name, percent: s(d.percent) }))
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
    limit_max_temperature: s(r.limit_max_temperature),
    limit_min_brix: s(r.limit_min_brix),
    limit_max_defect_pct: s(r.limit_max_defect_pct),
    limit_min_dry_matter: s(r.limit_min_dry_matter),
    limit_max_transport_temp: s(r.limit_max_transport_temp),
    breaches: r.breaches ?? 0,
    auto_result: r.auto_result ?? null,
    decision: r.decision ?? null,
    decision_note: r.decision_note ?? '',
    decided_by: r.decided_by ?? null,
    decided_at: r.decided_at ?? null,
    inspector_name: (r.profiles as { full_name: string } | null)?.full_name ?? '',
    thermos: (thr.data ?? []).map(
      (t): ThermoDraft => ({
        id: t.id,
        name: t.file_name,
        size: t.file_size ?? 0,
        path: t.storage_path,
        file: null,
        url: t.storage_path ? (urls[t.storage_path] ?? '') : '',
        columnLabel: t.column_label,
        stats:
          t.n_readings === null
            ? null
            : ({
                n: t.n_readings,
                min: Number(t.min_temp),
                max: Number(t.max_temp),
                avg: Number(t.avg_temp),
                first: t.started_at,
                last: t.ended_at,
                series: (t.series ?? []) as number[],
              } satisfies ThermoStats),
      }),
    ),
    pallets: (pal.data ?? []).map((p) => ({ boxes: s(p.boxes), gross: s(p.gross_kg) })),
    defects: defects.length ? defects : [{ id: newId(), defectTypeId: null, name: '', percent: '' }],
    photos: (pho.data ?? []).map((p) => ({
      id: p.id,
      kind: p.kind as PhotoKind,
      defectId: p.defect_id,
      palletIndex: p.pallet_position === null ? null : p.pallet_position - 1,
      path: p.storage_path,
      file: null,
      url: urls[p.storage_path] ?? '',
    })),
  }
}

/** Resumen del transporte para la recepción: mínima, máxima y media (ponderada) de todos los termógrafos. */
function transportSummary(thermos: ThermoDraft[]) {
  const stats = thermos.flatMap((t) => (t.stats ? [t.stats] : []))
  if (!stats.length) return { transport_min: null, transport_max: null, transport_avg: null }
  const n = stats.reduce((a, x) => a + x.n, 0)
  return {
    transport_min: Math.min(...stats.map((x) => x.min)),
    transport_max: Math.max(...stats.map((x) => x.max)),
    transport_avg: stats.reduce((a, x) => a + x.avg * x.n, 0) / n,
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
    limit_max_temperature: toNumber(draft.limit_max_temperature),
    limit_min_brix: toNumber(draft.limit_min_brix),
    limit_max_defect_pct: toNumber(draft.limit_max_defect_pct),
    limit_min_dry_matter: toNumber(draft.limit_min_dry_matter),
    limit_max_transport_temp: toNumber(draft.limit_max_transport_temp),
    breaches: draft.breaches,
    auto_result: draft.auto_result,
    decision: draft.decision,
    decision_note: draft.decision_note,
    decided_by: draft.decided_by,
    decided_at: draft.decided_at,
    ...transportSummary(draft.thermos),
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
      keepDefects.map((d) => ({
        id: d.id,
        reception_id: id,
        defect_type_id: d.defectTypeId,
        name: d.name.trim(),
        percent: toNumber(d.percent),
      })),
    )
    if (error) throw error
  }

  // Fotos: borrar las quitadas, subir las nuevas.
  // Termógrafos: borrar los quitados y subir los nuevos (el archivo original se guarda tal cual).
  const { data: existingThermos, error: e5 } = await supabase.from('thermographs').select('id, storage_path').eq('reception_id', id)
  if (e5) throw e5
  const keepThermoIds = new Set(draft.thermos.map((t) => t.id))
  const removedThermos = (existingThermos ?? []).filter((t) => !keepThermoIds.has(t.id))
  if (removedThermos.length) {
    const paths = removedThermos.flatMap((t) => (t.storage_path ? [t.storage_path] : []))
    if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths)
    const { error } = await supabase.from('thermographs').delete().in('id', removedThermos.map((t) => t.id))
    if (error) throw error
  }
  for (const t of draft.thermos.filter((x) => x.file)) {
    const ext = (t.name.split('.').pop() ?? 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
    const path = `${id}/${t.id}.${ext}`
    const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, t.file!, { contentType: t.file!.type || 'application/octet-stream', upsert: true })
    if (up.error) throw up.error
    const { error } = await supabase.from('thermographs').upsert({
      id: t.id,
      reception_id: id,
      file_name: t.name,
      file_size: t.size,
      storage_path: path,
      column_label: t.columnLabel,
      n_readings: t.stats?.n ?? null,
      min_temp: t.stats?.min ?? null,
      max_temp: t.stats?.max ?? null,
      avg_temp: t.stats?.avg ?? null,
      started_at: t.stats?.first ?? '',
      ended_at: t.stats?.last ?? '',
      series: t.stats?.series ?? [],
    })
    if (error) throw error
  }

  // Se descartan las fotos de defectos eliminados y las de palets que ya no existen.
  const photos = draft.photos.filter(
    (p) =>
      (p.kind !== 'defect' || (p.defectId && keepIds.has(p.defectId))) &&
      (p.kind !== 'origin' || (p.palletIndex !== null && p.palletIndex < draft.pallets.length)),
  )
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
      .upsert({
        id: p.id,
        reception_id: id,
        defect_id: p.defectId,
        pallet_position: p.palletIndex === null ? null : p.palletIndex + 1,
        kind: p.kind,
        storage_path: path,
      })
    if (error) throw error
  }
  return id
}

export async function deleteReception(id: string): Promise<void> {
  const [{ data }, { data: thr }] = await Promise.all([
    supabase.from('photos').select('storage_path').eq('reception_id', id),
    supabase.from('thermographs').select('storage_path').eq('reception_id', id),
  ])
  const paths = [...(data ?? []).map((p) => p.storage_path), ...(thr ?? []).flatMap((t) => (t.storage_path ? [t.storage_path] : []))]
  if (paths.length) await supabase.storage.from(PHOTO_BUCKET).remove(paths)
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
  if (error) {
    // Sin conexión se usa la copia de la última vez.
    const cached = cacheGet<AgreementWithSupplier[]>('agreements')
    if (cached) return cached
    throw error
  }
  const list = (data ?? []) as unknown as AgreementWithSupplier[]
  cacheSet('agreements', list)
  return list
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
