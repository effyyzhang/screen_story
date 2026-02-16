import { useState, useEffect, useRef } from 'react'
import { fetchScreenshots, type ScreenshotFilters } from '@/lib/api'
import { type Screenshot } from '@/lib/types'

interface UseScreenshotsResult {
  screenshots: Screenshot[]
  total: number
  page: number
  pages: number
  loading: boolean
  error: Error | null
  refetch: () => void
}

interface UseScreenshotsOptions {
  polling?: boolean
  pollingInterval?: number
}

export function useScreenshots(
  filters: ScreenshotFilters = {},
  options: UseScreenshotsOptions = {}
): UseScreenshotsResult {
  const [data, setData] = useState<{
    screenshots: Screenshot[]
    total: number
    page: number
    pages: number
  }>({
    screenshots: [],
    total: 0,
    page: 1,
    pages: 1,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [retryCount, setRetryCount] = useState(0)
  const [lastFetchTimestamp, setLastFetchTimestamp] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadScreenshots() {
      try {
        setLoading(true)
        setError(null)

        // Cancel previous request
        abortControllerRef.current?.abort()
        abortControllerRef.current = new AbortController()

        // Use delta sync if polling and we have a previous timestamp
        const screenshotFilters: ScreenshotFilters = {
          ...filters,
          ...(options.polling && lastFetchTimestamp ? { since: lastFetchTimestamp } : {}),
        }

        const result = await fetchScreenshots(screenshotFilters, {
          signal: abortControllerRef.current.signal,
        })

        if (!cancelled) {
          // If polling with delta sync, merge new screenshots
          if (options.polling && lastFetchTimestamp && result.screenshots.length > 0) {
            setData((prev) => {
              // Deduplicate by ID
              const combined = [...result.screenshots, ...prev.screenshots]
              const unique = combined.reduce((acc, curr) => {
                if (!acc.find((s: Screenshot) => s.id === curr.id)) {
                  acc.push(curr)
                }
                return acc
              }, [] as Screenshot[])

              // Keep only top 100
              return {
                ...result,
                screenshots: unique.slice(0, 100),
                total: prev.total + result.screenshots.length,
              }
            })
          } else {
            // Regular fetch - replace all data
            setData(result)
          }

          // Update timestamp for next delta sync
          setLastFetchTimestamp(new Date().toISOString())
          setRetryCount(0) // Reset retry count on success
        }
      } catch (err: any) {
        if (!cancelled) {
          // Ignore abort errors
          if (err.name === 'AbortError') return

          // Exponential backoff retry: 2s, 4s, 8s
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount + 1) * 1000
            console.log(`Retry ${retryCount + 1}/3 in ${delay}ms...`)
            setTimeout(() => {
              if (!cancelled) {
                setRetryCount((prev) => prev + 1)
                setRefreshTrigger((prev) => prev + 1)
              }
            }, delay)
          } else {
            setError(err as Error)
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadScreenshots()

    return () => {
      cancelled = true
      abortControllerRef.current?.abort()
    }
  }, [
    filters.page,
    filters.limit,
    filters.folder,
    filters.sort,
    filters.q,
    filters.dateStart,
    filters.dateEnd,
    filters.apps,
    refreshTrigger,
  ])

  // Tab visibility detection - refresh when tab becomes visible
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && !loading) {
        console.log('Tab visible - refreshing screenshots')
        refetch()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [loading])

  // Polling interval
  useEffect(() => {
    if (!options.polling) return

    const interval = setInterval(() => {
      if (!loading) {
        console.log('Polling - refreshing screenshots')
        refetch()
      }
    }, options.pollingInterval || 10000)

    return () => clearInterval(interval)
  }, [options.polling, options.pollingInterval, loading])

  const refetch = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return {
    screenshots: data.screenshots,
    total: data.total,
    page: data.page,
    pages: data.pages,
    loading,
    error,
    refetch,
  }
}
