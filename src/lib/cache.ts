/** Copia local (localStorage) de datos de solo lectura para poder trabajar sin conexión. */
const PREFIX = 'qc.cache.'

export function cacheSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* sin espacio o almacenamiento bloqueado: se ignora */
  }
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
