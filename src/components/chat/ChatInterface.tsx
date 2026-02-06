import { useEffect, useRef, useState } from 'react'
import { Channel } from '@tauri-apps/api/core'
import { commands, type StreamEvent, type ChatError } from '@/lib/bindings'
import { useChatStore } from '@/store/chat-store'
import { useProjectStore } from '@/store/project-store'
import { useExperimentStore } from '@/store/experiment-store'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { ConfigWizard, type WizardCompletionData } from './ConfigWizard'
import { TemplateSuggestion } from './TemplateSuggestion'
import { DecisionSavingOverlay } from './LoadingStates'
import { ErrorMessage, OfflineBanner } from './ErrorMessage'
import { RunExperimentButton } from '@/components/experiments/RunExperimentButton'
import { ExperimentProgress } from '@/components/experiments/ExperimentProgress'
import { ExperimentSummary } from '@/components/experiments/ExperimentSummary'
import { useExperimentEvents } from '@/hooks/useExperimentEvents'
import { useRunExperiment } from '@/services/experiments'
import { useTemplates } from '@/services/templates'
import { buildSystemPrompt } from '@/lib/agent/system-prompts'
import { classifyIntent, requiresTemplateHelp } from '@/lib/agent/intent-classifier'
import type { TemplateSuggestion as TemplateSuggestionType } from '@/lib/agent/intent-classifier'
import type { ChatMessage as FrontendChatMessage } from '@/types/chat'
import {
  useChatMessages,
  useAddMessage,
} from '@/services/chats'
import { useContextFiles } from '@/services/context'
import { useUpdateDecisionWithLog } from '@/services/decisions'
import {
  analyzeChatError,
  withRetry,
  isOnline,
} from '@/lib/error-handlers'
import {
  enqueueMessage,
  peekMessage,
  dequeueMessage as removeFromQueue,
  getQueueSize,
} from '@/lib/retry-queue'
import {
  generateDecisionLog,
  generateFilename,
  generateDecisionId,
  type DecisionConfig,
} from '@/lib/decision-generator'
import {
  generateExperimentConfig,
  generateExperimentFilename,
  type ContextFileInfo,
  type ExperimentConfigInput,
} from '@/lib/experiment-config-generator'
import { parseTemplateYaml } from '@/lib/template-parser'
import { load as loadYaml } from 'js-yaml'
import { toast } from 'sonner'
import { logger } from '@/lib/logger'
import type { Id } from '../../../convex/_generated/dataModel'

/**
 * ChatInterface is the main container for the chat UI.
 *
 * Persistence flow:
 * - On chat selection, messages are loaded from Convex into the Zustand store
 * - User messages are saved to Convex immediately when sent
 * - Assistant messages are saved to Convex after streaming completes
 * - Zustand store serves as the real-time cache for streaming
 */

export function ChatInterface() {
  const messages = useChatStore(state => state.messages)
  const isStreaming = useChatStore(state => state.isStreaming)
  const currentChatId = useChatStore(state => state.currentChatId)
  const currentTemplateId = useChatStore(state => state.currentTemplateId)
  const [chatError, setChatError] = useState<ChatError | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [queuedCount, setQueuedCount] = useState(0)
  const [isSavingDecision, setIsSavingDecision] = useState(false)

  // Experiment state: tracks YAML filename and config after wizard completion
  const [pendingExperiment, setPendingExperiment] = useState<{
    yamlFilename: string
    personaCount: number
    model: string
    templateName: string
    decisionId?: Id<'decisions'>
  } | null>(null)

  // Last experiment run params - kept for retry after failure
  const lastRunParamsRef = useRef<{
    yamlFilename: string
    projectPath: string
    projectId: Id<'projects'>
    decisionId?: Id<'decisions'>
  } | null>(null)

  // Template suggestion shown after intent classification
  const [templateSuggestion, setTemplateSuggestion] = useState<TemplateSuggestionType | null>(null)

  const experimentStatus = useExperimentStore(state => state.status)

  // Listen for experiment events from Tauri
  useExperimentEvents()

  // Experiment execution mutation
  const runExperiment = useRunExperiment()

  // Fetch published templates for system prompt and intent classification
  const { data: templates } = useTemplates()

  // Project context
  const currentProject = useProjectStore(state => state.currentProject)
  const projectId = currentProject?._id ?? null

  // Convex persistence hooks
  const persistedMessages = useChatMessages(currentChatId)
  const addMessageToConvex = useAddMessage()

  // Context data and decision hooks for wizard completion
  const contextFiles = useContextFiles(projectId)
  const updateDecisionWithLog = useUpdateDecisionWithLog()

  // Track which chat's history we last loaded to avoid re-loading on every render
  const loadedChatIdRef = useRef<string | null>(null)

  // When the chat changes, reset the loaded ref so we reload from Convex
  useEffect(() => {
    loadedChatIdRef.current = null
  }, [currentChatId])

  // Load persisted messages into the Zustand store when Convex data arrives
  useEffect(() => {
    if (!currentChatId || persistedMessages === undefined) return
    if (loadedChatIdRef.current === currentChatId) return

    loadedChatIdRef.current = currentChatId

    const { addMessage } = useChatStore.getState()
    // Only populate if the store was already reset (ChatList calls resetConversation on switch)
    // and Convex has messages to load
    if (persistedMessages.length === 0) return

    for (const msg of persistedMessages) {
      const frontendMsg: FrontendChatMessage = {
        id: msg._id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
        status: msg.status ?? 'complete',
        metadata: msg.metadata as Record<string, unknown> | undefined,
      }
      addMessage(frontendMsg)
    }

    logger.info('Loaded chat history from Convex', {
      chatId: currentChatId,
      messageCount: persistedMessages.length,
    })
  }, [currentChatId, persistedMessages])

  // Update queued message count
  useEffect(() => {
    const updateCount = () => setQueuedCount(getQueueSize())
    updateCount()

    // Listen for online/offline events
    window.addEventListener('online', updateCount)
    window.addEventListener('offline', updateCount)

    return () => {
      window.removeEventListener('online', updateCount)
      window.removeEventListener('offline', updateCount)
    }
  }, [])

  // Process offline queue when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      logger.info('Browser is back online, processing queue')

      // Process all queued messages
      while (getQueueSize() > 0) {
        const queued = peekMessage()
        if (!queued) break

        try {
          await handleSendMessage(queued.message)
          removeFromQueue(queued.id)
          setQueuedCount(getQueueSize())
        } catch (error) {
          logger.error('Failed to send queued message', { error, queued })
          break // Stop processing on error
        }
      }
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // Process in-memory queued messages after streaming completes
  useEffect(() => {
    if (!isStreaming) {
      const { dequeueMessage } = useChatStore.getState()
      const queuedMsg = dequeueMessage()
      if (queuedMsg) {
        handleSendMessage(queuedMsg)
      }
    }
  }, [isStreaming])

  /**
   * Handle wizard completion: generate decision log + experiment config,
   * write both to disk, and update Convex.
   */
  const handleWizardComplete = async (data: WizardCompletionData) => {
    if (!currentProject) {
      logger.error('Missing project for wizard completion')
      toast.error('Cannot save decision: no project selected')
      return
    }

    setIsSavingDecision(true)

    try {
      const projectPath = currentProject.localPath
      const parsedTemplate = parseTemplateYaml(data.yamlContent)

      if (!parsedTemplate) {
        throw new Error('Failed to parse template YAML')
      }

      const { answers } = data

      // Build decision config
      const decisionTitle =
        (answers.title as string) ||
        (answers.decision_title as string) ||
        data.templateName
      const decisionId = generateDecisionId(decisionTitle)
      const decisionFilename = generateFilename(decisionTitle)
      const markdownPath = `decisions/${decisionFilename}`

      const decisionConfig: DecisionConfig = {
        templateId: data.templateId,
        templateSlug: data.templateSlug,
        category: data.templateCategory,
        title: decisionTitle,
        context: (answers.context as string) || undefined,
        answers,
        contextFiles: contextFiles?.map(f => f.relativeFilePath),
      }

      // --- 1. Generate decision log markdown ---
      const markdownContent = generateDecisionLog(decisionConfig, parsedTemplate, markdownPath)

      // --- 2. Write decision log to disk ---
      const decisionResult = await commands.createDecisionLog(
        markdownContent,
        decisionFilename,
        projectPath
      )

      if (decisionResult.status === 'error') {
        throw new Error(`Failed to write decision log: ${decisionResult.error}`)
      }

      logger.info('Decision log written', { path: decisionResult.data })

      // --- 3. Generate experiment config YAML (non-blocking) ---
      let savedConfigFilename: string | null = null
      let experimentPersonaCount = 10
      let experimentModel = 'claude-sonnet-4-5-20250929'

      try {
        const templateRaw = loadYaml(data.yamlContent) as Record<string, unknown>

        const contextFileInfos: ContextFileInfo[] = (contextFiles ?? []).map(f => ({
          path: f.relativeFilePath,
          originalFilename: f.originalFilename,
          fileType: f.fileType,
          detectedType: f.detectedType,
          rows: f.rows,
          columns: f.columns,
          pages: f.pages,
          sizeBytes: f.sizeBytes,
        }))

        const configInput: ExperimentConfigInput = {
          template: parsedTemplate,
          templateRaw,
          templateSlug: data.templateSlug,
          answers,
          decisionTitle,
          decisionId,
          markdownPath,
          contextFiles: contextFileInfos,
        }

        const yamlContent = generateExperimentConfig(configInput)
        const configFilename = generateExperimentFilename(decisionTitle)

        // Extract persona count and model from the generated YAML
        try {
          const parsedConfig = loadYaml(yamlContent) as Record<string, unknown>
          const personas = parsedConfig.personas as Record<string, unknown> | undefined
          const execution = parsedConfig.execution as Record<string, unknown> | undefined
          if (personas?.count) experimentPersonaCount = personas.count as number
          if (execution?.model) experimentModel = execution.model as string
        } catch {
          // Use defaults
        }

        const configResult = await commands.writeExperimentConfig(
          projectPath,
          configFilename,
          yamlContent
        )

        if (configResult.status === 'error') {
          logger.error('Failed to write experiment config', { error: configResult.error })
          toast.error('Experiment config could not be saved', {
            description: configResult.error,
          })
        } else {
          logger.info('Experiment config written', { path: configResult.data })
          savedConfigFilename = configFilename
        }
      } catch (configErr) {
        // Experiment config failure should NOT block decision log creation
        logger.error('Failed to generate experiment config', {
          error: configErr instanceof Error ? configErr.message : String(configErr),
        })
        toast.error('Experiment config could not be generated', {
          description: configErr instanceof Error ? configErr.message : 'Unknown error',
        })
      }

      // --- 4. Update Convex with decision metadata ---
      let convexDecisionId: Id<'decisions'> | undefined
      try {
        const result = await updateDecisionWithLog.mutateAsync({
          title: decisionTitle,
          templateId: data.templateId,
          configData: answers,
          markdownFilePath: markdownPath,
          projectId: currentProject._id,
        })
        convexDecisionId = result as Id<'decisions'> | undefined
      } catch (convexErr) {
        logger.error('Failed to update Convex decision', {
          error: convexErr instanceof Error ? convexErr.message : String(convexErr),
        })
      }

      // --- 5. Clear wizard state, show experiment run prompt ---
      const { setTemplate } = useChatStore.getState()
      setTemplate(null)

      if (savedConfigFilename) {
        // Transition to experiment-ready state
        setPendingExperiment({
          yamlFilename: savedConfigFilename,
          personaCount: experimentPersonaCount,
          model: experimentModel,
          templateName: decisionTitle,
          decisionId: convexDecisionId,
        })
        toast.success('Decision log and experiment config saved. Ready to run experiment.')
      } else {
        toast.success('Decision log saved')
      }
    } catch (err) {
      logger.error('Failed to save decision', {
        error: err instanceof Error ? err.message : String(err),
      })
      toast.error('Failed to save decision', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setIsSavingDecision(false)
    }
  }

  const handleWizardCancel = () => {
    const { setTemplate } = useChatStore.getState()
    setTemplate(null)
  }

  const handleRunExperiment = () => {
    if (!pendingExperiment || !currentProject || !projectId) return

    const params = {
      yamlFilename: pendingExperiment.yamlFilename,
      projectPath: currentProject.localPath,
      projectId,
      decisionId: pendingExperiment.decisionId,
    }
    lastRunParamsRef.current = params
    runExperiment.mutate(params)
    // Clear pending state - progress is now driven by experiment store
    setPendingExperiment(null)
  }

  const handleRetryExperiment = () => {
    const params = lastRunParamsRef.current
    if (!params) return
    useExperimentStore.getState().reset()
    runExperiment.mutate(params)
  }

  const handleDismissExperiment = () => {
    setPendingExperiment(null)
    lastRunParamsRef.current = null
    useExperimentStore.getState().reset()
  }

  const handleAcceptTemplate = (templateId: string) => {
    const { setTemplate } = useChatStore.getState()
    setTemplate(templateId)
    setTemplateSuggestion(null)
  }

  const handleDismissSuggestion = () => {
    setTemplateSuggestion(null)
  }

  const handleSendMessage = async (content: string) => {
    const {
      addMessage,
      updateStreamingMessage,
      completeStreaming,
      updateMessageStatus,
      currentChatId: chatId,
    } = useChatStore.getState()

    // Check if offline - queue message
    if (!isOnline()) {
      logger.info('Offline detected, queueing message')
      enqueueMessage(content)
      setQueuedCount(getQueueSize())
      return
    }

    // Add user message to store
    const userMessage: FrontendChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'complete',
    }
    addMessage(userMessage)

    // Persist user message to Convex
    if (chatId) {
      try {
        await addMessageToConvex({
          chatId,
          role: 'user',
          content,
          status: 'complete',
        })
      } catch (err) {
        logger.error('Failed to persist user message to Convex', { error: err })
      }
    }

    // Create assistant message placeholder for streaming
    const assistantMessageId = `assistant-${Date.now()}`
    const assistantMessage: FrontendChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
    }
    addMessage(assistantMessage)

    // Clear previous error
    setChatError(null)

    // Set up streaming channel
    const channel = new Channel<StreamEvent>()
    let accumulatedContent = ''

    channel.onmessage = (event: StreamEvent) => {
      if (event.type === 'Token') {
        accumulatedContent += event.content
        updateStreamingMessage(assistantMessageId, accumulatedContent)
      } else if (event.type === 'Done') {
        completeStreaming(assistantMessageId)

        // Persist completed assistant message to Convex
        if (chatId) {
          addMessageToConvex({
            chatId,
            role: 'assistant',
            content: accumulatedContent,
            status: 'complete',
          }).catch(err => {
            logger.error('Failed to persist assistant message to Convex', {
              error: err,
            })
          })
        }

        // Run intent classification on the user message to suggest templates
        if (templates?.length && requiresTemplateHelp(content)) {
          const classification = classifyIntent(content, templates)
          if (classification.suggestions.length > 0 && classification.suggestions[0]!.confidence >= 0.3) {
            setTemplateSuggestion(classification.suggestions[0]!)
          }
        }
      } else if (event.type === 'Error') {
        // Update message with error status via store action
        updateMessageStatus(assistantMessageId, 'error', { error: event.message })
        completeStreaming(assistantMessageId)

        // Persist error message to Convex
        if (chatId && accumulatedContent) {
          addMessageToConvex({
            chatId,
            role: 'assistant',
            content: accumulatedContent,
            status: 'error',
            metadata: { error: event.message },
          }).catch(err => {
            logger.error('Failed to persist error message to Convex', {
              error: err,
            })
          })
        }
      }
    }

    // Convert frontend messages to backend format
    const historyForBackend = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }))

    // Build system prompt from available templates
    const systemPrompt = templates?.length ? buildSystemPrompt(templates) : null

    // Send with retry logic
    try {
      const sendWithRetry = async () => {
        const result = await commands.sendChatMessage(
          content,
          historyForBackend,
          systemPrompt,
          channel
        )

        if (result.status === 'error') {
          const analysis = analyzeChatError(result.error)

          // Store error for display
          setChatError(result.error)

          // Throw for retry logic
          if (analysis.canRetry) {
            throw new Error(analysis.userMessage)
          }
        }

        return result
      }

      // Attempt with retry for transient errors
      await withRetry(sendWithRetry, {
        maxRetries: 5,
        onRetry: (attempt, delay) => {
          logger.info('Retrying message send', { attempt, delay })
          setRetrying(true)
        },
      })

      setRetrying(false)
    } catch (err) {
      setRetrying(false)
      logger.error('Chat error after retries', { error: err })
      completeStreaming(assistantMessageId)

      // Update message with error via store action
      updateMessageStatus(assistantMessageId, 'error', {
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  const handleRetry = () => {
    if (!chatError) return

    // Find the last user message and retry
    const lastUserMessage = [...messages]
      .reverse()
      .find(m => m.role === 'user')

    if (lastUserMessage) {
      handleSendMessage(lastUserMessage.content)
    }
  }

  const handleStopStreaming = () => {
    // Stop streaming: discard partial response
    const { completeStreaming, streamingMessageId: currentStreamingId } =
      useChatStore.getState()
    if (currentStreamingId) {
      completeStreaming(currentStreamingId)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Decision saving overlay */}
      <DecisionSavingOverlay visible={isSavingDecision} />

      {/* Offline banner */}
      <OfflineBanner queuedCount={queuedCount} />

      {/* Error banner with retry */}
      {chatError && (
        <ErrorMessage
          error={chatError}
          onRetry={handleRetry}
          retrying={retrying}
          banner={true}
        />
      )}

      {/* Config wizard (shown when a template is selected) */}
      {currentTemplateId && !isSavingDecision ? (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <ConfigWizard
            templateId={currentTemplateId as Id<'experimentTemplates'>}
            onComplete={handleWizardComplete}
            onCancel={handleWizardCancel}
          />
        </div>
      ) : pendingExperiment ? (
        /* Experiment ready to run - show config summary and run button */
        <div className="flex-1 overflow-y-auto px-4 py-6 flex items-center justify-center">
          <RunExperimentButton
            config={{
              personaCount: pendingExperiment.personaCount,
              model: pendingExperiment.model,
              templateName: pendingExperiment.templateName,
            }}
            onRun={handleRunExperiment}
          />
        </div>
      ) : experimentStatus !== 'idle' ? (
        /* Experiment in progress / complete / error */
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {experimentStatus === 'complete' ? (
            <ExperimentSummary
              onAskFollowUp={handleDismissExperiment}
            />
          ) : (
            <ExperimentProgress
              onRetry={lastRunParamsRef.current ? handleRetryExperiment : undefined}
            />
          )}
        </div>
      ) : (
        <>
          {/* Messages area */}
          <ChatMessages onSendPrompt={handleSendMessage} />

          {/* Template suggestion (shown after intent classification) */}
          {templateSuggestion && (
            <TemplateSuggestion
              suggestion={templateSuggestion}
              onAccept={handleAcceptTemplate}
              onDismiss={handleDismissSuggestion}
            />
          )}

          {/* Input area */}
          <ChatInput
            onSend={handleSendMessage}
            onStopStreaming={handleStopStreaming}
          />
        </>
      )}
    </div>
  )
}
