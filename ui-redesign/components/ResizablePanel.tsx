'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

interface ResizablePanelProps {
  children: ReactNode
  defaultWidth: number
  minWidth: number
  maxWidth: number
  side: 'left' | 'right'
}

export function ResizablePanel({
  children,
  defaultWidth,
  minWidth,
  maxWidth,
  side,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      const panel = panelRef.current
      if (!panel) return

      const rect = panel.getBoundingClientRect()
      let newWidth: number

      if (side === 'left') {
        newWidth = e.clientX - rect.left
      } else {
        newWidth = rect.right - e.clientX
      }

      // Constrain to min/max
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, side, minWidth, maxWidth])

  const handleMouseDown = () => {
    setIsResizing(true)
  }

  return (
    <div
      ref={panelRef}
      className="relative flex-shrink-0 overflow-hidden"
      style={{ width: `${width}px` }}
    >
      {children}

      {/* Resize handle */}
      <div
        className={`absolute top-0 bottom-0 w-1 cursor-col-resize group z-10 ${
          side === 'left' ? 'right-0' : 'left-0'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div
          className={`absolute top-0 bottom-0 w-px bg-border transition-colors ${
            isResizing ? 'bg-accent' : 'group-hover:bg-border-hover'
          }`}
        />
        {/* Wider hit area */}
        <div className="absolute top-0 bottom-0 -left-1 -right-1" />
      </div>
    </div>
  )
}
