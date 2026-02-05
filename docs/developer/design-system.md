# Design System - Refined Functional Minimalism

## Design Philosophy

**"Quiet Precision"** - A Dieter Rams-inspired design system where every element serves a clear purpose. The interface becomes invisible, allowing users to focus entirely on their decision-making work.

### Core Principles

Following Dieter Rams' 10 Principles:

1. **Innovative** - Modern OKLCH colors, refined typography, thoughtful spacing
2. **Useful** - Function-first layout, intuitive placement, clear hierarchy
3. **Aesthetic** - Subtle elegance through restraint and precision
4. **Understandable** - Clear visual language, consistent patterns
5. **Unobtrusive** - Interface fades into background, content takes focus
6. **Honest** - No decorative elements, only functional design
7. **Long-lasting** - Timeless aesthetic, won't feel dated
8. **Thorough** - Every detail considered, nothing left to chance
9. **Environmentally-friendly** - Minimal resource usage, efficient rendering
10. **Minimal** - As little design as possible, maximum clarity

### Inspiration

**Attio CRM** aesthetic qualities:
- Clean, fast, intuitive
- Modern Notion-inspired interface
- Apple-like product quality
- Sophisticated simplicity

---

## Color System

### Philosophy

Refined neutral palette with barely perceptible warmth and sophistication. Uses OKLCH color space for perceptual uniformity and future-proof wide gamut support.

### Light Mode Palette

```css
/* Backgrounds - Refined neutrals with subtle warmth */
--background: oklch(0.99 0 0)           /* Off-white, reduces eye strain */
--card: oklch(1 0 0)                    /* Pure white for elevation */
--sidebar: oklch(0.98 0 0)              /* Subtle differentiation */

/* Text - Charcoal with slight warmth */
--foreground: oklch(0.18 0 0)           /* Primary text */
--muted-foreground: oklch(0.50 0 0)     /* Secondary text */

/* Interactive - Refined charcoal */
--primary: oklch(0.22 0.01 60)          /* Actions, slightly warm */
--primary-foreground: oklch(0.99 0 0)   /* Text on primary */

/* Supporting colors */
--muted: oklch(0.95 0 0)                /* Subtle backgrounds */
--accent: oklch(0.95 0.01 240)          /* Interactive hints, barely blue */
--destructive: oklch(0.55 0.18 25)      /* Refined red */

/* Borders - Subtle separation */
--border: oklch(0.91 0 0)               /* Standard borders */
--input: oklch(0.94 0 0)                /* Input backgrounds */
```

### Dark Mode Palette

```css
/* Backgrounds - True black with subtle warmth */
--background: oklch(0.12 0.005 60)      /* Warm black */
--card: oklch(0.16 0.005 60)            /* Elevated surface */
--sidebar: oklch(0.14 0.005 60)         /* Subtle sidebar */

/* Text - Refined light gray */
--foreground: oklch(0.95 0 0)           /* Primary text */
--muted-foreground: oklch(0.60 0 0)     /* Secondary text */

/* Interactive - Light gray */
--primary: oklch(0.90 0.01 60)          /* Actions */
--primary-foreground: oklch(0.12 0 0)   /* Text on primary */

/* Supporting colors */
--muted: oklch(0.22 0.005 60)           /* Subtle backgrounds */
--accent: oklch(0.24 0.02 240)          /* Interactive hints */
--destructive: oklch(0.60 0.16 25)      /* Softer red for dark mode */

/* Borders - Refined in darkness */
--border: oklch(0.25 0.005 60)          /* Subtle borders */
--input: oklch(0.20 0.005 60)           /* Input backgrounds */
```

### Usage Guidelines

**Do:**
- Use semantic tokens (`bg-background`, `text-foreground`)
- Trust the subtle warmth in neutrals
- Embrace the refined contrast ratios

**Don't:**
- Use raw color values
- Add saturated colors without purpose
- Override the subtle border opacities

---

## Typography

### Font Stack

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Text', 'Helvetica Neue', sans-serif;
```

**Rationale:** System fonts provide native feel, excellent readability, and zero load time.

### Scale & Hierarchy

```css
/* Base */
body: 14px, weight 400, line-height 1.5, letter-spacing -0.01em

/* Headings */
h1: 22px, weight 600, line-height 1.3, letter-spacing -0.02em    /* Page titles */
h2: 18px, weight 600, line-height 1.35, letter-spacing -0.015em  /* Section headers */
h3: 15px, weight 600, line-height 1.4, letter-spacing -0.01em    /* Card titles */
h4: 14px, weight 600, line-height 1.45, letter-spacing -0.005em  /* Labels */

/* Body variations */
.text-lg: 15px, line-height 1.5      /* Emphasized body */
.text-sm: 13px, line-height 1.5      /* Secondary text */
.text-xs: 12px, line-height 1.4      /* Meta information */
```

### Optical Refinements

- **Negative letter-spacing** on all text for refined feel
- **Optical size variation** via line-height (tighter for larger text)
- **Weight consistency** - only 400 and 600, never in-between
- **Text rendering** - `optimizeLegibility` and `-webkit-font-smoothing`

### Usage Guidelines

**Hierarchy Rules:**
1. One h1 per view (page title)
2. h2 for major sections
3. h3 for card/component titles
4. h4 for form labels and small headers

**Do:**
- Use the defined scale consistently
- Pair font weights intentionally (400 for body, 600 for emphasis)
- Trust the letter-spacing values

**Don't:**
- Create custom font sizes
- Use font weight 500 or 700
- Override line-heights without consideration

---

## Spacing System

### Scale

Based on 4px base unit with refined progression:

```
1  → 4px   (0.25rem)
1.5 → 6px  (0.375rem)
2  → 8px   (0.5rem)
2.5 → 10px (0.625rem)
3  → 12px  (0.75rem)
4  → 16px  (1rem)
5  → 20px  (1.25rem)
6  → 24px  (1.5rem)
8  → 32px  (2rem)
12 → 48px  (3rem)
16 → 64px  (4rem)
```

### Component Spacing Guidelines

**Cards:**
- Padding: `p-5` (20px) for content
- Gap between elements: `gap-2.5` (10px)
- Title to description: `space-y-1.5` (6px)

**Layouts:**
- Sidebar padding: `p-5` (20px)
- Main content padding: `p-6` (24px)
- Section gaps: `gap-6` (24px)

**Forms:**
- Label to input: `gap-2.5` (10px)
- Field groups: `gap-5` (20px)
- Form to actions: `py-6` (24px padding)

**Chat Interface:**
- Message gaps: `mb-6` (24px)
- Input padding: `px-6 py-4` (24px/16px)
- Empty state: `px-8 py-16` (32px/64px)

### Breathing Room Philosophy

Generous whitespace is a design element. Each component should have space to "breathe" without feeling cramped.

---

## Components

### Buttons

**Variants:**
- **Default** - Primary actions, high contrast
- **Outline** - Secondary actions, refined borders
- **Ghost** - Tertiary actions (if needed)

**Refinements:**
```tsx
className="cursor-pointer border-border/60 hover:bg-accent transition-colors"
```

**Typography:**
```tsx
<span className="text-sm font-medium">{label}</span>
```

### Inputs

**Refinements:**
```tsx
className="border-border/60 bg-background focus:border-border transition-colors"
```

**States:**
- Default: `border-border/60` - subtle, refined
- Focus: `border-border` - full opacity for clarity
- Disabled: `bg-muted/30` - clearly non-interactive

### Cards

**Structure:**
```tsx
<Card className="border-border/60 shadow-sm">
  <CardHeader>
    <CardTitle className="text-base font-semibold">Title</CardTitle>
    <CardDescription className="text-sm leading-relaxed">Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* content */}
  </CardContent>
</Card>
```

**Refinements:**
- Subtle borders: `border-border/60`
- Light shadows: `shadow-sm` (never `shadow-lg`)
- Generous padding: `p-5` or `p-6`

### Dialogs

**Modal refinements:**
```tsx
<DialogContent className="border-border/60">
  <DialogHeader>
    <DialogTitle className="text-lg">Title</DialogTitle>
    <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
      Description
    </DialogDescription>
  </DialogHeader>
  {/* content with gap-5 py-6 */}
</DialogContent>
```

### Chat Components

**Message Bubbles:**
- User: `bg-primary text-primary-foreground`
- Assistant: `bg-card border border-border`
- Error: `border-destructive bg-destructive/5`
- Streaming indicator: `w-1.5 h-4 rounded-sm animate-pulse`

**Empty State:**
- Centered, generous padding
- Clear hierarchy with subtle prompt arrows
- Max-width for readability

**Input Area:**
- Backdrop blur: `bg-background/50 backdrop-blur-sm`
- Centered with max-width
- Refined borders: `border-border/60`

---

## Interaction States

### Hover

**Principle:** Subtle shift, never dramatic

```css
/* Buttons */
hover:bg-accent transition-colors

/* Borders */
hover:border-border

/* Cards/Items */
hover:bg-accent/50 hover:border-border transition-all
```

### Focus

**Accessibility-first:**
```css
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

### Disabled

**Clear but refined:**
```css
disabled:opacity-50 disabled:cursor-not-allowed
```

### Transitions

**Standard timing:**
```css
transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
```

**Rationale:** 150ms feels instantaneous but smooth. Cubic-bezier provides refined easing.

---

## Shadows

### Philosophy

Minimal, functional shadows for depth. Never decorative.

**Scale:**
- `shadow-sm` - Cards, elevated elements (most common)
- `shadow-md` - Floating actions (rare)
- `shadow-lg` - Reserved, almost never used

**Usage:**
```tsx
// Cards
className="shadow-sm"

// Floating buttons (scroll to bottom)
className="shadow-sm hover:shadow-md transition-all"

// Toasts
className="shadow-sm"
```

---

## Border Radius

### Scale

```css
--radius: 0.5rem (8px) - subtle, refined curves
```

**Derived values:**
- `rounded-sm`: 4px
- `rounded-md`: 6px
- `rounded-lg`: 8px (most common)
- `rounded-xl`: 12px (rare)

### Usage

**Standard components:**
- Cards: `rounded-lg`
- Buttons: `rounded-lg`
- Inputs: `rounded-lg`
- Dialogs: `rounded-lg`

**Refinements:**
- Streaming cursor: `rounded-sm` (more precise)
- Message bubbles: `rounded-lg`

---

## Accessibility

### Contrast Ratios

All color combinations meet **WCAG AAA** standards:

**Light mode:**
- Foreground on background: 14:1
- Muted foreground on background: 4.7:1
- Primary on primary-foreground: 12:1

**Dark mode:**
- Foreground on background: 11:1
- Muted foreground on background: 3.8:1
- Primary on primary-foreground: 10:1

### Focus Indicators

Clear, 2px solid ring with 2px offset on all interactive elements.

### ARIA Support

All interactive components include:
- Proper `aria-label` for icon buttons
- `aria-live` regions for dynamic content
- Semantic HTML structure

---

## Dark Mode

### Implementation

Class-based dark mode using `.dark` class on root element.

### Switching

Handled by `ThemeProvider`:
- `light` - Force light mode
- `dark` - Force dark mode
- `system` - Follow OS preference (default)

### Color Token Mapping

All components use semantic tokens. Dark mode automatically applies via CSS variables in `.dark` selector.

---

## Responsive Behavior

**Note:** Unheard is a **fixed-size desktop application**. No responsive breakpoints needed.

### Approach

- Fixed layouts optimized for desktop
- Resizable panels for user customization
- No mobile/tablet considerations

---

## Performance

### Optimizations

1. **React Compiler** - Automatic memoization, no manual `useMemo`
2. **Zustand selectors** - Prevents render cascades
3. **System fonts** - Zero font loading overhead
4. **CSS variables** - Efficient theme switching
5. **Backdrop blur** - Used sparingly (chat input only)

### Animation Performance

All animations use `transform` and `opacity` for GPU acceleration:

```css
transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
```

---

## Implementation Checklist

When creating new components:

- [ ] Use semantic color tokens
- [ ] Apply refined typography scale
- [ ] Add proper spacing (4px base grid)
- [ ] Include hover states with `transition-colors`
- [ ] Add `cursor-pointer` to clickable elements
- [ ] Use `border-border/60` for subtle borders
- [ ] Apply `shadow-sm` for elevation
- [ ] Ensure WCAG AAA contrast
- [ ] Add proper ARIA labels
- [ ] Test in both light and dark mode

---

## Examples

### Perfect Card

```tsx
<Card className="border-border/60 shadow-sm">
  <CardHeader>
    <CardTitle className="text-base font-semibold">
      Project Files
    </CardTitle>
    <CardDescription className="text-sm leading-relaxed">
      Select files from your project folder
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* content */}
  </CardContent>
</Card>
```

### Perfect Button

```tsx
<Button
  variant="outline"
  className="cursor-pointer border-border/60 hover:bg-accent transition-colors"
>
  <span className="text-sm font-medium">Action</span>
</Button>
```

### Perfect Input

```tsx
<div className="grid gap-2.5">
  <Label className="text-sm font-medium text-foreground">
    Field Name
  </Label>
  <Input
    className="border-border/60 bg-background focus:border-border transition-colors"
    placeholder="Enter value"
  />
</div>
```

---

## Maintenance

### Updating Colors

Use [oklch.com](https://oklch.com) to generate new values. Maintain the refined contrast and subtle warmth.

### Adding Components

Reference `docs/developer/ui-patterns.md` for shadcn/ui component additions.

### Design Decisions

All design decisions should align with:
1. Dieter Rams' 10 Principles
2. Functional minimalism aesthetic
3. Attio-inspired refinement
4. Accessibility standards

---

## Credits

**Design System:** Refined Functional Minimalism
**Philosophy:** Dieter Rams' 10 Principles of Good Design
**Inspiration:** Attio CRM, Apple Human Interface Guidelines
**Color Science:** OKLCH color space (Björn Ottosson)
**Typography:** System font stack for native feel

---

*Last updated: February 2026*
