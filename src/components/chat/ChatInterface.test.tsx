import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInterface } from './ChatInterface'
import { ChatMessages } from './ChatMessages'
import { ChatInput } from './ChatInput'
import { ChatBubble } from './ChatBubble'
import { useChatStore } from '@/store/chat-store'
import type { ChatMessage } from '@/types/chat'

// Mock Tauri commands
vi.mock('@/lib/bindings', () => ({
  commands: {
    sendChatMessage: vi.fn().mockResolvedValue({
      status: 'ok',
      data: { success: true },
    }),
  },
}))

// Mock Tauri Channel
vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    onmessage = null
  },
}))

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('ChatBubble', () => {
  it('renders user message with correct styling', () => {
    const message: ChatMessage = {
      id: '1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
      status: 'complete',
    }

    const { container } = render(<ChatBubble message={message} />)

    expect(screen.getByText('Hello')).toBeInTheDocument()
    // Check that the container has the right alignment
    const wrapper = container.querySelector('.justify-end')
    expect(wrapper).toBeInTheDocument()
  })

  it('renders assistant message with correct styling', () => {
    const message: ChatMessage = {
      id: '2',
      role: 'assistant',
      content: 'Hi there!',
      timestamp: Date.now(),
      status: 'complete',
    }

    const { container } = render(<ChatBubble message={message} />)

    expect(screen.getByText('Hi there!')).toBeInTheDocument()
    // Check that the container has the right alignment
    const wrapper = container.querySelector('.justify-start')
    expect(wrapper).toBeInTheDocument()
  })

  it('shows typing indicator for streaming messages', () => {
    const message: ChatMessage = {
      id: '3',
      role: 'assistant',
      content: 'Typing...',
      timestamp: Date.now(),
      status: 'streaming',
    }

    render(<ChatBubble message={message} />)

    expect(screen.getByLabelText('chat.typing')).toBeInTheDocument()
  })

  it('shows error state for error messages', () => {
    const message: ChatMessage = {
      id: '4',
      role: 'assistant',
      content: 'Error',
      timestamp: Date.now(),
      status: 'error',
      metadata: { error: 'Network error' },
    }

    render(<ChatBubble message={message} />)

    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('shows timestamp for completed messages', () => {
    const message: ChatMessage = {
      id: '5',
      role: 'user',
      content: 'Test',
      timestamp: new Date('2025-01-01T12:00:00').getTime(),
      status: 'complete',
    }

    render(<ChatBubble message={message} />)

    // Timestamp should be visible for complete messages
    const timestamp = screen.getByText(/12:00|noon/i)
    expect(timestamp).toBeInTheDocument()
  })
})

describe('ChatMessages', () => {
  beforeEach(() => {
    useChatStore.getState().resetConversation()
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('shows empty state when no messages', () => {
    render(<ChatMessages />)

    expect(screen.getByText('chat.empty.title')).toBeInTheDocument()
    expect(screen.getByText('chat.empty.description')).toBeInTheDocument()
  })

  it('renders messages in correct order', () => {
    const { addMessage } = useChatStore.getState()

    addMessage({
      id: '1',
      role: 'user',
      content: 'First message',
      timestamp: Date.now(),
      status: 'complete',
    })

    addMessage({
      id: '2',
      role: 'assistant',
      content: 'Second message',
      timestamp: Date.now(),
      status: 'complete',
    })

    render(<ChatMessages />)

    expect(screen.getByText('First message')).toBeInTheDocument()
    expect(screen.getByText('Second message')).toBeInTheDocument()
  })

  it('has ARIA live region for screen readers', () => {
    const { addMessage } = useChatStore.getState()

    addMessage({
      id: '1',
      role: 'user',
      content: 'Test',
      timestamp: Date.now(),
      status: 'complete',
    })

    const { container } = render(<ChatMessages />)

    const liveRegion = container.querySelector('[role="log"]')
    expect(liveRegion).not.toBeNull()
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    expect(liveRegion).toHaveAttribute('aria-label', 'chat.messages.ariaLabel')
  })
})

describe('ChatInput', () => {
  const mockOnSend = vi.fn()
  const mockOnStopStreaming = vi.fn()

  beforeEach(() => {
    useChatStore.getState().resetConversation()
    mockOnSend.mockClear()
    mockOnStopStreaming.mockClear()
  })

  it('renders input and send button', () => {
    render(<ChatInput onSend={mockOnSend} />)

    expect(
      screen.getByPlaceholderText('chat.input.placeholder')
    ).toBeInTheDocument()
    expect(screen.getByText('chat.input.send')).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', () => {
    render(<ChatInput onSend={mockOnSend} />)

    const sendButton = screen.getByRole('button', {
      name: 'chat.input.sendButton',
    })
    expect(sendButton).toBeDisabled()
  })

  it('sends message on button click', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByPlaceholderText('chat.input.placeholder')
    const sendButton = screen.getByText('chat.input.send')

    await user.type(input, 'Hello world')
    await user.click(sendButton)

    expect(mockOnSend).toHaveBeenCalledWith('Hello world')
  })

  it('sends message on Enter key', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByPlaceholderText('chat.input.placeholder')

    await user.type(input, 'Hello world{Enter}')

    expect(mockOnSend).toHaveBeenCalledWith('Hello world')
  })

  it('adds new line on Shift+Enter', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByPlaceholderText(
      'chat.input.placeholder'
    ) as HTMLTextAreaElement

    await user.type(input, 'Line 1{Shift>}{Enter}{/Shift}Line 2')

    expect(input.value).toBe('Line 1\nLine 2')
    expect(mockOnSend).not.toHaveBeenCalled()
  })

  it('clears input on Escape key', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByPlaceholderText(
      'chat.input.placeholder'
    ) as HTMLTextAreaElement

    await user.type(input, 'Test message')
    expect(input.value).toBe('Test message')

    await user.keyboard('{Escape}')
    expect(input.value).toBe('')
  })

  it('disables input when streaming', () => {
    useChatStore.setState({ isStreaming: true })

    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByPlaceholderText('chat.input.streamingPlaceholder')
    const sendButton = screen.getByRole('button', {
      name: 'chat.input.sendButton',
    })

    expect(input).toBeDisabled()
    expect(sendButton).toBeDisabled()
  })

  it('input is disabled when streaming to prevent editing', () => {
    useChatStore.setState({ isStreaming: true })

    render(
      <ChatInput onSend={mockOnSend} onStopStreaming={mockOnStopStreaming} />
    )

    const input = screen.getByPlaceholderText('chat.input.streamingPlaceholder')
    const sendButton = screen.getByRole('button', {
      name: 'chat.input.sendButton',
    })

    expect(input).toBeDisabled()
    expect(sendButton).toBeDisabled()
  })

  it('clears input after sending', async () => {
    const user = userEvent.setup()
    render(<ChatInput onSend={mockOnSend} />)

    const input = screen.getByPlaceholderText(
      'chat.input.placeholder'
    ) as HTMLTextAreaElement

    await user.type(input, 'Test message')
    await user.click(screen.getByText('chat.input.send'))

    expect(input.value).toBe('')
  })
})

describe('ChatInterface', () => {
  beforeEach(() => {
    useChatStore.getState().resetConversation()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders messages and input', () => {
    render(<ChatInterface />)

    expect(screen.getByText('chat.empty.title')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('chat.input.placeholder')
    ).toBeInTheDocument()
  })

  it('adds user message to store on send', async () => {
    const user = userEvent.setup()
    render(<ChatInterface />)

    const input = screen.getByPlaceholderText('chat.input.placeholder')
    await user.type(input, 'Test message{Enter}')

    await waitFor(() => {
      const messages = useChatStore.getState().messages
      expect(messages).toHaveLength(2) // User + assistant placeholder
      expect(messages[0]?.role).toBe('user')
      expect(messages[0]?.content).toBe('Test message')
    })
  })

  it('shows error banner when error occurs', () => {
    useChatStore.setState({ error: 'Test error' })

    render(<ChatInterface />)

    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('dismisses error banner on click', async () => {
    const user = userEvent.setup()
    useChatStore.setState({ error: 'Test error' })

    render(<ChatInterface />)

    const dismissButton = screen.getByLabelText('chat.error.dismiss')
    await user.click(dismissButton)

    expect(useChatStore.getState().error).toBeNull()
  })

  it('processes queued message after streaming completes', async () => {
    useChatStore.setState({
      isStreaming: true,
      queuedMessage: 'Queued message',
    })

    render(<ChatInterface />)

    // Complete streaming
    useChatStore.setState({ isStreaming: false })

    await waitFor(() => {
      const messages = useChatStore.getState().messages
      expect(messages.some(m => m.content === 'Queued message')).toBe(true)
    })
  })
})
