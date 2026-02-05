import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Project } from '@/types/project'

interface ProjectState {
  currentProject: Project | null
  setCurrentProject: (project: Project | null) => void
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    set => ({
      currentProject: null,

      setCurrentProject: project =>
        set({ currentProject: project }, undefined, 'setCurrentProject'),
    }),
    {
      name: 'project-store',
    }
  )
)
