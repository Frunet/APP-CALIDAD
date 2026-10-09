import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../types'

export function Layout() {
  const { session, profile, loading, isAdmin, canReview, signOut } = useAuth()

  if (loading) return <div className="center muted">Cargando…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!profile || !profile.active)
    return (
      <main className="login">
        <div className="card">
          <h2>Acceso desactivado</h2>
          <p>Tu usuario no está activo. Contacta con un administrador.</p>
          <button className="btn secondary" onClick={signOut}>
            Salir
          </button>
        </div>
      </main>
    )

  return (
    <>
      <header className="app-header no-print">
        <div>
          <h1>FrutaCheck QA</h1>
          <small>
            {profile.full_name || session.user.email} · {ROLE_LABELS[profile.role]}
          </small>
        </div>
        <button className="btn secondary" onClick={signOut}>
          Salir
        </button>
      </header>
      <nav className="app-nav no-print">
        <NavLink to="/receptions/new">Nuevo</NavLink>
        <NavLink to="/specifications">Especificaciones</NavLink>
        {canReview && (
          <NavLink to="/" end>
            Historial
          </NavLink>
        )}
        {isAdmin && <NavLink to="/masters">Maestros</NavLink>}
      </nav>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}

/** Historial e informes: solo administrador y calidad. */
export function RequireReviewer({ children }: { children: JSX.Element }) {
  const { canReview } = useAuth()
  return canReview ? children : <Navigate to="/receptions/new" replace />
}

export function RequireAdmin({ children }: { children: JSX.Element }) {
  const { isAdmin } = useAuth()
  return isAdmin ? children : <Navigate to="/" replace />
}
