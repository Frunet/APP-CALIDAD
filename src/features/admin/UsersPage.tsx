import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Profile, Role } from '../../types'

export function UsersPage() {
  const { session } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    supabase
      .from('profiles')
      .select('id, full_name, role, active')
      .order('created_at')
      .then(({ data, error: err }) => {
        if (err) setError('No se pudieron cargar los usuarios.')
        else setUsers((data ?? []) as Profile[])
      })
  }, [])
  useEffect(refresh, [refresh])

  async function update(id: string, patch: Partial<Pick<Profile, 'role' | 'active' | 'full_name'>>) {
    const { error: err } = await supabase.from('profiles').update(patch).eq('id', id)
    if (err) setError(err.message)
    else setError(null)
    refresh()
  }

  const me = session?.user.id

  return (
    <div className="card">
      <h2>Usuarios</h2>
      <p className="muted">
        Los usuarios nuevos se crean en el panel de Supabase (Authentication → Users). Al entrar por primera vez aparecen aquí como
        inspectores; desde aquí puedes cambiar su rol o desactivarlos.
      </p>
      {error && <div className="result bad">{error}</div>}
      <div className="list">
        {users.map((u) => (
          <div className="list-item" key={u.id}>
            <label style={{ flex: 1 }}>
              Nombre
              <input
                defaultValue={u.full_name}
                placeholder="Nombre y apellidos"
                onBlur={(e) => e.target.value !== u.full_name && update(u.id, { full_name: e.target.value.trim() })}
              />
            </label>
            <label>
              Rol
              <select value={u.role} disabled={u.id === me} onChange={(e) => update(u.id, { role: e.target.value as Role })}>
                <option value="inspector">Inspector</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={u.active} disabled={u.id === me} onChange={(e) => update(u.id, { active: e.target.checked })} />
              Activo
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
