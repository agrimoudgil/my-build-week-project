# Twilio WhatsApp Sandbox Webhook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a signed `/api/whatsapp` Twilio webhook that analyzes one text meal or one meal photo, saves a pending meal for the sender, and replies with concise TwiML.

**Architecture:** Keep the React interface unchanged. Put webhook orchestration behind injected analysis and storage functions for focused tests; reuse the current local parser and deterministic estimate shape, and use the existing OpenAI server client only to interpret text or describe an image. Store WhatsApp records separately in Vercel Blob, keyed by a one-way hash of `From`, because browser localStorage is unavailable to server functions.

**Tech Stack:** Vercel Functions, TypeScript, Twilio Node helper, OpenAI Responses API, Vercel Blob, Vitest.

**Spec:** User request in the 2026-09-03 conversation turn.

## Global Constraints

- Do not change the web interface or its browser records and flows.
- Verify every request with `TWILIO_AUTH_TOKEN` and the exact public request URL.
- Accept only form-encoded POST input, at most one image, and never log request data or secrets.
- Do not invent macros because the existing estimator has no macro model.
- Do not deploy or push.

---

### Task 1: Shared server meal analysis

**Files:**
- Create: `api/meal-service.ts`
- Modify: `api/parse-meal.ts`
- Test: `api/meal-service.test.ts`

**Interfaces:**
- Consumes: `parseMealOnServer(text)` and `interpretMeal(text)`.
- Produces: `analyzeServerMeal(input): Promise<MealAnalysis>` and `describeMealPhoto(media): Promise<string>`.

- [ ] Write tests for text success, local fallback, photo description, and analysis failure.
- [ ] Extract/reuse server-safe analysis without changing the estimator.
- [ ] Run the focused service tests.

### Task 2: WhatsApp record storage

**Files:**
- Create: `api/whatsapp-store.ts`
- Test: `api/whatsapp-store.test.ts`

**Interfaces:**
- Consumes: sender `From` and current `MealEstimate`.
- Produces: `saveWhatsAppMeal(from, analyzedMeal)` with an injected Blob writer for tests.

- [ ] Test complete pending-meal serialization, stable hashed user key, and storage failure.
- [ ] Implement private Blob storage using `BLOB_READ_WRITE_TOKEN`.
- [ ] Run storage tests.

### Task 3: Signed Twilio webhook

**Files:**
- Create: `api/whatsapp.ts`
- Test: `api/whatsapp.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: form fields `From`, `Body`, `NumMedia`, `MediaUrl0`, `MediaContentType0`; `X-Twilio-Signature`; analysis and save functions.
- Produces: XML TwiML response and `handleWhatsAppWebhook` test seam.

- [ ] Test invalid signature, empty input, text input, image input, analysis failure, storage failure, and successful TwiML.
- [ ] Validate the exact request URL and form parameters with the Twilio helper.
- [ ] Download one image with a timeout and size limit, analyze it, save one pending record, and escape XML output.
- [ ] Add only the required environment variable names to `.env.example`.
- [ ] Run webhook tests and the production build.
