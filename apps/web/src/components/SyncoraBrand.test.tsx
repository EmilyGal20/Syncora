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
    expect(logo.getAttribute('src')).toContain(`syncora-logo-${mode}`)
  })

  it('exposes a branded loading status',()=>{
    render(<SyncoraLoader label="Authenticating"/>)
    const loader=screen.getByRole('status',{name:'Authenticating'})
    expect(loader).toBeInTheDocument()
    expect(loader.getAttribute('src')).toMatch(/^data:image\/svg\+xml/)
  })

  it('renders optimized mark and wordmark variants without distorting them',()=>{
    render(<ThemeProvider theme={createSyncoraTheme('light','ltr')}><SyncoraLogo asset="mark"/><SyncoraLogo asset="wordmark"/></ThemeProvider>)
    expect(screen.getByRole('img',{name:'Syncora'})).toHaveAttribute('data-brand-asset','mark')
    expect(screen.getByRole('img',{name:/Plan, Manage, Connect/})).toHaveStyle({height:'auto'})
  })

  it('supports a dark-surface logo independently of the page theme',()=>{
    render(<ThemeProvider theme={createSyncoraTheme('light','ltr')}><SyncoraLogo variant="dark"/></ThemeProvider>)
    const logo=screen.getByRole('img',{name:/Plan, Manage, Connect/})
    expect(logo).toHaveAttribute('data-brand-variant','dark')
    expect(logo.getAttribute('src')).toContain('syncora-logo-dark')
  })
})
