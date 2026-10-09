import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import { listReceptions, type HistoryFilters } from './api'
import type { Profile, ReceptionSummary } from '../../types'

const NO_FILTERS: HistoryFilters = { search: '', status: '', inspectorId: '', from: '', to: '' }

export function HistoryPage() {
  const { isAdmin } = useAuth()
  const [filters, setFilters] = useState<HistoryFilters>(NO_FILTERS)
  const [rows, setRows] = useState<ReceptionSummary[] | null>(null)
  const [inspectors, setInspectors] = useState<Pick<Profile, 'id' | 'full_name'>[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    supabase
      .from('profiles')
      .select('id, full_name')
      .order('full_name')
      .then(({ data }) => setInspectors(data ?? []))
  }, [isAdmin])

  useEffect(() => {
    const t = setTimeout(() => {
      listReceptions(filters)
        .then((r) => {
          setRows(r)
          setError(null)
        })
        .catch(() => setError('No se pudo cargar el historial.'))
    }, 250)
    return () => clearTimeout(t)
  }, [filters])

  const set = <K extends keyof HistoryFilters>(k: K, v: HistoryFilters[K]) => setFilters((f) => ({ ...f, [k]: v }))
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)

  return (
    <div className="card">
      <div className="row-between">
        <h2>Historial de recepciones</h2>
        <Link className="btn" to="/receptions/new">
          + Nueva recepción
        </Link>
      </div>

      <input placeholder="Buscar por proveedor o lote…" value={filters.search} onChange={(e) => set('search', e.target.value)} />
      <div className="grid filters">
        <label>
          Estado
          <select value={filters.status} onChange={(e) => set('status', e.target.value as HistoryFilters['status'])}>
            <option value="">Todos</option>
            <option value="closed">Cerradas</option>
            <option value="draft">Borradores</option>
          </select>
        </label>
        {isAdmin && (
          <label>
            Inspector
            <select value={filters.inspectorId} onChange={(e) => set('inspectorId', e.target.value)}>
              <option value="">Todos</option>
              {inspectors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.full_name || 'Sin nombre'}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Desde
          <input type="date" value={filters.from} onChange={(e) => set('from', e.target.value)} />
        </label>
        <label>
          Hasta
          <input type="date" value={filters.to} onChange={(e) => set('to', e.target.value)} />
        </label>
      </div>
      {filtered && (
        <div className="actions">
          <button className="btn secondary" onClick={() => setFilters(NO_FILTERS)}>
            Quitar filtros
          </button>
        </div>
      )}

      {error && <div className="result bad">{error}</div>}
      {rows === null && !error && <p className="muted">Cargando…</p>}
      {rows && (
        <p className="muted">
          {rows.length} {rows.length === 1 ? 'recepción' : 'recepciones'}
          {isAdmin ? ' (de todos los inspectores)' : ''}
        </p>
      )}
      <div className="list">
        {rows?.map((r) => (
          <div className="list-item" key={r.id}>
            <Link to={`/receptions/${r.id}`}>
              <strong>{r.supplier_name || 'Sin proveedor'}</strong> · {r.product}
              <br />
              <span className="muted">
                {new Date(r.received_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })} · Lote{' '}
                {r.lot || '—'} · {r.profiles?.full_name || 'Inspector'}
              </span>
            </Link>
            <div className="list-actions">
              <span className={'badge' + (r.status === 'closed' ? ' badge-ok' : '')}>
                {r.status === 'closed' ? 'Cerrada' : 'Borrador'}
              </span>
              <Link className="btn secondary" to={`/receptions/${r.id}/report`}>
                Informe
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
