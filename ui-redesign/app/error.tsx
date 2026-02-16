'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="h-screen flex items-center justify-center bg-bg-app">
      <div className="text-center max-w-md">
        <p className="text-red-500 mb-4">Something went wrong!</p>
        <p className="text-text-tertiary text-sm mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-md text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
