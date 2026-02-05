# UI Patterns

## Overview

This app uses a modern CSS stack optimized for Tauri desktop applications:

- **Tailwind CSS v4** with CSS-based configuration
- **shadcn/ui v4** component library
- **OKLCH color space** for perceptually uniform colors
- **Desktop-specific defaults** for native app feel

## Tailwind v4 Configuration

Tailwind v4 uses CSS-based configuration instead of `tailwind.config.js`.

### File Structure

```
src/
├── App.css              # Main window styles + Tailwind imports
├── quick-pane.css       # Quick pane window styles
└── theme-variables.css  # Shared theme variables (colors, radii)
```

**Multi-window theming**: `theme-variables.css` is imported by both `App.css` and `quick-pane.css` so all windows share the same theme tokens. When adding new color variables, add them to `theme-variables.css`.

### Structure

```css
@import 'tailwindcss'; /* Core Tailwind */
@import 'tw-animate-css'; /* Animation utilities */

@custom-variant dark (&:is(.dark *)); /* Dark mode variant */

@theme inline {
  /* Map CSS variables to Tailwind tokens */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  /* ... */
}

:root {
  /* Light mode values */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
}

.dark {
  /* Dark mode overrides */
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
}

@layer base {
  /* Global base styles */
}
```

### Key Concepts

| Directive              | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `@theme inline`        | Maps CSS variables to Tailwind's design token system |
| `@custom-variant dark` | Enables `dark:` prefix based on `.dark` class        |
| `@layer base`          | Base styles that apply globally                      |

### Adding Custom Colors

To add a new semantic color:

```css
@theme inline {
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
}

:root {
  --success: oklch(0.7 0.15 145);
  --success-foreground: oklch(1 0 0);
}

.dark {
  --success: oklch(0.6 0.15 145);
  --success-foreground: oklch(1 0 0);
}
```

Then use with Tailwind: `bg-success text-success-foreground`

## Dark Mode

### How It Works

1. **ThemeProvider** (`src/components/ThemeProvider.tsx`) manages theme state
2. Adds `.dark` class to `<html>` element when dark mode is active
3. CSS variables in `.dark` override `:root` values
4. Tailwind's `dark:` variant applies styles conditionally

### Theme Options

- `light` - Force light mode
- `dark` - Force dark mode
- `system` - Follow OS preference (default)

### Using in Components

```tsx
// Access theme in components
import { useTheme } from '@/hooks/use-theme'

function MyComponent() {
  const { theme, setTheme } = useTheme()

  return <button onClick={() => setTheme('dark')}>Current: {theme}</button>
}
```

### Why `.dark` Class (Not `light-dark()`)

This app uses the `.dark` class approach rather than CSS `light-dark()` because:

- Standard pattern for shadcn/ui ecosystem
- JavaScript control over theme switching
- Supports "system" preference detection
- Compatible with all shadcn components

## OKLCH Colors

All colors use the OKLCH color space for perceptual uniformity.

### Format

```css
oklch(lightness chroma hue)
oklch(0.7 0.15 250)  /* L: 0-1, C: 0-0.4, H: 0-360 */
```

### Why OKLCH

- **Perceptually uniform** - Equal steps in values = equal perceived change
- **Wide gamut** - Access to P3 display colors
- **Intuitive** - Lightness is predictable (unlike HSL)

### Color Palette Structure

| Token                                    | Purpose                   |
| ---------------------------------------- | ------------------------- |
| `--background` / `--foreground`          | Page background and text  |
| `--card` / `--card-foreground`           | Card surfaces             |
| `--primary` / `--primary-foreground`     | Primary actions           |
| `--secondary` / `--secondary-foreground` | Secondary actions         |
| `--muted` / `--muted-foreground`         | Subdued elements          |
| `--accent` / `--accent-foreground`       | Highlights                |
| `--destructive`                          | Destructive actions (red) |
| `--border` / `--input` / `--ring`        | Borders and focus rings   |

## Desktop-Specific Styles

The `@layer base` section includes styles that make the app feel native on desktop.

### Text Selection

```css
body {
  user-select: none; /* Disable by default */
}

input,
textarea,
[contenteditable='true'] {
  user-select: text !important; /* Enable in editable areas */
}
```

**Why:** Desktop apps typically don't allow selecting UI text, only content.

### Cursor

```css
* {
  cursor: default; /* Arrow cursor everywhere */
}

input,
textarea {
  cursor: text !important;
}

.cursor-pointer {
  cursor: pointer !important;
}
```

**Why:** Native apps use arrow cursor, not text cursor on labels.

### Scroll Behavior

```css
body {
  overscroll-behavior: none; /* Prevent bounce/refresh */
  overflow: hidden; /* Prevent body scroll */
}
```

**Why:** Prevents pull-to-refresh and elastic scrolling that feels wrong in desktop apps.

### Drag Regions

```css
*[data-tauri-drag-region] {
  -webkit-app-region: drag;
  app-region: drag;
}
```

Apply `data-tauri-drag-region` to elements that should drag the window (like title bars).

## Component Organization

```
src/components/
├── layout/           # App structure
│   ├── MainWindow.tsx
│   ├── LeftSideBar.tsx
│   ├── RightSideBar.tsx
│   └── MainWindowContent.tsx
├── titlebar/         # Window chrome
│   ├── TitleBar.tsx
│   ├── MacOSWindowControls.tsx
│   └── WindowsWindowControls.tsx
├── ui/               # shadcn primitives
│   ├── button.tsx
│   ├── dialog.tsx
│   └── ...
├── command-palette/  # Command palette feature
├── preferences/      # Preferences dialog
├── ThemeProvider.tsx
└── ErrorBoundary.tsx
```

### Conventions

- **layout/** - Structural components that define app regions
- **titlebar/** - Platform-specific window controls
- **ui/** - shadcn/ui primitives (don't modify directly)
- **Feature folders** - Group related components together

## shadcn/ui Usage

### Adding Components

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
```

Components are copied to `src/components/ui/` and can be customized.

### Customizing Components

shadcn components are yours to modify. Common customizations:

```tsx
// src/components/ui/button.tsx
const buttonVariants = cva('...', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      // Add custom variant
      success: 'bg-success text-success-foreground',
    },
  },
})
```

### Available Components

This app includes commonly needed components. Run `npx shadcn@latest add [component]` to add more from [ui.shadcn.com](https://ui.shadcn.com/docs/components).

## The `cn()` Utility

All components use the `cn()` utility for conditional classes:

```tsx
import { cn } from '@/lib/utils'

function MyComponent({ className, disabled }) {
  return (
    <div
      className={cn(
        'base-styles here',
        disabled && 'opacity-50',
        className // Allow overrides
      )}
    >
      ...
    </div>
  )
}
```

**Pattern:** Always accept `className` prop and merge with `cn()` for flexibility.

## Component Patterns

### Layout Components

Layout components should:

- Accept `children` and `className` props
- Use flexbox with `overflow-hidden` to prevent content bleed
- Not set external margins (let parent control spacing)

```tsx
interface SideBarProps {
  children?: React.ReactNode
  className?: string
}

export function LeftSideBar({ children, className }: SideBarProps) {
  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {children}
    </div>
  )
}
```

### Visibility with CSS

For panels that toggle visibility, prefer CSS over conditional rendering:

```tsx
// Good: Preserves component state
;<ResizablePanel className={cn(!visible && 'hidden')}>
  <SideBar />
</ResizablePanel>

// Avoid: Loses component state on hide/show
{
  visible && <SideBar />
}
```

This preserves scroll position, form state, and resize dimensions.

## Best Practices

### Do

- Use semantic color tokens (`bg-background`, `text-foreground`)
- Accept `className` prop on components
- Use `cn()` for conditional classes
- Keep desktop UX conventions (cursor, selection, scroll)
- Follow existing patterns in codebase

### Don't

- Use raw color values (`bg-white`, `text-gray-900`)
- Hardcode light/dark specific values
- Override shadcn components in place (copy and modify instead)
- Add `cursor-pointer` everywhere (only for actual clickable elements)
- Use viewport-based responsive design (this is a fixed-size desktop app)

## Chat Components

The chat interface follows a component composition pattern for AI-powered decision support conversations.

### Component Structure

```
src/components/chat/
├── ChatInterface.tsx    # Main container with state management
├── ChatMessages.tsx     # Message list with auto-scroll
├── ChatInput.tsx        # Input area with keyboard shortcuts
├── ChatBubble.tsx       # Individual message bubble
└── index.ts            # Clean exports
```

### Architecture

```tsx
ChatInterface (container)
├── ChatMessages (scroll area with message list)
│   └── ChatBubble (individual message bubble)
└── ChatInput (textarea + send button)
```

### State Pattern

Chat components use **Zustand selector pattern** (enforced by ast-grep):

```tsx
// ✅ GOOD: Selector syntax
const messages = useChatStore(state => state.messages)
const isStreaming = useChatStore(state => state.isStreaming)

// ❌ BAD: Destructuring (causes render cascades)
const { messages, isStreaming } = useChatStore()

// ✅ GOOD: Use getState() in callbacks
const handleSend = () => {
  const { addMessage, setError } = useChatStore.getState()
  addMessage(newMessage)
}
```

### Streaming Pattern

Streaming uses Tauri Channels for real-time token updates:

```tsx
import { Channel } from '@tauri-apps/api/core'
import { commands, type StreamEvent } from '@/lib/bindings'

const channel = new Channel<StreamEvent>()
let accumulatedContent = ''

channel.onmessage = (event: StreamEvent) => {
  if (event.type === 'Token') {
    accumulatedContent += event.content
    updateStreamingMessage(messageId, accumulatedContent)
  } else if (event.type === 'Done') {
    completeStreaming(messageId)
  } else if (event.type === 'Error') {
    setError(event.message)
  }
}

await commands.sendChatMessage(message, history, null, channel)
```

### Auto-scroll Behavior

ChatMessages implements smart auto-scroll:

- Auto-scrolls to bottom when user is within 100px of bottom
- Shows "New messages ↓" button when user scrolls up
- Preserves scroll position when user is reading previous messages

```tsx
const isNearBottom = () => {
  const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
  return scrollHeight - scrollTop - clientHeight < 100
}

useEffect(() => {
  if (messages.length > 0 && isNearBottom()) {
    scrollToBottom('smooth')
  } else if (messages.length > 0 && !isNearBottom()) {
    setShowScrollButton(true)
  }
}, [messages])
```

### Keyboard Shortcuts

ChatInput supports standard messaging shortcuts:

- **Enter**: Send message
- **Shift+Enter**: New line
- **Escape**: Clear input (or stop streaming if empty and streaming)

```tsx
const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
    return
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    if (input.trim() === '' && isStreaming) {
      onStopStreaming?.()
    } else {
      setInput('')
    }
  }
}
```

### Accessibility

Chat components include full ARIA support:

```tsx
<div
  role="log"
  aria-live="polite"
  aria-label={t('chat.messages.ariaLabel')}
>
  {messages.map(message => (
    <ChatBubble key={message.id} message={message} />
  ))}
</div>

<Textarea
  aria-label={t('chat.input.ariaLabel')}
  placeholder={t('chat.input.placeholder')}
/>
```

### Message Styling

- **User messages**: Right-aligned, blue background
- **Assistant messages**: Left-aligned, gray background
- **Streaming messages**: Animated cursor indicator
- **Error messages**: Red border with error details

```tsx
<Card
  className={`
    max-w-[80%] px-4 py-3
    ${isUser ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-800'}
    ${isError ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''}
  `}
>
  {message.content}
  {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />}
</Card>
```

### Empty State

Chat shows a welcoming empty state with suggested prompts:

```tsx
if (messages.length === 0) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <h2 className="text-2xl font-semibold mb-4">
        {t('chat.empty.title')}
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        {t('chat.empty.description')}
      </p>
      <ul className="text-sm space-y-1">
        <li>• {t('chat.empty.prompt1')}</li>
        <li>• {t('chat.empty.prompt2')}</li>
        <li>• {t('chat.empty.prompt3')}</li>
      </ul>
    </div>
  )
}
```

### Concurrent Input Handling

Users can type while assistant is streaming. Messages are queued and sent after stream completes:

```tsx
// Queue message if user types while streaming
const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
  setInput(e.target.value)

  if (isStreaming && e.target.value.trim()) {
    const { queueMessage } = useChatStore.getState()
    queueMessage(e.target.value.trim())
  }
}

// Process queued messages after streaming completes
useEffect(() => {
  if (!isStreaming) {
    const { dequeueMessage } = useChatStore.getState()
    const queuedMsg = dequeueMessage()
    if (queuedMsg) {
      handleSendMessage(queuedMsg)
    }
  }
}, [isStreaming])
```

### Testing

Chat components have comprehensive tests covering:

- Message rendering (user vs assistant styling)
- Streaming behavior (token accumulation, typing indicator)
- Keyboard shortcuts (Enter, Shift+Enter, Escape)
- Auto-scroll behavior (near bottom vs scrolled up)
- Error states (API failures, network errors)
- ARIA live regions for screen readers

See `src/components/chat/ChatInterface.test.tsx` for examples.
