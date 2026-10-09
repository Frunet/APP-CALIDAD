import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function LoginPage() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(await signIn(email.trim(), password))
    setBusy(false)
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <h1>FrutaCheck QA</h1>
        <p className="muted">Control de calidad de recepción</p>
        <label>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <div className="result bad">{error}</div>}
        <div className="actions">
          <button className="btn" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
        <p className="muted">¿Sin acceso? Pide a un administrador que te cree el usuario.</p>
      </form>
    </main>
  )
}
