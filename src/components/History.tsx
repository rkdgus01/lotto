import type { Ticket } from '../lib/lotto'

export interface HistoryEntry {
  id: string
  at: number
  tickets: Ticket[]
}
