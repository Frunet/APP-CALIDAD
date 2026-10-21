import { useEffect, useMemo, useState } from 'react'
import { HBars, LineChart } from '../../components/charts'
import { useMasters } from '../../lib/masters'
import { supabase } from '../../lib/supabase'
import { defectStats, kpis, rankSuppliers, series, supplierStats } from '../../lib/stats'
import { loadRegister, type RegisterReception } from '../receptions/register'

const MAX_RECEPTIONS = 1000

const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86400000))

interface Filters {
  from: string
  to: string
  product: string
  supplierId: string
  drafts: boolean
}

const fmt = (v: number | null, digits = 1, unit = '') => (v === null ? '—' : `${v.toFixed(digits)}${unit}`)

export function StatsPage() {
  const { products, suppliers } = useMasters()
  const [f, setF] = useState<Filters>({ from: daysAgo(90), to: isoDay(new Date()), product: '', supplierId: '', drafts: false })
  const [rows, setRows] = useState<RegisterReception[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [capped, setCapped] = useState(false)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    const t = setTimeout(async () => {
      try {
        let q = supabase
          .from('receptions')
          .select('id')
          .gte('received_at', new Date(`${f.from}T00:00:00`).toISOString())
          .lte('received_at', new Date(`${f.to}T23:59:59`).toISOString())
          .order('received_at', { ascending: false })
          .limit(MAX_RECEPTIONS + 1)
        if (!f.drafts) q = q.eq('status', 'closed')
        if (f.product) q = q.eq('product', f.product)
        if (f.supplierId) q = q.eq('supplier_id', f.supplierId)
        const { data, error: err } = await q
        if (err) throw err
        const ids = (data ?? []).map((r) => r.id)
        const data2 = await loadRegister(ids.slice(0, MAX_RECEPTIONS))
        if (cancelled) return
        setCapped(ids.length > MAX_RECEPTIONS)
        setRows(data2)
        setError(null)
      } catch {
        if (!cancelled) setError('No se pudieron cargar las estadísticas.')
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [f])

  const stats = useMemo(() => {
    const rs = rows ?? []
    const sup = supplierStats(rs)
    return {
      k: kpis(rs),
      ranking: rankSuppliers(sup),
      belowBySupplier: sup
        .filter((s) => s.palletsWeighed > 0)
        .sort((a, b) => (b.belowPct ?? 0) - (a.belowPct ?? 0))
        .slice(0, 12),
      defects: defectStats(rs).slice(0, 10),
      brix: series(rs, (r) => r.brix),
      temp: series(rs, (r) => r.temperature),
    }
  }, [rows])

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }))
  const { k } = stats
  const evaluated = k.accepted + k.reserves + k.rejected

  return (
    <div>
      <div className="card">
        <h2>Estadísticas</h2>
        <div className="grid filters">
          <label>
            Desde
            <input type="date" value={f.from} max={f.to} onChange={(e) => set('from', e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={f.to} min={f.from} onChange={(e) => set('to', e.target.value)} />
          </label>
          <label>
            Producto
            <select value={f.product} onChange={(e) => set('product', e.target.value)}>
              <option value="">Todos</option>
              {products.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Proveedor
            <select value={f.supplierId} onChange={(e) => set('supplierId', e.target.value)}>
              <option value="">Todos</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="actions">
          {[30, 90, 365].map((d) => (
            <button key={d} className="btn secondary" onClick={() => setF((x) => ({ ...x, from: daysAgo(d), to: isoDay(new Date()) }))}>
              Últimos {d === 365 ? '12 meses' : `${d} días`}
            </button>
          ))}
          <label className="check">
            <input type="checkbox" checked={f.drafts} onChange={(e) => set('drafts', e.target.checked)} />
            Incluir borradores
          </label>
        </div>
        {error && <div className="result bad">{error}</div>}
        {rows === null && !error && <p className="muted">Cargando…</p>}
        {capped && <p className="muted">Se muestran las {MAX_RECEPTIONS} recepciones más recientes del periodo; acota las fechas para ver el resto.</p>}
      </div>

      {rows && rows.length === 0 && <div className="card muted">No hay recepciones en este periodo con estos filtros.</div>}

      {rows && rows.length > 0 && (
        <>
          <div className="kpis">
            <div className="kpi">
              <span className="muted">Recepciones</span>
              <strong>{k.receptions}</strong>
            </div>
            <div className="kpi">
              <span className="muted">Peso neto total</span>
              <strong>{(k.netKg / 1000).toFixed(1)} t</strong>
            </div>
            <div className={'kpi' + (k.belowPct && k.belowPct > 10 ? ' bad' : '')}>
              <span className="muted">Palets bajo mínimo</span>
              <strong>{fmt(k.belowPct, 1, ' %')}</strong>
              <span className="muted">
                {k.palletsBelow} de {k.palletsWeighed}
              </span>
            </div>
            <div className="kpi good">
              <span className="muted">Aceptadas</span>
              <strong>{evaluated ? `${((k.accepted / evaluated) * 100).toFixed(0)} %` : '—'}</strong>
              <span className="muted">{k.accepted} de {evaluated}</span>
            </div>
            <div className="kpi warn">
              <span className="muted">Con reservas</span>
              <strong>{evaluated ? `${((k.reserves / evaluated) * 100).toFixed(0)} %` : '—'}</strong>
              <span className="muted">{k.reserves}</span>
            </div>
            <div className={'kpi' + (k.rejected ? ' bad' : '')}>
              <span className="muted">Rechazadas</span>
              <strong>{evaluated ? `${((k.rejected / evaluated) * 100).toFixed(0)} %` : '—'}</strong>
              <span className="muted">{k.rejected}</span>
            </div>
          </div>
          {k.unevaluated > 0 && (
            <p className="muted" style={{ marginTop: -6 }}>
              {k.unevaluated} recepción{k.unevaluated === 1 ? '' : 'es'} sin resultado (anteriores a las alertas de calidad o sin evaluar): no entran en los porcentajes.
            </p>
          )}

          <div className="card">
            <h2>Ranking de proveedores</h2>
            <p className="muted">Ordenado por % de recepciones aceptadas; a igualdad, menos palets bajo mínimo y menos defectos.</p>
            <div className="table-wrap">
              <table className="rank">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Proveedor</th>
                    <th>Recep.</th>
                    <th>Aceptadas</th>
                    <th>Rechaz.</th>
                    <th>Palets &lt; mín.</th>
                    <th>Defectos</th>
                    <th>°Brix</th>
                    <th>Temp.</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.ranking.map((s, i) => (
                    <tr key={s.supplier}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>{s.supplier}</strong>
                      </td>
                      <td>{s.receptions}</td>
                      <td className={s.acceptedPct !== null && s.acceptedPct >= 80 ? 'good' : s.acceptedPct !== null && s.acceptedPct < 50 ? 'bad' : ''}>{fmt(s.acceptedPct, 0, ' %')}</td>
                      <td className={s.rejected ? 'bad' : ''}>{s.rejected}</td>
                      <td className={s.belowPct && s.belowPct > 10 ? 'bad' : ''}>{fmt(s.belowPct, 1, ' %')}</td>
                      <td>{fmt(s.avgDefectPct, 1, ' %')}</td>
                      <td>{fmt(s.avgBrix)}</td>
                      <td>{fmt(s.avgTemp, 1, ' °C')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>Palets bajo mínimo por proveedor</h2>
            <HBars
              items={stats.belowBySupplier.map((s) => ({ label: s.supplier, value: s.belowPct, note: `${s.palletsBelow} de ${s.palletsWeighed} palets` }))}
              color="var(--bad)"
              max={100}
            />
          </div>

          <div className="card">
            <h2>Defectos más frecuentes</h2>
            <p className="muted">Nº de recepciones en las que aparece cada defecto, y su porcentaje medio.</p>
            <HBars
              items={stats.defects.map((d) => ({ label: d.name, value: d.receptions, note: d.avgPct === null ? undefined : `media ${d.avgPct.toFixed(1)} %` }))}
              unit=""
              color="var(--yellow)"
            />
          </div>

          <div className="card">
            <h2>Evolución del °Brix</h2>
            {!f.product && <p className="muted">Con varios productos las escalas no son comparables: filtra por producto para una lectura más clara.</p>}
            <LineChart points={stats.brix} unit="°Brix" />
          </div>

          <div className="card">
            <h2>Evolución de la temperatura</h2>
            <LineChart points={stats.temp} unit="°C" />
          </div>
        </>
      )}
    </div>
  )
}
