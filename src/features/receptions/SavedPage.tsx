import { Link, useLocation } from 'react-router-dom'
import { useSync } from './SyncContext'

export function SavedPage() {
  const queued = (useLocation().state as { queued?: boolean } | null)?.queued
  const { pending, online } = useSync()

  return (
    <div className="card">
      {queued ? (
        <>
          <h2>📥 Guardada en el dispositivo</h2>
          <p>
            {online
              ? 'Se está enviando…'
              : 'No hay conexión. La recepción y sus fotos están guardadas en este dispositivo y se enviarán automáticamente cuando vuelva la conexión.'}
          </p>
          <p className="muted">No cierres sesión ni borres los datos del navegador hasta que se envíe. Pendientes: {pending}.</p>
        </>
      ) : (
        <>
          <h2>✓ Recepción guardada</h2>
          <p className="muted">Los datos y las fotos se han guardado correctamente.</p>
        </>
      )}
      <div className="actions">
        <Link className="btn" to="/receptions/new">
          + Nueva recepción
        </Link>
      </div>
    </div>
  )
}
