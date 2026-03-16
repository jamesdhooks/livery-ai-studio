# Contributing to Livery AI Studio

Thanks for your interest in contributing! This document covers how to get involved.

See [ROADMAP.md](ROADMAP.md) for the project's planned features and priorities.

## Finding Work

Browse the [Issues](https://github.com/jamesdhooks/livery-ai-studio/issues) board
for things to work on:

- [`good first issue`](https://github.com/jamesdhooks/livery-ai-studio/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) — small, well-scoped tasks ideal for newcomers.
- [`help wanted`](https://github.com/jamesdhooks/livery-ai-studio/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) — larger items where extra hands are welcome.

### Claiming an Issue

1. **Comment** on the issue to let others know you're working on it.
2. **Open a draft PR** early so maintainers can see progress and give feedback.
3. **Ask questions** in the issue thread — don't hesitate to request clarification.

If you don't see an issue for what you want to build, open one first so we can
discuss the approach before you invest time.

## Getting Started

1. **Fork** the repository and clone your fork.
2. Install dependencies:
   ```bash
   # Python
   python -m venv .venv
   .venv\Scripts\activate      # Windows
   pip install -r requirements.txt

   # Frontend
   cd frontend
   npm install
   ```
3. Start the dev servers. **Choose one:**

   **Option A — Quick start (recommended):**
   ```bash
   start.bat --auto-load
   ```
   This launches both the Flask backend and Vite dev server in one command with HMR enabled.

   **Option B — Manual control (two terminals):**
   ```bash
   # Terminal 1 — Flask backend
   python app.py

   # Terminal 2 — Vite dev server (with proxy to Flask)
   cd frontend
   npm run dev
   ```
   Opens at http://localhost:5173 with HMR, proxies `/api/*` to http://localhost:5000 (Flask).

## Development Workflow

- **Backend** code lives in `server/` (Flask blueprints) and root-level Python files.
- **Frontend** code lives in `frontend/src/` (React + Vite + Tailwind CSS).
- Built frontend assets go to `static/` — run `cd frontend && npm run build` to regenerate.

### Architecture

All frontend API communication follows the **Service → Hook → Component** pattern:

1. **Services** (`frontend/src/services/`) — extend `BaseService`, handle raw HTTP calls.
2. **Hooks** (`frontend/src/hooks/`) — manage React state, call services.
3. **Components** (`frontend/src/components/`) — render UI, consume hooks.

## Running Tests

```bash
cd frontend
npm test           # Run all tests once
npm run test:watch # Watch mode
```

All tests must pass before submitting a pull request.

## Submitting Changes

1. Create a feature branch: `git checkout -b my-feature`
2. Make your changes with clear, descriptive commits.
3. Run tests: `cd frontend && npm test`
4. Push your branch and open a Pull Request against `main`.
5. Describe what your PR does and why.

## Code Style

- **Python:** Follow PEP 8. Use `pathlib.Path` for file paths.
- **JavaScript/JSX:** Use the existing code style (functional components, hooks, Tailwind utilities).
- **Naming:** React components → PascalCase, hooks → `use*`, services → `*Service`, tests → `*.test.js(x)`.

## Reporting Bugs

Open a [GitHub Issue](../../issues) with:
- Steps to reproduce
- Expected vs actual behaviour
- Screenshots or logs if applicable
- Your OS and Python version

## Feature Requests

Open a [GitHub Issue](../../issues) tagged as an enhancement. Describe the use case and any
implementation ideas you have. Check [ROADMAP.md](ROADMAP.md) first to see if it's already
planned.

## Building the EXE

See the **Building the EXE** section in [README.md](README.md) for instructions on
creating your own packaged build with PyInstaller.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the same
[license](LICENSE) as the project.
