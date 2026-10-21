/**
 * Lectura de los archivos de un termógrafo: CSV / TXT / TSV y Excel.
 * Se detectan las columnas que parecen temperaturas y el usuario puede elegir cuál usar.
 */

export interface ThermoStats {
  n: number
  min: number
  max: number
  avg: number
  first: string
  last: string
  /** Lecturas reducidas (≤ MAX_SERIES) para dibujar la gráfica. */
  series: number[]
}

export interface Candidate {
  index: number
  label: string
  score: number
}

const MAX_SERIES = 120
const DATE_RE = /\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}|\d{1,2}:\d{2}/

/** Divide un texto en filas y celdas, detectando el separador (tabulador, punto y coma o coma). */
export function parseDelimited(text: string): { rows: string[][]; delimiter: string } {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
  const sample = lines.slice(0, 15).join('\n')
  const delimiter = sample.includes('\t') ? '\t' : sample.includes(';') ? ';' : ','
  const rows = lines.map((l) => l.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, '')))
  return { rows, delimiter }
}

/** Número de una celda; con separador ≠ coma, la coma es el decimal. */
export function toNum(s: string | undefined, delimiter = ','): number {
  if (s === undefined || s === '') return NaN
  const t = delimiter === ',' ? s : s.replace(',', '.')
  return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NaN
}

/** Columnas que parecen temperaturas (valores entre -50 y 100, no un simple contador). Mejor puntuación primero. */
export function findCandidates(rows: string[][], delimiter = ','): Candidate[] {
  if (rows.length < 3) return []
  const ncol = Math.max(...rows.slice(0, 50).map((r) => r.length))
  const out: Candidate[] = []
  for (let c = 0; c < ncol; c++) {
    const vals = rows.map((r) => toNum(r[c], delimiter)).filter((v) => !Number.isNaN(v))
    if (vals.length < Math.max(3, rows.length * 0.5)) continue
    if (!vals.every((v) => v >= -50 && v <= 100)) continue
    const isCounter = vals.every(Number.isInteger) && vals.every((v, i) => i === 0 || v - vals[i - 1] === 1)
    if (isCounter) continue
    const header = rows[0]?.[c] ?? ''
    const named = Number.isNaN(toNum(header, delimiter)) && header
    const hint = /temp|°c|celsius/i.test(header) ? 10 : 0
    out.push({ index: c, label: named ? header : `Columna ${c + 1}`, score: hint + vals.length / rows.length })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** Estadísticas de una columna: mínima, máxima, media, nº de lecturas, inicio y fin. */
export function statsForColumn(rows: string[][], col: number, delimiter = ','): ThermoStats | null {
  const temps: number[] = []
  const stamps: string[] = []
  for (const r of rows) {
    const v = toNum(r[col], delimiter)
    if (Number.isNaN(v)) continue
    temps.push(v)
    stamps.push(r.filter((cell, i) => i !== col && DATE_RE.test(cell)).slice(0, 2).join(' '))
  }
  const n = temps.length
  if (!n) return null
  const step = Math.max(1, Math.ceil(n / MAX_SERIES))
  return {
    n,
    min: Math.min(...temps),
    max: Math.max(...temps),
    avg: temps.reduce((a, b) => a + b, 0) / n,
    first: stamps[0],
    last: stamps[n - 1],
    series: temps.filter((_, i) => i % step === 0),
  }
}

export interface ParsedFile {
  rows: string[][]
  delimiter: string
  candidates: Candidate[]
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Lee un archivo de lecturas. Devuelve null si el formato no se puede leer (PDF u otros): se guardará sin lecturas. */
export async function readThermoFile(file: File): Promise<ParsedFile | null> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  let rows: string[][] | null = null
  let delimiter = ','

  if (['csv', 'txt', 'tsv'].includes(ext)) {
    const parsed = parseDelimited(await file.text())
    rows = parsed.rows
    delimiter = parsed.delimiter
  } else if (ext === 'xlsx') {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(await file.arrayBuffer())
    const ws = wb.worksheets[0]
    if (!ws) return null
    rows = []
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        const v = cell.value
        cells[col - 1] =
          v instanceof Date
            ? `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()} ${pad(v.getUTCHours())}:${pad(v.getUTCMinutes())}`
            : v === null || v === undefined
              ? ''
              : typeof v === 'object'
                ? String((v as { result?: unknown; text?: unknown }).result ?? (v as { text?: unknown }).text ?? '')
                : String(v)
      })
      rows!.push(Array.from(cells, (c) => c ?? ''))
    })
    delimiter = '.' // los números de Excel ya vienen con punto decimal
  }
  if (!rows) return null
  const candidates = findCandidates(rows, delimiter)
  return { rows, delimiter, candidates }
}

/** Valor más alto entre las lecturas de todos los termógrafos (para comparar con el límite de transporte). */
export function overallMax(stats: (ThermoStats | null)[]): number | null {
  const maxes = stats.flatMap((s) => (s ? [s.max] : []))
  return maxes.length ? Math.max(...maxes) : null
}
