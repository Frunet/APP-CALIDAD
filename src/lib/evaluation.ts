import type { PalletResult } from './calculations'

export type Result = 'accepted' | 'reserves' | 'rejected'

export const RESULT_LABELS: Record<Result, string> = {
  accepted: 'Aceptada',
  reserves: 'Aceptada con reservas',
  rejected: 'Rechazada',
}

/** Límites de la especificación; null = no se comprueba. */
export interface Limits {
  maxTemperature: number | null
  minBrix: number | null
  maxDefectPct: number | null
  minDryMatter: number | null
  maxTransportTemp: number | null
}

export const NO_LIMITS: Limits = { maxTemperature: null, minBrix: null, maxDefectPct: null, minDryMatter: null, maxTransportTemp: null }

export interface EvaluationInput {
  limits: Limits
  pallets: PalletResult[]
  temperature: number | null
  brix: number | null
  /** Solo se evalúa si el producto pide materia seca. */
  requiresDryMatter: boolean
  dryMatter: number | null
  defectPcts: number[]
  /** Temperatura máxima medida por el termógrafo del transporte, si hay. */
  transportMax: number | null
}

export type CheckStatus = 'ok' | 'breach' | 'na'

export interface Check {
  key: 'weight' | 'temperature' | 'brix' | 'dryMatter' | 'defects' | 'transport'
  label: string
  status: CheckStatus
  detail: string
}

export interface Evaluation {
  checks: Check[]
  breaches: number
  suggestion: Result
}

/** Regla de la propuesta: 0 incumplimientos = aceptada; 1-2 = con reservas; 3 o más = rechazada. */
export function suggestResult(breaches: number): Result {
  return breaches === 0 ? 'accepted' : breaches <= 2 ? 'reserves' : 'rejected'
}

const f1 = (n: number) => n.toFixed(1)

export function evaluate(i: EvaluationInput): Evaluation {
  const checks: Check[] = []

  const weighed = i.pallets.filter((p) => p.valid)
  if (!weighed.length) {
    checks.push({ key: 'weight', label: 'Peso', status: 'na', detail: 'Sin palets pesados' })
  } else {
    const below = weighed.filter((p) => !p.ok).length
    checks.push(
      below
        ? { key: 'weight', label: 'Peso', status: 'breach', detail: `${below} de ${weighed.length} palets por debajo del mínimo` }
        : { key: 'weight', label: 'Peso', status: 'ok', detail: `${weighed.length} palets en o sobre el mínimo` },
    )
  }

  const { limits } = i
  if (limits.maxTemperature !== null) {
    checks.push(
      i.temperature === null
        ? { key: 'temperature', label: 'Temperatura', status: 'na', detail: 'Sin medir' }
        : i.temperature > limits.maxTemperature
          ? { key: 'temperature', label: 'Temperatura', status: 'breach', detail: `${f1(i.temperature)} °C supera el máximo de ${f1(limits.maxTemperature)} °C` }
          : { key: 'temperature', label: 'Temperatura', status: 'ok', detail: `${f1(i.temperature)} °C (máximo ${f1(limits.maxTemperature)} °C)` },
    )
  }
  if (limits.minBrix !== null) {
    checks.push(
      i.brix === null
        ? { key: 'brix', label: '°Brix', status: 'na', detail: 'Sin medir' }
        : i.brix < limits.minBrix
          ? { key: 'brix', label: '°Brix', status: 'breach', detail: `${f1(i.brix)} está por debajo del mínimo de ${f1(limits.minBrix)}` }
          : { key: 'brix', label: '°Brix', status: 'ok', detail: `${f1(i.brix)} (mínimo ${f1(limits.minBrix)})` },
    )
  }
  if (i.requiresDryMatter && limits.minDryMatter !== null) {
    checks.push(
      i.dryMatter === null
        ? { key: 'dryMatter', label: 'Materia seca', status: 'na', detail: 'Pendiente de laboratorio' }
        : i.dryMatter < limits.minDryMatter
          ? { key: 'dryMatter', label: 'Materia seca', status: 'breach', detail: `${f1(i.dryMatter)} % está por debajo del mínimo de ${f1(limits.minDryMatter)} %` }
          : { key: 'dryMatter', label: 'Materia seca', status: 'ok', detail: `${f1(i.dryMatter)} % (mínimo ${f1(limits.minDryMatter)} %)` },
    )
  }
  if (limits.maxDefectPct !== null) {
    const total = i.defectPcts.reduce((a, b) => a + b, 0)
    checks.push(
      total > limits.maxDefectPct
        ? { key: 'defects', label: 'Defectos', status: 'breach', detail: `${f1(total)} % en total supera el máximo de ${f1(limits.maxDefectPct)} %` }
        : { key: 'defects', label: 'Defectos', status: 'ok', detail: `${f1(total)} % en total (máximo ${f1(limits.maxDefectPct)} %)` },
    )
  }
  if (limits.maxTransportTemp !== null) {
    checks.push(
      i.transportMax === null
        ? { key: 'transport', label: 'Transporte', status: 'na', detail: 'Sin datos del termógrafo' }
        : i.transportMax > limits.maxTransportTemp
          ? { key: 'transport', label: 'Transporte', status: 'breach', detail: `Máxima ${f1(i.transportMax)} °C supera el límite de ${f1(limits.maxTransportTemp)} °C` }
          : { key: 'transport', label: 'Transporte', status: 'ok', detail: `Máxima ${f1(i.transportMax)} °C (límite ${f1(limits.maxTransportTemp)} °C)` },
    )
  }

  const breaches = checks.filter((c) => c.status === 'breach').length
  return { checks, breaches, suggestion: suggestResult(breaches) }
}

/** Resultado final: la decisión de Calidad si existe; si no, la propuesta automática. */
export function finalResult(decision: Result | null | undefined, suggestion: Result): Result {
  return decision ?? suggestion
}
