# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meka Flow — a React SPA for managing multiple AI sessions (Claude, Codex, Gemini) concurrently across an infinite canvas, Kanban board, or tab view.

## Commands

- `npm run dev` — Start dev server (Vite, port 3000)
- `npm run build` — Production build
- `npm run lint` — TypeScript type checking only (no ESLint)
- `npm run preview` — Preview production build
- `npm run clean` — Remove dist/

## Environment Setup

Copy `.env.local` and set `GEMINI_API_KEY` to your Gemini API key. This key is injected at build time via Vite's `define` config.

## Architecture

**Stack:** React 19 + TypeScript + Vite 6 + Tailwind CSS 4 (utility-first, no component library)

**State management:** React hooks + prop drilling from App.tsx. No Redux/Zustand.

**Entry flow:** `index.html` → `main.tsx` → `App.tsx` (owns all global state: sessions, viewMode, modals)

**Three view modes** controlled by `viewMode` state in App.tsx:
- **CanvasView** — Infinite draggable canvas with pan/zoom, multi-select, broadcast messaging to selected sessions
- **BoardView** — Kanban columns by session status (inbox → inprocess → review → done)
- **TabView** — Tab-based navigation with search

All views render `SessionWindow` for individual AI chat sessions. Top-level chrome: `TopBar`, `NewSessionModal`, `GitSidebar`, `DiffModal`.

**AI integration:** Streams responses from Google Gemini API (`gemini-3-flash-preview`) via `@google/genai` SDK. Located in SessionWindow.tsx.

**Git integration is mocked:** `services/mockGit.ts` generates fake diffs after AI responses for demo purposes.

**Key types** (in `types.ts`): `Session` (id, title, model, status, position, messages, diff), `SessionStatus` ('inbox' | 'inprocess' | 'review' | 'done'), `Message`, `FileDiff`, `GitDiff`.

## Path Aliases

`@/*` maps to project root (configured in both tsconfig.json and vite.config.ts).

## Styling Conventions

Tailwind-only. Custom scrollbar styles defined in `index.css`. Icons from `lucide-react`. Animations via `motion` library.
