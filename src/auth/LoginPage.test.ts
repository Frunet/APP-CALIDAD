import { describe, expect, it } from 'vitest'
import { loginEmails } from './LoginPage'

describe('loginEmails', () => {
  it('IV GAMA, IVGAMA e iv-gama son el mismo usuario', () => {
    expect(loginEmails('IV GAMA')).toEqual(['ivgama@frutacheck.test', 'iv-gama@frutacheck.test'])
    expect(loginEmails('IVGAMA')).toEqual(['ivgama@frutacheck.test'])
    expect(loginEmails(' iv-gama ')).toEqual(['ivgama@frutacheck.test', 'iv-gama@frutacheck.test'])
  })

  it('un solo nombre da una sola dirección', () => {
    expect(loginEmails('ADMINISTRADOR')).toEqual(['administrador@frutacheck.test'])
    expect(loginEmails('1 GAMA')[0]).toBe('1gama@frutacheck.test')
  })

  it('un email completo se respeta', () => {
    expect(loginEmails('alguien@empresa.com')).toEqual(['alguien@empresa.com'])
  })
})
