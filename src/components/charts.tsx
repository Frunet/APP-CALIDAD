import type { Point } from '../lib/stats'

interface BarItem {
  label: string
  value: number | null
  /** Texto secundario a la derecha (p. ej. "3 de 12 palets"). */
  note?: string
}

/** Barras horizontales con CSS: se adaptan al ancho y se leen bien en móvil. */
export function HBars({ items, unit = '%', color = 'var(--accent)', max }: { items: BarItem[]; unit?: string; color?: string; max?: number }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value ?? 0))
  if (!items.length) return <p className="muted">Sin datos en este periodo.</p>
  return (
    <div className="hbars">
      {items.map((i) => (
        <div className="hbar-row" key={i.label}>
          <div className="hbar-label" title={i.label}>
            {i.label}
          </div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${Math.min(100, ((i.value ?? 0) / top) * 100)}%`, background: color }} />
          </div>
          <div className="hbar-value">
            {i.value === null ? '—' : `${i.value.toFixed(1)}${unit}`}
            {i.note && <span className="muted"> · {i.note}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

const fmtDay = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })

/** Evolución en el tiempo: un punto por recepción, unidos por una línea. */
export function LineChart({ points, unit, limit, limitLabel }: { points: Point[]; unit: string; limit?: number | null; limitLabel?: string }) {
  if (points.length < 2) return <p className="muted">Hacen falta al menos 2 recepciones con este dato para dibujar la evolución.</p>

  const W = 640
  const H = 220
  const pad = { l: 44, r: 14, t: 14, b: 28 }
  const vs = points.map((p) => p.v).concat(limit != null ? [limit] : [])
  let y0 = Math.min(...vs)
  let y1 = Math.max(...vs)
  if (y0 === y1) {
    y0 -= 1
    y1 += 1
  }
  const m = (y1 - y0) * 0.1
  y0 -= m
  y1 += m
  const t0 = points[0].t
  const t1 = points[points.length - 1].t || t0 + 1
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (H - pad.t - pad.b)
  const yTicks = [0, 1, 2, 3].map((i) => y0 + ((y1 - y0) * i) / 3)
  const xTicks = [0, 1, 2, 3].map((i) => t0 + ((t1 - t0) * i) / 3)

  return (
    <svg className="linechart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Evolución en ${unit}`}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            {v.toFixed(1)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={t} x={x(t)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
          {fmtDay(t)}
        </text>
      ))}
      {limit != null && (
        <g>
          <line x1={pad.l} x2={W - pad.r} y1={y(limit)} y2={y(limit)} stroke="var(--bad)" strokeDasharray="5 4" />
          <text x={W - pad.r} y={y(limit) - 4} textAnchor="end" fontSize="11" fill="var(--bad)">
            {limitLabel ?? 'Límite'} {limit}
          </text>
        </g>
      )}
      <polyline fill="none" stroke="var(--accent)" strokeWidth="2" points={points.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')} />
      {points.map((p, i) => (
        <circle key={i} cx={x(p.t)} cy={y(p.v)} r="3.5" fill="var(--accent)">
          <title>{`${new Date(p.t).toLocaleDateString('es-ES')} · ${p.label} · ${p.v.toFixed(1)} ${unit}`}</title>
        </circle>
      ))}
    </svg>
  )
}
