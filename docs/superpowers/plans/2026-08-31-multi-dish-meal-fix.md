# Multi-Dish Meal Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save one typed meal as separate dish line items, each with its assumed portion and calories, plus a summed meal total.

**Architecture:** Replace the flat parser result with a meal containing `items`. Split natural-language input on commas and meal conjunctions, parse explicit decimal portions, estimate each dish independently, and derive the total from those items; migrate old browser records when loading them.

**Tech Stack:** React, TypeScript, Vite, CSS, Vitest, Testing Library

**Spec:** User bug report and fix request from 2026-08-31, especially `1 katori rajma, 1.5 katori rice and 1 katori curd`.

## Global Constraints

- Keep all dishes inside one saved meal entry.
- Show each dish name, assumed portion, and item calories.
- Calculate the meal total by summing item calories.
- Keep old browser entries readable; do not add unrelated milestone features.

---

### Task 1: Structured multi-dish interpretation

**Files:**
- Modify: `src/mealParser.ts`
- Modify: `src/mealParser.test.ts`

**Interfaces:**
- Produces: `MealItem { dishName: string; portion: string; calories: number; uncertain: boolean }`.
- Produces: `MealInterpretation { items: MealItem[]; calories: number; uncertain: boolean }` from `interpretMeal(input)`.

- [ ] **Step 1: Add a failing exact-sentence test** expecting Rajma `1 katori / 180 kcal`, Rice `1.5 katori / 315 kcal`, Curd `1 katori / 100 kcal`, and `595 kcal` total.
- [ ] **Step 2: Run the parser test** and confirm the old flat result fails.
- [ ] **Step 3: Implement clause splitting, decimal portion parsing, dish defaults, and item summing.**
- [ ] **Step 4: Run parser tests** and confirm known, mixed, and unknown meals pass.

### Task 2: Nested meal display and storage migration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/App.test.tsx`

**Interfaces:**
- Consumes: `MealInterpretation.items` and `MealInterpretation.calories`.
- Produces: one meal card containing a semantic list of dish rows and a meal-total footer.

- [ ] **Step 1: Add a failing screen test** that submits the exact sentence and checks all three names, portions, item calories, and the `595 kcal` meal total.
- [ ] **Step 2: Update entry loading** to validate new entries and wrap old flat entries in one `1 serving` item.
- [ ] **Step 3: Render item rows and a derived total** with the current visual tokens and compact hierarchy.
- [ ] **Step 4: Run all tests and the production build.**
- [ ] **Step 5: Submit the exact sentence in the running app and visually verify the result.**
