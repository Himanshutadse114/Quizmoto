# Platform page spacing

The signed-in workspace uses `PlatformPageLayout` inside `ScormPlatformShell`.
It owns the page width and outer gutters. Route components should not add a
second centered shell or another set of horizontal page margins.

| Role | Desktop | Mobile (below 768px) |
| --- | --- | --- |
| Page maximum width (including gutters) | 1280px | Available width |
| Horizontal page gutter | 28px | 16px |
| Top / bottom padding | 24px / 40px | 20px / 32px |
| Section gap | 24px | 20px |
| Panel inset | 20px | 16px |
| Field gap | 16px | 16px |
| Action gap | 8px | 8px |

Use the shared roles for new or changed pages:

- `platform-page-header`: title, description and primary actions, followed by the standard divider and section gap.
- `platform-content-grid`: equal spacing between major panels in a grid.
- `platform-content-stack`: vertical spacing between major sections; works with an existing Tailwind `space-y-*` stack or a flex/grid container.
- `platform-panel`: an inset panel. For a flush panel with borders, use `platform-panel-body` for its header and `platform-panel-content` for its body.
- `platform-form-grid` / `platform-actions`: consistent field and action gaps.
- `platform-admin-section`: nested administration tab content without duplicate gutters.

Compact metrics, table rows and field groups may use smaller internal gaps.
Reader pages, public/authentication pages, dialogs and authored course previews
retain their independent layouts. Typography is not changed by this layout layer.

`tests/ui/platform-spacing.spec.js` checks 31 workspace route templates, both
themes, 320px–1920px viewports, administration tabs and account roles. It also
guards independent public layouts and authored preview padding. Its APIs are
mocked; it never creates or modifies production tenant data.
