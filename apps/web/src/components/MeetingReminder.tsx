import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { playReminderChime } from '../lib/chime'
import type { CalendarEvent } from '../pages/CalendarPage'

const leadMs = 15 * 60 * 1000
const remembered = new Set<string>(JSON.parse(localStorage.getItem('syncora_meeting_chimes') || '[]') as string[])

function remember(id: string) {
  remembered.add(id)
  localStorage.setItem('syncora_meeting_chimes', JSON.stringify([...remembered].slice(-200)))
}

export function MeetingReminder() {
  const { user } = useAuth()
  const events = useQuery({
    queryKey: ['events'],
    enabled: Boolean(user),
    queryFn: async () => (await api.get<CalendarEvent[]>('/events')).data,
    refetchInterval: 30_000,
  })
  useEffect(() => {
    if (!events.data) return
    const now = Date.now()
    for (const event of events.data) {
      if (!['meeting', 'appointment'].includes(event.event_type)) continue
      const start = new Date(event.starts_at).getTime()
      if (start < now || start - now > leadMs) continue
      const key = `remind:${event.id}:${event.starts_at}`
      if (remembered.has(key)) continue
      remember(key)
      playReminderChime()
    }
  }, [events.data])
  return null
}
