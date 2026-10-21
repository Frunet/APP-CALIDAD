import { describe, expect, it } from 'vitest'
import type { RegisterReception } from '../features/receptions/register'
import { defectStats, defectTotal, finalOf, kpis, rankSuppliers, series, supplierStats } from './stats'

function rec(p: Partial<RegisterReception> & { id: string }): RegisterReception {
  return {
    received_at: '2026-10-01T10:00:00Z',
    status: 'closed',
    product: 'Piña',
    caliber: '',
    supplier_name: 'A',
    format: '',
    lot: 'L',
    origin: '',
    truck: '',
    boxes_per_pallet: 80,
    min_kg_box: 12,
    tare_box: 0,
    tare_pallet: 0,
    tare_other: 0,
    temperature: null,
    firmness: '',
    brix: null,
    lab_ref: '',
    dry_matter: null,
    notes: '',
    inspector: '',
    transportMin: null,
    transportMax: null,
    transportAvg: null,
    breaches: 0,
    autoResult: null,
    decision: null,
    decisionNote: '',
    pallets: [],
    defects: [],
    photoCount: 0,
    ...p,
  }
}
// 80 cajas × 12 kg = 960 kg mínimo
const ok = { position: 1, boxes: 80, gross_kg: 1000 }
const low = { position: 2, boxes: 80, gross_kg: 900 }

describe('finalOf', () => {
  it('la decisión de Calidad manda; si no, la propuesta', () => {
    expect(finalOf(rec({ id: '1', autoResult: 'reserves', decision: 'rejected' }))).toBe('rejected')
    expect(finalOf(rec({ id: '1', autoResult: 'reserves' }))).toBe('reserves')
    expect(finalOf(rec({ id: '1' }))).toBeNull()
  })
})

describe('kpis', () => {
  it('cuenta palets bajo mínimo, kg netos y resultados', () => {
    const k = kpis([
      rec({ id: '1', pallets: [ok, low], autoResult: 'reserves' }),
      rec({ id: '2', pallets: [ok], autoResult: 'accepted' }),
      rec({ id: '3', pallets: [], decision: 'rejected', autoResult: 'accepted' }),
      rec({ id: '4' }),
    ])
    expect(k.receptions).toBe(4)
    expect(k.palletsWeighed).toBe(3)
    expect(k.palletsBelow).toBe(1)
    expect(k.belowPct).toBeCloseTo(33.33, 1)
    expect(k.netKg).toBe(1000 + 900 + 1000)
    expect([k.accepted, k.reserves, k.rejected, k.unevaluated]).toEqual([1, 1, 1, 1])
  })

  it('sin palets pesados el porcentaje es null', () => {
    expect(kpis([rec({ id: '1' })]).belowPct).toBeNull()
  })
})

describe('supplierStats y ranking', () => {
  const rows = [
    rec({ id: '1', supplier_name: 'A', pallets: [ok], autoResult: 'accepted', brix: 14, temperature: 6, defects: [{ name: 'Golpes', percent: 2 }] }),
    rec({ id: '2', supplier_name: 'A', pallets: [low], autoResult: 'reserves', brix: 12, temperature: 8, defects: [{ name: 'Golpes', percent: 4 }] }),
    rec({ id: '3', supplier_name: 'B', pallets: [ok], autoResult: 'accepted' }),
    rec({ id: '4', supplier_name: 'C', pallets: [low], autoResult: 'rejected' }),
  ]

  it('agrupa por proveedor con medias', () => {
    const a = supplierStats(rows).find((s) => s.supplier === 'A')!
    expect(a.receptions).toBe(2)
    expect(a.belowPct).toBe(50)
    expect(a.avgBrix).toBe(13)
    expect(a.avgTemp).toBe(7)
    expect(a.avgDefectPct).toBe(3)
    expect(a.acceptedPct).toBe(50)
  })

  it('ordena: más aceptadas primero; a igualdad, menos bajo mínimo', () => {
    expect(rankSuppliers(supplierStats(rows)).map((s) => s.supplier)).toEqual(['B', 'A', 'C'])
  })
})

describe('defectStats y series', () => {
  it('cuenta recepciones por defecto y su media', () => {
    const d = defectStats([
      rec({ id: '1', defects: [{ name: 'Golpes', percent: 2 }, { name: 'Verde', percent: 1 }] }),
      rec({ id: '2', defects: [{ name: 'Golpes', percent: 4 }] }),
    ])
    expect(d[0]).toEqual({ name: 'Golpes', receptions: 2, avgPct: 3 })
    expect(d[1].name).toBe('Verde')
  })

  it('defectTotal suma los porcentajes', () => {
    expect(defectTotal(rec({ id: '1', defects: [{ name: 'a', percent: 1.5 }, { name: 'b', percent: null }, { name: 'c', percent: 2 }] }))).toBe(3.5)
  })

  it('serie cronológica sin valores vacíos', () => {
    const s = series(
      [
        rec({ id: '1', received_at: '2026-10-03T00:00:00Z', brix: 13 }),
        rec({ id: '2', received_at: '2026-10-01T00:00:00Z', brix: 11 }),
        rec({ id: '3', received_at: '2026-10-02T00:00:00Z', brix: null }),
      ],
      (r) => r.brix,
    )
    expect(s.map((p) => p.v)).toEqual([11, 13])
  })
})
