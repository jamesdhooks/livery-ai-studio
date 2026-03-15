# Livery AI Studio — Frontend

React 19 + Vite 6 + Tailwind CSS v3 single-page application served by the Flask backend.

## Quick Start

```bash
npm install
npm run dev       # dev server with hot-reload (proxies /api to localhost:5000)
npm run build     # production build → ../static/
npm test          # run test suite (Vitest + React Testing Library)
npm run test:coverage  # test suite with v8 coverage report
```

> **Note:** The pre-built output in `../static/` is committed to the repo so end-users do not need Node.js. Run `npm run build` only after editing source files in this directory.

## Architecture

```
src/
├── services/     # API service layer — extend BaseService, exported as singletons
├── hooks/        # Custom React hooks — manage state, call services
├── components/
│   ├── common/   # Reusable UI atoms (Button, Modal, Toggle, StatusBar, FileUploader)
│   ├── layout/   # App shell (TopBar, SubBar)
│   ├── tabs/     # Main content tabs
│   └── modals/   # Dialog components
├── utils/        # Pure utility functions (helpers.js, pricing.js)
└── test/         # Vitest tests mirroring the src/ structure
```

All backend communication follows the pattern: **Service → Hook → Component**.  
Components never call `fetch()` directly.

## Tailwind Theme

Custom dark-mode colour palette defined in `tailwind.config.js`:

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-bg-dark` | `#0d0f13` | Main background |
| `bg-bg-panel` | `#151820` | Top/sub bars |
| `bg-bg-card` | `#1a1e28` | Cards |
| `bg-bg-input` | `#1e2230` | Form inputs |
| `text-text-primary` | `#e8eaf0` | Body text |
| `text-text-secondary` | `#8890a4` | Subdued text |
| `text-accent` | `#4a6cf7` | Primary blue |
| `text-success` | `#34d399` | Success green |
| `text-error` | `#f87171` | Error red |

## Adding a New Feature

1. Add the API endpoint in `../app.py`
2. Create or extend a service in `src/services/`
3. Create or extend a hook in `src/hooks/`
4. Build the component in `src/components/`
5. Write tests in `src/test/` mirroring the source path
6. Run `npm run build` to update `../static/`
