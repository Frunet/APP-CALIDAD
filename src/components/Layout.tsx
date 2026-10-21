import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useSync } from '../features/receptions/SyncContext'
import { ROLE_LABELS } from '../types'

export function Layout() {
  const { session, profile, loading, isAdmin, canReview, signOut } = useAuth()
  const { online, pending, justSent, syncing, lastError, flush } = useSync()

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
        <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo-frunet.jpg`} alt="Frunet" />
        <div className="grow">
          <h1>Quality Control</h1>
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
        {canReview && <NavLink to="/stats">Estadísticas</NavLink>}
        {isAdmin && <NavLink to="/masters">Maestros</NavLink>}
      </nav>
      {(!online || pending > 0 || justSent > 0) && (
        <div className={'sync-bar no-print' + (!online ? ' offline' : pending > 0 ? ' pending' : ' sent')}>
          {!online && <span>Sin conexión · las recepciones se guardan en el dispositivo</span>}
          {online && pending > 0 && (
            <span>
              {syncing ? 'Enviando…' : `${pending} recepción${pending === 1 ? '' : 'es'} pendiente${pending === 1 ? '' : 's'} de enviar`}
              {lastError ? ` · error: ${lastError}` : ''}
            </span>
          )}
          {online && pending === 0 && justSent > 0 && <span>✓ {justSent} recepción{justSent === 1 ? '' : 'es'} enviada{justSent === 1 ? '' : 's'}</span>}
          {!!pending && (
            <button className="btn secondary" onClick={() => void flush()} disabled={!online || syncing}>
              Enviar ahora
            </button>
          )}
        </div>
      )}
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
