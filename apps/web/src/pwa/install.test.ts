import { describe, expect, it } from 'vitest'
import { isStandaloneApp, shouldAskInstall, shouldOfferWorkspaceInstall } from './install'

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

  it('asks after sign-in until the user hides it or already saw it', () => {
    expect(shouldAskInstall({ allowed: true, installed: false, hidden: false, seen: false })).toBe(true)
    expect(shouldAskInstall({ allowed: false, installed: false, hidden: false, seen: false })).toBe(false)
    expect(shouldAskInstall({ allowed: true, installed: true, hidden: false, seen: false })).toBe(false)
    expect(shouldAskInstall({ allowed: true, installed: false, hidden: true, seen: false })).toBe(false)
    expect(shouldAskInstall({ allowed: true, installed: false, hidden: false, seen: true })).toBe(false)
  })
})
