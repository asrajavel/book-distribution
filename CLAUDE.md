# Book Distribution App

Read `requirements.md` first. It is the agreed requirements and the source of truth;
update it whenever a requirement is decided or changed.

## Files

- `requirements.md`: what the app must do, what was decided against, and open points.
- `mockup.html`: single-file clickable mockup shown to the temple. Fake data, no backend.
- `check.js`: runs the mockup's logic: one event from the host's, a volunteer's and an admin's side, then the book tags.
  Run `node check.js mockup.html` after changing the mockup's script.
- `archive/stock/`: parked stock and ledger feature (requirements, full mockup, check).
  Don't read it unless the user brings stock back.

## Rules

- Edit `mockup.html` locally only. Publish it only when the user explicitly says to.
  When they do, publish to the existing artifact so the link stays the same:
  https://claude.ai/artifact/ALZQL5PHq7Ymoy1AtxTktb
- Keep every screen simple: mobile first, very little text.
- Everything in the mockup (names, books, prices, places, teams) is placeholder data.
- Long heredocs with backticks fail in the Bash tool here; for multi-line edits to mockup.html,
  write a Python script to the scratchpad and run it.
- The browser pane shows mockup.html as a static snapshot: re-run preview_start after edits,
  and read state with get_page_text, since screenshots can lag.
- mockup.html has base64 book covers on very long lines, so a full Read fails: grep for the part you need,
  or print it with long lines cut (`awk '{print substr($0,1,300)}'`).
- No alert/confirm/prompt (the artifact sandbox may block them, and check.js has none): use the in-page `.modal` popup.
- UI conventions: the screen's main action goes in the bottom bar; edit is the round pencil;
  add is the round orange +; dates come before places ("17 Nov · Market").
- Don't copy `../iskcon-subscriptions`' Vercel API-route design: it needed a server only because it began
  on Google Sheets (secret service-account key). Its daily keep-alive GitHub Action is worth reusing.
- If you spent real effort discovering something that the next agent would also need
  and couldn't get quickly from the files (a gotcha, a non-obvious command, a hidden
  constraint), suggest one line for CLAUDE.md at the end of your reply. Don't suggest
  anything already in requirements.md or obvious from the code.
