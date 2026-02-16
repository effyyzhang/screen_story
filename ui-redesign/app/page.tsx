'use client'

import { useState, useMemo, useEffect } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { ScreenshotGrid } from '@/components/ScreenshotGrid'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { ResizablePanel } from '@/components/ResizablePanel'
import { useFolderCounts } from '@/hooks/useFolderCounts'
import { useScreenshots } from '@/hooks/useScreenshots'
import { useActiveSession } from '@/hooks/useActiveSession'
import { getThumbnailUrl, startCapture, stopCapture } from '@/lib/api'
import { type Screenshot, type FilterType } from '@/lib/types'

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [activeFolder, setActiveFolder] = useState<string | null>(null) // e.g., "app:Chrome", "session:1"
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Detect active recording session
  const { isRecording, activeSession } = useActiveSession()

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch folder counts for sidebar (poll when recording)
  const { data: folderCounts, loading: countsLoading, error: countsError } = useFolderCounts({
    polling: isRecording,
    pollingInterval: 30000, // 30 seconds
  })

  // Build filter parameter based on active selections
  const screenshotFilters = useMemo(() => {
    const filters: any = {
      limit: 100,
      sort: 'timestamp-desc',
    }

    // Add search query
    if (debouncedSearch.trim()) {
      filters.q = debouncedSearch.trim()
    }

    // If a specific folder is selected, use that
    if (activeFolder) {
      filters.folder = activeFolder
    }
    // Otherwise, use the quick access filter
    else if (activeFilter === 'hero') {
      filters.folder = 'success:hero'
    } else if (activeFilter === 'success') {
      filters.folder = 'success:success'
    }
    // 'all' filter doesn't need a folder parameter

    return filters
  }, [activeFilter, activeFolder, debouncedSearch])

  // Fetch screenshots based on filters (poll when recording)
  const { screenshots, total, loading: screenshotsLoading, error: screenshotsError } = useScreenshots(
    screenshotFilters,
    {
      polling: isRecording,
      pollingInterval: 10000, // 10 seconds - matches capture interval
    }
  )

  const handleScreenshotClick = (screenshot: Screenshot) => {
    // Immediate visual feedback - no waiting for image load
    setIsTransitioning(true)
    setSelectedScreenshot(screenshot)
    // Reset transition state after animation
    setTimeout(() => setIsTransitioning(false), 200)
  }

  const handleCloseDetail = () => {
    setIsTransitioning(true)
    setSelectedScreenshot(null)
    setTimeout(() => setIsTransitioning(false), 200)
  }

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter)
    setActiveFolder(null) // Clear folder selection when changing quick access
    setSelectedScreenshot(null) // Close detail view
  }

  const handleFolderChange = (folder: string) => {
    setActiveFolder(folder)
    setActiveFilter('all') // Reset quick access when selecting folder
    setSelectedScreenshot(null) // Close detail view
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
    setSelectedScreenshot(null) // Close detail view on search
  }

  const handleStartCapture = async () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const sessionName = `recording-${timestamp}`
      await startCapture(sessionName, 'Screen recording session')
      console.log('✅ Recording started:', sessionName)
    } catch (error) {
      console.error('❌ Failed to start recording:', error)
      alert('Failed to start recording. Make sure the backend server is running.')
    }
  }

  const handleStopCapture = async () => {
    try {
      await stopCapture()
      console.log('⏹ Recording stopped')
    } catch (error) {
      console.error('❌ Failed to stop recording:', error)
      alert('Failed to stop recording.')
    }
  }

  // Format session meta information
  const sessionMeta = useMemo(() => {
    if (!folderCounts) return ''
    return `${total} screenshots`
  }, [total, folderCounts])

  // Show loading state
  if (countsLoading || screenshotsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-app">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-border border-t-accent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">Loading screenshots...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (countsError || screenshotsError) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-app">
        <div className="text-center max-w-md">
          <p className="text-red-500 mb-4">Failed to load data</p>
          <p className="text-text-tertiary text-sm mb-4">
            {countsError?.message || screenshotsError?.message}
          </p>
          <p className="text-text-secondary text-sm">
            Make sure the backend server is running on http://localhost:4000
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-md text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        isRecording={isRecording}
        screenshotCount={total}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onStartCapture={handleStartCapture}
        onStopCapture={handleStopCapture}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Fixed width */}
        <div className="w-60 flex-shrink-0">
          <Sidebar
            activeFilter={activeFilter}
            onFilterChange={handleFilterChange}
            activeFolder={activeFolder}
            onFolderChange={handleFolderChange}
            folderCounts={folderCounts}
          />
        </div>

        {/* Center Content - Grid or Detail View */}
        <div className="flex-1 overflow-hidden relative">
          {selectedScreenshot ? (
            // Detail View - Large preview with loading state
            <div className="h-full flex items-center justify-center bg-bg-app p-8">
              {/* Loading placeholder - shows immediately */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-bg-surface rounded-lg animate-pulse" />
              </div>
              {/* Actual image - loads in background */}
              <img
                src={getThumbnailUrl(selectedScreenshot.file_path, 'full')}
                alt="Detail view"
                className="max-w-full max-h-full object-contain rounded-lg cursor-pointer relative z-10"
                onClick={handleCloseDetail}
                loading="eager"
                onLoad={(e) => {
                  // Hide placeholder once loaded
                  const placeholder = e.currentTarget.previousElementSibling as HTMLElement
                  if (placeholder) placeholder.style.display = 'none'
                }}
              />
            </div>
          ) : (
            // Grid View
            <ScreenshotGrid
              screenshots={screenshots}
              sessionName={activeFolder || 'All Screenshots'}
              sessionMeta={sessionMeta}
              onScreenshotClick={handleScreenshotClick}
            />
          )}
        </div>

        {/* Right Panel - Only visible in detail view, draggable */}
        {selectedScreenshot && (
          <ResizablePanel defaultWidth={320} minWidth={280} maxWidth={500} side="right">
            <PropertiesPanel
              screenshot={selectedScreenshot}
              onExportToJianying={() => {
                console.log('Export to JianYing:', selectedScreenshot)
              }}
              onCreateVideo={() => {
                console.log('Create video:', selectedScreenshot)
              }}
            />
          </ResizablePanel>
        )}
      </div>
    </div>
  )
}
