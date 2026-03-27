# Antigravity Sprint 2B Changelog

## Context
This document tracks the technical resolutions made by Antigravity during the Sprint 2B backend orchestration migration for the OmniNauka MVP.

## Resolved Technical Debt & Integrations

**1. True AI / OCR Pipeline Backend (Supabase Edge Functions)**
- **Problem**: Analysis was completely mocked inside the frontend via `setTimeout` and hardcoded static arrays.
- **Solution**: 
  - Wrote a secure Deno-based Supabase Edge Function under `supabase/functions/analyze-notes/index.ts`.
  - Downloads user-uploaded binaries natively from the private Supabase Storage `study-materials` bucket using valid internal `study_sessions` row paths. (Zero public URIs).
  - Evaluates extracted JSON against Google Cloud Vision API mapped to strict Open AI prompts (`gpt-4o-mini`).
  - Automatically updates the PostgreSQL `study_sessions` JSONB tables ensuring synchronization between AI results and active application models.

**2. Frontend Polling Lifecycle (`AnalysisPage.tsx`)**
- **Problem**: Frontend relied on raw browser storage timeout loops.
- **Solution**: 
  - Explicitly invokes `supabase.functions.invoke('analyze-notes')`.
  - Only fetches fresh structured payloads explicitly queried out of PostgreSQL on success.
  - Dynamically synthesizes front-end `UUID` elements inside React mapping logic to reduce redundant string generations over Open AI.
  - Maintains `demo-session` hard-coded sandbox traps for external reviewers.

## New Architecture Stack Requirements
Running this architecture fully requires the following server-side environment configurations within the Supabase Dashboard:
- `GOOGLE_VISION_API_KEY`
- `OPENAI_API_KEY`

## Upcoming Scope (Sprint 2C)
1. Delete hardcoded Dashboard / Recent Arrays and swap exclusively to `supabase.from('study_sessions').select('*')` loops.
2. Hook up Vercel AI SDK to OpenAI for the interactive AI Tutor chat `LessonPage.tsx`.
