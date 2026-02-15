import { useState, useEffect } from 'react'
import { fetchActiveSession } from '@/lib/api'
import { type Session } from '@/lib/types'

interface UseActiveSessionResult {
  isRecording: boolean
  activeSession: Session | null
  loading: boolean
  error: Error | null
}

export function useActiveSession(): UseActiveSessionResult {
  const [isRecording, setIsRecording] = useState(false)
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function checkActive() {
      try {
        setError(null)
        const data = await fetchActiveSession()

        if (!cancelled) {
          setIsRecording(data.hasActiveSession)
          setActiveSession(data.session)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to check active session:', err)
          setError(err as Error)
          setLoading(false)
          // Don't set isRecording to false on error - keep previous state
        }
      }
    }

    // Initial check
    checkActive()

    // Poll every 5 seconds
    const interval = setInterval(() => {
      if (!cancelled) checkActive()
    }, 5000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return { isRecording, activeSession, loading, error }
}
