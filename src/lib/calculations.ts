export interface WeightConfig {
  minKgBox: number
  tareBox: number
  tarePallet: number
  tareOther: number
}

export interface PalletResult {
  boxes: number
  tare: number
  net: number | null
  minimum: number
  avgPerBox: number | null
  valid: boolean
  ok: boolean
}

/** Convierte texto de formulario a número; vacío o inválido → null. Acepta coma decimal. */
export function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Tara total = cajas × tara/caja + tara palet + otras taras.
 * Neto = bruto − tara. Mínimo = cajas × kg mínimos/caja. OK si neto ≥ mínimo.
 */
export function palletResult(boxesRaw: string | number, grossRaw: string | number, cfg: WeightConfig): PalletResult {
  const boxes = toNumber(boxesRaw) ?? 0
  const gross = toNumber(grossRaw)
  const tare = boxes * cfg.tareBox + cfg.tarePallet + cfg.tareOther
  const minimum = boxes * cfg.minKgBox
  const net = gross === null ? null : gross - tare
  const valid = net !== null
  return {
    boxes,
    tare,
    net,
    minimum,
    avgPerBox: valid && boxes > 0 ? net! / boxes : null,
    valid,
    ok: valid && net! >= minimum,
  }
}

export function summarize(results: PalletResult[]) {
  const weighed = results.filter((r) => r.valid)
  return {
    total: results.length,
    weighed: weighed.length,
    belowMin: weighed.filter((r) => !r.ok).length,
    netTotal: weighed.reduce((s, r) => s + (r.net ?? 0), 0),
  }
}
