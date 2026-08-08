# UX guidance & onboarding (acceptance checklist)

| Criterion | Implementation |
|-----------|----------------|
| Hover tooltips on field labels | [`FieldLabel`](/frontend/components/shared/FieldLabel.tsx) — `tooltip` + help icon; used in [`ObjectiveForm`](/frontend/components/ObjectiveForm.tsx), [`KeyResultForm`](/frontend/components/KeyResultForm.tsx), Progress tab score/notes ([`ProgressTab`](/frontend/components/modal/tabs/ProgressTab.tsx)). |
| Inline help for score requirements | [`InlineHelp`](/frontend/components/shared/InlineHelp.tsx) with `learnMoreHref="/docs#scoring"` in [`ProgressTab`](/frontend/components/modal/tabs/ProgressTab.tsx) and [`KeyResultProgress`](/frontend/components/KeyResultProgress.tsx). |
| Actionable errors + suggestions | [`ErrorMessage`](/frontend/components/shared/ErrorMessage.tsx) + [`getErrorSuggestions()`](/frontend/components/shared/ErrorMessage.tsx) for auth, 403, 409, network, validation, 500; optional `learnMoreHref`. Used in modal ([`OKRModal`](/frontend/components/modal/OKRModal.tsx)), forms, etc. |
| Optional first-time tutorials | [`TutorialOverlay`](/frontend/components/shared/TutorialOverlay.tsx) + [`useFirstTimeTutorial`](/frontend/lib/tutorial.ts) on [`FullDashboardView`](/frontend/components/dashboard/FullDashboardView.tsx) / [`StandardDashboardView`](/frontend/components/dashboard/StandardDashboardView.tsx). |
| Learn more → full docs | `/docs` app route ([`app/docs/page.tsx`](/frontend/app/docs/page.tsx)); links from `FieldLabel`, `InlineHelp`, `ErrorMessage`, [`EmptyState`](/frontend/components/shared/EmptyState.tsx) `secondaryLink`. |
| Empty-state prompts | [`EmptyState`](/frontend/components/shared/EmptyState.tsx) — title, description, optional `action` + `secondaryLink` (e.g. Progress tab no KRs, dashboard no objectives). |
