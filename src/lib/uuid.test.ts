import { afterEach, describe, expect, it, vi } from 'vitest'
import { uuid } from './uuid'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuid', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('genera un UUID v4 válido y distinto cada vez', () => {
    const a = uuid()
    expect(a).toMatch(V4)
    expect(uuid()).not.toBe(a)
  })

  it('funciona sin crypto.randomUUID (contexto no seguro, http en la red local)', () => {
    const real = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => real.getRandomValues(a) })
    const ids = new Set(Array.from({ length: 200 }, () => uuid()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(V4)
  })
})
