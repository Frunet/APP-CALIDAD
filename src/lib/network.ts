/**
 * ¿El error viene de que no hay conexión (y por tanto conviene reintentar más tarde)?
 * Los errores de datos (permisos, validaciones…) NO cuentan: esos no se arreglan reintentando.
 */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const msg = String((e as { message?: string } | null)?.message ?? e ?? '')
  const name = (e as { name?: string } | null)?.name ?? ''
  return (
    name === 'TypeError' ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed|timeout|timed out|ERR_INTERNET|ERR_NETWORK/i.test(msg)
  )
}
