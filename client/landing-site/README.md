# Atelora primary website

The root marketing site (`/`) keeps the verified Webflow/Localyzer-derived layout and animation runtime intact, while Atelora-owned marketing content is maintained in `atelora-content.js`.

Edit `atelora-content.js` to change navigation labels, hero copy, platform/features copy, use cases, Quizmoto messaging, footer content, CTA links, and product imagery without altering the underlying animation DOM.

`npm run prepare:landing` reconstructs the verified visual template, serves its CSS locally, injects the editable Atelora content layer, and writes the final site to `client/public/landing/`. The React route at `/` displays that site. `/login`, `/atelora`, host/player routes and backend authentication are unchanged.
