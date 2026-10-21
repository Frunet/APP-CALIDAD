import type { RegisterReception } from '../features/receptions/register'
import { palletResult } from './calculations'
import type { Result } from './evaluation'

export type Row = RegisterReception

export const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** Resultado final de una recepción: decisión de Calidad o, si no hay, la propuesta automática. */
export const finalOf = (r: Row): Result | null => ((r.decision ?? r.autoResult) as Result | null) ?? null

export function palletsOf(r: Row) {
  const cfg = { minKgBox: r.min_kg_box, tareBox: r.tare_box, tarePallet: r.tare_pallet, tareOther: r.tare_other }
  const results = r.pallets.map((p) => palletResult(p.boxes, p.gross_kg ?? '', cfg))
  const weighed = results.filter((x) => x.valid)
  return {
    weighed: weighed.length,
    below: weighed.filter((x) => !x.ok).length,
    netKg: weighed.reduce((a, x) => a + (x.net ?? 0), 0),
  }
}

/** Suma de los porcentajes de defectos de la recepción. */
export const defectTotal = (r: Row): number => r.defects.reduce((a, d) => a + (d.percent ?? 0), 0)

export interface Kpis {
  receptions: number
  palletsWeighed: number
  palletsBelow: number
  belowPct: number | null
  netKg: number
  accepted: number
  reserves: number
  rejected: number
  unevaluated: number
}

export function kpis(rows: Row[]): Kpis {
  const k: Kpis = { receptions: rows.length, palletsWeighed: 0, palletsBelow: 0, belowPct: null, netKg: 0, accepted: 0, reserves: 0, rejected: 0, unevaluated: 0 }
  for (const r of rows) {
    const p = palletsOf(r)
    k.palletsWeighed += p.weighed
    k.palletsBelow += p.below
    k.netKg += p.netKg
    const f = finalOf(r)
    if (f === 'accepted') k.accepted++
    else if (f === 'reserves') k.reserves++
    else if (f === 'rejected') k.rejected++
    else k.unevaluated++
  }
  k.belowPct = k.palletsWeighed ? (k.palletsBelow / k.palletsWeighed) * 100 : null
  return k
}

export interface SupplierStat {
  supplier: string
  receptions: number
  palletsWeighed: number
  palletsBelow: number
  belowPct: number | null
  avgDefectPct: number | null
  avgBrix: number | null
  avgTemp: number | null
  accepted: number
  reserves: number
  rejected: number
  /** % de recepciones aceptadas (sin reservas) sobre las evaluadas. */
  acceptedPct: number | null
}

export function supplierStats(rows: Row[]): SupplierStat[] {
  const groups = new Map<string, Row[]>()
  for (const r of rows) {
    const k = r.supplier_name || 'Sin proveedor'
    groups.set(k, [...(groups.get(k) ?? []), r])
  }
  return [...groups.entries()].map(([supplier, rs]) => {
    const k = kpis(rs)
    const evaluated = k.accepted + k.reserves + k.rejected
    return {
      supplier,
      receptions: rs.length,
      palletsWeighed: k.palletsWeighed,
      palletsBelow: k.palletsBelow,
      belowPct: k.belowPct,
      avgDefectPct: mean(rs.map(defectTotal)),
      avgBrix: mean(rs.flatMap((r) => (r.brix === null ? [] : [r.brix]))),
      avgTemp: mean(rs.flatMap((r) => (r.temperature === null ? [] : [r.temperature]))),
      accepted: k.accepted,
      reserves: k.reserves,
      rejected: k.rejected,
      acceptedPct: evaluated ? (k.accepted / evaluated) * 100 : null,
    }
  })
}

/**
 * Ranking: primero los de más recepciones aceptadas; a igualdad, menos palets bajo mínimo y menos defectos.
 * Los proveedores sin recepciones evaluadas van al final.
 */
export function rankSuppliers(stats: SupplierStat[]): SupplierStat[] {
  const num = (v: number | null, dflt: number) => (v === null ? dflt : v)
  return [...stats].sort(
    (a, b) =>
      num(b.acceptedPct, -1) - num(a.acceptedPct, -1) ||
      num(a.belowPct, 0) - num(b.belowPct, 0) ||
      num(a.avgDefectPct, 0) - num(b.avgDefectPct, 0) ||
      b.receptions - a.receptions,
  )
}

export interface DefectStat {
  name: string
  receptions: number
  avgPct: number | null
}

export function defectStats(rows: Row[]): DefectStat[] {
  const byName = new Map<string, { receptions: Set<string>; pcts: number[] }>()
  for (const r of rows) {
    for (const d of r.defects) {
      if (!d.name && d.percent === null) continue
      const name = d.name || 'Sin especificar'
      const g = byName.get(name) ?? { receptions: new Set<string>(), pcts: [] }
      g.receptions.add(r.id)
      if (d.percent !== null) g.pcts.push(d.percent)
      byName.set(name, g)
    }
  }
  return [...byName.entries()]
    .map(([name, g]) => ({ name, receptions: g.receptions.size, avgPct: mean(g.pcts) }))
    .sort((a, b) => b.receptions - a.receptions || (b.avgPct ?? 0) - (a.avgPct ?? 0))
}

export interface Point {
  t: number // milisegundos
  v: number
  label: string
}

/** Serie cronológica de un valor medido en cada recepción (omite las que no lo tienen). */
export function series(rows: Row[], pick: (r: Row) => number | null): Point[] {
  return rows
    .flatMap((r) => {
      const v = pick(r)
      const t = new Date(r.received_at).getTime()
      return v === null || Number.isNaN(t) ? [] : [{ t, v, label: `${r.supplier_name || 'Sin proveedor'} · ${r.lot || 's/lote'}` }]
    })
    .sort((a, b) => a.t - b.t)
}
