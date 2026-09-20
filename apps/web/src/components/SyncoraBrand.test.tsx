import '@testing-library/jest-dom/vitest'
import { ThemeProvider } from '@mui/material'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createSyncoraTheme } from '../theme'
import { SyncoraLoader, SyncoraLogo } from './SyncoraBrand'

afterEach(cleanup)

describe('Syncora branding',()=>{
  it.each(['light','dark'] as const)('renders the optimized logo in %s mode',mode=>{
    render(<ThemeProvider theme={createSyncoraTheme(mode,'ltr')}><SyncoraLogo/></ThemeProvider>)
    const logo=screen.getByRole('img',{name:/Syncora/})
    expect(logo).toHaveAttribute('data-brand-variant',mode)
    expect(logo.getAttribute('src')).toContain('syncora-logo-transparent')
  })

  it('exposes a branded loading status',()=>{
    render(<SyncoraLoader label="Authenticating"/>)
    expect(screen.getByRole('status',{name:'Authenticating'})).toBeInTheDocument()
  })
})
