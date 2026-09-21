import { describe, expect, it } from 'vitest'
import { eventFormSchema, eventPayload, type EventForm } from './CalendarPage'

const valid:EventForm={title:'Planning session',description:'Quarterly plan',date:new Date(2026,8,25),endDate:new Date(2026,8,25),start:new Date(2026,8,25,9),end:new Date(2026,8,25,10,30),allDay:false,location:'Room 2',visibility:'team',teamId:'team-1',participants:['user-1']}

describe('calendar event form',()=>{
  it('builds a localized date and time payload for the API',()=>{
    const payload=eventPayload(valid)
    expect(payload.title).toBe('Planning session')
    expect(new Date(payload.starts_at).getHours()).toBe(9)
    expect(new Date(payload.ends_at).getMinutes()).toBe(30)
    expect(payload.participant_ids).toEqual(['user-1'])
  })

  it('rejects an end time before the start time',()=>{
    const result=eventFormSchema.safeParse({...valid,end:new Date(2026,8,25,8)})
    expect(result.success).toBe(false)
    if(!result.success)expect(result.error.issues.at(0)?.path).toEqual(['end'])
  })

  it('creates a full-day interval and ignores clock values',()=>{
    const payload=eventPayload({...valid,allDay:true})
    expect(new Date(payload.starts_at).getHours()).toBe(0)
    expect(new Date(payload.ends_at).getTime()-new Date(payload.starts_at).getTime()).toBe(86_400_000)
  })

  it('preserves a selected multi-day range',()=>{
    const payload=eventPayload({...valid,allDay:true,endDate:new Date(2026,8,28)})
    expect(new Date(payload.ends_at).getTime()-new Date(payload.starts_at).getTime()).toBe(4*86_400_000)
  })
})
