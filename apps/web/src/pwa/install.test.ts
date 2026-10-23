import { describe, expect, it } from 'vitest'
import { isStandaloneApp, shouldOfferWorkspaceInstall } from './install'

describe('PWA install helpers', () => {
  it('treats a normal browser tab as not installed', () => {
    expect(isStandaloneApp()).toBe(false)
  })

  it('offers the login notice only to allowed users who are not already installed', () => {
    expect(shouldOfferWorkspaceInstall({ allowed: true, installed: false, enabled: true })).toBe(true)
    expect(shouldOfferWorkspaceInstall({ allowed: false, installed: false, enabled: true })).toBe(false)
    expect(shouldOfferWorkspaceInstall({ allowed: true, installed: true, enabled: true })).toBe(false)
    expect(shouldOfferWorkspaceInstall({ allowed: true, installed: false, enabled: false })).toBe(false)
  })
})
