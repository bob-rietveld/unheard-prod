import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { toast } from 'sonner'

/**
 * Hook to get all chats for a project.
 * Returns undefined while loading, empty array if no chats.
 */
export function useChats(projectId: Id<'projects'> | null | undefined) {
  return useQuery(
    api.chats.listByProject,
    projectId ? { projectId } : 'skip'
  )
}

/**
 * Hook to get a specific chat.
 */
export function useChat(chatId: Id<'chats'> | null | undefined) {
  return useQuery(api.chats.get, chatId ? { id: chatId } : 'skip')
}

/**
 * Hook to get messages for a chat.
 */
export function useChatMessages(chatId: Id<'chats'> | null | undefined) {
  return useQuery(api.chats.getMessages, chatId ? { chatId } : 'skip')
}

/**
 * Hook to create a new chat.
 */
export function useCreateChat() {
  const createChat = useMutation(api.chats.create)

  return {
    mutateAsync: async (args: {
      projectId: Id<'projects'>
      title: string
    }) => {
      try {
        const chatId = await createChat(args)
        toast.success('Chat created')
        return { chatId, title: args.title }
      } catch (error) {
        toast.error('Failed to create chat')
        throw error
      }
    },
    isPending: false, // Convex mutations don't expose pending state
  }
}

/**
 * Hook to update a chat.
 */
export function useUpdateChat() {
  const updateChat = useMutation(api.chats.update)

  return {
    mutateAsync: async (args: { id: Id<'chats'>; title?: string }) => {
      try {
        await updateChat(args)
        toast.success('Chat updated')
      } catch (error) {
        toast.error('Failed to update chat')
        throw error
      }
    },
  }
}

/**
 * Hook to archive a chat.
 */
export function useArchiveChat() {
  const archiveChat = useMutation(api.chats.archive)

  return {
    mutateAsync: async (chatId: Id<'chats'>) => {
      try {
        await archiveChat({ id: chatId })
        toast.success('Chat archived')
      } catch (error) {
        toast.error('Failed to archive chat')
        throw error
      }
    },
  }
}

/**
 * Hook to add a message to a chat.
 */
export function useAddMessage() {
  const addMessage = useMutation(api.chats.addMessage)
  return addMessage
}

/**
 * Hook to update a message (for streaming).
 */
export function useUpdateMessage() {
  const updateMessage = useMutation(api.chats.updateMessage)
  return updateMessage
}
