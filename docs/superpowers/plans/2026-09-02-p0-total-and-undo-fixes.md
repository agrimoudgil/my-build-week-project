# P0 Derived Totals and Undo Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix stale confirmed totals during correction and complete the persisted edit, delete, undo, review, and finish-day paths without redesigning the app.

**Architecture:** Keep the versioned Asia/Kolkata localStorage day record. Use each meal's current `status` as the only inclusion rule for all derived totals; correction updates the existing record and sets it to `awaiting_confirmation`, while deletion keeps a hidden soft-deleted record and undo restores the exact pre-action collection.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, localStorage

**Spec:** User request dated 2026-09-02 in this conversation.

## Global Constraints

- Preserve the current UI styling, responsive layout, React/Vite stack, Asia/Kolkata date handling, and existing local data where valid.
- Only `status === "confirmed"` contributes to confirmed estimate, range, meal count, or completed summary.
- Do not hard-code totals or duplicate meals during correction.
- Keep new-meal review, review-later, inbox, clarification, and day completion behavior.
- Use inline delete confirmation, persisted undo, and one meaningful accessible status per action.

---

### Task 1: Regression and acceptance coverage

**Files:** Modify `src/App.test.tsx`, `src/mealParser.test.ts`

**Interfaces:** Tests read the date-scoped day record and exercise controls through accessible names.

- [ ] Add the exact 18-step acceptance test using `2 idlis with sambar`, `half bowl rice`, corrected idlis, delete/undo, completion/refresh, mixed thali, and two-cup chai.
- [ ] Assert estimate, minimum, and maximum all exclude the edited pending meal.
- [ ] Assert correction preserves the ID and creates no duplicate record.
- [ ] Assert pending and confirmed deletion restore the original state and order after refresh.
- [ ] Assert each action exposes only its concise user-facing status.

### Task 2: Current-state totals and correction

**Files:** Modify `src/App.tsx`

**Interfaces:** `confirmedMeals = meals.filter(meal => meal.status === "confirmed")`; recalculation replaces the same entry with the new estimate and `awaiting_confirmation`.

- [ ] Normalize stored `corrected` meals to `confirmed`, and stored `pendingEdit` data to one pending updated meal.
- [ ] Remove `pendingEdit` from new transitions and calculate estimate/range/count from current confirmed meals only.
- [ ] Reopen completed days when recalculation changes a meal to pending.
- [ ] Confirm a corrected pending meal by changing that same record back to `confirmed`.

### Task 3: Inline deletion, undo, and messages

**Files:** Modify `src/App.tsx`, `src/App.css`

**Interfaces:** `deleteCandidateId` controls an inline confirmation row; `lastAction.meals` holds the exact prior ordered array.

- [ ] Replace `window.confirm` with inline `Delete meal` and `Keep meal` actions.
- [ ] Soft-delete confirmed or pending records and immediately derive new totals/counts.
- [ ] Restore the exact snapshot on `Undo`, including IDs, fields, state, and ordering after refresh.
- [ ] Give add, confirm, defer, recalculate, delete, undo, clarification, and completion one concise accessible status.

### Task 4: Chai assumptions and final verification

**Files:** Modify `src/mealParser.ts`, `src/mealParser.test.ts`

**Interfaces:** Tea assumptions state the per-cup assumed milk and sugar amounts and scale the estimate by parsed cup count.

- [ ] Replace “regular preparation” for chai with `100 ml milk and 2 teaspoons sugar per cup`.
- [ ] Run the unit tests, TypeScript compiler, production build, and any configured lint command.
- [ ] Serve the production output locally and verify the built app shell.
- [ ] Package and locally serve the production build after the exact acceptance test and all checks pass.
