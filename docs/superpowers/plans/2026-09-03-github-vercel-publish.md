# GitHub and Vercel Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the complete meal-log project to a new GitHub repository, connect that repository to the existing Vercel project, and prove the connection with a small deployed change.

**Architecture:** Initialize Git in the existing project while preserving ignored local and secret files, create a GitHub repository under the authenticated account, and push the source. Connect the existing Vercel project to that GitHub repository, then add a small visible footer change, push it, deploy it, and verify the live response.

**Tech Stack:** Git, GitHub CLI, Vercel CLI/API, React, Vite, Vitest.

**Spec:** User request in the current conversation.

## Global Constraints

- Do not commit `.vercel`, `node_modules`, build output, credentials, or populated environment files.
- Use the existing Vercel project `my-build-week-project` with ID `prj_57PbtTa4cVfgfPFwtfUZFi5CkucQ`.
- Preserve all existing project files and behavior.
- Run tests and a production build before publishing the proof change.
- Report the GitHub repository URL and verified deployment URL.

---

### Task 1: Prepare and publish the repository

**Files:**
- Modify: `.gitignore`
- Track: all project source, tests, documentation, and configuration not excluded by `.gitignore`

**Interfaces:**
- Consumes: the current local project and authenticated GitHub account `agrimoudgil`.
- Produces: a GitHub repository with `main` as its pushed default branch.

- [ ] **Step 1: Audit ignored and untracked files**

Run `git check-ignore -v .vercel node_modules dist .env 2>$null` after initialization and inspect `git status --short --ignored` before staging.

- [ ] **Step 2: Add standard generated-file exclusions**

Ensure `.gitignore` contains `.vercel`, `node_modules`, `dist`, `.env`, `*.tsbuildinfo`, generated `vite.config.js`, and generated `vite.config.d.ts`, while retaining `.env.example`.

- [ ] **Step 3: Verify the application**

Run `npm test` and `npm run build`. Expected: all tests pass and Vite completes a production build.

- [ ] **Step 4: Create the first commit**

Initialize Git with `main`, stage only audited files, and commit with `chore: publish meal log project`.

- [ ] **Step 5: Create and push GitHub repository**

Create a repository under `agrimoudgil` using the project name when available, add it as `origin`, push `main`, and confirm the remote URL with `gh repo view --json url`.

### Task 2: Connect GitHub to Vercel

**Files:**
- Read only: `.vercel/project.json`

**Interfaces:**
- Consumes: the GitHub repository URL and existing Vercel project identifiers.
- Produces: Vercel project metadata whose Git repository points to the new GitHub repository.

- [ ] **Step 1: Inspect current Vercel project access**

Confirm the authenticated Vercel identity and retrieve the existing project using the CLI or Vercel API.

- [ ] **Step 2: Connect the repository**

Use Vercel's supported Git connection command or project API to associate the GitHub repository with `my-build-week-project`.

- [ ] **Step 3: Verify project metadata**

Retrieve the project again and confirm its Git provider is GitHub and its repository name matches the new repository.

### Task 3: Prove push-to-deploy with a small change

**Files:**
- Modify: `src/App.tsx` or the smallest suitable visible UI file
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: the linked GitHub and Vercel projects.
- Produces: a visible, tested text change present in GitHub and in a successful Vercel production deployment.

- [ ] **Step 1: Add a focused failing test**

Add one assertion for a short, harmless footer or helper phrase, then run the focused test and confirm it fails because the phrase is absent.

- [ ] **Step 2: Add the smallest UI change**

Render exactly the tested phrase without changing meal behavior or layout structure beyond the new text.

- [ ] **Step 3: Verify locally**

Run the focused test, the full `npm test` suite, and `npm run build`. Expected: all commands pass.

- [ ] **Step 4: Commit and push**

Commit with `chore: add deployment proof` and push `main` to GitHub.

- [ ] **Step 5: Deploy and verify**

Wait for or trigger the production deployment, confirm it reaches a ready state for the pushed commit, and request the public page to verify the proof phrase appears in the deployed output.

- [ ] **Step 6: Report evidence**

Return the GitHub repository URL, production deployment URL, pushed commit identifier, and the observed proof phrase.
