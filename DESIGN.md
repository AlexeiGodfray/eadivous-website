# Eadivous Technologies — Design Standard

Swiss International Typographic Style meets raw web brutalism: mathematical grids, Helvetica clarity, exposed structure, and near-monochrome restraint.

## Theme config (where constants live)

All tunable values live in **[src/styles/theme_config.css](src/styles/theme_config.css)** — think of it like a single `config.yaml` for the UI.

**Naming pattern:** `--{group}-{what}-{detail}`

| Part | Meaning | Example |
|------|---------|---------|
| `group` | Category of setting | `color`, `spacing`, `layout`, `font` |
| `what` | What you're setting | `background`, `grid`, `size` |
| `detail` | Role or literal value | `page`, `64`, `display` |

**Not** opaque shorthands like `--space-3` without the grid step in the name.

## Philosophy

| Principle | Rule |
|-----------|------|
| **Swiss grid** | 12 columns, fixed margins and gutters, asymmetric placement, 8px spacing base |
| **Minimalism** | One sans family, no ornament, generous whitespace, limited palette |
| **Brutalism** | Raw layout, zero radius, stark display contrast, no cards or shadows |

Helvetica Neue is the primary typeface (International Typographic Style). Do not substitute Inter or other generic UI fonts.

## Colors

| Variable | Value | Usage |
|----------|-------|-------|
| `--color-background-page` | `#000000` | Page background |
| `--color-background-surface` | `#000000` | Surfaces (same as page for now) |
| `--color-text-body` | `#6b6375` | Body and secondary copy |
| `--color-text-heading-display` | `#ffffff` | Display headings (H1) |
| `--color-border-default` | `#e5e4e7` | Structural borders, frame |
| `--color-accent-default` | `#ffffff` | Sparingly, for emphasis |

## Spacing

Base unit: `--spacing-base-unit` = `0.5rem` (8px at a 16px root). Tokens use the **grid step in the name** (`--space-64` = step 64 on the 8px grid):

| Variable | rem | Tailwind utility |
|----------|-----|------------------|
| `--space-8` | 0.5 | `p-2`, `gap-2`, … |
| `--space-16` | 1 | `p-4` |
| `--space-24` | 1.5 | `p-6` |
| `--space-32` | 2 | `p-8` |
| `--space-40` | 2.5 | `p-10` |
| `--space-48` | 3 | `p-12` |
| `--space-64` | 4 | `p-16` |
| `--space-80` | 5 | `p-20` |
| `--space-96` | 6 | `p-24` |

Example in a component: `className="pt-16"` (wired to `--space-64` via `@theme` in `index.css`).

## Layout (grid)

| Variable | Value |
|----------|-------|
| `--layout-grid-column-count` | 12 |
| `--layout-grid-margin` | 1.5rem (1rem below `39.9375rem`) |
| `--layout-grid-gutter` | 1rem |
| `--layout-page-max-width` | 70.375rem |
| `--size-logo` | 9.375rem |

The page fills the viewport (`#root` is full width). Inner content uses `.site-grid` (12 equal columns) with `--layout-grid-margin` padding on the left and right so logo and copy sit on the canvas edge inset, not centered on the screen.

### Column utilities

- `.col-span-full` — span 12 columns
- `.col-span-8` — span 8 columns (asymmetric sections when needed)
- `.col-span-6` — span 6 columns

## Typography

| Role | Size variable | Color variable | Line height |
|------|---------------|----------------|-------------|
| **display** (H1) | `--font-size-heading-display` | `--color-text-heading-display` | `--font-line-height-heading-display` (0.92) |
| **heading** | `--font-size-heading` | `--color-text-heading-display` | 1.2 |
| **body** | `--font-size-body` | `--color-text-body` | 1.5 |
| **meta** | `--font-size-meta` | `--color-text-body` | 1.4 |

Font family: `--font-family-primary`.

Display titles split across two lines: **Eadivous** then **Technologies**.

Tailwind classes (`text-display`, `text-text-display`, …) are wired in [src/index.css](src/index.css) `@theme` from these variables.

## Components

### `SiteShell`

Wraps every page. Applies `.site-grid` and full-height layout.

```tsx
<SiteShell>
  <Home />
</SiteShell>
```

### `SiteHeader`

Persistent header. Logo **top-left**, sized via `size-logo` (`--size-logo`), links to home.

### `DisplayTitle`

Semantic `<h1>` with two block lines. Use once per page.

```tsx
<DisplayTitle />
```

## Do / Don't

**Do**

- Change the look in `theme_config.css` first, then use `var(--…)` or Tailwind utilities in components
- Align content to the 12-column grid
- Use borders only for structure when needed (e.g. section dividers), not a page frame
- Keep display type white on black

**Don't**

- Round corners (`border-radius: 0` everywhere)
- Add gradients, shadows, or glass effects
- Center the logo in the hero (header owns the mark)
- Use more than one display H1 per page
- Introduce opaque names like `--space-3` without the grid step in the key
- Use raw `px` in components or theme tokens (use `rem` / Tailwind utilities instead)
