import { Link } from 'react-router-dom'

export function SavedPage() {
  return (
    <div className="card">
      <h2>✓ Recepción guardada</h2>
      <p className="muted">Los datos y las fotos se han guardado correctamente.</p>
      <div className="actions">
        <Link className="btn" to="/receptions/new">
          + Nueva recepción
        </Link>
      </div>
    </div>
  )
}
