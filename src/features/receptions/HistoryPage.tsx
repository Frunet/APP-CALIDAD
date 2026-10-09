import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listReceptions } from './api'
import type { ReceptionSummary } from '../../types'

export function HistoryPage() {
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<ReceptionSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      listReceptions(search)
        .then((r) => {
          setRows(r)
          setError(null)
        })
        .catch(() => setError('No se pudo cargar el historial.'))
    }, 250)
    return () => clearTimeout(t)
  }, [search])

  return (
    <div className="card">
      <div className="row-between">
        <h2>Recepciones</h2>
        <Link className="btn" to="/receptions/new">
          + Nueva recepción
        </Link>
      </div>
      <input placeholder="Buscar por proveedor o lote…" value={search} onChange={(e) => setSearch(e.target.value)} />
      {error && <div className="result bad">{error}</div>}
      {rows === null && !error && <p className="muted">Cargando…</p>}
      {rows?.length === 0 && <p className="muted">No hay recepciones.</p>}
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
