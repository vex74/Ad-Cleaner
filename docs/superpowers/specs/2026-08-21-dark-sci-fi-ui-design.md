# Dark Sci-Fi UI Design

**Goal:** Give Ad Cleaner a minimal dark sci-fi control-console appearance without changing extension behavior, layout structure, or accessibility semantics.

## Visual Direction

- Use a deep navy-black background with restrained cyan-blue glows and a low-contrast technical grid.
- Render cards as translucent dark panels with thin blue edge lighting instead of heavy gradients or bright glass effects.
- Keep the primary action electric blue, destructive actions muted red, and successful or active states teal.
- Preserve the existing 16px corner radius and compact layout density.
- Use subtle hover elevation and focus rings; avoid flashing animation, large shadows, or distracting effects.

## Scope

- `options.css`: full-page settings console treatment, structured panel hierarchy, form and rule-list contrast.
- `popup.css`: compact status-console treatment, central count readout, action and metric emphasis.
- `content.css`: recovery panel and element-picker overlay use the same dark system while preserving page-level contrast.
- No changes to JavaScript behavior, extension permissions, filter rules, or localized strings.

## Acceptance Criteria

- Text, inputs, buttons, switches, badges, and rule cards remain legible in both Chinese and English.
- Existing primary, danger, ghost, enabled, and disabled visual meanings remain distinguishable.
- The popup remains usable at its 340px width.
- Recovery and picker controls remain visibly separate from the host page.
- JavaScript checks and existing test suite continue to pass.
