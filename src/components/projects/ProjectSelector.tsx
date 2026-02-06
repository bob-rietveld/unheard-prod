import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderIcon, PlusIcon, AlertTriangleIcon } from 'lucide-react'
import { open } from '@tauri-apps/plugin-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useProjects,
  useCreateProject,
  useDetectGitLFS,
} from '@/services/projects'
import { useProjectStore } from '@/store/project-store'
import { logger } from '@/lib/logger'

export function ProjectSelector() {
  const { t } = useTranslation()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectPath, setProjectPath] = useState('')

  const projects = useProjects()
  const { data: lfsAvailable } = useDetectGitLFS()
  const projectsLoading = projects === undefined
  const createProject = useCreateProject()
  const currentProject = useProjectStore(state => state.currentProject)
  const setCurrentProject = useProjectStore(state => state.setCurrentProject)

  // Restore persisted project selection on load
  const persistedProjectId = useProjectStore(
    state => state._persistedProjectId
  )
  useEffect(() => {
    if (projects && !currentProject && persistedProjectId) {
      const project = projects.find(
        (p: { _id: string }) => p._id === persistedProjectId
      )
      if (project) {
        setCurrentProject(project)
        logger.info('Restored persisted project', {
          projectId: persistedProjectId,
          name: project.name,
        })
      }
    }
  }, [projects, currentProject, persistedProjectId, setCurrentProject])

  const handleSelectProject = (projectId: string) => {
    const project = projects?.find((p: { _id: string }) => p._id === projectId)
    if (project) {
      setCurrentProject(project)
      logger.info('Project selected', { projectId, name: project.name })
    }
  }

  const handleBrowsePath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('projects.selectLocation', 'Select Project Location'),
      })

      if (selected && typeof selected === 'string') {
        setProjectPath(selected)
        logger.debug('Project path selected', { path: selected })
      }
    } catch (error) {
      logger.error('Failed to open directory picker', { error })
    }
  }

  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      return
    }

    if (!projectPath.trim()) {
      return
    }

    try {
      const result = await createProject.mutateAsync({
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
        localPath: projectPath,
      })

      // Wait for Convex subscription to populate projects list, then select the new project
      // Use a short timeout to allow Convex to sync
      setTimeout(() => {
        const project = projects?.find(p => p._id === result.projectId)
        if (project) {
          setCurrentProject(project)
        }
      }, 500)

      // Close dialog and reset form
      setIsCreateDialogOpen(false)
      setProjectName('')
      setProjectDescription('')
      setProjectPath('')

      logger.info('Project created and selected', {
        projectId: result.projectId,
        name: result.projectName,
      })
    } catch (error) {
      logger.error('Failed to create project', { error })
      // Error toast is already shown by the mutation
    }
  }

  const isFormValid =
    projectName.trim().length > 0 && projectPath.trim().length > 0

  return (
    <div className="flex items-center gap-2">
      <Select
        value={currentProject?._id}
        onValueChange={handleSelectProject}
        disabled={projectsLoading}
      >
        <SelectTrigger className="w-full border-border/60 bg-background/50 hover:bg-background hover:border-border transition-colors">
          <SelectValue
            placeholder={
              projectsLoading
                ? t('projects.loading', 'Loading...')
                : t('projects.selectProject', 'Select project')
            }
          />
        </SelectTrigger>
        <SelectContent className="border-border/60">
          {projects?.map((project: { _id: string; name: string }) => (
            <SelectItem
              key={project._id}
              value={project._id}
              className="cursor-pointer"
            >
              <span className="font-medium">{project.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            title={t('projects.createNew', 'Create project')}
            className="shrink-0 border-border/60 hover:bg-accent transition-colors cursor-pointer"
          >
            <PlusIcon className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="border-border/60">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {t('projects.createProject', 'Create New Project')}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              {t(
                'projects.createDescription',
                'Set up a new project with Git version control and organized directory structure.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-6">
            <div className="grid gap-2.5">
              <Label
                htmlFor="project-name"
                className="text-sm font-medium text-foreground"
              >
                {t('projects.name', 'Project Name')}
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder={t(
                  'projects.namePlaceholder',
                  'My Decision Project'
                )}
                maxLength={50}
                className="border-border/60 bg-background focus:border-border transition-colors"
              />
            </div>

            <div className="grid gap-2.5">
              <Label
                htmlFor="project-description"
                className="text-sm font-medium text-foreground"
              >
                {t('projects.description', 'Description')}{' '}
                <span className="text-muted-foreground font-normal">
                  ({t('common.optional', 'optional')})
                </span>
              </Label>
              <Input
                id="project-description"
                value={projectDescription}
                onChange={e => setProjectDescription(e.target.value)}
                placeholder={t(
                  'projects.descriptionPlaceholder',
                  'Brief description of the project'
                )}
                className="border-border/60 bg-background focus:border-border transition-colors"
              />
            </div>

            <div className="grid gap-2.5">
              <Label
                htmlFor="project-path"
                className="text-sm font-medium text-foreground"
              >
                {t('projects.location', 'Location')}
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="project-path"
                  value={projectPath}
                  onChange={e => setProjectPath(e.target.value)}
                  placeholder={t(
                    'projects.locationPlaceholder',
                    '/path/to/project'
                  )}
                  readOnly
                  className="border-border/60 bg-muted/30 focus:border-border transition-colors"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowsePath}
                  className="shrink-0 cursor-pointer border-border/60 hover:bg-accent"
                >
                  <FolderIcon className="size-4" />
                </Button>
              </div>
            </div>

            {lfsAvailable === false && (
              <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                <AlertTriangleIcon className="size-5 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                <div className="text-sm space-y-1">
                  <p className="font-medium text-foreground">
                    {t('projects.lfsWarning', 'Git LFS not detected')}
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {t(
                      'projects.lfsWarningDescription',
                      'Large files (PDF, Excel) may impact repository performance. Consider installing Git LFS.'
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              className="cursor-pointer border-border/60 hover:bg-accent"
            >
              <span className="text-sm font-medium">
                {t('common.cancel', 'Cancel')}
              </span>
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!isFormValid || createProject.isPending}
              className="cursor-pointer"
            >
              <span className="text-sm font-medium">
                {createProject.isPending
                  ? t('projects.creating', 'Creating...')
                  : t('projects.create', 'Create')}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
