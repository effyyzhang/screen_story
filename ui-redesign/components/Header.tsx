'use client'

import { motion } from 'framer-motion'
import { MagnifyingGlass, Gear, Circle, Play, Stop, VideoCamera } from '@phosphor-icons/react'
import { useState } from 'react'

interface HeaderProps {
  isRecording: boolean
  screenshotCount?: number
  searchQuery: string
  onSearchChange: (query: string) => void
  onStartCapture: () => void
  onStopCapture: () => void
}

export function Header({ isRecording, screenshotCount = 0, searchQuery, onSearchChange, onStartCapture, onStopCapture }: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="h-14 bg-[#111111] border-b border-border flex items-center px-5 gap-6 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <VideoCamera size={20} weight="duotone" className="text-accent" />
        <h1 className="text-base font-medium">Screen Story</h1>
      </div>

      {/* Search */}
      <motion.div
        className="relative flex-1 max-w-md"
        animate={{ width: searchFocused ? '500px' : '400px' }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
        <input
          type="search"
          placeholder="Search screenshots..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-8 bg-bg-app border border-border rounded-md pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none transition-colors"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
      </motion.div>

      <div className="flex-1" />

      {/* Recording Status Indicator */}
      {isRecording && (
        <motion.div
          className="flex items-center gap-2 px-3 py-1.5 bg-[#1C0F0F] border border-[#3D1515] rounded-md"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.3, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Circle className="w-2 h-2 fill-[#FF4444] text-[#FF4444]" />
          </motion.div>
          <span className="text-xs text-[#FF9999] font-medium">
            Recording... {screenshotCount} screenshots
          </span>
        </motion.div>
      )}

      {/* Idle Status (subtle) */}
      {!isRecording && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-surface rounded-md">
          <Circle className="w-2 h-2 fill-text-tertiary text-text-tertiary" />
          <span className="text-xs text-text-secondary">Idle</span>
        </div>
      )}

      {/* Actions */}
      <button
        className="w-8 h-8 flex items-center justify-center hover:bg-bg-hover rounded-md transition-colors"
        aria-label="Settings"
      >
        <Gear className="w-4 h-4 text-text-secondary" />
      </button>

      <button
        onClick={isRecording ? onStopCapture : onStartCapture}
        className={`h-8 px-4 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
          isRecording
            ? 'bg-[#3D1515] hover:bg-[#4D1A1A] text-[#FF9999] border border-[#3D1515]'
            : 'bg-accent hover:bg-accent-hover text-white'
        }`}
      >
        {isRecording ? (
          <>
            <Stop size={16} weight="fill" />
            <span>Stop</span>
          </>
        ) : (
          <>
            <Play size={16} weight="fill" />
            <span>Start Recording</span>
          </>
        )}
      </button>
    </header>
  )
}
