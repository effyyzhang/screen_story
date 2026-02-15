import { useState, useEffect } from 'react'
import { fetchFolderCounts } from '@/lib/api'
import { type FolderCounts } from '@/lib/types'

interface UseFolderCountsOptions {
  polling?: boolean
  pollingInterval?: number
}

export function useFolderCounts(options: UseFolderCountsOptions = {}) {
  const [data, setData] = useState<FolderCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function loadCounts() {
      try {
        setLoading(true)
        setError(null)
        const counts = await fetchFolderCounts()
        if (!cancelled) {
          setData(counts)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadCounts()

    return () => {
      cancelled = true
    }
  }, [refreshTrigger])

  // Polling interval
  useEffect(() => {
    if (!options.polling) return

    const interval = setInterval(() => {
      if (!loading) {
        console.log('Polling - refreshing folder counts')
        refetch()
      }
    }, options.pollingInterval || 30000) // Default 30s for counts

    return () => clearInterval(interval)
  }, [options.polling, options.pollingInterval, loading])

  const refetch = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return { data, loading, error, refetch }
}
