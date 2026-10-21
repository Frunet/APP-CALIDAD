import type { ReceptionDraft } from '../types'

/**
 * Cola de recepciones pendientes de enviar, guardada en IndexedDB.
 * IndexedDB admite Blob/File, así que las fotos se guardan tal cual junto al borrador.
 */
export interface PendingItem {
  id: string // = id de la recepción (estable: reintentar es idempotente)
  userId: string // solo se envía con la sesión del usuario que la creó
  draft: ReceptionDraft
  createdAt: number
  attempts: number
  lastError?: string
}

const DB_NAME = 'qc-offline'
const STORE = 'pending'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export const putPending = (item: PendingItem) => run('readwrite', (s) => s.put(item)).then(() => undefined)
export const removePending = (id: string) => run('readwrite', (s) => s.delete(id)).then(() => undefined)
export const listPending = () => run<PendingItem[]>('readonly', (s) => s.getAll())
