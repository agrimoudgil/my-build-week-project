# Daily Meal Log V2 P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every estimate reviewable, correctable, recoverable, and explicitly confirmed before it affects the completed India-local day.

**Architecture:** Keep the React/Vite app local-first. Store one versioned record per Asia/Kolkata date containing meals, completion metadata, and the last reversible action; keep parsing and deterministic uncertainty in `mealParser.ts`, and make `App.tsx` the state-transition and presentation boundary.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, localStorage, Vercel

**Spec:** User request dated 2026-09-02 in this conversation.

## Global Constraints

- Preserve the current visual style, React/Vite stack, localStorage persistence, and Vercel project.
- Meal statuses are exactly `analyzing`, `needs_clarification`, `awaiting_confirmation`, `confirmed`, `corrected`, `deleted`, and `failed`.
- Pending meals never affect confirmed totals; deleted meals never appear in either visible list.
- Every estimate uses `calorieEstimate`, `calorieMin`, `calorieMax`, `assumptions`, and `confidence`.
- Dates use `Asia/Kolkata`; modifying a completed day makes it incomplete.
- Do not add photographs, WhatsApp, authentication, recommendations, or historical analytics.

---

### Task 1: Deterministic parser and uncertainty

**Files:** Modify `src/mealParser.ts`; Test `src/mealParser.test.ts`

**Interfaces:** `interpretMeal(input)` returns recognized items, aggregate estimate/range/assumptions/confidence, and at most one clarification with choices.

- [ ] Add regression tests for half/one/one-and-a-half/two bowls, cups, pieces, sizes, handfuls, plates, plurals, and the four required phrases.
- [ ] Add recovery tests for ambiguous rice and mixed thali while preserving the original description.
- [ ] Parse quantities before dish matching, retain every recognized clause, and return one high-impact clarification only when needed.
- [ ] Apply ±12% for explicit quantities, ±20% for named sizes, and ±30% for inferred or preparation-uncertain portions; round bounds to whole kcal.
- [ ] Run `npm test` and `npm run build`.

### Task 2: Versioned India-local day state

**Files:** Modify `src/App.tsx`; Test `src/App.test.tsx`

**Interfaces:** `DayRecord` contains `dateKey`, `meals`, `completedAt`, `lastAction`, and `events`; storage is versioned and date-scoped.

- [ ] Test all seven statuses, migration, refresh, and midnight-safe Asia/Kolkata keys.
- [ ] Persist an `analyzing` meal before interpretation and transition it to clarification, confirmation, or failure.
- [ ] Validate stored data and retain deleted snapshots long enough for persisted undo.
- [ ] Derive confirmed estimate/range and pending count without storing duplicate totals.
- [ ] Run `npm test` and `npm run build`.

### Task 3: Review, correction, deletion, and undo transitions

**Files:** Modify `src/App.tsx`, `src/App.css`; Test `src/App.test.tsx`

**Interfaces:** Confirm, correction, clarification, review-later, edit, delete, and undo are explicit transition handlers; edits to confirmed meals become `corrected` only after reconfirmation.

- [ ] Test draft actions, inline correction, confirmed edit replacement, delete confirmation, timed undo, general undo, and refresh restoration.
- [ ] Render draft cards with dishes, portions, approximate estimate, range, assumptions, confidence, and required actions.
- [ ] Keep the old confirmed amount until an edited estimate is reconfirmed by storing the pending edit separately.
- [ ] Soft-delete records, persist a complete undo snapshot, and restore it after refresh while the undo window is active.
- [ ] Run `npm test` and `npm run build`.

### Task 4: Review Inbox and separated daily log

**Files:** Modify `src/App.tsx`, `src/App.css`; Test `src/App.test.tsx`

**Interfaces:** The inbox shows chronological clarification/confirmation meals and advances after each resolution; the main log never duplicates a meal across sections.

- [ ] Test count copy, filtering, chronology, progression, delete, refresh, and empty state.
- [ ] Add the visible awaiting-review indicator and `Review pending` action near the approximate confirmed total.
- [ ] Render clarification choices, correction, confirmation, and delete within the inbox.
- [ ] Keep confirmed and awaiting-review sections distinct in the main view.
- [ ] Run `npm test` and `npm run build`.

### Task 5: Finish-day workflow and event

**Files:** Modify `src/App.tsx`, `src/App.css`; Test `src/App.test.tsx`

**Interfaces:** Completion requires zero pending meals and an explicit yes; the day stores an ISO timestamp and a `Complete Calorie-Tracked Day` event.

- [ ] Test pending blocking, exact confirmation copy/actions, cancellation, completed summary, event recording, and reopening after mutation.
- [ ] Route blocked completion to the inbox with the unresolved count.
- [ ] Render the explicit completion prompt and completed day summary with estimate and total range.
- [ ] Clear completion whenever a meal is added, edited, confirmed, deleted, or restored.
- [ ] Run `npm test` and `npm run build`.

### Task 6: Acceptance and production deployment

**Files:** No source changes unless verification exposes a defect.

**Interfaces:** The linked Vercel production project serves the checked build.

- [ ] Run the full Vitest suite and TypeScript/Vite production build.
- [ ] Check desktop and mobile layouts plus refresh flows in a real browser when browser tooling is available.
- [ ] Redeploy production, wait for `Ready`, and verify the public alias returns HTTP 200.
