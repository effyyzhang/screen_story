# Quick Setup Guide

## Install & Run

```bash
cd ui-redesign
npm install
npm run dev
```

Open http://localhost:3000

## What You'll See

A production-grade Eagle-inspired interface with:

✅ **Dark minimal aesthetic** - Pure #0D0D0D with subtle borders
✅ **3-column layout** - Sidebar (240px) | Grid | Properties (280px)
✅ **Smooth animations** - Framer Motion hover effects, staggered reveals
✅ **SF Pro typography** - 14px base, clean and readable
✅ **Screenshot cards** - Hover to reveal metadata + quick actions
✅ **Relevance system** - Gold badges for hero moments (>80%)

## Key Interactions

- **Hover cards** - Lift effect + overlay with AI summary
- **Click screenshot** - Opens in properties panel
- **Search** - Expands from 400px to 500px on focus
- **Filters** - Quick Access for All/Hero/Success
- **Sessions** - Collapsible tree in sidebar

## Integration with Your Backend

Current state: **Mock data only**

To connect to Electron:

1. **Replace mock sessions** in `app/page.tsx`:
   ```typescript
   // Replace mockSessions with:
   const [sessions, setSessions] = useState<Session[]>([])

   useEffect(() => {
     // Fetch from your API/Electron IPC
     fetch('http://localhost:3001/api/sessions')
       .then(res => res.json())
       .then(setSessions)
   }, [])
   ```

2. **Update screenshot paths** to local files:
   ```typescript
   // In your screenshot data:
   path: `/Users/effyzhang/.../sessions/jianying-mcp-test/frame_0001.png`
   ```

3. **Wire up actions**:
   - Export to JianYing → Call MCP server
   - Create Video → Trigger FFmpeg
   - Recording status → WebSocket from daemon

## Design System

All design tokens in `tailwind.config.ts`:
- Eagle-exact colors
- SF Pro font stack
- Spacing scale (4px base)
- Smooth timing functions

## File Structure

```
ui-redesign/
├── app/
│   ├── page.tsx           # Main app
│   ├── layout.tsx         # Root
│   └── globals.css        # Styles
├── components/
│   ├── Header.tsx         # 56px top bar
│   ├── Sidebar.tsx        # 240px navigation
│   ├── ScreenshotCard.tsx # Grid item
│   ├── ScreenshotGrid.tsx # Masonry
│   └── PropertiesPanel.tsx # 280px details
└── lib/
    ├── types.ts           # Interfaces
    └── utils.ts           # Helpers
```

## Tips

- Mock data shows 5 screenshots in first session
- Click any card to see properties panel
- Hover to see overlay effects
- Search bar is visual only (not wired yet)

Enjoy! 🎨
