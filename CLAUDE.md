# Book Distribution App

Read `requirements.md` first. It is the agreed requirements and the source of truth;
update it whenever a requirement is decided or changed.

## Files

- `requirements.md`: what the app must do, what was decided against, and open points.
- `index.html` + `app.js`: the app.
  Run locally with preview_start "app" (port 8000, the only local origin Google sign-in allows).
  `sw.js` (bump VERSION on release), `manifest.json`, icons, `privacy.html` (linked from Google's consent screen).
- `schema.sql`: Supabase tables, row rules, app functions and audit trigger. Applied to the live project;
  run any change there too (Supabase connector) and keep this file matching.
- `rls_test.sql`: row-rule test with fake users; always rolls back, ends with "ALL TESTS PASSED". Run after schema changes.
- `archive/mockup/`: the clickable mockups shown to the temple before the app was built, and `check.js` for them.
  Their artifacts: https://claude.ai/artifact/ALZQL5PHq7Ymoy1AtxTktb (mockup.html),
  https://claude.ai/artifact/AXX9sPueTfZiSYbLWQvAeC (mockup-standard.html). Don't read them unless the user asks.
- `archive/stock/`: parked stock and ledger feature (requirements, full mockup, check).
  Don't read it unless the user brings stock back.

## Rules

- Keep every screen simple: mobile first, very little text.
- Long heredocs with backticks fail in the Bash tool here; for multi-line edits,
  write a Python script to the scratchpad and run it.
- No alert/confirm/prompt: use the in-page `.modal` popup.
- UI conventions: the screen's main action goes in the bottom bar; edit is the round pencil;
  add is the round + (accent colour), in section headers too, never a text link; buttons at least 44px; dates come before places ("17 Nov · Market").
- Don't copy `../iskcon-subscriptions`' Vercel API-route design: it needed a server only because it began
  on Google Sheets (secret service-account key). Its daily keep-alive GitHub Action is worth reusing.
- Typing in the Google Cloud console or Supabase dashboard via Claude in Chrome often hits page shortcuts
  instead of the field: click the field by coordinates (getBoundingClientRect), check its value with JS, reload to confirm a save.
- `impeccable detect` can't see screens built in app.js and only reaches the sign-in page on localhost:
  review the app by walking its screens at phone size instead.
- `.claude/launch.json` hard-codes port 8000 in its arguments. If another session's preview holds 8000, preview_start
  moves to another port but the server never starts there: stop the other preview first.
- If you spent real effort discovering something that the next agent would also need
  and couldn't get quickly from the files (a gotcha, a non-obvious command, a hidden
  constraint), suggest one line for CLAUDE.md at the end of your reply. Don't suggest
  anything already in requirements.md or obvious from the code.
