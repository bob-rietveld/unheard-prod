import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ContextSection } from '@/components/context/ContextSection'
import { ProjectSettings } from './ProjectSettings'
import { cn } from '@/lib/utils'

/**
 * ProjectTabs shows tabs for navigating project views.
 * Follows minimal design with simple tab navigation.
 */

type Tab = 'files' | 'settings'

export function ProjectTabs() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('files')

  return (
    <div className="flex flex-col h-full">
      {/* Tab navigation */}
      <div className="border-b border-border/40 px-6">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('files')}
            className={cn(
              'px-4 py-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer',
              activeTab === 'files'
                ? 'text-foreground border-foreground'
                : 'text-foreground/50 border-transparent hover:text-foreground/70'
            )}
          >
            {t('project.tabs.files', 'Files')}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              'px-4 py-3 text-[13px] font-medium transition-colors border-b-2 cursor-pointer',
              activeTab === 'settings'
                ? 'text-foreground border-foreground'
                : 'text-foreground/50 border-transparent hover:text-foreground/70'
            )}
          >
            {t('project.tabs.settings', 'Settings')}
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && <ContextSection />}
        {activeTab === 'settings' && <ProjectSettings />}
      </div>
    </div>
  )
}
