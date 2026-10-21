import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { cacheGet, cacheSet } from '../lib/cache'
import { isNetworkError } from '../lib/network'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

/**
 * Sin conexión, supabase-js no puede renovar un token caducado y getSession() devuelve null.
 * Para poder seguir trabajando (las recepciones se encolan en el dispositivo) se lee la sesión
 * guardada tal cual; solo se usa para la interfaz: los datos siguen protegidos por el servidor.
 */
function storedSession(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const s = JSON.parse(localStorage.getItem(k) ?? 'null')
        if (s?.user?.id) return s as Session
      }
    }
  } catch {
    /* ignorar */
  }
  return null
}

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  /** Puede ver el historial y los informes de todas las recepciones (administrador y calidad). */
  canReview: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const applySession = (s: Session | null) => {
      const effective = s ?? (navigator.onLine ? null : storedSession())
      setSession(effective)
      if (!effective) setLoading(false)
    }
    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch(() => applySession(null))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Un fallo de renovación sin conexión no debe cerrar la sesión en pantalla.
      if (!s && event !== 'SIGNED_OUT' && !navigator.onLine) return
      setSession(s)
      if (!s) {
        setProfile(null)
        setLoading(false)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, full_name, role, active')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return
        if (data) {
          cacheSet(`profile.${userId}`, data)
          setProfile(data as Profile)
        } else {
          // Sin conexión se usa el perfil guardado la última vez.
          setProfile(error && isNetworkError(error) ? cacheGet<Profile>(`profile.${userId}`) : null)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const value: AuthState = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' && profile.active,
    canReview: !!profile && profile.active && (profile.role === 'admin' || profile.role === 'calidad'),
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error ? 'Email o contraseña incorrectos.' : null
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
