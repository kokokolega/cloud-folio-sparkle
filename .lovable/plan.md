# Theme-aware Oltrid branding

## What will change
- Keep one reusable Oltrid logo component that automatically swaps between the light-theme and dark-theme logo assets.
- Show the logo consistently in the shared workspace navigation and mobile top bar, so every protected workspace section inherits it without duplicating markup.
- Preserve the existing logo treatment on sign-in and card exports, while checking standalone/public screens for any missing brand placement.
- Create a small browser favicon from the Oltrid mark, reference it in the page head, and remove the obsolete default icon if present.
- Complete the page’s Oltrid-specific social metadata while updating the head.

## Verification
- Check light and dark themes at desktop and mobile sizes.
- Confirm the logo appears without duplication or layout overlap across representative sections.
- Confirm the favicon loads and the preview remains error-free.
