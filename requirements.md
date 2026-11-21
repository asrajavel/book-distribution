# Book Distribution App: Requirements

An app for ISKCON temple volunteers to record the books they distribute, and for a few
main volunteers to track books and money moving between people.

Status: built and live at https://asrajavel.github.io/book-distribution/ in the look of `mockup-standard.html`.
The books in the database are the mockup's placeholders until the real list is in.

## 1. People and sign-in

- Sign-in is with a Google account only. The phone number is only stored, never used to sign in.
- On first sign-in (sign up) the person gives name and phone number, once.
- An admin can add a person (name, phone, email) before they ever sign in. That row is linked to
  their account automatically when they sign up with that email.
- **Admin** is a per-person switch, set directly in the database.
- Avatars show the person's Google photo (saved on each sign-in), else initials.

## 2. Events and distributing books (every volunteer)

- **Event:** one distribution outing. Date, place, volunteers, who started it, open or closed,
  and each volunteer's hours once closed. One open event per person.
- **Entry:** books and quantities only, inside an event. Price comes from the book.
- Only the volunteer who started the event (the host) records its entries and edits it.
  The host is marked wherever the event's volunteers are listed.
- **Tabs:** Distribute, Current event, Past events (plus Admin for admins).
  Current event is greyed out while there is no open event.
- **Books:** a title in a language (Bhagavad Gita in Tamil, English, Hindi, Kannada, ...).
  Each has one fixed price and a kind: Common, Rare or Kids. No points.
  Kids books (mostly coloring books) are English only.
- Books show by short name where one is set (BG, Krsna, SSR, Isopanisad), else the full name,
  with the language as a muted 3-letter code (ENG).
- **Distribute, no open event:** Start event form. Date (defaults to today, can be any past date),
  place (see Places), volunteers (search and tap to add; added ones move up as chips with ×; the host is always on it).
- **Distribute, event open** ("Book distribution") must be fast on a phone:
  - One tag row, scrolls sideways: ENG, KIDS, TAM, HIN, KAN, TEL. ENG is selected by default.
  - A language tag shows the common books in that language, then the rare books
    folded under "More books" (shows how many are entered). Search also finds rare books.
  - KIDS shows the kids books.
  - Tap + / − on each book.
  - Search box: matches part of the name, or initials (KB = Krishna Book).
  - Starts at zero. Save adds an entry to the event, stays on the page, shows "Saved", and clears the quantities.
    Unsaved quantities are kept on the phone, so they survive the app being closed.
- **Current event:** event details (editable), its entries newest first (each editable), total.
- **Close event:** hours for each volunteer, prefilled with the time since the start rounded to
  half an hour. Change with + / − (half an hour each) or type. Hours show one decimal (1.0).
  A "Close event?" popup confirms, then the event moves to Past events.
- **Past events:** closed events the person started or was on. Opens to details, hours and entries.
  The host can edit all of it; other volunteers only see it.
- **Add entry** (host): the round orange + by Entries. Past event: the book picker, saved to that event.
  Current event: opens Distribute.
- **Phone back** (swipe or button) closes a popup, else does what the screen's back button does; on a main tab it leaves the app.
  Leaving Edit entry or Edit event with changes asks "Discard changes?".
- Slow saves show "Saving…"; no network shows "No internet. Try again."
- Motion (off with the phone's reduce-motion setting): deeper screens slide in from the right and back slides them out,
  tabs fade; popups and the toast rise in; buttons shrink when pressed; a count bumps on + / −; a just-saved entry is highlighted once.
- **Delete** (host): "Delete entry" or "Delete event" in the bottom bar of Edit entry and Edit event,
  with a popup: "Delete this event?" plus how many entries go with it. Rows are really deleted; the audit log keeps them for recovery.

### Places

- A place is a name plus latitude and longitude, in one list shared by all volunteers.
- Pick: saved places nearest first, with search. One within 150 m is preselected.
  Without location or for a past date, most recently used first.
- New location (any volunteer): a map filling the screen, pin fixed in the centre, move the map under it (starts at the current location), a live blue dot for the current location, a bottom-right button to go back to it, and
  nearby saved places shown. Type a name and save. Names are unique.
- Location is read only on Start event (today's date) and New location, asked at that moment.
  Denied: most recently used first, and the map starts at the city.

## 3. Admin

- **Admin tab (admins only):** Map, People (add a person), and Events: every event by everyone, newest first,
  with host, date, place, volunteers and books (view only). In the mockup the admin is Satya.
- **Map:** a circle per place, larger for more books, with period filter
  (today, this week, all). The real app uses the city's actual map.
- Apart from admins, nobody sees events they were not on. Others don't see an event while it is open.
- Events show as date · place everywhere.

## 4. Decided against, for now

- Approval or confirmation of entries.
- Offline sync (past-date entry covers bad network).
- Teams, Stats tab and marathons.
- Recording entries by other volunteers on the event.
- Duplicate-entry warning.
- Checks across events (a volunteer on someone's open event can still start their own, or be on two at once).
- Google Places lookup for place names.
- A RARE tag with a language dropdown per book (rare books stay under "More books").
- Renaming or merging places.
- Storing the volunteer's GPS point on each entry or event, and tracking in the background.
- Play Store, App Store and sideloaded APKs (the installed web app covers Android and iPhone).

## 5. Open points

- Real book list and prices.
- Which books are common and which are rare.
- The city the map starts at when location is denied and no place is saved (`CITY` in app.js, a placeholder).
- Later: when location fails (Start event, New location, the location button), a popup by reason:
  blocked (steps to allow it in Chrome or iPhone settings; the app can't ask again), phone location off, or timed out (try again).
  The browser's own permission prompt stays as the first ask.

## 6. Planned build

- Mobile-first installable web app (PWA). Shared as a link and QR code in the volunteers' group.
  Android: Install from Chrome. iPhone: Safari, Share, Add to Home Screen; install before signing in.
  In a browser tab, a small banner shows how to install.
- Supabase: Google sign-in, Postgres, per-row access rules.
- Ownership: code in the developer's public GitHub repo (asrajavel/book-distribution).
  Supabase on the developer's account (an email alias); Google OAuth client in the developer's
  Google Cloud project, published unverified (sign-in shows the Supabase address). Add the temple
  account as an owner of both later.
- Data shape: an entry has one row per book line (book, quantity, price at the time of sale),
  an event has one row per volunteer (hours).
- All dates and times are IST (the database time zone), nowhere else. Each Save goes through one database function, all or nothing.
- Plain HTML, CSS and JS modules, no build step or framework. supabase-js and Leaflet from a CDN at pinned versions.
  `// @ts-check` for editor type checks. Hand-written manifest and service worker (bump its version on each release).
- Leaflet with OpenFreeMap tiles via MapLibre (free, no key; light or dark with the phone).
- No server: GitHub Pages at https://asrajavel.github.io/book-distribution/ (needs privacy.html there
  for Google's consent screen), the browser talks to Supabase with the anon key.
  All access checks are Supabase row rules; linking a signed-up account to its person row is a database function.
- Audit log: every insert, update and delete on every table, written by one generic database trigger
  into one table (when, who, action, table, row, old and new row, transaction). Admins read it; nobody writes it.
  Sign-ins are in Supabase's own auth logs. Page views are not logged.
- A daily GitHub Action pings Supabase so the free project doesn't pause.
- Test Google sign-in inside the installed app on a real iPhone first.
- Order: sign-in, books, events, distribute, past events, admin.

## Parked

- Stock and ledger (lending, returns, payments, books in hand) is out for now.
  Requirements and the working mockup are in `archive/stock/`.
