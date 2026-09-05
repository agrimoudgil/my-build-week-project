# AI Meal Parsing Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure AI-first meal interpretation, deterministic catalogue calories, meal-time categories, compact estimate details, and accessible saved-meal menus without breaking the P0 workflow.

**Architecture:** A Vercel `/api/parse-meal` function calls the OpenAI Responses API with Structured Outputs and optionally enriches unmatched generic foods through USDA. The browser validates the response, derives calories from the local catalogue or server-provided USDA matches, and falls back to the current deterministic parser on any unavailable, invalid, or timed-out AI request. Date-scoped localStorage remains the source of persisted meal/day state.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Vercel Functions, OpenAI SDK, Zod, localStorage

**Spec:** User request dated 2026-09-02 in this conversation.

## Global Constraints

- Preserve all 7/7 P0 behaviors and the current rice-paper, leaf-green, Fraunces/Manrope, soft-shadow responsive design.
- Never expose or log `OPENAI_API_KEY`, `USDA_API_KEY`, or meal descriptions.
- Use `OPENAI_MODEL` with `gpt-5.6-luna` as the default and set `store: false`.
- AI interprets items only; calorie estimates remain deterministic.
- Keep the existing local parser as the failure/unconfigured fallback.
- Keep Asia/Kolkata date handling and safely migrate existing V3 meals using `createdAt`.

---

### Task 1: Shared interpretation and catalogue model

**Files:** Create `src/aiMealTypes.ts`, `src/foodCatalog.ts`, `src/mealEstimator.ts`; Modify `src/mealParser.ts`; Test `src/mealParser.test.ts`, `src/mealEstimator.test.ts`

**Interfaces:** `ParsedMeal` contains schema fields only; `estimateParsedMeal(parsed, usdaMatches)` returns the existing `MealEstimate`; `interpretMeal` remains the synchronous fallback.

- [ ] Define a strict runtime validator for canonical/display names, positive quantity, unit, preparation, confidence, meal type, and one nullable clarification question.
- [ ] Move curated food values and aliases into a shared catalogue and add noodles, instant noodles, Hakka noodles, cold coffee, coffee, and `sambhar`.
- [ ] Match aliases without mapping unknown items to unrelated entries.
- [ ] Convert parsed quantities/units to deterministic estimates and retain portions, confidence, ranges, and human-readable assumptions.
- [ ] Add fallback regressions for idli/sambhar, noodles, cold coffee, mixed thali, half rice, and two-cup chai.

### Task 2: Secure AI and USDA server function

**Files:** Create `api/parse-meal.ts`, `api/usda.ts`, `api/parse-meal.test.ts`, `tsconfig.api.json`, `.env.example`; Modify `tsconfig.json`, `package.json`, `package-lock.json`

**Interfaces:** `POST /api/parse-meal` accepts `{ text }` up to 500 characters and returns `{ parsed, usdaMatches }`; unconfigured or failed requests return a safe non-sensitive error.

- [ ] Install the official `openai` SDK, `zod`, and Vercel request types.
- [ ] Call `responses.parse` with a Zod Structured Output schema, `store: false`, the configured/default model, no retries, and an eight-second timeout.
- [ ] Reject non-POST, missing, oversized, and invalid inputs without logging their contents.
- [ ] Look up unmatched generic items through USDA only when configured, cache successful normalized matches in memory, and never return the key.
- [ ] Mock AI success, invalid schema, timeout/error, missing configuration, validation, and USDA fallback in server tests.

### Task 3: AI-first browser integration and storage migration

**Files:** Create `src/mealApi.ts`; Modify `src/App.tsx`; Test `src/mealApi.test.ts`, `src/App.test.tsx`

**Interfaces:** `analyzeMealText(text, fetcher)` returns an estimate plus meal type/source; production calls the endpoint and tests/local failures use `interpretMeal`.

- [ ] Add input timeout and response validation on the browser boundary.
- [ ] Persist `mealType` on every meal and migrate V3 records from their Asia/Kolkata creation time.
- [ ] Auto-suggest Breakfast 05:00–10:59, Lunch 11:00–15:59, Snack 16:00–18:59, Dinner 19:00–04:59.
- [ ] Keep one analyzing record, replace it in place after parsing, and preserve every P0 status/total transition.
- [ ] Test AI success, invalid response, network failure, disabled configuration behavior, and refresh persistence.

### Task 4: Compact review and grouped saved-meal UI

**Files:** Create `src/MealOptionsMenu.tsx`, `src/MealOptionsMenu.test.tsx`; Modify `src/App.tsx`, `src/App.css`; Test `src/App.test.tsx`

**Interfaces:** Immediate review retains visible Confirm/Edit/Review later; confirmed saved cards use `MealOptionsMenu`; meal type is editable through an accessible control.

- [ ] Replace all user-facing `Correct` copy with `Edit`.
- [ ] Hide the redundant subtotal for one item and show combined total only for multiple items.
- [ ] Replace the assumptions panel with collapsed `How this was estimated` details when assumptions exist.
- [ ] Add the accessible three-dot menu with exact aria label, ArrowUp/ArrowDown/Home/End, Escape, outside click, and trigger focus restoration.
- [ ] Group confirmed meals under Breakfast, Lunch, Snacks, and Dinner while retaining pending review separation.
- [ ] Preserve inline delete confirmation and exact persisted Undo behavior.

### Task 5: Regression, acceptance, and packaging

**Files:** Modify tests only if verification exposes a missing assertion.

**Interfaces:** The existing P0 suite and the new 18-step acceptance test both pass against the same app.

- [ ] Run all tests and the named P0/AI acceptance flows.
- [ ] Run every configured lint command, standalone TypeScript checks for browser and API code, and `npm run build`.
- [ ] Scan the production bundle for secrets and confirm keys appear only as server environment reads.
- [ ] Serve the built app locally and verify HTTP 200 plus the expected bundle.
