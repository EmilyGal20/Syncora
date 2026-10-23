import { describe, expect, it } from 'vitest'
import { isStandaloneApp } from './install'

describe('PWA install helpers', () => {
  it('treats a normal browser tab as not installed', () => {
    expect(isStandaloneApp()).toBe(false)
  })
})
