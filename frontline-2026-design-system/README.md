# Frontline 2026 Design System

The Backbase Unified Frontline 2026 presentation design system — design tokens, layout specs, and the HTML/PPTX builders used by Claude Code skills.

## What's in this package

```
frontline-2026-design-system/
├── design-system/          # Tokens, layouts, component & rules docs
│   ├── design-tokens.json    # Colors, fonts, spacing, radii
│   ├── slide-layouts.md      # 9 layout types with specs
│   ├── html-components.md    # Component catalog for HTML builder
│   └── google-slides-rules.md# PPTX → Google Slides compatibility rules
├── tools/                  # Python builder classes
│   ├── frontline_2026_html.py       # Single-file HTML deck builder
│   └── frontline_2026_presenter.py  # PPTX builder (Google Slides-compatible)
└── skills/                 # Claude Code skill commands
    ├── frontline-html.md     # /frontline-html — interactive HTML preview
    └── frontline-slides.md   # /frontline-slides — Google Slides PPTX
```

## How to use

### As a Claude Code skill (recommended)

Drop the `tools/` files into your repo at `tools/` and the `skills/` files at `.claude/commands/`. Then in Claude Code:

```
/frontline-html        # iterate on content as a self-contained HTML preview
/frontline-slides      # generate Google Slides-compatible .pptx
```

Both skills read tokens from `presentations/frontline-2026/design-tokens.json` — copy `design-system/design-tokens.json` to that path, or update the path constant in the skill docs.

### As a standalone library

Both Python builders are dependency-light:

- `frontline_2026_html.py` — pure Python, no deps. Outputs a single self-contained HTML file.
- `frontline_2026_presenter.py` — requires `python-pptx`. Outputs a 20"×11.25" Google Slides-compatible `.pptx`.

```python
from frontline_2026_html import Frontline2026HTML

deck = Frontline2026HTML(title="My Deck")
deck.add_cover(title="Quarterly Review", subtitle="Q1 2026")
deck.add_content(heading="Highlights", bullets=["..."])
deck.save("output.html")
```

See `skills/frontline-html.md` and `skills/frontline-slides.md` for the full API and layout catalog.

## Design tokens (quick reference)

- **Navy** `#001C3D` — dark backgrounds
- **Action Blue** `#1A5AFF` — accents, primary buttons
- **Semantic Red** `#E02020` — warnings, "from" state
- **Success Green** `#2ECC71` — positive metrics
- **Background Gray** `#F5F7F9` — "from" state cards
- **Font** — Libre Franklin (Google Fonts CDN)
- **Radius** — 16px cards, 30px pill buttons

## Layouts

Nine slide types are supported in both HTML and PPTX:

1. Cover
2. Section divider
3. Agenda
4. Content (heading + bullets)
5. Split comparison (from/to)
6. Showcase (large stat + supporting copy)
7. Architecture diagram
8. Stat cards (3-up or 4-up)
9. Case study

Full specs in `design-system/slide-layouts.md`.

## Google Slides compatibility

The PPTX builder enforces these rules so decks survive PPTX → Google Slides import without formatting issues:

- 20"×11.25" canvas (Google Slides native widescreen)
- 15% text-width buffer (prevents wrapping on import)
- Autofit disabled
- No gradients, drop shadows, or rotated text
- Libre Franklin with Inter fallback

Details in `design-system/google-slides-rules.md`.

## Status

> Legacy in the cortex repo — `/backbase-slides` and `/backbase-slides-pptx` are now the primary skills there. This system is still supported and useful as a self-contained reference for the Frontline 2026 visual language.
