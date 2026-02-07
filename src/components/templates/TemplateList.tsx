import { useTranslation } from 'react-i18next'
import { FlaskConical, TrendingUp, DollarSign, BarChart3 } from 'lucide-react'
import { useTemplates } from '@/services/templates'
import { useChatStore } from '@/store/chat-store'
import { useProjectStore } from '@/store/project-store'
import type { Doc } from '../../../convex/_generated/dataModel'

/**
 * Icon mapping by template category.
 * Falls back to FlaskConical for unknown categories.
 */
const CATEGORY_ICONS: Record<string, typeof FlaskConical> = {
  investor: TrendingUp,
  pricing: DollarSign,
  'van-westendorp': BarChart3,
  roadmap: FlaskConical,
}

/**
 * TemplateList displays available experiment templates in the left sidebar.
 * Clicking a template sets it as the current template in the chat store,
 * which triggers the ConfigWizard in the ChatInterface.
 */
export function TemplateList() {
  const { t } = useTranslation()
  const currentProject = useProjectStore(state => state.currentProject)
  const { data: templates, isLoading } = useTemplates()

  if (!currentProject) return null
  if (isLoading || !templates || templates.length === 0) return null

  const handleSelectTemplate = (template: Doc<'experimentTemplates'>) => {
    useChatStore.getState().setTemplate(template._id)
  }

  return (
    <div className="border-t border-border/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t('templates.sidebar.title')}
        </span>
      </div>
      <div className="space-y-0.5">
        {templates.map(template => {
          const Icon = CATEGORY_ICONS[template.category] ?? FlaskConical
          return (
            <button
              key={template._id}
              onClick={() => handleSelectTemplate(template)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/70 hover:bg-foreground/4 hover:text-foreground transition-colors"
              title={template.description}
            >
              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-[13px]">{template.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
