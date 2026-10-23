import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PageHeader } from './PageHeader'
describe('PageHeader',()=>{
  it('uses an accessible page heading',()=>{
    render(<PageHeader title="Tasks" subtitle="Daily work"/>)
    expect(screen.getByRole('heading',{level:1,name:'Tasks'})).toBeInTheDocument()
    expect(screen.getByText('Daily work')).toBeInTheDocument()
  })
  it('keeps page actions usable next to the title',()=>{
    render(<PageHeader title="Schedule" action={<button type="button">New</button>}/>)
    expect(screen.getByRole('button',{name:'New'})).toBeInTheDocument()
  })
})

