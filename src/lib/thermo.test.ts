import { describe, expect, it } from 'vitest'
import { findCandidates, overallMax, parseDelimited, statsForColumn, toNum } from './thermo'

const csv = [
  'Nº,Fecha,Hora,Temperatura (°C),Humedad',
  '1,01/10/2026,08:00,5.2,80',
  '2,01/10/2026,08:10,5.8,81',
  '3,01/10/2026,08:20,7.9,79',
  '4,01/10/2026,08:30,6.1,80',
].join('\n')

describe('parseDelimited', () => {
  it('detecta coma, punto y coma y tabulador', () => {
    expect(parseDelimited('a,b\n1,2').delimiter).toBe(',')
    expect(parseDelimited('a;b\n1;2').delimiter).toBe(';')
    expect(parseDelimited('a\tb\n1\t2').delimiter).toBe('\t')
  })

  it('quita comillas y BOM', () => {
    const { rows } = parseDelimited('﻿"Temp","Hora"\n"5.1","08:00"')
    expect(rows[0]).toEqual(['Temp', 'Hora'])
  })
})

describe('toNum', () => {
  it('con punto y coma la coma es el decimal', () => {
    expect(toNum('5,4', ';')).toBe(5.4)
    expect(toNum('5.4', ',')).toBe(5.4)
    expect(toNum('abc')).toBeNaN()
    expect(toNum('')).toBeNaN()
  })
})

describe('findCandidates', () => {
  it('elige la columna de temperatura y descarta el contador y la humedad fuera de rango no aplica', () => {
    const { rows, delimiter } = parseDelimited(csv)
    const c = findCandidates(rows, delimiter)
    expect(c[0].label).toBe('Temperatura (°C)')
    expect(c.some((x) => x.index === 0)).toBe(false) // el contador 1,2,3,4 no es temperatura
  })

  it('con pocos datos no propone nada', () => {
    expect(findCandidates([['t'], ['5']])).toEqual([])
  })
})

describe('statsForColumn', () => {
  it('calcula mínima, máxima, media, lecturas e inicio/fin', () => {
    const { rows, delimiter } = parseDelimited(csv)
    const s = statsForColumn(rows, 3, delimiter)!
    expect(s.n).toBe(4)
    expect(s.min).toBe(5.2)
    expect(s.max).toBe(7.9)
    expect(s.avg).toBeCloseTo(6.25, 2)
    expect(s.first).toContain('08:00')
    expect(s.last).toContain('08:30')
  })

  it('reduce la serie a unas 120 lecturas', () => {
    const rows = [['t'], ...Array.from({ length: 1000 }, (_, i) => [String(5 + (i % 10) / 10)])]
    const s = statsForColumn(rows, 0)!
    expect(s.n).toBe(1000)
    expect(s.series.length).toBeLessThanOrEqual(120)
  })

  it('sin lecturas numéricas devuelve null', () => {
    expect(statsForColumn([['a'], ['b']], 0)).toBeNull()
  })
})

describe('overallMax', () => {
  it('máximo entre varios termógrafos, ignorando los sin lecturas', () => {
    const s = (max: number) => ({ n: 3, min: 1, max, avg: 2, first: '', last: '', series: [] })
    expect(overallMax([s(6), null, s(9)])).toBe(9)
    expect(overallMax([null])).toBeNull()
  })
})
