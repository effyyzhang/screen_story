const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export interface FolderCounts {
  apps: Array<{ name: string; count: number }>
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

export interface ScreenshotsResponse {
  screenshots: any[]
  total: number
  page: number
  pages: number
}

export interface ScreenshotFilters {
  page?: number
  limit?: number
  folder?: string // format: "type:value" e.g., "app:Chrome", "session:MySession"
  sort?: string // format: "field-direction" e.g., "timestamp-desc"
  q?: string // text search
  dateStart?: string // YYYY-MM-DD
  dateEnd?: string // YYYY-MM-DD
  apps?: string // comma-separated
  since?: string // ISO timestamp for delta sync
}

export interface ActiveSessionResponse {
  hasActiveSession: boolean
  session: any | null
}

/**
 * Fetch all folder counts in a single API call
 */
export async function fetchFolderCounts(): Promise<FolderCounts> {
  const res = await fetch(`${API_BASE_URL}/api/folders/all`)
  if (!res.ok) {
    throw new Error(`Failed to fetch folder counts: ${res.status}`)
  }
  return res.json()
}

/**
 * Fetch screenshots with optional filtering and pagination
 */
export async function fetchScreenshots(
  filters: ScreenshotFilters = {},
  options?: { signal?: AbortSignal }
): Promise<ScreenshotsResponse> {
  const params = new URLSearchParams()

  if (filters.page) params.append('page', filters.page.toString())
  if (filters.limit) params.append('limit', filters.limit.toString())
  if (filters.folder) params.append('folder', filters.folder)
  if (filters.sort) params.append('sort', filters.sort)
  if (filters.q) params.append('q', filters.q)
  if (filters.dateStart) params.append('dateStart', filters.dateStart)
  if (filters.dateEnd) params.append('dateEnd', filters.dateEnd)
  if (filters.apps) params.append('apps', filters.apps)
  if (filters.since) params.append('since', filters.since)

  const url = `${API_BASE_URL}/api/screenshots?${params.toString()}`
  const res = await fetch(url, { signal: options?.signal })

  if (!res.ok) {
    throw new Error(`Failed to fetch screenshots: ${res.status}`)
  }

  return res.json()
}

/**
 * Fetch session details with all screenshots
 */
export async function fetchSessionDetails(sessionId: number | string) {
  const res = await fetch(`${API_BASE_URL}/api/sessions/${sessionId}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch session ${sessionId}: ${res.status}`)
  }
  return res.json()
}

/**
 * Get thumbnail URL for a screenshot
 */
export function getThumbnailUrl(filePath: string, size: 'thumb' | 'medium' | 'full' = 'thumb'): string {
  // Extract session and filename from file_path
  // Format: /path/to/sessions/session-name/frame_0001.png
  const match = filePath.match(/sessions\/([^/]+)\/([^/]+)$/)
  if (!match) {
    console.warn('Invalid file path format:', filePath)
    return filePath
  }

  const [, session, filename] = match
  return `${API_BASE_URL}/screenshots/${session}/${filename}?size=${size}`
}

/**
 * Get capture status
 */
export async function fetchCaptureStatus() {
  const res = await fetch(`${API_BASE_URL}/api/capture/status`)
  if (!res.ok) {
    throw new Error(`Failed to fetch capture status: ${res.status}`)
  }
  return res.json()
}

/**
 * Start capture session
 */
export async function startCapture(sessionName: string, description?: string) {
  const res = await fetch(`${API_BASE_URL}/api/capture/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionName, description }),
  })
  if (!res.ok) {
    throw new Error(`Failed to start capture: ${res.status}`)
  }
  return res.json()
}

/**
 * Stop capture session
 */
export async function stopCapture() {
  const res = await fetch(`${API_BASE_URL}/api/capture/stop`, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(`Failed to stop capture: ${res.status}`)
  }
  return res.json()
}

/**
 * Fetch active recording session
 */
export async function fetchActiveSession(): Promise<ActiveSessionResponse> {
  const res = await fetch(`${API_BASE_URL}/api/sessions/active`)
  if (!res.ok) {
    throw new Error(`Failed to fetch active session: ${res.status}`)
  }
  return res.json()
}
