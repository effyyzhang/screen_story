'use client'

import { useState, useMemo } from 'react'
import { Header } from '@/components/Header'
import { Sidebar } from '@/components/Sidebar'
import { ScreenshotGrid } from '@/components/ScreenshotGrid'
import { PropertiesPanel } from '@/components/PropertiesPanel'
import { type Screenshot, type Session, type FilterType } from '@/lib/types'

// Mock data - replace with real data from your backend
const mockSessions: Session[] = [
  {
    id: '1',
    name: 'jianying-mcp-test',
    description: 'Testing JianYing MCP integration',
    createdAt: '2026-02-15T10:00:00Z',
    duration: '9 min',
    screenshots: [
      {
        id: '1',
        path: '/api/placeholder/800/500',
        timestamp: '2026-02-15T10:05:00Z',
        aiSummary: 'User navigating to settings panel in Claude Desktop',
        relevance: 85,
        size: '2.4 MB',
        type: 'PNG',
        width: 1920,
        height: 1080,
      },
      {
        id: '2',
        path: '/api/placeholder/800/500',
        timestamp: '2026-02-15T10:06:00Z',
        aiSummary: 'Terminal window showing git commit command',
        relevance: 72,
        size: '1.8 MB',
        type: 'PNG',
        width: 1920,
        height: 1080,
      },
      {
        id: '3',
        path: '/api/placeholder/800/500',
        timestamp: '2026-02-15T10:07:00Z',
        aiSummary: 'Browser displaying JianYing project documentation',
        relevance: 45,
        size: '3.1 MB',
        type: 'PNG',
        width: 1920,
        height: 1080,
      },
      {
        id: '4',
        path: '/api/placeholder/800/500',
        timestamp: '2026-02-15T10:08:00Z',
        aiSummary: 'Code editor with TypeScript interface definition',
        relevance: 90,
        size: '2.2 MB',
        type: 'PNG',
        width: 1920,
        height: 1080,
      },
      {
        id: '5',
        path: '/api/placeholder/800/500',
        timestamp: '2026-02-15T10:09:00Z',
        aiSummary: 'JianYing desktop app showing imported project',
        relevance: 95,
        size: '4.5 MB',
        type: 'PNG',
        width: 1920,
        height: 1080,
      },
    ],
  },
  {
    id: '2',
    name: 'screen-story-completion',
    createdAt: '2026-02-11T07:25:00Z',
    duration: '2 min',
    screenshots: [],
  },
]

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [activeSession, setActiveSession] = useState<string | null>(mockSessions[0].id)
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null)

  const currentSession = useMemo(
    () => mockSessions.find((s) => s.id === activeSession),
    [activeSession]
  )

  const filteredScreenshots = useMemo(() => {
    if (!currentSession) return []

    switch (activeFilter) {
      case 'hero':
        return currentSession.screenshots.filter((s) => s.relevance >= 80)
      case 'success':
        return currentSession.screenshots.filter((s) => s.relevance >= 50 && s.relevance < 80)
      case 'all':
      default:
        return currentSession.screenshots
    }
  }, [currentSession, activeFilter])

  const sessionMeta = useMemo(() => {
    if (!currentSession) return ''
    return `${filteredScreenshots.length} screenshots • ${currentSession.duration}`
  }, [currentSession, filteredScreenshots])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header
        isRecording={isRecording}
        onStartCapture={() => setIsRecording(true)}
        onStopCapture={() => setIsRecording(false)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          sessions={mockSessions}
          activeSession={activeSession}
          onSessionChange={setActiveSession}
        />

        <ScreenshotGrid
          screenshots={filteredScreenshots}
          sessionName={currentSession?.name || ''}
          sessionMeta={sessionMeta}
          onScreenshotClick={setSelectedScreenshot}
        />

        <PropertiesPanel
          screenshot={selectedScreenshot}
          onExportToJianying={() => {
            console.log('Export to JianYing:', selectedScreenshot)
          }}
          onCreateVideo={() => {
            console.log('Create video:', selectedScreenshot)
          }}
        />
      </div>
    </div>
  )
}
