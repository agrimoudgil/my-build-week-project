# How Your Meal Logger Works

This lesson explains the system in plain words. By the end, you should be able to describe how a meal travels through the product, why estimates need review, how the web and WhatsApp paths differ, and where to look when something goes wrong.

## The big idea

Your product turns an informal message such as `2 rotis and a bowl of dal` into a structured meal record.

The important design choice is that understanding and estimating are separate jobs:

1. **Understand the message.** Identify the foods, quantities, units, preparation, meal category, and uncertainty.
2. **Estimate calories.** Match each understood food to a trusted calorie source and calculate a range.
3. **Ask a person to review it.** New results are pending, not automatically treated as final truth.
4. **Save the result.** The web app saves in the browser. WhatsApp saves a private file on the server.

That separation makes the system easier to check. The AI does not invent calorie numbers. It describes the meal in a fixed shape; ordinary code performs the calorie calculation.

## A map of the system

```text
                    MEAL DESCRIPTION
                           |
              +------------+------------+
              |                         |
          Web browser                WhatsApp
              |                         |
      POST /api/parse-meal      POST /api/whatsapp
              |                         |
              +------> understand <-----+
                           |
                 catalog first, then USDA
                           |
                    calorie estimate
                           |
              +------------+------------+
              |                         |
      browser localStorage       private Vercel Blob
              |                         |
         review screen            WhatsApp reply
```

An **API endpoint** is simply a server address that accepts a request. `localStorage` is the browser's built-in private storage for one site. Vercel Blob is online file storage used by the server.

## Follow one meal through the web app

Suppose someone enters `2 rotis and a bowl of dal`.

### 1. The app creates an analyzing record

The React interface immediately creates a meal with the status `analyzing`. This lets the interface react without waiting for the server. The record has an ID, timestamps, the original words, and an empty estimate.

The main screen and its state changes live in `src/App.tsx`.

### 2. The browser asks the server to understand the words

`src/mealApi.ts` sends the description to `/api/parse-meal`. It stops waiting after about nine seconds. If the request fails, takes too long, or returns the wrong shape, the app uses its smaller local parser instead.

This is **graceful fallback**: the best path may fail, but the core feature still has a simpler way to work.

### 3. AI returns facts about the meal, not calories

`api/parse-meal.ts` asks OpenAI for a fixed structure containing food names, quantity, unit, preparation, meal type, confidence, and one clarification question when needed.

The response is checked with Zod. Zod is a library that verifies that incoming data has exactly the kinds of values the program expects. This check matters because even an AI response must be treated as untrusted input.

The server limits the message to 500 characters, allows at most 12 foods, uses an eight-second timeout, disables response storage, and returns safe error codes instead of internal details.

### 4. Code calculates the calories

`src/mealEstimator.ts` first looks for each food in the product's own catalog. If a food is not there and a USDA key is configured, `api/usda.ts` searches USDA FoodData Central.

The estimator multiplies the source calories by the quantity, then creates a minimum and maximum based on uncertainty. It also records its assumption, such as the serving size used. Multiple food estimates are added to form the meal total.

If a food cannot be matched, or if the interpretation has low confidence, the system asks for clarification instead of pretending to know.

### 5. The user reviews the estimate

Back in `src/App.tsx`, the result becomes either:

- `needs_clarification` when more detail is required;
- `awaiting_confirmation` when it is ready to review; or
- `failed` when no useful estimate could be made.

Only `confirmed` meals count toward the day's total. A user can correct, recategorize, delete, or postpone review. Most changes can be undone for 15 seconds. A day cannot be finished while meals still need attention.

### 6. The browser saves the day

The web version stores one record per India calendar date in `localStorage`. It validates saved data before using it and can migrate records from an older format.

This is convenient for a single browser, but it is not a shared account system. Clearing site data or moving to another device means those browser records will not automatically follow.

## Follow one meal through WhatsApp

The WhatsApp route reuses the same understanding and estimating ideas but has different input, security, and storage needs.

### 1. Twilio forwards the message

Twilio, the service connecting WhatsApp to the app, sends a request to `api/whatsapp.ts`. The request may contain text or one image.

The route checks Twilio's signature before doing any work. A **signature** is proof calculated from a shared secret; it helps show that the request really came through Twilio and was not forged.

The exact public request address is part of that check. If the deployed address and Twilio configuration disagree, valid messages can be rejected.

### 2. Text and photos become the same kind of input

Text goes straight to the shared analysis service in `api/meal-service.ts`.

For a photo, the server downloads at most one image, rejects files above 8 MB, and stops slow downloads. OpenAI describes only the visible foods and portions in one sentence. That sentence then enters the same meal-analysis path as typed text.

This is a useful design pattern: convert different inputs into one common form early, then reuse the rest of the system.

### 3. The server analyzes and saves

When an OpenAI key is available, the service tries AI interpretation. If that fails, it uses the local parser. It refuses to save a meal when analysis produces no usable items.

`api/whatsapp-store.ts` changes the phone-number-like sender value into a SHA-256 hash before building the storage path. A **hash** is a one-way fingerprint: the same input gives the same fingerprint, but the original value is not placed in the filename.

The meal is saved as a private JSON file with `awaiting_confirmation` status. JSON is a plain-text format for structured data. The reply shows item names, portions, the estimated calories, the range, and the pending status.

## What is shared, and what is deliberately separate

| Concern | Web | WhatsApp |
|---|---|---|
| Input | Typed description | Text or one photo |
| Interpretation | AI with local fallback | AI with local fallback |
| Estimation | Catalog and optional USDA | Same estimator |
| Review status | Full interactive review | Saved as awaiting review |
| Storage | Browser `localStorage` | Private Vercel Blob file |
| User identity | No account | Hashed sender value |

The two storage systems do not synchronize. A WhatsApp meal does not automatically appear in the current web screen. This is the clearest current product boundary.

## Why the confidence range matters

Food calories are rarely exact from a short description. `one bowl of dal` leaves questions about bowl size, ingredients, and oil. Showing a center estimate plus a range communicates that uncertainty honestly.

Confidence and calorie range are related but different:

- **Confidence** describes how sure the system is about its interpretation.
- **Range** describes how much the calorie value might vary.

A clear food name can still have a wide calorie range when preparation varies.

## Safety and reliability choices already present

- Server inputs have length and item-count limits.
- AI output is checked before use.
- OpenAI and USDA calls have time limits.
- USDA is optional and failures leave foods unresolved.
- WhatsApp requests require a valid Twilio signature.
- Photo count and file size are limited.
- XML reply text is escaped so food names cannot break the response format.
- Sender values are hashed before they enter storage paths.
- Saved Blob files are private.
- Secrets come from environment variables rather than source code.
- The automated suite currently passes all 75 tests across 10 test files.

## The most useful files to know

- `src/App.tsx` — the web experience, meal states, review actions, totals, undo, and browser saving.
- `src/mealApi.ts` — the browser's AI request and local fallback.
- `api/parse-meal.ts` — guarded AI interpretation on the server.
- `src/mealEstimator.ts` — calorie calculations and clarification decisions.
- `src/foodCatalog.ts` — the built-in trusted foods.
- `api/usda.ts` — optional lookup for foods outside the catalog.
- `api/meal-service.ts` — shared text and photo analysis for server features.
- `api/whatsapp.ts` — request checking and WhatsApp conversation flow.
- `api/whatsapp-store.ts` — private server-side meal records.
- Files ending in `.test.ts` or `.test.tsx` — examples of promised behavior written as executable checks.

## Check your understanding

Try answering these without looking above:

1. Why is it safer for AI to identify foods while ordinary code calculates calories?
2. What happens when the AI service is unavailable?
3. Why does a new estimate not immediately count toward the daily total?
4. Why must Twilio's exact public request address be used during signature checking?
5. Why can a WhatsApp meal be saved successfully but still not appear in the web app?

Suggested answers:

1. The numbers come from visible data and repeatable calculations rather than generated guesses.
2. The system tries the local parser; if it still cannot form a useful estimate, it reports failure.
3. It remains pending until a person confirms it.
4. The address is part of the signed data, so a mismatch makes the proof invalid.
5. WhatsApp and the web app currently use separate storage systems with no synchronization.

## Safe experiments

1. Read a successful case in `api/whatsapp.test.ts`, then find the matching branch in `api/whatsapp.ts`.
2. Add a food alias to `src/foodCatalog.ts` and first write a test showing the phrase you want recognized.
3. Change a test's AI response into an invalid shape and observe how the code falls back or rejects it.
4. Trace every possible status from `analyzing` to its next state in `src/App.tsx`.

Run the checks after an experiment with:

```powershell
npm test
```

The central lesson is this: your product is not one AI prompt. It is a guarded chain in which AI interprets, trusted data supplies calories, deterministic code calculates, a person reviews, and separate channels save the result in the place appropriate to them.
