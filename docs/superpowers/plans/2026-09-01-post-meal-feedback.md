# Post-meal Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show one grounded feedback line beneath each newly saved meal.

**Architecture:** A pure helper generates feedback from the saved meal list and running calorie total. The save handler stores that feedback with the new entry, and the existing meal card renders it beneath the meal total.

**Tech Stack:** React, TypeScript, Vitest, Testing Library

**Spec:** User request in the current conversation.

## Global Constraints

- Reference actual logged dishes and the running total.
- Use no more than two sentences.
- Give no advice unless supported by the log.
- Do not change the input box, layout, or add chat.

---

### Task 1: Grounded feedback generator

**Files:**
- Create: `src/mealFeedback.ts`
- Create: `src/mealFeedback.test.ts`

**Interfaces:**
- Consumes: saved meals with `items` and `mealTotal`
- Produces: `generateMealFeedback(meals): string`

- [ ] **Step 1: Write a failing test**

```ts
expect(generateMealFeedback([teaMeal])).toBe(
  "That takes you to 90 kcal today. The tea accounts for all of it.",
);
```

- [ ] **Step 2: Run the focused test and confirm it fails because the helper is absent**

Run: `npm test -- src/mealFeedback.test.ts`

- [ ] **Step 3: Implement the pure generator**

Calculate the running total from every supplied meal, find the highest-calorie dish, and name it in a factual second sentence.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `npm test -- src/mealFeedback.test.ts`

### Task 2: Save and render feedback

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `generateMealFeedback(meals)`
- Produces: persisted `feedback` on each new `MealEntry`

- [ ] **Step 1: Add an app test that submits `1 cup tea`**

```tsx
submitMeal("1 cup tea");
expect(screen.getByText("That takes you to 90 kcal today. The tea accounts for all of it.")).toBeInTheDocument();
```

- [ ] **Step 2: Run the app test and confirm the feedback is missing**

Run: `npm test -- src/App.test.tsx`

- [ ] **Step 3: Generate feedback during save and render one paragraph under the entry**

Store the generated text with the new entry so older entries keep the total that was current when they were saved.

- [ ] **Step 4: Add only text styling**

Use existing colors and spacing without changing the input or page structure.

- [ ] **Step 5: Run all tests and the production build**

Run: `npm test` and `npm run build`
