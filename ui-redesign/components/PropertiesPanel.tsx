'use client'

import { motion } from 'framer-motion'
import { Image, Clock, HardDrive, FilmSlate, Monitor } from '@phosphor-icons/react'
import { type Screenshot } from '@/lib/types'
import { formatTime, formatFileSize, getRelevanceLabel } from '@/lib/utils'
import { getThumbnailUrl } from '@/lib/api'

interface PropertiesPanelProps {
  screenshot: Screenshot | null
  onExportToJianying: () => void
  onCreateVideo: () => void
}

export function PropertiesPanel({
  screenshot,
  onExportToJianying,
  onCreateVideo,
}: PropertiesPanelProps) {
  if (!screenshot) {
    return (
      <aside className="w-full h-full bg-bg-sidebar border-l border-border flex items-center justify-center">
        <div className="text-center text-text-tertiary text-sm">
          <Image size={48} className="mx-auto mb-2 opacity-20" />
          <p>Select a screenshot</p>
        </div>
      </aside>
    )
  }

  const relevancePercent = screenshot.relevance_display || screenshot.relevance_score * 100

  return (
    <aside className="w-full h-full bg-bg-sidebar border-l border-border overflow-y-auto">
      <div className="p-4 space-y-5">
        {/* Preview */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <img
            src={getThumbnailUrl(screenshot.file_path, 'medium')}
            alt="Preview"
            className="w-full rounded-md border border-border"
          />
        </motion.div>

        {/* Properties */}
        <div className="space-y-4 pb-5 border-b border-border-subtle">
          <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
            Properties
          </h3>

          <div className="space-y-2">
            <PropertyRow icon={Clock} label="Time" value={formatTime(screenshot.timestamp)} />
            <PropertyRow icon={Monitor} label="App" value={screenshot.app_name} />
            <PropertyRow icon={Image} label="Window" value={screenshot.window_title} />
            <PropertyRow
              icon={Image}
              label="Dimensions"
              value={screenshot.window_info?.dimensions || `${screenshot.window_width} × ${screenshot.window_height}`}
            />
          </div>
        </div>

        {/* AI Analysis */}
        <div className="space-y-4 pb-5 border-b border-border-subtle">
          <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wide">
            AI Analysis
          </h3>

          <p className="text-sm text-text-secondary leading-relaxed">{screenshot.ai_summary || 'No AI summary available'}</p>

          {/* Relevance meter */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-tertiary">Relevance</span>
              <span className="text-text-secondary font-medium tabular-nums">
                {relevancePercent}%
              </span>
            </div>
            <div className="h-1.5 bg-bg-app rounded-full overflow-hidden">
              <motion.div
                className={`h-full ${
                  relevancePercent >= 80
                    ? 'bg-warning'
                    : relevancePercent >= 50
                    ? 'bg-success'
                    : 'bg-accent'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${relevancePercent}%` }}
                transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
            <div className="text-xs text-text-tertiary">
              Type: {getRelevanceLabel(relevancePercent)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={onExportToJianying}
            className="w-full h-9 bg-accent hover:bg-accent-hover text-white rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FilmSlate size={16} />
            Export to JianYing
          </button>
          <button
            onClick={onCreateVideo}
            className="w-full h-9 bg-bg-surface hover:bg-bg-hover border border-border text-text-primary rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FilmSlate size={16} />
            Create Video
          </button>
        </div>
      </div>
    </aside>
  )
}

function PropertyRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between text-sm h-7">
      <div className="flex items-center gap-2 text-text-tertiary">
        <Icon size={14} />
        <span>{label}</span>
      </div>
      <span className="text-text-secondary font-mono text-xs tabular-nums">{value}</span>
    </div>
  )
}
