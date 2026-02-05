# Design Patterns from SODT-2026

## Overview

Patterns extracted from [bob-rietveld/sodt-2026](https://github.com/bob-rietveld/sodt-2026) (TechStaple) that create a polished, cohesive user experience.

---

## 1. Consistent Spacing Scale

### Pattern
**Mobile-first responsive spacing with predictable progressions**

```tsx
// Page/section containers
className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"

// Large sections
className="py-12 sm:py-16"

// Card padding
className="p-4 sm:p-6 lg:p-8"

// Flex/grid gaps
className="gap-4 sm:gap-6 lg:gap-8"
className="space-y-4 sm:space-y-6"

// Section margins
className="mb-6 sm:mb-8"
```

### Application to Unheard

**Current (Unheard):**
```tsx
// Static spacing
className="p-4"
className="gap-4"
className="mb-4"
```

**Improved (SODT pattern):**
```tsx
// Responsive spacing
className="p-4 sm:p-5 lg:p-6"
className="gap-4 sm:gap-5 lg:gap-6"
className="mb-4 sm:mb-6"
```

### Benefits
- Scales naturally on larger screens
- Creates visual rhythm
- Predictable across components

---

## 2. Typography Hierarchy with Responsive Sizes

### Pattern
**All text sizes respond to screen size**

```tsx
// H1 - Page titles
className="text-2xl sm:text-3xl lg:text-4xl font-semibold"

// H2 - Section headers
className="text-xl sm:text-2xl font-semibold"

// H3 - Card titles
className="text-lg sm:text-xl font-semibold"

// Body text
className="text-sm sm:text-base"

// Small text
className="text-xs sm:text-sm"

// Labels (uppercase with tracking)
className="text-xs sm:text-sm font-medium uppercase tracking-wide"
```

### Application to Unheard

**Current:**
```tsx
// Static sizes
<h1 className="text-foreground font-semibold">  // 22px fixed
<p className="text-sm">  // 13px fixed
```

**Improved:**
```tsx
<h1 className="text-xl sm:text-2xl font-semibold">
<p className="text-sm sm:text-base">
```

---

## 3. Color Opacity System for Depth

### Pattern
**Consistent opacity variations create hierarchy**

```tsx
// Text hierarchy
className="text-foreground"       // 100% - Primary text
className="text-foreground/70"    // 70% - Secondary
className="text-foreground/50"    // 50% - Tertiary/muted
className="text-foreground/40"    // 40% - Placeholder
className="text-foreground/20"    // 20% - Very subtle

// Background hierarchy
className="bg-primary/10"         // 10% - Subtle tint
className="bg-primary/20"         // 20% - Hover state
className="bg-primary/90"         // 90% - Button hover

// Border hierarchy
className="border-foreground/10"  // 10% - Subtle borders
className="border-foreground/20"  // 20% - Input borders
className="border-foreground/40"  // 40% - Dividers
```

### Application to Unheard

**Current:**
```tsx
// Binary approach
className="text-muted-foreground"  // Semantic, but less flexible
className="border-border"
```

**Enhanced:**
```tsx
// Add opacity variations
className="text-foreground/60"     // More control
className="border-border/60"       // Softer borders
className="bg-accent/50"           // Subtle backgrounds
```

### Pattern Usage

| Opacity | Use Case | Example |
|---------|----------|---------|
| `/10` | Subtle tints, very light borders | Badge backgrounds, card borders |
| `/20` | Light backgrounds, input borders | Hover states, input focus |
| `/40` | Placeholders, disabled states | Form placeholders |
| `/50` | Tertiary text, icons | Help text, metadata |
| `/60` | Secondary text | Descriptions |
| `/70` | Body text variations | Longer paragraphs |
| `/90` | Hover darkening | Button hover states |

---

## 4. Card Component Pattern

### Pattern
**Consistent card styling with hover feedback**

```tsx
// Standard card
className="bg-white rounded-xl border border-foreground/10 hover:border-primary/20 hover:shadow-md transition-all"

// Feature card with icon
<div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-foreground/5 hover:shadow-md hover:border-primary/20 transition-all group">
  {/* Icon container with group-hover */}
  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary/10 rounded-xl flex items-center justify-center mb-4 sm:mb-6 group-hover:bg-primary/20 transition-colors">
    {icon}
  </div>

  <h3 className="text-lg sm:text-xl font-semibold mb-2">{title}</h3>
  <p className="text-foreground/60 text-sm sm:text-base">{description}</p>
</div>

// Interactive card (clickable)
<Link
  href={...}
  className="block bg-white rounded-xl border border-foreground/10 hover:border-primary/20 hover:shadow-lg active:scale-[0.99] transition-all"
>
  {/* Content */}
</Link>
```

### Key Elements
1. **Border progression**: `border-foreground/10` → `hover:border-primary/20`
2. **Shadow progression**: `shadow-sm` → `hover:shadow-md` or `hover:shadow-lg`
3. **Rounded corners**: `rounded-xl` (12px) or `rounded-2xl` (16px)
4. **Group hover**: Child elements react to parent hover
5. **Active feedback**: `active:scale-[0.99]` for press feedback
6. **Transitions**: `transition-all` for smooth state changes

### Application to Unheard

**Current:**
```tsx
<Card className="border-border/60 shadow-sm">
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</Card>
```

**Enhanced:**
```tsx
<Card className="bg-card rounded-xl border border-border/40 hover:border-border hover:shadow-md transition-all group">
  <CardHeader>
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
        {icon}
      </div>
      <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>
    </div>
  </CardHeader>
  <CardContent className="text-foreground/60 text-sm sm:text-base">
    {children}
  </CardContent>
</Card>
```

---

## 5. Loading Skeleton Pattern

### Pattern
**Skeletons match actual content layout**

```tsx
// Card skeleton
<div className="bg-card rounded-xl border border-border/40 overflow-hidden animate-pulse">
  {/* Image skeleton */}
  <div className="h-36 sm:h-44 bg-foreground/5" />

  {/* Content skeleton */}
  <div className="p-4 sm:p-6 space-y-2">
    <div className="h-4 bg-foreground/10 rounded w-3/4" />
    <div className="h-3 bg-foreground/5 rounded w-1/2" />
  </div>
</div>

// List skeleton
<div className="space-y-4 animate-pulse">
  {[...Array(5)].map((_, i) => (
    <div key={i} className="flex items-center gap-3 p-3 border border-border/40 rounded-lg">
      <div className="w-10 h-10 bg-foreground/10 rounded-lg" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-foreground/10 rounded w-2/3" />
        <div className="h-3 bg-foreground/5 rounded w-1/2" />
      </div>
    </div>
  ))}
</div>

// Form skeleton
<div className="bg-card p-6 rounded-xl border border-border/40">
  <div className="animate-pulse space-y-4">
    <div className="h-6 bg-foreground/10 rounded w-20" />
    <div className="h-10 bg-foreground/10 rounded" />
    <div className="h-10 bg-foreground/10 rounded" />
  </div>
</div>
```

### Skeleton Color Hierarchy
- **Foreground elements**: `bg-foreground/10` (darker placeholders)
- **Background elements**: `bg-foreground/5` (lighter placeholders)
- **Creates depth** even in loading state

### Application to Unheard

```tsx
// Chat loading skeleton
function ChatListSkeleton() {
  return (
    <div className="p-2 space-y-1">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/40 animate-pulse"
        >
          <div className="size-4 bg-foreground/10 rounded" />
          <div className="flex-1 h-4 bg-foreground/10 rounded" />
        </div>
      ))}
    </div>
  )
}

// Project selector skeleton
function ProjectSelectorSkeleton() {
  return (
    <div className="flex items-center gap-2 animate-pulse">
      <div className="flex-1 h-10 bg-foreground/10 rounded-lg" />
      <div className="size-10 bg-foreground/10 rounded-lg" />
    </div>
  )
}
```

---

## 6. Empty State Pattern

### Pattern
**Icon + Primary message + Secondary message + Optional CTA**

```tsx
<div className="flex flex-col items-center justify-center text-center py-12 sm:py-16 text-foreground/50">
  {/* Icon */}
  <div className="w-12 h-12 sm:w-16 sm:h-16 mb-4 text-foreground/20">
    {icon}
  </div>

  {/* Primary message */}
  <p className="text-base sm:text-lg font-medium mb-2">
    {primaryMessage}
  </p>

  {/* Secondary message */}
  <p className="text-sm sm:text-base text-foreground/60 max-w-md mb-6">
    {secondaryMessage}
  </p>

  {/* Optional CTA */}
  {cta && (
    <Button>{cta}</Button>
  )}
</div>
```

### Application to Unheard

**Current:**
```tsx
// Simple empty state
<div className="text-center py-12">
  <p className="text-sm text-muted-foreground">
    No chats yet
  </p>
  <p className="text-xs text-muted-foreground/70">
    Create a chat to get started
  </p>
</div>
```

**Enhanced (SODT pattern):**
```tsx
<div className="flex flex-col items-center justify-center text-center py-12 sm:py-16">
  <MessageSquareIcon className="size-12 sm:size-16 text-foreground/20 mb-4" />

  <p className="text-base sm:text-lg font-medium text-foreground/70 mb-2">
    No chats yet
  </p>

  <p className="text-sm sm:text-base text-foreground/50 max-w-sm mb-6">
    Create your first chat to start a conversation with the AI assistant
  </p>

  <Button onClick={handleCreateChat} className="gap-2">
    <PlusIcon className="size-4" />
    Create Chat
  </Button>
</div>
```

---

## 7. Error Handling Pattern

### Pattern
**Error box with icon + message + retry action**

```tsx
// Error message
{error && (
  <div className="p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm sm:text-base flex items-start gap-3">
    <AlertCircleIcon className="size-5 flex-shrink-0 mt-0.5" />
    <div className="flex-1">
      <p className="font-medium mb-1">Error occurred</p>
      <p className="text-sm opacity-90">{error}</p>
    </div>
    <button
      onClick={handleDismiss}
      className="text-destructive/60 hover:text-destructive"
    >
      <XIcon className="size-4" />
    </button>
  </div>
)}

// PDF load error with retry
<div className="absolute inset-0 flex items-center justify-center bg-foreground/5">
  <div className="flex flex-col items-center gap-3 p-6 text-center bg-card rounded-xl border border-border/40 shadow-sm max-w-sm">
    <AlertTriangleIcon className="size-10 text-foreground/40" />
    <div>
      <p className="font-medium mb-1">Failed to load content</p>
      <p className="text-sm text-foreground/60">
        There was an error loading this content. Please try again.
      </p>
    </div>
    <Button onClick={handleRetry} className="gap-2">
      <RefreshCwIcon className="size-4" />
      Retry
    </Button>
  </div>
</div>
```

---

## 8. Badge/Tag Pattern

### Pattern
**Semantic color coding with consistent style**

```tsx
// Category badges (larger, more prominent)
<span className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium bg-info/10 text-info border border-info/20">
  Technology
</span>

// Small tags (compact, inline)
<span className="px-1.5 py-0.5 rounded text-[10px] sm:text-xs font-medium bg-primary/10 text-primary">
  AI
</span>

// Status badges
<span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
  <div className="size-1.5 rounded-full bg-success" />
  Active
</span>
```

### Color Mapping
```tsx
// Semantic categories
const badgeStyles = {
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  primary: "bg-primary/10 text-primary border-primary/20",
  secondary: "bg-secondary/10 text-secondary border-secondary/20",
}
```

---

## 9. Transition & Animation Patterns

### Pattern
**Smooth, purpose-driven animations**

```tsx
// Standard transitions
className="transition-colors"     // Color changes only
className="transition-all"        // All properties
className="transition-transform"  // Position/scale only

// Duration variations
className="duration-150"  // Quick (buttons, hovers)
className="duration-300"  // Standard (cards, modals)
className="duration-500"  // Slow (page transitions)

// Hover transforms
className="hover:scale-105 transition-transform duration-300"
className="hover:-translate-y-1 transition-transform duration-200"

// Active feedback
className="active:scale-[0.99]"
className="active:scale-95"

// Icon rotations
className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}

// Group hover effects
<div className="group">
  <div className="group-hover:scale-105 transition-transform" />
  <div className="group-hover:bg-primary/20 transition-colors" />
</div>
```

### Loading Animations

```tsx
// Spinner
<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />

// Bouncing dots
<div className="flex gap-1">
  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
</div>

// Pulse (skeleton)
className="animate-pulse"

// Fade in
className="animate-fade-in"  // Custom: @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
```

---

## 10. Button Pattern

### Pattern
**Clear hierarchy with consistent sizing**

```tsx
// Primary button
<button className="bg-primary text-white px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-lg hover:bg-primary/90 active:scale-[0.99] transition-all font-semibold text-sm sm:text-base">
  Primary Action
</button>

// Secondary button
<button className="bg-white text-foreground px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-lg hover:bg-foreground/5 active:scale-[0.99] transition-all border border-foreground/20 font-semibold text-sm sm:text-base">
  Secondary Action
</button>

// Ghost button
<button className="text-foreground px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg hover:bg-foreground/5 active:scale-[0.99] transition-all font-medium text-sm sm:text-base">
  Tertiary Action
</button>

// With icon
<button className="inline-flex items-center justify-center gap-2 ...">
  <Icon className="size-4" />
  <span>Label</span>
</button>

// Icon-only
<button className="size-9 sm:size-10 flex items-center justify-center rounded-lg hover:bg-accent transition-colors">
  <Icon className="size-4 sm:size-5" />
</button>

// Disabled state
<button
  disabled
  className="... disabled:opacity-50 disabled:cursor-not-allowed"
>
  Disabled
</button>
```

---

## 11. Form Input Pattern

### Pattern
**Consistent styling with clear focus states**

```tsx
// Text input
<input
  type="text"
  className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-card text-sm sm:text-base placeholder:text-foreground/40 transition-all"
  placeholder="Enter value"
/>

// Larger input (search)
<input
  type="search"
  className="w-full pl-10 pr-4 py-3 border border-foreground/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-card text-base"
  placeholder="Search..."
/>

// Select
<select className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-card text-sm sm:text-base">
  <option>Option 1</option>
  <option>Option 2</option>
</select>

// Textarea
<textarea
  className="w-full px-3 py-2.5 border border-foreground/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary bg-card resize-none text-sm sm:text-base placeholder:text-foreground/40"
  rows={4}
  placeholder="Enter details"
/>

// With label
<div className="space-y-1.5">
  <label className="text-sm sm:text-base font-medium text-foreground/70">
    Field Label
  </label>
  <input ... />
  <p className="text-xs sm:text-sm text-foreground/50">
    Helper text goes here
  </p>
</div>
```

---

## Summary: Implementation Checklist for Unheard

### High Priority
- [ ] Add responsive spacing to all components (`sm:` and `lg:` modifiers)
- [ ] Implement loading skeletons for chat list and project selector
- [ ] Enhance empty states with icons and better messaging
- [ ] Add hover state refinements to cards (shadow + border progression)
- [ ] Implement error states with retry actions

### Medium Priority
- [ ] Add active press feedback to buttons (`active:scale-[0.99]`)
- [ ] Implement group hover effects on cards
- [ ] Add transition duration variations (150ms for quick, 300ms for standard)
- [ ] Create consistent badge/tag component
- [ ] Add color opacity variations for more control

### Low Priority (Nice to have)
- [ ] Add loading animations (bouncing dots, spinners)
- [ ] Implement fade-in animations for content
- [ ] Add icon rotation transitions
- [ ] Create skeleton loading for all data-driven components

---

## Key Takeaways

1. **Consistency creates polish** - Every spacing value, transition, and color follows a pattern
2. **Responsive by default** - All text and spacing scales with screen size
3. **Feedback is essential** - Every interaction has hover, active, and focus states
4. **Loading states matter** - Skeletons should match actual content layout
5. **Empty states guide users** - Clear messaging with icons and CTAs
6. **Transitions are fast** - 150-300ms feels instant but smooth
7. **Opacity creates depth** - `/10`, `/20`, `/50`, `/70` hierarchy is powerful
8. **Group hover is magic** - Multiple child elements react to parent hover

---

*Patterns extracted from: [bob-rietveld/sodt-2026](https://github.com/bob-rietveld/sodt-2026)*
*Applied to: Unheard (Tauri Decision Support Tool)*
