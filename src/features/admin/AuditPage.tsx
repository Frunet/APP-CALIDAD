import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface AuditRow {
  id: number
  at: string
  user_name: string
  action: 'insert' | 'update' | 'delete'
  entity_id: string
  summary: { lote?: string; proveedor?: string; producto?: string; fecha?: string }
  changes: Record<string, unknown>
}

const FIELD_LABELS: Record<string, string> = {
  lot: 'Lote',
  supplier_name: 'Proveedor',
  product: 'Producto',
  caliber: 'Calibre',
  origin: 'Origen',
  truck: 'Camión',
  format: 'Formato',
  boxes_per_pallet: 'Cajas por palet',
  min_kg_box: 'Mínimo kg/caja',
  tare_box: 'Tara caja',
  tare_pallet: 'Tara palet',
  tare_other: 'Otras taras',
  temperature: 'Temperatura',
  firmness: 'Firmeza',
  brix: '°Brix',
  lab_ref: 'Ref. laboratorio',
  dry_matter: 'Materia seca',
  notes: 'Observaciones',
  status: 'Estado',
  received_at: 'Fecha',
  decision: 'Decisión',
  decision_note: 'Comentario de la decisión',
}
// campos internos o derivados (se recalculan solos): no aportan al registro
const HIDDEN_FIELDS = new Set([
  'supplier_id', 'product_id', 'caliber_id', 'inspector_id', 'decided_by', 'decided_at', 'breaches', 'auto_result',
  'limit_max_temperature', 'limit_min_brix', 'limit_max_defect_pct', 'limit_min_dry_matter', 'limit_max_transport_temp',
  'transport_min', 'transport_max', 'transport_avg',
])

const PHOTO_KINDS: Record<string, string> = { label: 'albarán', pallet: 'palet', cut: 'corte', defect: 'defecto', origin: 'palet de origen', thermo: 'termógrafo' }
const DECISIONS: Record<string, string> = { accepted: 'Aceptada', reserves: 'Aceptada con reservas', rejected: 'Rechazada' }

function fmt(field: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (field === 'status') return v === 'closed' ? 'Cerrada' : 'Borrador'
  if (field === 'decision') return DECISIONS[String(v)] ?? String(v)
  if (field === 'received_at') return new Date(String(v)).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
  return String(v)
}

/** Si varios guardados seguidos se agrupan, el «antes» es el primer valor y el «después» el último. */
function toMap<T, K>(items: T[], key: (t: T) => K, keep: 'first' | 'last'): Map<K, T> {
  const m = new Map<K, T>()
  for (const it of items) if (keep === 'last' || !m.has(key(it))) m.set(key(it), it)
  return m
}

type Pallet = { palet: number; cajas: number; bruto: number | null }
type Defect = { defecto: string; pct: number | null }

/** Convierte lo registrado en frases legibles; si no queda ningún cambio real devuelve []. */
export function describeChanges(row: AuditRow): string[] {
  const c = row.changes
  const out: string[] = []

  if (row.action === 'delete') {
    if (c.inspector) out.push(`Recepción de ${c.inspector}`)
    if (c.estado) out.push(`Estaba ${c.estado === 'closed' ? 'cerrada' : 'en borrador'}`)
    return out
  }
  if (row.action === 'insert') return out

  const campos = (c.campos ?? {}) as Record<string, { de: unknown; a: unknown }>
  for (const [k, v] of Object.entries(campos)) {
    if (HIDDEN_FIELDS.has(k)) continue
    out.push(`${FIELD_LABELS[k] ?? k}: ${fmt(k, v.de)} → ${fmt(k, v.a)}`)
  }

  const before = toMap((c.palets_antes ?? []) as Pallet[], (p) => p.palet, 'first')
  const after = toMap((c.palets_despues ?? []) as Pallet[], (p) => p.palet, 'last')
  for (const n of [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a - b)) {
    const b = before.get(n)
    const a = after.get(n)
    if (b && !a) out.push(`Palet ${n} eliminado`)
    else if (!b && a) out.push(`Palet ${n} añadido (${a.cajas} cajas, bruto ${fmt('', a.bruto)} kg)`)
    else if (a && b) {
      if (a.bruto !== b.bruto) out.push(`Palet ${n} · peso bruto: ${fmt('', b.bruto)} → ${fmt('', a.bruto)} kg`)
      if (a.cajas !== b.cajas) out.push(`Palet ${n} · cajas: ${b.cajas} → ${a.cajas}`)
    }
  }

  const dBefore = (c.defectos_antes ?? []) as Defect[]
  const dAfter = (c.defectos_despues ?? []) as Defect[]
  {
    const key = (d: Defect) => d.defecto || 'Sin especificar'
    const mb = toMap(dBefore, key, 'first')
    const ma = toMap(dAfter, key, 'last')
    for (const name of new Set([...mb.keys(), ...ma.keys()])) {
      const b = mb.get(name)
      const a = ma.get(name)
      if (b && !a) out.push(`Defecto «${name}» eliminado`)
      else if (!b && a) out.push(`Defecto «${name}» añadido (${fmt('', a.pct)} %)`)
      else if (a && b && a.pct !== b.pct) out.push(`Defecto «${name}»: ${fmt('', b.pct)} % → ${fmt('', a.pct)} %`)
    }
  }

  const added = (c.fotos_anadidas ?? []) as string[]
  const removed = (c.fotos_eliminadas ?? []) as string[]
  const count = (xs: string[]) =>
    Object.entries(
      xs.reduce<Record<string, number>>((m, k) => ({ ...m, [PHOTO_KINDS[k] ?? k]: (m[PHOTO_KINDS[k] ?? k] ?? 0) + 1 }), {}),
    )
      .map(([k, n]) => `${k} ×${n}`)
      .join(', ')
  const thermoAdded = (c.termografos_anadidos ?? []) as string[]
  const thermoRemoved = (c.termografos_eliminados ?? []) as string[]
  if (thermoAdded.length) out.push(`Archivos de termógrafo añadidos: ${thermoAdded.join(', ')}`)
  if (thermoRemoved.length) out.push(`Archivos de termógrafo eliminados: ${thermoRemoved.join(', ')}`)
  if (added.length) out.push(`Fotos añadidas: ${added.length} (${count(added)})`)
  if (removed.length) out.push(`Fotos eliminadas: ${removed.length} (${count(removed)})`)
  return out
}

const ACTION_LABEL = { insert: 'Creada', update: 'Modificada', delete: 'Eliminada' } as const

export function AuditPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState<'' | AuditRow['action']>('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase
      .from('audit_log')
      .select('id, at, user_name, action, entity_id, summary, changes')
      .order('at', { ascending: false })
      .limit(500)
      .then(({ data, error: err }) => {
        if (err) setError('No se pudo cargar el registro.')
        else setRows((data ?? []) as AuditRow[])
      })
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (rows ?? [])
      .map((r) => ({ r, lines: describeChanges(r) }))
      .filter(({ r, lines }) => (r.action === 'update' ? lines.length > 0 : true)) // guardados sin cambios reales
      .filter(({ r }) => !action || r.action === action)
      .filter(({ r }) => {
        if (!q) return true
        return [r.user_name, r.summary.lote, r.summary.proveedor, r.summary.producto].some((t) => (t ?? '').toLowerCase().includes(q))
      })
  }, [rows, action, search])

  return (
    <div className="card">
      <h2>Registro de cambios</h2>
      <p className="muted">Quién creó, modificó o eliminó cada recepción y cuándo. Solo lo ve el administrador y no se puede editar.</p>
      <div className="grid">
        <label>
          Buscar
          <input placeholder="Usuario, lote, proveedor o producto" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label>
          Acción
          <select value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
            <option value="">Todas</option>
            <option value="insert">Creadas</option>
            <option value="update">Modificadas</option>
            <option value="delete">Eliminadas</option>
          </select>
        </label>
      </div>
      {error && <div className="result bad">{error}</div>}
      {rows === null && !error && <p className="muted">Cargando…</p>}
      {rows && <p className="muted">{visible.length} registro{visible.length === 1 ? '' : 's'}</p>}
      <div className="list">
        {visible.map(({ r, lines }) => (
          <div className="list-item audit-item" key={r.id}>
            <div className="grow">
              <div>
                <span className={'badge audit-' + r.action}>{ACTION_LABEL[r.action]}</span>{' '}
                <strong>{r.summary.lote ? `Lote ${r.summary.lote}` : 'Recepción'}</strong> · {r.summary.proveedor || 'Sin proveedor'}
                {r.summary.producto ? ` · ${r.summary.producto}` : ''}
              </div>
              <div className="muted">
                {new Date(r.at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' })} · {r.user_name || 'Usuario desconocido'}
              </div>
              {lines.length > 0 && (
                <ul className="audit-lines">
                  {lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
        {rows && !visible.length && <p className="muted">No hay registros.</p>}
      </div>
    </div>
  )
}
