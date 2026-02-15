# Screen Story UI Redesign

Eagle-inspired minimal interface built with Next.js, TypeScript, Tailwind CSS, and Framer Motion.

## Design Philosophy

**Refined Minimalism** - Clean, precise, functional
- Pure dark theme (#0D0D0D) with subtle hierarchies
- SF Pro typography at 14px base
- Micro-animations that enhance, not distract
- Information density with breathing room

## Visual Language

**Inspired by:** Eagle (asset management) + Linear (project management)

**Key traits:**
- Subtle borders (#262626) - barely visible divisions
- Hover states that lift and reveal
- Smooth 200ms transitions with ease-out curves
- Backdrop blur effects for overlays
- Tabular numbers for counts and metrics

## Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Font:** SF Pro (system default)

## Setup

```bash
cd ui-redesign
npm install
npm run dev
```

Open http://localhost:3000

## Structure

```
ui-redesign/
├── app/
│   ├── globals.css         # Tailwind + custom styles
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Main app page
├── components/
│   ├── Header.tsx          # Top bar with search
│   ├── Sidebar.tsx         # Left navigation
│   ├── ScreenshotCard.tsx  # Grid item with hover
│   ├── ScreenshotGrid.tsx  # Masonry layout
│   └── PropertiesPanel.tsx # Right details panel
├── lib/
│   ├── types.ts            # TypeScript interfaces
│   └── utils.ts            # Helpers (cn, formatters)
└── tailwind.config.ts      # Design tokens
```

## Features

### Header
- Search bar that expands on focus (400px → 500px)
- Recording status with pulsing indicator
- Clean action buttons

### Sidebar (240px)
- Quick Access filters with counts
- Session tree navigation
- Active state with left accent border
- Smooth layoutId animations

### Screenshot Grid
- Responsive masonry (min 240px columns)
- Staggered fade-in on load (30ms delay between items)
- Hover effects:
  - Card lifts 2px
  - Gradient overlay fades in
  - Metadata slides up from bottom
  - Quick actions appear

### Properties Panel (280px)
- Large preview thumbnail
- Metadata rows with icons
- AI analysis with animated relevance meter
- Export action buttons

## Design Tokens

```css
/* Backgrounds */
--bg-app: #0D0D0D       /* Main canvas */
--bg-surface: #161616    /* Cards */
--bg-hover: #1C1C1C      /* Hover states */
--bg-sidebar: #0A0A0A    /* Left sidebar */

/* Borders */
--border-subtle: #1A1A1A
--border: #262626
--border-hover: #404040

/* Text */
--text-primary: #E8E8E8
--text-secondary: #A0A0A0
--text-tertiary: #6B6B6B

/* Accents */
--accent: #5E6AD2       /* Linear purple */
--success: #00D26A
--warning: #F59E0B      /* Gold for hero moments */
--error: #FF6B6B
```

## Animation Details

**Transitions:** 200ms cubic-bezier(0.4, 0, 0.2, 1)

**Card hover:**
- translateY(-2px)
- shadow-md appears
- Overlay fades in

**Overlay content:**
- Top metadata: -10px → 0 with stagger
- Bottom content: +10px → 0 with delay

**Search focus:**
- Width expansion smooth spring
- Border color transition

**Active indicators:**
- layoutId for smooth morphing between items
- Spring animation (500 stiffness, 30 damping)

## Integration with Existing App

To connect to your Electron backend:

1. Replace mock data in `app/page.tsx` with API calls
2. Update image paths to point to local screenshots
3. Wire up action handlers (export, create video)
4. Add WebSocket for real-time recording status
5. Connect to existing database queries

## Next Steps

- [ ] Add keyboard shortcuts (Cmd+K for search)
- [ ] Implement virtual scrolling for large sessions
- [ ] Add drag-and-drop for session organization
- [ ] Create timeline view mode
- [ ] Add bulk export operations
- [ ] Integrate with JianYing MCP tools

## Performance

- Images lazy load
- Staggered animations prevent jank
- Framer Motion uses GPU acceleration
- Grid uses CSS Grid (hardware optimized)
