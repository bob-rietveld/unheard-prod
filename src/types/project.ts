import type { Id } from '../../convex/_generated/dataModel'

/**
 * Project model from Convex database
 */
export interface Project {
  _id: Id<'projects'>
  _creationTime: number
  name: string
  description?: string
  localPath: string
  clerkUserId: string
  archived: boolean
  createdAt: number
}
