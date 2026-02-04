import { useState } from 'react'
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

      // Set the newly created project as current
      // Note: Convex will update the projects list automatically via subscription
      setCurrentProject({
        _id: result.projectId,
        name: result.projectName,
        description: result.projectDescription,
        clerkUserId: '', // Will be populated by Convex query
        archived: false,
        createdAt: Date.now(),
      })

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
        <SelectTrigger className="w-[200px]">
          <SelectValue
            placeholder={
              projectsLoading
                ? t('projects.loading', 'Loading...')
                : t('projects.selectProject', 'Select project')
            }
          />
        </SelectTrigger>
        <SelectContent>
          {projects?.map((project: { _id: string; name: string }) => (
            <SelectItem key={project._id} value={project._id}>
              {project.name}
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
          >
            <PlusIcon className="size-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('projects.createProject', 'Create New Project')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'projects.createDescription',
                'Set up a new project with Git version control and organized directory structure.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="project-name">
                {t('projects.name', 'Project Name')}
                <span className="text-destructive">*</span>
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
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="project-description">
                {t('projects.description', 'Description')} (
                {t('common.optional', 'optional')})
              </Label>
              <Input
                id="project-description"
                value={projectDescription}
                onChange={e => setProjectDescription(e.target.value)}
                placeholder={t(
                  'projects.descriptionPlaceholder',
                  'Brief description of the project'
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="project-path">
                {t('projects.location', 'Location')}
                <span className="text-destructive">*</span>
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
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowsePath}
                >
                  <FolderIcon className="size-4" />
                </Button>
              </div>
            </div>

            {lfsAvailable === false && (
              <div className="flex items-start gap-2 rounded-md border border-warning bg-warning/10 p-3">
                <AlertTriangleIcon className="size-5 text-warning shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">
                    {t('projects.lfsWarning', 'Git LFS not detected')}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">
                    {t(
                      'projects.lfsWarningDescription',
                      'Large files (PDF, Excel) may impact repository performance. Consider installing Git LFS.'
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!isFormValid || createProject.isPending}
            >
              {createProject.isPending
                ? t('projects.creating', 'Creating...')
                : t('projects.create', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
