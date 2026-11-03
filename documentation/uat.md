# Manual UAT — `npm run uat`

One command opens a real Chromium with a host page served at the panel origin,
loads the **real** SDK bundle, and leaves a panel tab open so you can file a
report and review it end to end.

```bash
npm run uat
```

Before opening the browser the command:

1. validates `.env` has a real `wkbt_…` project key (the key is never printed);
2. rebuilds `@watchbug/contracts` + `@watchbug/sdk` when a source file is newer
   than the shipped bundle (or the bundle is missing);
3. starts `docker compose up -d` when `http://127.0.0.1:8080/api/health` is not
   already healthy.

Useful variants:

```bash
npm run uat -- --dpr=2        # DPR 2 (pixelation / HG-02)
npm run uat -- --width=760    # narrow viewport (word-wrap)
npm run uat -- --no-build     # skip the freshness check
npm run uat -- --no-stack     # never start compose
npm run uat -- --dry-run      # preflight only, no browser
```

## What to check

The harness page carries the checklist. In short:

1. The launcher is visible in the bottom-right corner.
2. Click it: the composer opens with the captured page and this form.
3. Draw a stroke, a shape and a text label in the editor.
4. Use the **Mask** tool over a secret and confirm.
5. `Review report` → `Send report`.
6. The panel tab lists the report and shows the screenshot.

The page also carries a password field, a Luhn-valid card, a credential
assignment, a JWT-shaped value, an `Authorization: Bearer …` line and a
`data-watchbug-sensitive` block: none of them may appear in the sent capture.

The session log (page console, API requests/responses, viewport metrics) is
written to `%TEMP%\watchbug-uat.log` (`$TMPDIR/watchbug-uat.log` elsewhere).

> The older root files `manual-widget.mjs`, `open-browser.mjs` and
> `report-bug.cmd` are superseded by `scripts/manual-uat.mjs`; they are not
> tracked by git and can be removed once verified.
