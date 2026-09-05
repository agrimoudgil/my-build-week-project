# Strict Estimator Result Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every estimate return one fixed, auditable structure and reject input with no recognised food instead of inventing calories.

**Architecture:** `interpretMeal` always returns `{ items, mealTotal, error }`; each item always contains `{ dishName, assumedPortion, calories, confidence }`. The React form saves only results with at least one item and no error, while showing an accessible error for rejected input; browser storage uses a new versioned key and accepts only the fixed structure.

**Tech Stack:** React, TypeScript, Vite, CSS, Vitest, Testing Library

**Spec:** User regression report and the three required inputs from 2026-09-01.

## Global Constraints

- Never return or save an item without a dish name.
- Never use a default calorie value for unrecognised text.
- `mealTotal` must equal the arithmetic sum of item calories.
- Input with no recognised food returns zero items and an error and is not saved.

---

### Task 1: Fixed estimator contract

**Files:**
- Modify: `src/mealParser.ts`
- Modify: `src/mealParser.test.ts`

**Interfaces:**
- Produces: `MealEstimate { items: MealItem[]; mealTotal: number; error: string | null }`.
- Produces: `MealItem { dishName: string; assumedPortion: string; calories: number; confidence: "high" | "low" }`.

- [ ] **Step 1: Rewrite the three required parser tests** to assert the exact fixed structure, item count, arithmetic total, and rejection error.
- [ ] **Step 2: Run parser tests** and confirm the old result shape and 350 kcal fallback fail.
- [ ] **Step 3: Implement the fixed result contract** by discarding unrecognised clauses and returning an error when no recognised items remain.
- [ ] **Step 4: Run parser tests** and confirm all required inputs pass.

### Task 2: Strict save and visible item rows

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `MealEstimate` and saves only successful estimates under `daily-meals-v2`.
- Produces: dish rows that always show name, assumed portion, calories, and confidence; rejected input produces a `role="alert"` message.

- [ ] **Step 1: Add screen tests for all three required inputs** including three distinct rows, one Rajma row, and no saved entry for Agrim.
- [ ] **Step 2: Update form submission and versioned storage validation** to enforce the fixed structure and recompute stored totals.
- [ ] **Step 3: Render every item field and the meal total** and add a restrained error style using existing tokens.
- [ ] **Step 4: Run all tests and the production build.**
- [ ] **Step 5: Start a fresh server and verify the three outputs.**
