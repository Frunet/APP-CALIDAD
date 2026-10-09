import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

const USER_DOMAIN = 'frutacheck.test'

/** Un nombre de usuario sin @ (p. ej. "IV GAMA") se convierte en iv-gama@frutacheck.test. */
export function toLoginEmail(input: string): string {
  const v = input.trim()
  if (v.includes('@')) return v
  const slug = v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}@${USER_DOMAIN}`
}

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
    setError(await signIn(toLoginEmail(email), password))
    setBusy(false)
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <h1>FrutaCheck QA</h1>
        <p className="muted">Control de calidad de recepción</p>
        <label>
          Usuario
          <input type="text" autoCapitalize="none" autoCorrect="off" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
