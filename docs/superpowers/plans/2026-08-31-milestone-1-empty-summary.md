# Milestone 1 Empty Summary Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive web page that shows today’s empty calorie summary.

**Architecture:** Use a minimal Vite and React application with one presentational page. Keep the milestone static because logging, storage, targets, history, and AI belong to later milestones.

**Tech Stack:** React, TypeScript, Vite, CSS, Vitest, Testing Library

**Spec:** Approved milestone 1: “I can open the app and see today’s empty calorie summary.”

## Global Constraints

- Build milestone 1 only.
- Do not add logging, AI, Convex, targets, history, or review behavior.
- The page must work at mobile and desktop widths.

---

### Task 1: Create the application foundation and empty summary

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/App.css`
- Create: `src/test/setup.ts`
- Create: `src/App.test.tsx`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`

**Interfaces:**
- Produces: A default `App` React component that renders today’s empty summary.

- [ ] Write a page test that checks the heading, zero-calorie total, and empty-state message.
- [ ] Run the test and confirm it fails before the component exists.
- [ ] Create the Vite entry point and accessible summary markup.
- [ ] Add responsive visual tokens and page styling.
- [ ] Run tests and the production build.
- [ ] Check the page at mobile and desktop widths.

