# TM-Lingo Next.js 15 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `TM-Lingo` from Vite + Express to a unified Next.js 15 App Router architecture, consolidating frontend client UI, API route handlers, MongoDB persistence, Supabase authentication, and PWA capabilities into a single cohesive codebase.

**Architecture:**
- **App Router (`src/app`)**: Replace Vite SPA with Next.js 15 App Router. Root layout provides font optimization (`next/font/google`), PWA meta/manifest, and global styles. Main page renders the responsive interactive language learning experience (`LessonPlayer`, `StoryReader`, `ParentPanel`, `AdminWorkspace`).
- **Unified API Route Handlers (`src/app/api/v1/`)**: Migrate Express `/api/v1` routes to Next.js Web API Route Handlers using native `Request` and `NextResponse`. Migrate `multer` file uploads to native `request.formData()`.
- **Database & Server Singleton (`server/` / `src/lib/server/`)**: Maintain MongoDB connection caching and Supabase server role verification across serverless/Node runtimes with lazy auto-initialization.
- **Styling & Assets**: Retain Tailwind CSS v4 using `@tailwindcss/postcss` and PostCSS. Keep static PWA icons and service worker in `public/`.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, TypeScript, MongoDB, Supabase, Web Push, Lucide React, Zod.

**Spec:** [TM-Lingo Architecture v1.1](file:///d:/Applications/tm-lingo/docs/TM-Lingo-Architecture-v1.1.md)

---

## Global Constraints

- Preserve 100% of existing API endpoints (`/api/v1/*`) to ensure contract compatibility with `src/shared/apiClient.ts`.
- Retain all audio playback, offline fallback indicators, speech synthesis, and story reading functionalities.
- Support environment variables seamlessly: retain support for both `process.env.NEXT_PUBLIC_*` and fallback `process.env.VITE_*` prefixes so existing `.env` files continue working.
- Ensure strict TypeScript compilation (`pnpm build` / `tsc --noEmit`) without errors.
- Do not introduce breaking database schema or auth contract changes.

## Review Focus

1. **Popup OAuth callback**: `/auth/callback` must continue to post message back to the popup opener window so Supabase Google sign-in works seamlessly.
2. **Media file upload**: `/api/v1/media/upload` must handle multipart form-data via web-standard `request.formData()` without Express `multer`.
3. **Database connection pooling**: MongoDB client must reuse the established connection across API routes rather than reconnecting on every route invocation.
4. **Tailwind CSS v4 compatibility**: `@import "tailwindcss";` in `src/index.css` must compile properly under Next.js and PostCSS.
5. **Client vs Server boundaries**: Interactive components with hooks (`useState`, `useEffect`, `window`) must be marked with `'use client';`.

---

## Task Decomposition

### Task 1: Package Dependencies & Next.js Configuration

**Files:**
- Modify: `package.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Modify: `tsconfig.json`
- Remove: `vite.config.ts`, `server.ts`

- [x] **Step 1.1**: Update `package.json` to install `next`, `@tailwindcss/postcss`, `postcss`, while removing `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-plugin-pwa`, `express`, `@types/express`, `multer`, `@types/multer`.
- [x] **Step 1.2**: Update scripts in `package.json` to:
  - `"dev": "next dev"`
  - `"build": "next build"`
  - `"start": "next start"`
  - `"lint": "tsc --noEmit"`
- [x] **Step 1.3**: Create `next.config.ts` configured for React 19, server actions/route handlers, and environment variable fallbacks.
- [x] **Step 1.4**: Create `postcss.config.mjs` with `@tailwindcss/postcss`.
- [x] **Step 1.5**: Update `tsconfig.json` to include `"next"` plugins and path aliases `@/*` pointing to `./src/*`.
- [x] **Step 1.6**: Run `pnpm install` and verify dependencies resolve cleanly.

---

### Task 2: Server Initialization, Environment, and Auth Adapter

**Files:**
- Modify: `server/config/env.ts`
- Modify: `server/db/mongo.ts`
- Modify: `server/auth/supabaseAuth.ts`
- Modify: `server/modules/storage.ts`

- [x] **Step 2.1**: Update `server/config/env.ts` to read Next.js environment variables, supporting both `NEXT_PUBLIC_*` and `VITE_*` aliases.
- [x] **Step 2.2**: Ensure `server/db/mongo.ts` maintains a cached global connection promise for Next.js hot-reloading and route handlers.
- [x] **Step 2.3**: Update `server/auth/supabaseAuth.ts` to provide a Web API standard `getAuthUserFromRequest(req: Request)` helper that decodes Supabase JWT tokens and fetches user roles.
- [x] **Step 2.4**: Update `server/modules/storage.ts` to ensure memory buffer compatibility with Web API `ArrayBuffer` / `Buffer`.

---

### Task 3: Migrate `/api/v1` to Next.js Route Handlers

**Files:**
- Create: `src/app/api/v1/[...route]/route.ts`

- [x] **Step 3.1**: Create `src/app/api/v1/[...route]/route.ts` handling `GET`, `POST`, `PATCH`, `DELETE`.
- [x] **Step 3.2**: Connect `/api/v1/health`, `/api/v1/auth/me`, `/api/v1/languages`, `/api/v1/voices`.
- [x] **Step 3.3**: Connect `/api/v1/learners`, `/api/v1/learners/:id/preferences`, `/api/v1/packages`, `/api/v1/lessons/:id`, `/api/v1/activities/:id/answer`, `/api/v1/progress`, `/api/v1/lessons/:id/progress`.
- [x] **Step 3.4**: Connect `/api/v1/stories`, `/api/v1/stories/:id`, `/api/v1/stories/:id/position`.
- [x] **Step 3.5**: Connect `/api/v1/media` (GET, POST with `request.formData()`, DELETE).
- [x] **Step 3.6**: Connect `/api/v1/notifications/*` (inbox, vapid-public-key, subscribe, subscriptions, campaigns, send).
- [x] **Step 3.7**: Connect `/api/v1/admin/users` and role management endpoints.
- [x] **Step 3.8**: Ensure MongoDB connection and admin seed are initialized upon API execution.

---

### Task 4: Next.js App Router Shell, Pages, and OAuth Callback

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/auth/callback/page.tsx`
- Create: `src/app/manifest.ts`
- Modify: `src/lib/supabase.ts`
- Modify: `src/firebase.ts`
- Remove: `index.html`, `src/main.tsx`, `src/vite-env.d.ts`

- [x] **Step 4.1**: Create `src/app/layout.tsx` importing Google fonts (`Plus_Jakarta_Sans`, `Bricolage_Grotesque`), metadata, PWA link tags, and `../index.css`.
- [x] **Step 4.2**: Create `src/app/page.tsx` hosting `<App />` client component with Suspense boundary for `useSearchParams`.
- [x] **Step 4.3**: Create `src/app/auth/callback/page.tsx` rendering the OAuth callback window that posts credentials to `window.opener` and closes.
- [x] **Step 4.4**: Update `src/lib/supabase.ts` and `src/firebase.ts` to access `process.env.NEXT_PUBLIC_*` with fallback to `process.env.VITE_*`.
- [x] **Step 4.5**: Add `'use client';` directive to client components that need browser hooks.
- [x] **Step 4.6**: Clean up obsolete Vite-only files (`index.html`, `src/main.tsx`, `src/vite-env.d.ts`).

---

### Task 5: Build Verification and End-to-End Testing

**Files:**
- All project files

- [x] **Step 5.1**: Run TypeScript check (`pnpm lint` or `tsc --noEmit`) and fix any type errors.
- [x] **Step 5.2**: Run `pnpm build` to verify Next.js production build succeeds with all static and dynamic routes compiled.
- [x] **Step 5.3**: Start local server with `pnpm dev` or `pnpm start` and test key endpoints:
  - `GET /api/v1/health`
  - `GET /api/v1/languages`
  - `GET /api/v1/packages`
  - `GET /` (Frontend UI loads with styles and fonts)
- [x] **Step 5.4**: Commit changes with a clean git commit message.
