import { describe, expect, it } from 'vitest'
import { palletResult, summarize, toNumber } from './calculations'

const cfg = { minKgBox: 12, tareBox: 0.5, tarePallet: 20, tareOther: 0 }

describe('toNumber', () => {
  it('acepta coma decimal y rechaza vacío', () => {
    expect(toNumber('12,5')).toBe(12.5)
    expect(toNumber('')).toBeNull()
    expect(toNumber('abc')).toBeNull()
  })
})

describe('palletResult', () => {
  it('calcula tara, neto y mínimo (80 cajas × 12 kg = 960 kg)', () => {
    const r = palletResult('80', '1020', cfg)
    expect(r.tare).toBe(80 * 0.5 + 20)
    expect(r.net).toBe(1020 - 60)
    expect(r.minimum).toBe(960)
    expect(r.ok).toBe(true)
  })

  it('marca bajo mínimo', () => {
    const r = palletResult('80', '1000', cfg)
    expect(r.net).toBe(940)
    expect(r.ok).toBe(false)
  })

  it('sin peso bruto queda pendiente', () => {
    const r = palletResult('80', '', cfg)
    expect(r.valid).toBe(false)
    expect(r.ok).toBe(false)
    expect(r.net).toBeNull()
  })

  it('resume palets pesados y bajo mínimo', () => {
    const s = summarize([palletResult('80', '1020', cfg), palletResult('80', '1000', cfg), palletResult('80', '', cfg)])
    expect(s).toEqual({ total: 3, weighed: 2, belowMin: 1, netTotal: 960 + 940 })
  })
})
