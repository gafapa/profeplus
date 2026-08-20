# ProfePlus Design System

## Product Direction

ProfePlus is a calm, high-density teacher workspace. The interface should feel reliable during a live class: clear enough to scan quickly, compact enough to keep context visible, and restrained enough that status colors retain meaning.

The public landing page extends the same blue workspace into a brighter editorial surface. It must demonstrate the product through an explicitly simulated classroom workflow rather than invented customer quotes, usage totals, or institutional logos.

## Visual Foundations

- Primary ink: deep navy and slate blues for headings and durable navigation.
- Primary action: `#1f4b99` or the existing stronger blue where the surrounding component already defines it.
- Canvas: white and very light blue surfaces; warm cream is reserved for backup and other actionable warnings.
- Success: green only for saved, current, present, or verified states.
- Warning: amber only when the teacher should act or understand a data-recovery risk.
- Danger: red only for destructive actions or failed operations.
- Borders: cool blue-gray, usually one pixel. Use elevation sparingly and avoid stacked card decoration.

Typography uses the existing system sans-serif stack. Headings are compact and assertive, body text stays readable at classroom distance, and tabular values should remain easy to compare. Public-page display headings may be larger, but the product workspace keeps its established density.

## Layout

- Workspace pages preserve the existing top workflow navigation, contextual subnavigation, main content panel, and fixed status bar.
- The landing page uses a maximum content width of 1,120 pixels, with the value proposition and the simulated Today view sharing the first viewport on wide screens.
- Forms group related controls with labels above fields. Primary actions follow the reading order and destructive actions stay visually separate.
- Recovery guidance precedes backup controls so users understand the storage model before acting.

## Components And States

- Buttons use the existing `primary`, `secondary`, and danger treatments. Every new interactive target is at least 44 pixels high on narrow or touch layouts.
- Notices describe the result and whether local data changed. Backup verification must explicitly state that it does not replace current data.
- Product feedback always previews the outgoing text and warns against including academic data. It never gathers page content automatically.
- Backup status appears in the global status bar and as a contextual reminder only when meaningful local records exist.
- Empty, loading, error, offline, and disabled states use plain Spanish and preserve the user's next safe action.

## Responsive Behavior

- At 900 pixels and below, Today uses a horizontally scrollable session chooser, removes the artificial student-list height limit, exposes the `Pasar lista` shortcut, and keeps the class-save action reachable while scrolling.
- At 620 pixels and below, landing actions become full width, the product demonstration collapses to one column, feedback actions stack, and backup guidance uses a single-column reading order.
- Responsive changes must not create horizontal document overflow. Dense data tables may keep their existing local scrolling behavior.

## Accessibility

- Keep one clear page-level heading, semantic landmarks, visible labels, and the existing skip links.
- Use native buttons, links, inputs, lists, and headings before adding ARIA.
- Never rely on color alone for status; pair it with text or a symbol.
- Preserve visible `:focus-visible` treatment, logical keyboard order, reduced-motion behavior, live status announcements, and labeled modal dialogs.
- Decorative SVGs and synthetic product artwork remain hidden from assistive technology; meaningful controls carry accessible names.

## Content Principles

- User-facing copy is Spanish. Documentation, source identifiers, functions, variables, and code comments are English.
- Make local-only storage and recovery responsibility explicit before users enter data.
- Do not claim adoption, performance outcomes, certifications, or customer approval without verified evidence.
- Label synthetic names and records as simulated examples.
