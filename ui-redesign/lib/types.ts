export interface Screenshot {
  id: string
  path: string
  timestamp: string
  aiSummary: string
  relevance: number
  size: string
  type: string
  width: number
  height: number
}

export interface Session {
  id: string
  name: string
  description?: string
  screenshots: Screenshot[]
  createdAt: string
  duration: string
}

export type FilterType = 'all' | 'hero' | 'success' | 'context'

export interface QuickAccessItem {
  id: FilterType
  label: string
  icon: string
  count: number
}
