import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

const USER_DOMAIN = 'frutacheck.test'

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Un nombre de usuario sin @ se convierte en email. Se compara sin espacios ni guiones, así que
 * «IV GAMA», «IVGAMA» e «iv-gama» son el mismo usuario (ivgama@frutacheck.test). Por compatibilidad con
 * usuarios antiguos, se prueba también la forma con guion (iv-gama@frutacheck.test).
 */
export function loginEmails(input: string): string[] {
  const v = input.trim()
  if (v.includes('@')) return [v]
  const compact = fold(v).replace(/[^a-z0-9]+/g, '')
  const hyphen = fold(v).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return [...new Set([compact, hyphen])].filter(Boolean).map((u) => `${u}@${USER_DOMAIN}`)
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
    let result: string | null = null
    for (const candidate of loginEmails(email)) {
      result = await signIn(candidate, password)
      // Solo se prueba la siguiente forma si el servidor ha contestado «incorrecto»; un fallo de red no se reintenta aquí.
      if (!result || !result.startsWith('Usuario o contraseña')) break
    }
    setError(result)
    setBusy(false)
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <img className="login-logo" src={`${import.meta.env.BASE_URL}logo-frunet.jpg`} alt="Frunet" />
        <h1>Quality Control</h1>
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
