import { palletResult, toNumber } from '../../lib/calculations'
import { evaluate, type Evaluation, type Limits } from '../../lib/evaluation'
import { overallMax } from '../../lib/thermo'
import type { ReceptionDraft } from '../../types'

export function limitsOf(d: ReceptionDraft): Limits {
  return {
    maxTemperature: toNumber(d.limit_max_temperature),
    minBrix: toNumber(d.limit_min_brix),
    maxDefectPct: toNumber(d.limit_max_defect_pct),
    minDryMatter: toNumber(d.limit_min_dry_matter),
    maxTransportTemp: toNumber(d.limit_max_transport_temp),
  }
}

/** Evalúa una recepción contra los límites que lleva guardados (los de su especificación). */
export function evaluateDraft(
  d: ReceptionDraft,
  requiresDryMatter: boolean,
  transportMax: number | null = overallMax(d.thermos.map((t) => t.stats)),
): Evaluation {
  const cfg = {
    minKgBox: toNumber(d.min_kg_box) ?? 0,
    tareBox: toNumber(d.tare_box) ?? 0,
    tarePallet: toNumber(d.tare_pallet) ?? 0,
    tareOther: toNumber(d.tare_other) ?? 0,
  }
  return evaluate({
    limits: limitsOf(d),
    pallets: d.pallets.map((p) => palletResult(p.boxes, p.gross, cfg)),
    temperature: toNumber(d.temperature),
    brix: toNumber(d.brix),
    requiresDryMatter,
    dryMatter: toNumber(d.dry_matter),
    defectPcts: d.defects.map((x) => toNumber(x.percent) ?? 0),
    transportMax,
  })
}
