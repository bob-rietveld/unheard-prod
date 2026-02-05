import { useTranslation } from 'react-i18next'
import { useProjectStore } from '@/store/project-store'
import { FolderIcon } from 'lucide-react'

/**
 * ProjectSettings shows project configuration and metadata.
 * Minimal, peaceful design.
 */

export function ProjectSettings() {
  const { t } = useTranslation()
  const currentProject = useProjectStore(state => state.currentProject)

  if (!currentProject) {
    return null
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-6 py-6 space-y-6">
        {/* Project info */}
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-medium tracking-wider uppercase text-foreground/40 block mb-2">
              {t('project.settings.name', 'Project Name')}
            </label>
            <p className="text-[14px] text-foreground">{currentProject.name}</p>
          </div>

          {currentProject.description && (
            <div>
              <label className="text-[11px] font-medium tracking-wider uppercase text-foreground/40 block mb-2">
                {t('project.settings.description', 'Description')}
              </label>
              <p className="text-[14px] text-foreground/70">
                {currentProject.description}
              </p>
            </div>
          )}

          <div>
            <label className="text-[11px] font-medium tracking-wider uppercase text-foreground/40 block mb-2">
              {t('project.settings.location', 'Location')}
            </label>
            <div className="flex items-center gap-2 text-[13px] text-foreground/70">
              <FolderIcon className="size-3.5 opacity-50" />
              <code className="font-mono">{currentProject.localPath}</code>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium tracking-wider uppercase text-foreground/40 block mb-2">
              {t('project.settings.created', 'Created')}
            </label>
            <p className="text-[13px] text-foreground/70">
              {new Date(currentProject._creationTime).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
