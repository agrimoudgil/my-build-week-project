import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Clarification, Confidence, interpretMeal, MealEstimate, MealItem } from "./mealParser";
import { analyzeMealLocally, analyzeMealText, type MealAnalysis } from "./mealApi";
import { MEAL_TYPE_LABELS, suggestMealType, type MealType } from "./aiMealTypes";
import MealOptionsMenu from "./MealOptionsMenu";

export type MealStatus = "analyzing" | "needs_clarification" | "awaiting_confirmation" | "confirmed" | "corrected" | "deleted" | "failed";
type EstimateFields = Pick<MealEstimate, "items" | "calorieEstimate" | "calorieMin" | "calorieMax" | "assumptions" | "confidence">;
type MealEntry = EstimateFields & {
  id: string;
  originalDescription: string;
  description: string;
  status: MealStatus;
  createdAt: string;
  updatedAt: string;
  clarificationAsked: boolean;
  clarification: Clarification | null;
  mealType: MealType;
};
type UndoAction = { label: string; meals: MealEntry[]; expiresAt: number };
type DayEvent = { name: "Complete Calorie-Tracked Day"; at: string };
type DayRecord = { version: 3; dateKey: string; meals: MealEntry[]; completedAt: string | null; lastAction: UndoAction | null; events: DayEvent[] };

const STORAGE_PREFIX = "daily-meals-v3:";
const LEGACY_KEY = "daily-meals-v2";
const EMPTY_ESTIMATE: EstimateFields = { items: [], calorieEstimate: 0, calorieMin: 0, calorieMax: 0, assumptions: [], confidence: "low" };
const PENDING_STATUSES: MealStatus[] = ["needs_clarification", "awaiting_confirmation"];
const UNDO_MS = 15_000;

export function getIndiaDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

const storageKey = (dateKey: string) => `${STORAGE_PREFIX}${dateKey}`;
const formatToday = () => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(new Date());
const isConfidence = (value: unknown): value is Confidence => value === "high" || value === "medium" || value === "low";

function isMealItem(value: unknown): value is MealItem {
  const item = value as Partial<MealItem> | null;
  return Boolean(item && typeof item.dishName === "string" && typeof item.portion === "string" &&
    Number.isFinite(item.calorieEstimate) && Number.isFinite(item.calorieMin) && Number.isFinite(item.calorieMax) &&
    typeof item.assumption === "string" && isConfidence(item.confidence));
}

function isMealEntry(value: unknown): value is MealEntry {
  const meal = value as Partial<MealEntry> | null;
  const statuses: MealStatus[] = ["analyzing", "needs_clarification", "awaiting_confirmation", "confirmed", "corrected", "deleted", "failed"];
  return Boolean(meal && typeof meal.id === "string" && typeof meal.originalDescription === "string" && typeof meal.description === "string" &&
    typeof meal.createdAt === "string" && typeof meal.updatedAt === "string" && typeof meal.clarificationAsked === "boolean" &&
    statuses.includes(meal.status as MealStatus) && Array.isArray(meal.items) && meal.items.every(isMealItem) &&
    Number.isFinite(meal.calorieEstimate) && Number.isFinite(meal.calorieMin) && Number.isFinite(meal.calorieMax) &&
    Array.isArray(meal.assumptions) && meal.assumptions.every((item) => typeof item === "string") && isConfidence(meal.confidence));
}

type StoredMealEntry = Omit<MealEntry, "mealType"> & { mealType?: MealType; pendingEdit?: EstimateFields & { description: string } };

function normalizeStoredMeal(meal: StoredMealEntry): MealEntry {
  if (meal.pendingEdit) {
    const { pendingEdit, ...current } = meal;
    return { ...current, ...pendingEdit, description: pendingEdit.description, status: "awaiting_confirmation", clarification: null, mealType: meal.mealType ?? suggestMealType(new Date(meal.createdAt)) };
  }
  return { ...meal, status: meal.status === "corrected" ? "confirmed" : meal.status, mealType: meal.mealType ?? suggestMealType(new Date(meal.createdAt)) };
}

function migrateLegacy(dateKey: string): DayRecord | null {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null");
    if (!Array.isArray(legacy) || !legacy.length) return null;
    const now = new Date().toISOString();
    const meals: MealEntry[] = legacy.flatMap((old, index) => {
      if (!old || !Array.isArray(old.items)) return [];
      const items: MealItem[] = old.items.flatMap((item: Record<string, unknown>) => {
        if (typeof item.dishName !== "string" || !Number.isFinite(item.calories)) return [];
        const estimate = Number(item.calories);
        const range = item.calorieRange as { min?: number; max?: number } | undefined;
        return [{
          dishName: item.dishName,
          portion: String(item.assumedPortion ?? "1 serving"),
          calorieEstimate: estimate,
          calorieMin: Number(range?.min ?? Math.round(estimate * .7)),
          calorieMax: Number(range?.max ?? Math.round(estimate * 1.3)),
          assumption: String(item.assumption ?? `Assumes ${item.assumedPortion ?? "1 serving"}.`),
          confidence: item.confidence === "high" ? "high" : "low",
        }];
      });
      if (!items.length) return [];
      const description = items.map((item) => `${item.portion} ${item.dishName}`).join(", ");
      return [{
        id: String(old.id ?? `legacy-${index}`), originalDescription: description, description,
        status: old.status === "CONFIRMED" ? "confirmed" : "awaiting_confirmation",
        createdAt: now, updatedAt: now, clarificationAsked: false, clarification: null, mealType: suggestMealType(new Date(now)),
        items, calorieEstimate: items.reduce((sum, item) => sum + item.calorieEstimate, 0),
        calorieMin: items.reduce((sum, item) => sum + item.calorieMin, 0),
        calorieMax: items.reduce((sum, item) => sum + item.calorieMax, 0),
        assumptions: items.map((item) => item.assumption), confidence: "low",
      } satisfies MealEntry];
    });
    return meals.length ? { version: 3, dateKey, meals, completedAt: null, lastAction: null, events: [] } : null;
  } catch { return null; }
}

function loadDay(dateKey: string): DayRecord {
  const empty: DayRecord = { version: 3, dateKey, meals: [], completedAt: null, lastAction: null, events: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(dateKey)) ?? "null") as Partial<DayRecord> | null;
    if (parsed?.version === 3 && parsed.dateKey === dateKey && Array.isArray(parsed.meals) && parsed.meals.every(isMealEntry)) {
      const meals = parsed.meals.map((meal) => normalizeStoredMeal(meal as StoredMealEntry));
      const normalized = { ...empty, ...parsed, meals, events: Array.isArray(parsed.events) ? parsed.events : [] };
      if (JSON.stringify(meals) !== JSON.stringify(parsed.meals)) localStorage.setItem(storageKey(dateKey), JSON.stringify(normalized));
      return normalized;
    }
  } catch { /* fall through to migration */ }
  const migrated = migrateLegacy(dateKey);
  if (migrated) localStorage.setItem(storageKey(dateKey), JSON.stringify(migrated));
  return migrated ?? empty;
}

function BowlMark() {
  return <svg aria-hidden="true" className="bowl-mark" viewBox="0 0 40 40"><path d="M8 18h24c0 8-4.8 13-12 13S8 26 8 18Z" /><path d="M13 14c1.2-3 3.5-5 7-5 2.6 0 4.7 1.1 6.2 3" /><path d="M14 32h12" /></svg>;
}

export default function App() {
  const dateKey = getIndiaDateKey();
  const [day, setDay] = useState<DayRecord>(() => loadDay(dateKey));
  const dayRef = useRef(day);
  const [mealText, setMealText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [reviewMode, setReviewMode] = useState(false);
  const [finishPrompt, setFinishPrompt] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [, setClock] = useState(Date.now());

  useEffect(() => {
    if (!day.lastAction) return;
    const delay = Math.max(0, day.lastAction.expiresAt - Date.now());
    const timer = window.setTimeout(() => setClock(Date.now()), delay + 10);
    return () => window.clearTimeout(timer);
  }, [day.lastAction]);

  const visibleMeals = day.meals.filter((meal) => meal.status !== "deleted" && meal.status !== "failed" && meal.status !== "analyzing");
  const pendingMeals = useMemo(() => [...day.meals
    .filter((meal) => PENDING_STATUSES.includes(meal.status))]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [day.meals]);
  const confirmedMeals = visibleMeals.filter((meal) => meal.status === "confirmed");
  const totals = confirmedMeals.reduce((sum, meal) => ({ estimate: sum.estimate + meal.calorieEstimate, min: sum.min + meal.calorieMin, max: sum.max + meal.calorieMax }), { estimate: 0, min: 0, max: 0 });
  const activeDraft = day.meals.find((meal) => meal.id === activeDraftId) ?? null;
  const undoAvailable = Boolean(day.lastAction && day.lastAction.expiresAt > Date.now());

  function persist(next: DayRecord) {
    dayRef.current = next;
    setDay(next);
    localStorage.setItem(storageKey(dateKey), JSON.stringify(next));
  }

  function changeMeals(nextMeals: MealEntry[], label: string, withUndo = true) {
    persist({ ...day, meals: nextMeals, completedAt: null, lastAction: withUndo ? { label, meals: day.meals, expiresAt: Date.now() + UNDO_MS } : day.lastAction });
    setFinishPrompt(false);
  }

  function analyzeDescription(estimate: MealEstimate): { status: MealStatus; estimate: MealEstimate } {
    if (estimate.clarification) return { status: "needs_clarification", estimate };
    if (estimate.error || !estimate.items.length) return { status: "failed", estimate };
    return { status: "awaiting_confirmation", estimate };
  }

  function runAnalysis(description: string, createdAt: string, onComplete: (analysis: MealAnalysis) => void) {
    if (import.meta.env.MODE === "test") {
      onComplete(analyzeMealLocally(description, new Date(createdAt)));
      return;
    }
    void analyzeMealText(description, { aiEnabled: true, now: new Date(createdAt) }).then(onComplete);
  }

  function addMeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const description = mealText.trim();
    if (!description) return;
    const now = new Date().toISOString();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const analyzing: MealEntry = { id, originalDescription: description, description, status: "analyzing", createdAt: now, updatedAt: now, clarificationAsked: false, clarification: null, mealType: suggestMealType(new Date(now)), ...EMPTY_ESTIMATE };
    const analyzingDay = { ...day, meals: [...day.meals, analyzing], completedAt: null };
    persist(analyzingDay);
    setMealText("");
    runAnalysis(description, now, (analysis) => {
      const result = analyzeDescription(analysis.estimate);
      const resolved: MealEntry = { ...analyzing, ...result.estimate, mealType: analysis.mealType, status: result.status, clarification: result.estimate.clarification, clarificationAsked: Boolean(result.estimate.clarification), updatedAt: new Date().toISOString() };
      const current = dayRef.current;
      const next = { ...current, meals: current.meals.map((meal) => meal.id === id ? resolved : meal), lastAction: { label: "meal added", meals: day.meals, expiresAt: Date.now() + UNDO_MS } };
      persist(next);
      if (result.status === "failed") {
        setFormError(result.estimate.error);
        setActiveDraftId(null);
      } else {
        setFormError(null);
        setActiveDraftId(id);
        setNotice("Meal added for review.");
      }
    });
  }

  function confirmMeal(meal: MealEntry) {
    const now = new Date().toISOString();
    const next = day.meals.map((candidate) => {
      if (candidate.id !== meal.id) return candidate;
      return { ...candidate, status: "confirmed" as const, updatedAt: now };
    });
    changeMeals(next, "confirmation");
    setActiveDraftId(null);
    setEditingMealId(null);
    setNotice("Meal confirmed.");
  }

  function reviewLater() {
    setActiveDraftId(null);
    setEditingMealId(null);
    setNotice("Saved for review later.");
  }

  function startCorrection(meal: MealEntry) {
    setEditingMealId(meal.id);
    setEditText(meal.description);
    setFormError(null);
  }

  function saveCorrection(event: FormEvent<HTMLFormElement>, meal: MealEntry) {
    event.preventDefault();
    const description = editText.trim();
    if (!description) return;
    const analyzingMeals = day.meals.map((candidate) => candidate.id === meal.id ? { ...candidate, description, status: "analyzing" as const, updatedAt: new Date().toISOString() } : candidate);
    changeMeals(analyzingMeals, "correction");
    setEditingMealId(null);
    setActiveDraftId(meal.id);
    setFormError(null);
    runAnalysis(description, meal.createdAt, (analysis) => {
      const result = analyzeDescription(analysis.estimate);
      const current = dayRef.current;
      const next = current.meals.map((candidate) => candidate.id !== meal.id ? candidate : {
        ...candidate,
        ...result.estimate,
        description,
        status: result.status,
        clarification: result.estimate.clarification,
        clarificationAsked: candidate.clarificationAsked || Boolean(result.estimate.clarification),
        updatedAt: new Date().toISOString(),
      });
      persist({ ...current, meals: next, completedAt: null });
      if (result.status === "failed") {
        setFormError(result.estimate.error);
        setActiveDraftId(null);
      } else {
        setActiveDraftId(meal.id);
        setNotice("Meal updated and awaiting confirmation.");
      }
    });
  }

  function changeMealType(meal: MealEntry, mealType: MealType) {
    const next = day.meals.map((candidate) => candidate.id === meal.id ? { ...candidate, mealType, updatedAt: new Date().toISOString() } : candidate);
    changeMeals(next, "meal category");
    setNotice(`Meal moved to ${MEAL_TYPE_LABELS[mealType]}.`);
  }

  function answerClarification(meal: MealEntry, replacement: string) {
    const estimate = interpretMeal(replacement);
    if (estimate.error || !estimate.items.length) { setFormError(estimate.error); return; }
    const next = day.meals.map((candidate) => candidate.id === meal.id ? {
      ...candidate, ...estimate, description: replacement, status: "awaiting_confirmation" as const,
      clarification: null, clarificationAsked: true, updatedAt: new Date().toISOString(),
    } : candidate);
    changeMeals(next, "clarification answer");
    setActiveDraftId(meal.id);
    setEditingMealId(null);
    setNotice("Meal updated and awaiting confirmation.");
  }

  function deleteMeal(meal: MealEntry) {
    const next = day.meals.map((candidate) => candidate.id === meal.id ? { ...candidate, status: "deleted" as const, updatedAt: new Date().toISOString() } : candidate);
    changeMeals(next, "deletion");
    setActiveDraftId(null);
    setEditingMealId(null);
    setDeleteCandidateId(null);
    setNotice("Meal deleted.");
  }

  function undoLastAction() {
    if (!day.lastAction || day.lastAction.expiresAt <= Date.now()) return;
    persist({ ...day, meals: day.lastAction.meals, completedAt: null, lastAction: null });
    setDeleteCandidateId(null);
    setNotice("Last action undone.");
  }

  function requestFinish() {
    if (pendingMeals.length) {
      setReviewMode(true);
      setNotice(`${pendingMeals.length} ${pendingMeals.length === 1 ? "meal needs" : "meals need"} attention before you finish.`);
      return;
    }
    setFinishPrompt(true);
  }

  function completeDay() {
    const at = new Date().toISOString();
    const event: DayEvent = { name: "Complete Calorie-Tracked Day", at };
    persist({ ...day, completedAt: at, events: [...day.events, event], lastAction: null });
    window.dispatchEvent(new CustomEvent("meal-log:event", { detail: event }));
    setFinishPrompt(false);
    setNotice("Today’s log is complete.");
  }

  function renderEstimate(meal: MealEntry, estimate: EstimateFields = meal) {
    return <>
      <ul className="meal-items">{estimate.items.map((item, index) => <Fragment key={`${item.dishName}-${index}`}>
        <li className="meal-item" aria-label={`Dish: ${item.dishName}`}>
          <div className="meal-copy"><div className="dish-line"><h3>{item.dishName}</h3><span className={`status-pill confidence-${item.confidence}`}>{item.confidence} confidence</span></div><p>Portion: <span>{item.portion}</span></p></div>
          <div className="item-energy"><strong>Approximately {item.calorieEstimate} kcal</strong><span>{item.calorieMin}–{item.calorieMax} kcal</span></div>
        </li>
      </Fragment>)}</ul>
      {estimate.items.length > 1 ? <div className="meal-total"><span>Combined meal total</span><strong>Approximately {estimate.calorieEstimate} kcal</strong></div> : null}
      <p className="calorie-range">Estimated range: {estimate.calorieMin}–{estimate.calorieMax} kcal</p>
      {estimate.assumptions.length ? <details className="estimate-details"><summary>How this was estimated</summary><ul>{estimate.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details> : null}
    </>;
  }

  function renderMeal(meal: MealEntry, reviewActions = false) {
    const shownEstimate = meal;
    const awaiting = PENDING_STATUSES.includes(meal.status);
    const mealName = meal.items.map((item) => item.dishName).join(" and ") || meal.description;
    return <div className="meal-card-content">
      <div className="meal-card-head"><p className="meal-description">{meal.description}</p><span className={`status-pill status-${awaiting ? "pending" : "confirmed"}`}>{awaiting ? "Awaiting review" : "Confirmed"}</span></div>
      <label className="meal-type-control">Meal time<span className="sr-only"> for {mealName}</span><select aria-label={`Meal category for ${mealName}`} value={meal.mealType} onChange={(event) => changeMealType(meal, event.target.value as MealType)}>{(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((type) => <option value={type} key={type}>{MEAL_TYPE_LABELS[type]}</option>)}</select></label>
      {meal.status === "needs_clarification" && !meal.items.length ? <p className="recovery-copy">Original entry: “{meal.originalDescription}”</p> : renderEstimate(meal, shownEstimate)}
      {meal.status === "needs_clarification" && meal.clarification ? <div className="clarification" role="group" aria-label={meal.clarification.question}>
        <strong>{meal.clarification.question}</strong>
        {meal.clarification.options.length ? <div className="clarification-options">{meal.clarification.options.map((option) => <button type="button" key={option.label} onClick={() => answerClarification(meal, option.replacement)}>{option.label}</button>)}</div> : null}
        {meal.clarification.allowDescription && editingMealId !== meal.id ? <button type="button" onClick={() => startCorrection(meal)}>Describe main items</button> : null}
        <button type="button" className="text-action" onClick={reviewLater}>Review later</button>
        {reviewActions ? <button type="button" className="delete-action" onClick={() => setDeleteCandidateId(meal.id)}>Delete</button> : null}
      </div> : null}
      {editingMealId === meal.id ? <form className="correction-form" onSubmit={(event) => meal.status === "needs_clarification" ? (event.preventDefault(), answerClarification(meal, editText)) : saveCorrection(event, meal)}>
        <label htmlFor={`correction-${meal.id}`}>{meal.status === "needs_clarification" ? "Describe the main items and portions" : "Edit meal description, dish, quantity or portion"}</label>
        <input id={`correction-${meal.id}`} value={editText} onChange={(event) => setEditText(event.target.value)} autoFocus />
        <button type="submit">Recalculate</button>
      </form> : null}
      {awaiting && meal.status !== "needs_clarification" && editingMealId !== meal.id ? <div className="review-actions">
        <button type="button" className="primary-action" onClick={() => confirmMeal(meal)}>Confirm</button>
        <button type="button" onClick={() => startCorrection(meal)}>Edit</button>
        <button type="button" onClick={reviewLater}>Review later</button>
        {reviewActions ? <button type="button" className="delete-action" onClick={() => setDeleteCandidateId(meal.id)}>Delete</button> : null}
      </div> : null}
      {!awaiting && editingMealId !== meal.id ? <MealOptionsMenu mealName={mealName} onEdit={() => startCorrection(meal)} onDelete={() => setDeleteCandidateId(meal.id)} /> : null}
      {deleteCandidateId === meal.id ? <div className="delete-confirmation" role="group" aria-label="Confirm meal deletion"><span>Delete this meal?</span><div><button type="button" className="delete-action" onClick={() => deleteMeal(meal)}>Delete meal</button><button type="button" onClick={() => setDeleteCandidateId(null)}>Keep meal</button></div></div> : null}
    </div>;
  }

  const countCopy = `${pendingMeals.length} ${pendingMeals.length === 1 ? "meal" : "meals"} awaiting review`;
  const pendingActionCopy = pendingMeals.length === 0
    ? "No meals pending"
    : `Review ${pendingMeals.length} ${pendingMeals.length === 1 ? "meal" : "meals"}`;
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="Daily meal log home"><BowlMark /><span>daily</span></a><span className="today-chip">Today</span></header>
    <main className="meal-page">
      <section className="today-summary" aria-label="Today’s summary">
        <div><span>Confirmed</span><strong>Approximately {totals.estimate} kcal</strong><small>Estimated range: {totals.min}–{totals.max} kcal</small></div>
        <div><span>Pending</span><strong>{countCopy}</strong></div>
        <button type="button" disabled={pendingMeals.length === 0} onClick={() => setReviewMode(true)}>{pendingActionCopy}</button>
      </section>
      {notice ? <div className="notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div> : null}
      {undoAvailable ? <div className="undo-delete"><button type="button" onClick={undoLastAction}>Undo</button></div> : null}

      {reviewMode ? <section className="review-inbox" aria-labelledby="review-title">
        <button type="button" className="back-action" onClick={() => setReviewMode(false)}>Back to today</button><p className="section-label">Review inbox</p><h1 id="review-title">Awaiting review</h1>
        {pendingMeals.length ? <><p className="review-progress">{countCopy}. Review the next meal below.</p><ol className="meal-list">{pendingMeals.map((meal) => <li className="meal-entry" key={meal.id}>{renderMeal(meal, true)}</li>)}</ol></> : <div className="empty-review"><h2>Everything is reviewed</h2><p>No meals are waiting for review.</p></div>}
      </section> : <>
        <section className="intro" aria-labelledby="page-title"><p className="eyebrow">{formatToday()}</p><h1 id="page-title">What did you eat?</h1><p className="intro-copy">Write it the way you would say it. We’ll estimate a calorie range for you to review.</p>
          <form className="meal-form" onSubmit={addMeal}><label htmlFor="meal-input">What did you eat?</label><div className="input-row"><input id="meal-input" value={mealText} onChange={(event) => { setMealText(event.target.value); setFormError(null); }} placeholder="2 idlis with sambar" autoComplete="off" aria-invalid={formError ? "true" : undefined} aria-describedby={formError ? "meal-error" : undefined} /><button type="submit" disabled={!mealText.trim()}>Analyse meal</button></div>{formError ? <p className="form-error" id="meal-error" role="alert">{formError}</p> : null}</form>
        </section>
        {activeDraft && PENDING_STATUSES.includes(activeDraft.status) ? <section className="result-card" aria-labelledby="result-title"><p className="section-label">Awaiting review</p><h2 id="result-title">Review this estimate</h2>{renderMeal(activeDraft)}</section> : null}
        <section className="day-log" aria-labelledby="day-log-title">
          <div className="log-heading"><div><p className="section-label">Today’s meals</p><h2 id="day-log-title">{confirmedMeals.length} confirmed · {countCopy}</h2></div><p className="daily-total">Approximately {totals.estimate} kcal</p></div>
          {visibleMeals.length === 0 ? <div className="empty-state"><div className="empty-plate" aria-hidden="true"><span /></div><p>Your first meal will appear here.</p></div> : <div className="split-log" aria-live="polite">
            <section aria-labelledby="confirmed-title"><h3 id="confirmed-title">Confirmed meals</h3>{confirmedMeals.length ? <div className="meal-groups">{(Object.keys(MEAL_TYPE_LABELS) as MealType[]).map((type) => {
              const meals = confirmedMeals.filter((meal) => meal.mealType === type);
              return meals.length ? <section className="meal-group" aria-labelledby={`meal-group-${type}`} key={type}><h4 id={`meal-group-${type}`}>{MEAL_TYPE_LABELS[type]}</h4><ol className="meal-list">{[...meals].reverse().map((meal) => <li className="meal-entry" key={meal.id}>{renderMeal(meal)}</li>)}</ol></section> : null;
            })}</div> : <p className="section-empty">No confirmed meals yet.</p>}</section>
            <section aria-labelledby="awaiting-title"><h3 id="awaiting-title">Awaiting review</h3>{pendingMeals.filter((meal) => meal.id !== activeDraftId).length ? <ol className="meal-list">{pendingMeals.filter((meal) => meal.id !== activeDraftId).map((meal) => <li className="meal-entry" key={meal.id}>{renderMeal(meal)}</li>)}</ol> : <p className="section-empty">No other meals are waiting.</p>}</section>
          </div>}
          {finishPrompt ? <div className="finish-prompt" role="group" aria-label="Complete today’s log"><strong>Have you logged everything you ate and drank today?</strong><div><button type="button" className="primary-action" onClick={completeDay}>Yes, complete my day</button><button type="button" onClick={() => setFinishPrompt(false)}>Not yet</button></div></div> : null}
          {day.completedAt ? <div className="completed-summary"><span>Day completed</span><strong>Approximately {totals.estimate} kcal</strong><p>Estimated range: {totals.min}–{totals.max} kcal · {confirmedMeals.length} confirmed meals</p><time dateTime={day.completedAt}>Completed {new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(new Date(day.completedAt))}</time></div> : <button type="button" className="finish-day" onClick={requestFinish}>Finish today’s log</button>}
        </section>
      </>}
    </main>
    <footer className="deployment-proof">Built for thoughtful meal tracking — one meal at a time.</footer>
  </div>;
}
