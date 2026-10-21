import { describe, expect, it } from 'vitest'
import { palletResult } from './calculations'
import { evaluate, finalResult, NO_LIMITS, suggestResult, type EvaluationInput } from './evaluation'

const cfg = { minKgBox: 12, tareBox: 0, tarePallet: 0, tareOther: 0 }
const okPallet = palletResult('80', '1000', cfg) // 1000 >= 960
const badPallet = palletResult('80', '900', cfg) // 900 < 960

const base: EvaluationInput = {
  limits: { ...NO_LIMITS, maxTemperature: 10, minBrix: 12, maxDefectPct: 5, minDryMatter: 21, maxTransportTemp: 8 },
  pallets: [okPallet],
  temperature: 8,
  brix: 13,
  requiresDryMatter: false,
  dryMatter: null,
  defectPcts: [2, 1],
  transportMax: 6,
}

describe('suggestResult', () => {
  it('0 = aceptada, 1-2 = con reservas, 3+ = rechazada', () => {
    expect(suggestResult(0)).toBe('accepted')
    expect(suggestResult(1)).toBe('reserves')
    expect(suggestResult(2)).toBe('reserves')
    expect(suggestResult(3)).toBe('rejected')
  })
})

describe('evaluate', () => {
  it('sin incumplimientos: aceptada', () => {
    const e = evaluate(base)
    expect(e.breaches).toBe(0)
    expect(e.suggestion).toBe('accepted')
  })

  it('palets bajo mínimo cuentan como un incumplimiento', () => {
    const e = evaluate({ ...base, pallets: [okPallet, badPallet] })
    expect(e.breaches).toBe(1)
    expect(e.checks.find((c) => c.key === 'weight')?.status).toBe('breach')
    expect(e.suggestion).toBe('reserves')
  })

  it('temperatura, brix, defectos y transporte fuera de límite', () => {
    const e = evaluate({ ...base, temperature: 12, brix: 10, defectPcts: [4, 3], transportMax: 9 })
    expect(e.checks.filter((c) => c.status === 'breach').map((c) => c.key)).toEqual(['temperature', 'brix', 'defects', 'transport'])
    expect(e.suggestion).toBe('rejected')
  })

  it('el límite exacto se cumple (no es incumplimiento)', () => {
    const e = evaluate({ ...base, temperature: 10, brix: 12, defectPcts: [5], transportMax: 8 })
    expect(e.breaches).toBe(0)
  })

  it('sin dato medido no se cuenta como incumplimiento', () => {
    const e = evaluate({ ...base, temperature: null, brix: null, transportMax: null })
    expect(e.breaches).toBe(0)
    expect(e.checks.filter((c) => c.status === 'na').map((c) => c.key)).toEqual(['temperature', 'brix', 'transport'])
  })

  it('materia seca solo se evalúa si el producto la pide', () => {
    expect(evaluate({ ...base, dryMatter: 18 }).checks.some((c) => c.key === 'dryMatter')).toBe(false)
    const e = evaluate({ ...base, requiresDryMatter: true, dryMatter: 18 })
    expect(e.checks.find((c) => c.key === 'dryMatter')?.status).toBe('breach')
    expect(evaluate({ ...base, requiresDryMatter: true, dryMatter: null }).checks.find((c) => c.key === 'dryMatter')?.status).toBe('na')
  })

  it('sin límites definidos solo se comprueba el peso', () => {
    const e = evaluate({ ...base, limits: NO_LIMITS, temperature: 40 })
    expect(e.checks.map((c) => c.key)).toEqual(['weight'])
  })
})

describe('finalResult', () => {
  it('la decisión de Calidad manda sobre la propuesta', () => {
    expect(finalResult('accepted', 'rejected')).toBe('accepted')
    expect(finalResult(null, 'reserves')).toBe('reserves')
  })
})
