# Daily Meal Log interface system

## Direction and feel

- Calm, warm and non-judgmental, like a carefully kept food notebook.
- Meal capture is the main action; totals and pending review remain clear supporting information.
- Preserve the existing rice-paper, porcelain, leaf, turmeric and ink color tokens.
- Preserve Fraunces for display and summary figures, with Manrope for controls and supporting copy.

## Depth and spacing

- Use subtle layered shadows for raised cards and quiet low-contrast lines for internal separation.
- Follow the existing 4px-based spacing rhythm and rounded-card scale.
- Keep controls at least 44px high.

## Hierarchy

- Meal capture remains the page focal point.
- Summary labels are small, uppercase metadata; values use stronger weight and tabular numbers.
- Confirmed calorie totals use the leaf color and Fraunces display face.
- Use spacing and type weight before adding borders or new colors.

## Responsive summary pattern

- Above 600px, the day-log meal count and calorie total sit horizontally.
- At 600px and below, stack the meal count and calorie total vertically with an 8px gap.
- Give both flex or grid children `min-width: 0` so they can shrink inside the card.
- On narrow screens, allow summary text and calorie totals to wrap at normal word boundaries. Do not use forced character breaking that creates word-per-line columns.
- Keep the desktop calorie total at its natural width with `flex-shrink: 0`; allow the meal-count copy to wrap instead.
- The top summary becomes one column at 600px and below.
- Verify responsive changes at 390px and 1440px with both empty and populated states. Check both document overflow and card-level `scrollWidth`.

## Pending review control

- Derive the label from the real pending-meal count.
- Zero pending: show a disabled `No meals pending` control.
- One pending: show `Review 1 meal`.
- Multiple pending: show `Review N meals`.
- Preserve the existing leaf primary style when actionable and the quiet control surface when disabled.

## Existing behavior contract

- Do not alter meal text capture, analysis, confirmation, editing, Review later, inbox, deletion, Undo, meal grouping or complete-day behavior during presentation-only work.
- Pending meals never affect confirmed totals.
- Preserve Asia/Kolkata dates and local persistence.
