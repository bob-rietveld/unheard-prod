import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { Project } from '@/types/project'

interface ProjectState {
  currentProject: Project | null
  /** Persisted project ID used to restore selection on app load */
  _persistedProjectId: string | null
  setCurrentProject: (project: Project | null) => void
}

export const useProjectStore = create<ProjectState>()(
  devtools(
    persist(
      set => ({
        currentProject: null,
        _persistedProjectId: null,

        setCurrentProject: project =>
          set(
            {
              currentProject: project,
              _persistedProjectId: project?._id ?? null,
            },
            undefined,
            'setCurrentProject'
          ),
      }),
      {
        name: 'project-store',
        // Only persist the project ID, not the full object
        partialize: state => ({
          _persistedProjectId: state._persistedProjectId,
        }),
      }
    ),
    {
      name: 'project-store',
    }
  )
)
