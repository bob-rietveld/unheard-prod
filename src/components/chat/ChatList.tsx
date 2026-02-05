import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PlusIcon, MessageSquareIcon, MoreHorizontalIcon, Trash2Icon, Edit2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChats, useCreateChat, useArchiveChat, useUpdateChat } from '@/services/chats'
import { useProjectStore } from '@/store/project-store'
import { useChatStore } from '@/store/chat-store'
import { ChatListSkeleton } from './ChatListSkeleton'
import type { Chat } from '@/types/chat'
import { logger } from '@/lib/logger'

/**
 * ChatList displays all chats for the current project.
 * Peaceful, minimal design following Dieter Rams principles.
 *
 * Features:
 * - List of chats with titles
 * - Create new chat
 * - Select/switch between chats
 * - Rename chat (inline editing)
 * - Archive chat
 * - Shows empty state when no chats exist
 */

export function ChatList() {
  const { t } = useTranslation()
  const currentProject = useProjectStore(state => state.currentProject)
  const currentChatId = useChatStore(state => state.currentChatId)
  const setCurrentChat = useChatStore(state => state.setCurrentChat)
  const resetConversation = useChatStore(state => state.resetConversation)

  const chats = useChats(currentProject?._id)
  const createChat = useCreateChat()
  const archiveChat = useArchiveChat()
  const updateChat = useUpdateChat()

  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const handleCreateChat = async () => {
    if (!currentProject) return

    try {
      const result = await createChat.mutateAsync({
        projectId: currentProject._id,
        title: 'New Chat',
      })

      // Switch to the new chat
      setCurrentChat(result.chatId)
      resetConversation()

      logger.info('Chat created', { chatId: result.chatId })
    } catch (error) {
      logger.error('Failed to create chat', { error })
    }
  }

  const handleSelectChat = (chat: Chat) => {
    if (currentChatId === chat._id) return

    setCurrentChat(chat._id)
    resetConversation()
    logger.info('Chat selected', { chatId: chat._id })
  }

  const handleStartRename = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingChatId(chat._id)
    setEditTitle(chat.title)
  }

  const handleSaveRename = async (chatId: string) => {
    if (!editTitle.trim()) {
      setEditingChatId(null)
      return
    }

    try {
      await updateChat.mutateAsync({
        id: chatId as any, // Type will be fixed by Convex
        title: editTitle.trim(),
      })
      setEditingChatId(null)
    } catch (error) {
      logger.error('Failed to rename chat', { error })
    }
  }

  const handleArchiveChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      await archiveChat.mutateAsync(chatId as any)

      // If we archived the current chat, clear selection
      if (currentChatId === chatId) {
        setCurrentChat(null)
        resetConversation()
      }

      logger.info('Chat archived', { chatId })
    } catch (error) {
      logger.error('Failed to archive chat', { error })
    }
  }

  // Component only renders when project is selected (handled by LeftSideBar)
  if (!currentProject) {
    return null
  }

  // Show loading skeleton while chats are loading
  if (chats === undefined) {
    return <ChatListSkeleton />
  }

  return (
    <div className="flex flex-col h-full">
      {/* Section header with + button - recurring pattern */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-medium tracking-wider uppercase text-foreground/40">
          {t('chat.list.title', 'Chats')}
        </h2>
        <button
          onClick={handleCreateChat}
          className="size-4 flex items-center justify-center text-foreground/40 hover:text-foreground transition-colors cursor-pointer"
          title={t('chat.list.newChat', 'New Chat')}
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>

      {/* Chat list */}
      <ScrollArea className="flex-1">
        {chats.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquareIcon className="size-10 text-foreground/20 mb-3 mx-auto" />
            <p className="text-xs text-foreground/40">
              {t('chat.list.empty', 'No chats yet')}
            </p>
          </div>
        ) : (
          <div className="px-2 pb-3">
            <div className="space-y-0.5">
              {chats?.map(chat => {
                const isSelected = currentChatId === chat._id
                return (
                  <div
                    key={chat._id}
                    className={`
                      group relative flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all
                      ${
                        isSelected
                          ? 'bg-foreground/8 text-foreground'
                          : 'text-foreground/70 hover:bg-foreground/4 hover:text-foreground'
                      }
                    `}
                    onClick={() => handleSelectChat(chat)}
                  >
                    <MessageSquareIcon className="size-3.5 flex-shrink-0 opacity-50" />

                    {editingChatId === chat._id ? (
                      <Input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => handleSaveRename(chat._id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveRename(chat._id)
                          if (e.key === 'Escape') setEditingChatId(null)
                        }}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                        className="h-6 text-[13px] flex-1 border-border/60 px-2"
                      />
                    ) : (
                      <>
                        <span className="flex-1 truncate text-[13px] font-medium">
                          {chat.title}
                        </span>

                        {/* Actions menu - shows on hover */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                              onClick={e => e.stopPropagation()}
                            >
                              <MoreHorizontalIcon className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="border-border/60"
                          >
                            <DropdownMenuItem
                              onClick={e => handleStartRename(chat, e)}
                              className="cursor-pointer"
                            >
                              <Edit2Icon className="size-3.5 mr-2" />
                              <span className="text-xs">
                                {t('chat.list.rename', 'Rename')}
                              </span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={e => handleArchiveChat(chat._id, e)}
                              className="cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2Icon className="size-3.5 mr-2" />
                              <span className="text-xs">
                                {t('chat.list.archive', 'Archive')}
                              </span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
