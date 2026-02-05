# SODT Patterns Applied to Unheard

## Overview

Design patterns extracted from [bob-rietveld/sodt-2026](https://github.com/bob-rietveld/sodt-2026) (TechStaple) and applied to the Unheard Tauri application.

---

## Repository Analysis Summary

The SODT-2026 repository demonstrates exceptional polish through:

1. **Consistent Spacing Scale** - Responsive progressions (`px-4 sm:px-6 lg:px-8`)
2. **Typography Hierarchy** - All text scales with screen size
3. **Color Opacity System** - `/10`, `/20`, `/50`, `/70` create depth
4. **Card Patterns** - Hover state refinements with border/shadow progressions
5. **Loading Skeletons** - Match actual content layout perfectly
6. **Empty States** - Icon + message + optional CTA pattern
7. **Error Handling** - Retry buttons with clear messaging
8. **Transitions** - Fast (150ms) but smooth cubic-bezier
9. **Group Hover** - Child elements react to parent hover
10. **Badge System** - Semantic color-coded categories

Full analysis: [docs/developer/design-patterns-from-sodt.md](docs/developer/design-patterns-from-sodt.md)

---

## Patterns Implemented

### 1. Loading Skeletons ✅

**Pattern:** Skeletons match actual content layout for seamless loading

**Implementation:**
- [src/components/chat/ChatListSkeleton.tsx](src/components/chat/ChatListSkeleton.tsx) - Matches ChatList layout
- [src/components/projects/ProjectSelectorSkeleton.tsx](src/components/projects/ProjectSelectorSkeleton.tsx) - Matches ProjectSelector

**Key Elements:**
```tsx
// Darker elements
className="bg-foreground/10"

// Lighter elements
className="bg-foreground/5"

// Animation
className="animate-pulse"

// Variable widths for natural look
style={{ width: `${60 + Math.random() * 30}%` }}
```

**Applied To:**
- ChatList component now shows skeleton while `chats === undefined`
- Future: Can add to ProjectSelector, ContextLibrary, etc.

---

### 2. Enhanced Empty States ✅

**Pattern:** Icon + Primary message + Secondary message

**Before:**
```tsx
<div>
  <MessageSquareIcon className="size-8" />
  <p className="text-sm">No chats yet</p>
</div>
```

**After (SODT pattern):**
```tsx
<div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center">
  {/* Larger icon with subtle color */}
  <MessageSquareIcon className="size-12 sm:size-16 text-foreground/20 mb-4" />

  {/* Primary message - larger, medium weight */}
  <p className="text-base sm:text-lg font-medium text-foreground/70 mb-2">
    {t('chat.list.empty', 'No chats yet')}
  </p>

  {/* Secondary message - responsive, muted */}
  <p className="text-sm sm:text-base text-foreground/50 max-w-[200px]">
    {t('chat.list.emptyHint', 'Create a chat to get started')}
  </p>
</div>
```

**Improvements:**
- ✅ Responsive icon size (`size-12 sm:size-16`)
- ✅ Color opacity for subtle effect (`text-foreground/20`)
- ✅ Typography hierarchy with responsive sizes
- ✅ Generous spacing (`p-8 sm:p-12`)
- ✅ Max-width for readability

**Applied To:**
- ChatList empty state (no chats)
- ChatList no project state

---

### 3. Responsive Spacing System ⚠️ (Partial)

**Pattern:** Mobile-first spacing with predictable progressions

**SODT Pattern:**
```tsx
// Page containers
className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8"

// Sections
className="py-12 sm:py-16"

// Cards
className="p-4 sm:p-6 lg:p-8"

// Gaps
className="gap-4 sm:gap-6 lg:gap-8"
```

**Current Unheard:**
```tsx
// Mostly static spacing
className="p-4"
className="gap-4"
className="mb-4"
```

**Status:** Partially applied in empty states, needs broader implementation

**Recommendation:** Add responsive modifiers to:
- All card padding
- Section gaps
- Layout spacing
- Button padding

---

### 4. Color Opacity Hierarchy ⚠️ (Needs Enhancement)

**Pattern:** Consistent opacity variations create depth

**SODT Usage:**
```tsx
// Text hierarchy
text-foreground      // 100% - Primary
text-foreground/70   // 70% - Secondary
text-foreground/50   // 50% - Tertiary
text-foreground/40   // 40% - Placeholder
text-foreground/20   // 20% - Very subtle

// Backgrounds
bg-primary/10        // Subtle tint
bg-primary/20        // Hover state
bg-primary/90        // Button hover

// Borders
border-foreground/10 // Subtle
border-foreground/20 // Input borders
```

**Current Unheard:**
```tsx
// Using semantic names (good)
text-muted-foreground
border-border

// Already using some opacity
border-border/60
text-muted-foreground/70
```

**Status:** Already partially implemented!

**Enhancement Opportunities:**
- Use `/10` for very subtle borders on cards
- Use `/20` for stronger borders on inputs
- Use `/50` for tertiary text
- Use `/70` for secondary text
- Use `/90` for button hover darken

---

### 5. Card Hover States ⚠️ (Needs Implementation)

**Pattern:** Border progression + Shadow progression + Active feedback

**SODT Pattern:**
```tsx
<div className="bg-card rounded-xl border border-foreground/10 hover:border-primary/20 hover:shadow-md active:scale-[0.99] transition-all group">
  <div className="group-hover:bg-primary/20 transition-colors">
    {/* Icon container reacts to parent hover */}
  </div>
</div>
```

**Key Elements:**
1. Border progression: `/10` → hover:`/20`
2. Shadow progression: `shadow-sm` → hover:`shadow-md`
3. Active feedback: `active:scale-[0.99]`
4. Group hover for child elements
5. Fast transitions: `transition-all`

**Recommendation:** Apply to:
- FolderScanner file list items
- ContextFileCard components
- Chat list items (partially done)

---

### 6. Button Press Feedback ❌ (Not Implemented)

**Pattern:** Visual feedback on button press

**SODT Pattern:**
```tsx
<button className="... active:scale-[0.99] transition-transform">
  Click me
</button>
```

**Status:** Not yet implemented

**Recommendation:** Add `active:scale-[0.99]` to all buttons

---

### 7. Group Hover Effects ❌ (Not Implemented)

**Pattern:** Child elements react to parent hover

**SODT Pattern:**
```tsx
<div className="group hover:bg-accent">
  <div className="group-hover:bg-primary/20 transition-colors">
    {/* Icon background changes on parent hover */}
  </div>
  <h3 className="group-hover:text-primary transition-colors">
    {/* Title color changes on parent hover */}
  </h3>
</div>
```

**Status:** Not yet implemented

**Recommendation:** Apply to:
- FolderScanner file items
- Chat list items
- Any interactive cards

---

## Implementation Checklist

### ✅ Completed
- [x] ChatListSkeleton component created
- [x] ProjectSelectorSkeleton component created
- [x] ChatList shows skeleton during loading
- [x] Enhanced empty states in ChatList (icon + messages)
- [x] Responsive spacing in empty states

### ⚠️ Partially Implemented
- [ ] Responsive spacing throughout app (need to add `sm:` and `lg:` modifiers)
- [ ] Color opacity system (some done, needs consistency)

### ❌ Not Yet Implemented (Recommended)
- [ ] Card hover state refinements (border/shadow progression)
- [ ] Button press feedback (`active:scale-[0.99]`)
- [ ] Group hover effects on cards
- [ ] Error states with retry buttons
- [ ] Loading animations (bouncing dots, spinners)
- [ ] Badge/tag component system
- [ ] Consistent form input styling
- [ ] Transition duration variations (150ms vs 300ms)

---

## Quick Wins (High Impact, Low Effort)

### 1. Add Button Press Feedback (5 min)
```tsx
// Find all buttons, add:
className="... active:scale-[0.99] transition-transform"
```

### 2. Enhance File List Hover (10 min)
```tsx
// FolderScanner file items:
className="... hover:border-border hover:shadow-sm transition-all"
```

### 3. Add Responsive Spacing to Cards (15 min)
```tsx
// All Card components:
className="p-4 sm:p-5 lg:p-6"  // Instead of p-4
```

### 4. Implement Loading Spinner (10 min)
```tsx
<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
```

### 5. Add Group Hover to Chat Items (15 min)
```tsx
<div className="group ...">
  <MessageSquareIcon className="group-hover:text-primary transition-colors" />
  <span className="group-hover:text-primary transition-colors" />
</div>
```

---

## Long-Term Recommendations

### 1. Create Shared Component Library
Extract common patterns:
```
src/components/ui/
  loading-skeleton.tsx  // Reusable skeleton component
  empty-state.tsx       // Standardized empty states
  badge.tsx             // Semantic badge system
  loading-spinner.tsx   // Loading indicators
```

### 2. Establish Design Tokens
```tsx
// lib/design-tokens.ts
export const spacing = {
  card: "p-4 sm:p-5 lg:p-6",
  section: "py-6 sm:py-8 lg:py-12",
  gap: "gap-4 sm:gap-5 lg:gap-6",
}

export const opacity = {
  subtle: "/10",
  border: "/20",
  tertiary: "/50",
  secondary: "/70",
  primary: "",  // 100%
}
```

### 3. Document Patterns
Add to `docs/developer/ui-patterns.md`:
- When to use loading skeletons
- Empty state guidelines
- Color opacity usage
- Transition timing standards

---

## Impact Summary

### Before (Current State)
- Static spacing (no responsive scaling)
- Simple empty states
- No loading skeletons
- Inconsistent hover states
- No press feedback

### After (With SODT Patterns)
- ✅ Responsive spacing scales naturally
- ✅ Polished empty states with icons
- ✅ Smooth loading experience with skeletons
- ⚠️ Improved hover states (partially)
- ❌ Press feedback (not yet)

### Result
**More polished, professional feel** that scales beautifully across screen sizes and provides clear feedback at every interaction.

---

## Key Takeaways from SODT

1. **Consistency = Polish** - Every spacing, color, transition follows a pattern
2. **Responsive by Default** - All sizes scale (`sm:`, `lg:` modifiers)
3. **Feedback is Essential** - Hover, active, focus states on everything
4. **Loading Matters** - Skeletons match content layout
5. **Empty States Guide** - Icon + message + CTA
6. **Fast Transitions** - 150-300ms feels instant but smooth
7. **Opacity Creates Depth** - `/10` to `/90` hierarchy
8. **Group Hover is Magic** - Multiple elements react together

---

## Next Steps

1. **Review** the full pattern documentation: [docs/developer/design-patterns-from-sodt.md](docs/developer/design-patterns-from-sodt.md)
2. **Test** the new loading skeletons and empty states
3. **Implement** quick wins (button press feedback, responsive spacing)
4. **Gradually apply** remaining patterns as you work on components
5. **Document** your own patterns in `ui-patterns.md`

---

*Patterns extracted from: [bob-rietveld/sodt-2026](https://github.com/bob-rietveld/sodt-2026)*
*Applied to: Unheard Tauri App*
*Date: February 2026*
