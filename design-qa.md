# Design QA — Atlas product switcher

- Source visual truth: `/var/folders/bn/3x3z3qtj4j390z5md0_nssrm0000gn/T/codex-clipboard-bb986069-4274-4dca-9f60-5d8e6d233389.png`
- Implementation captures: `/tmp/gridconnects-nav-fixed-map.png`, `/tmp/gridconnects-nav-fixed-menu.png`
- Combined comparison: `/tmp/gridconnects-nav-comparison.png`
- Requested CSS viewport: 2048 × 1177
- Source pixels: 3018 × 1734
- Implementation capture pixels: 1280 × 720 (browser-managed downsample)
- Density normalization: source aspect-fit and padded to 1280 × 720; implementation retained at 1280 × 720; compared side by side at equal pixel dimensions
- State: light theme; Map selected; switcher closed for the full-view comparison and open for the focused menu check

## Full-view comparison evidence

The source shows the product switcher stretched from the top to the bottom of the viewport, obscuring the center of the map. The revised capture preserves the surrounding map, sidebar, theme control, and metrics while returning the product switcher to a compact, centered top pill.

## Focused region comparison evidence

The switcher and its open Signal menu were checked separately in `/tmp/gridconnects-nav-fixed-menu.png`. The menu is anchored below the Signal button, remains content-sized, preserves the existing radii/colors/spacing, and does not alter the switcher's height. Calendar, Contacts, Agent, and Profile were each selected successfully; Escape dismissed the menu; Map restored the map view.

## Required fidelity surfaces

- Fonts and typography: Existing project fonts, weights, labels, and line heights are unchanged.
- Spacing and layout rhythm: Fixed positioning now resolves only from the top edge; the pill uses intrinsic width and height, and the menu has a viewport-safe maximum height.
- Colors and visual tokens: Existing Atlas light/dark tokens and glass surfaces are unchanged.
- Image quality and asset fidelity: The map iframe and all existing icons/assets are unchanged and remain sharp at the captured viewport.
- Copy and content: Signal, Map, Calendar, Contacts, Agent, Profile, and theme labels are unchanged.

## Comparison history

### Iteration 1

- P1: The fixed product switcher inherited both `top` and `bottom`, stretching into a full-height center obstruction.
- Fix: Reset `bottom`, added intrinsic sizing/alignment, and constrained the dropdown's overflow.
- P2: Theme initialization caused a hydration mismatch between server and client.
- Fix: Deferred reading and applying the stored theme until after mount.
- P2: Repeated evidence URLs produced duplicate React keys during Contacts navigation.
- Fix: Keys now include the speaker, URL, label, and index.

### Iteration 2

- Post-fix evidence: Compact top switcher in both themes; open dropdown remains bounded; all four Signal destinations, Map return, and Escape dismissal pass.
- Browser console check: The app-level hydration and duplicate-key errors are gone. The browser harness still reports an unscoped `MutationObserver` message with no source URL; no `MutationObserver` remains in the application source, and the message does not affect rendering or interaction.
- No remaining actionable P0, P1, or P2 visual findings.

## Follow-up polish

- P3: Recheck the unscoped browser-harness console message after the next deployed asset revision.

final result: passed
