import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Id } from '../../convex/_generated/dataModel'

interface Project {
  _id: Id<'projects'>
  name: string
  description?: string
  localPath: string
  clerkUserId: string
  archived: boolean
  createdAt: number
}

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
