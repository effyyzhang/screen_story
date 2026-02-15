export interface Screenshot {
  id: number
  session_id: number
  frame_number: number
  timestamp: string
  app_name: string
  window_title: string
  file_path: string
  ocr_text?: string
  ai_summary?: string
  is_success: boolean
  relevance_score: number
  relevance_display: number // 0-100 for UI display
  tags?: string[]
  analyzed: boolean
  window_width: number
  window_height: number
  window_x: number
  window_y: number
  is_fullscreen: boolean
  was_cropped: boolean
  session_name?: string
  window_info?: {
    dimensions: string
    position: string
    isFullscreen: boolean
    wasCropped: boolean
  }
  // Legacy fields for compatibility
  path?: string
  aiSummary?: string
  relevance?: number
  size?: string
  type?: string
  width?: number
  height?: number
}

export interface Session {
  id: number
  session_name: string
  description?: string
  started_at: string
  ended_at?: string
  status: 'recording' | 'stopped'
  screenshot_count: number
  is_continuous: boolean
  created_at: string
  analyzed_count?: number
  avg_relevance?: number
  screenshots?: Screenshot[]
  // Legacy fields for compatibility
  name?: string
  createdAt?: string
  duration?: string
}

export type FilterType = 'all' | 'hero' | 'success' | 'context'

export interface QuickAccessItem {
  id: FilterType
  label: string
  icon: string
  count: number
}

export interface AppFolder {
  name: string
  count: number
}

export interface TimeFolder {
  id: string
  label: string
  count: number
}

export interface FolderCounts {
  apps: AppFolder[]
  sessions: Array<{ id: number; name: string; count: number }>
  timePeriods: {
    today: number
    yesterday: number
    week: number
    month: number
  }
  success: {
    hero: number
    success: number
  }
  total: number
}
