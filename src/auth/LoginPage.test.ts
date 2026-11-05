import { describe, expect, it } from 'vitest'
import { loginEmails } from './LoginPage'

describe('loginEmails', () => {
  it('IV GAMA, IVGAMA e iv-gama son el mismo usuario', () => {
    expect(loginEmails('IV GAMA')).toEqual([
      'ivgama@frutacheck.test',
      'ivgama@frutacheck.prueba',
      'iv-gama@frutacheck.test',
      'iv-gama@frutacheck.prueba',
    ])
    expect(loginEmails('IVGAMA')).toEqual(['ivgama@frutacheck.test', 'ivgama@frutacheck.prueba'])
    expect(loginEmails(' iv-gama ')).toEqual([
      'ivgama@frutacheck.test',
      'ivgama@frutacheck.prueba',
      'iv-gama@frutacheck.test',
      'iv-gama@frutacheck.prueba',
    ])
  })

  it('un solo nombre da una sola dirección', () => {
    expect(loginEmails('ADMINISTRADOR')).toEqual(['administrador@frutacheck.test', 'administrador@frutacheck.prueba'])
    expect(loginEmails('1 GAMA')[0]).toBe('1gama@frutacheck.test')
  })

  it('un email completo se respeta', () => {
    expect(loginEmails('alguien@empresa.com')).toEqual(['alguien@empresa.com'])
  })
})
