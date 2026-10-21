import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { isNetworkError } from '../../lib/network'
import { listPending, putPending, removePending } from '../../lib/offlineStore'
import type { ReceptionDraft } from '../../types'
import { newId, saveReception } from './api'

interface SyncState {
  online: boolean
  /** Recepciones del usuario guardadas en el dispositivo y aún sin enviar. */
  pending: number
  /** Enviadas en la última sincronización (se pone a 0 pasados unos segundos). */
  justSent: number
  syncing: boolean
  /** Último error que no es de conexión (p. ej. permisos), si lo hay. */
  lastError: string | null
  /** Guarda la recepción en el dispositivo para enviarla cuando haya conexión. */
  enqueue: (draft: ReceptionDraft) => Promise<void>
  flush: () => Promise<void>
}

const SyncContext = createContext<SyncState | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [pending, setPending] = useState(0)
  const [justSent, setJustSent] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const flushing = useRef(false)

  const refreshCount = useCallback(async () => {
    try {
      const items = await listPending()
      setPending(items.filter((i) => i.userId === userId).length)
    } catch {
      setPending(0)
    }
  }, [userId])

  const flush = useCallback(async () => {
    if (!userId || flushing.current) return
    flushing.current = true
    setSyncing(true)
    let sent = 0
    try {
      const items = (await listPending()).filter((i) => i.userId === userId).sort((a, b) => a.createdAt - b.createdAt)
      for (const item of items) {
        try {
          await saveReception(item.draft)
          await removePending(item.id)
          sent++
          setLastError(null)
        } catch (e) {
          if (isNetworkError(e)) break // sin conexión: se reintenta más tarde
          const msg = (e as { message?: string })?.message ?? 'error desconocido'
          setLastError(msg)
          await putPending({ ...item, attempts: item.attempts + 1, lastError: msg })
        }
      }
    } catch {
      /* IndexedDB no disponible */
    } finally {
      flushing.current = false
      setSyncing(false)
      await refreshCount()
      if (sent) {
        setJustSent(sent)
        setTimeout(() => setJustSent(0), 7000)
      }
    }
  }, [userId, refreshCount])

  const enqueue = useCallback(
    async (draft: ReceptionDraft) => {
      if (!userId) throw new Error('Sin sesión')
      // El id se fija ya: así reintentar el envío no duplica la recepción.
      const id = draft.id ?? newId()
      const clean: ReceptionDraft = {
        ...draft,
        id,
        photos: draft.photos.map((p) => ({ ...p, url: '' })),
        // las filas leídas del archivo solo sirven para elegir columna: no hace falta guardarlas
        thermos: draft.thermos.map((t) => ({ ...t, url: '', rows: undefined, candidates: undefined })),
      }
      await putPending({ id, userId, draft: clean, createdAt: Date.now(), attempts: 0 })
      await refreshCount()
    },
    [userId, refreshCount],
  )

  // Al iniciar sesión (o arrancar la app) se cuenta lo pendiente y se intenta enviar.
  useEffect(() => {
    void refreshCount().then(() => flush())
  }, [refreshCount, flush])

  useEffect(() => {
    const on = () => {
      setOnline(true)
      void flush()
    }
    const off = () => setOnline(false)
    const visible = () => document.visibilityState === 'visible' && void flush()
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    document.addEventListener('visibilitychange', visible)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [flush])

  // Mientras haya pendientes se reintenta cada 30 s (por si el navegador no avisa de que volvió la red).
  useEffect(() => {
    if (!pending) return
    const t = setInterval(() => void flush(), 30000)
    return () => clearInterval(t)
  }, [pending, flush])

  return (
    <SyncContext.Provider value={{ online, pending, justSent, syncing, lastError, enqueue, flush }}>{children}</SyncContext.Provider>
  )
}

export function useSync() {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSync fuera de SyncProvider')
  return ctx
}
