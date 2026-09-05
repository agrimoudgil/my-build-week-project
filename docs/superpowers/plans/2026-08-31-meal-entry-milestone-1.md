# Meal Entry Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person describe a meal in plain words and immediately see a saved dish name, calorie estimate, and uncertainty marker when the estimate is weak.

**Architecture:** Keep the feature entirely in the existing React client. A small pure parser maps common dish words and quantities to calorie estimates, while the app owns form state and versioned browser storage so entries survive reloads.

**Tech Stack:** React, TypeScript, Vite, CSS, Vitest, Testing Library

**Spec:** User-approved milestone 1 in the 2026-08-31 request; this replaces the outdated static-empty-summary milestone in `docs/superpowers/plans/2026-08-31-milestone-1-empty-summary.md`.

## Global Constraints

- Build only plain-language meal entry, detected dish name, calorie number, saving on screen, and a small uncertainty marker.
- Do not add a review inbox, calorie target, WhatsApp, authentication, backend, or unrelated navigation.
- Keep the page usable at mobile and desktop widths.

---

### Task 1: Meal interpretation

**Files:**
- Create: `src/mealParser.ts`
- Create: `src/mealParser.test.ts`

**Interfaces:**
- Produces: `interpretMeal(input: string): MealInterpretation`, where `MealInterpretation` contains `dishName`, `calories`, and `uncertain`.

- [ ] **Step 1: Write failing parser tests** for a known dish, quantity, mixed meal, and unknown meal.
- [ ] **Step 2: Run `npm test -- src/mealParser.test.ts`** and confirm the missing module failure.
- [ ] **Step 3: Implement a bounded built-in dish catalog and quantity parser** with a safe generic fallback.
- [ ] **Step 4: Run `npm test -- src/mealParser.test.ts`** and confirm all parser tests pass.

### Task 2: Logging interface and browser storage

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `interpretMeal(input: string): MealInterpretation`.
- Produces: an accessible meal form and a versioned `localStorage` entry list under `daily-meals-v1`.

- [ ] **Step 1: Replace the static page test** with tests for saving a known meal, showing the uncertainty marker, and restoring stored meals.
- [ ] **Step 2: Run `npm test -- src/App.test.tsx`** and confirm the interaction tests fail.
- [ ] **Step 3: Build the form, live total, entry list, empty state, and storage handling** with native form controls.
- [ ] **Step 4: Extend the existing visual language** so the input leads and saved entries remain easy to scan on mobile.
- [ ] **Step 5: Run `npm test` and `npm run build`** and fix every failure.
- [ ] **Step 6: Start Vite and inspect desktop and mobile screenshots** before handing over the local URL.
