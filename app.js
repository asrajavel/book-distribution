// @ts-check
// Book Distribution app. Screens and behaviour follow mockup-standard.html; data lives in Supabase.
// Every access check is a row rule or database function in schema.sql.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm";

const sb = createClient("https://wwfwyuzmgpadwjdwltch.supabase.co", "sb_publishable_CDmMVIqkDNxU75Vcy1g7jQ_WlFmQ9y2",
  { auth: { flowType: "pkce" } });
const L = /** @type {any} */ (window).L; // Leaflet, from the script tag
const CITY = [12.97, 77.59]; // map start when location is denied and no place is saved yet (placeholder city)

// ---------- data ----------
/** @type {{ me: any, people: Map<number, string>, books: any[], places: any[], events: any[] }} */
const D = { me: null, people: new Map(), photos: new Map(), books: [], places: [], events: [] };
let ME = 0; // signed-in person's id
/** @param {any} p */
async function q(p) { const { data, error } = await p; if (error) throw error; return data; }
async function load() {
  const [people, books, places, events] = await Promise.all([
    q(sb.from("people").select("id, name, photo").order("name")),
    q(sb.from("books").select("id, name, short_name, language, kind, price").order("id")),
    q(sb.from("places").select("id, name, lat, lng")),
    q(sb.from("events").select("id, date, place_id, host_id, started_at, closed_at, event_volunteers(person_id, hours), entries(id, at, entry_lines(book_id, qty, price))")
      .order("date", { ascending: false }).order("id", { ascending: false })),
  ]);
  D.people = new Map(people.map(p => [p.id, p.name]));
  D.photos = new Map(people.map(p => [p.id, p.photo]));
  D.books = books;
  D.places = places;
  D.events = events.map(e => ({ ...e,
    team: e.event_volunteers.map(v => v.person_id).sort((a, b) => (b === e.host_id ? 1 : 0) - (a === e.host_id ? 1 : 0)), // host first
    hours: Object.fromEntries(e.event_volunteers.map(v => [v.person_id, v.hours == null ? "" : Number(v.hours)])),
    entries: e.entries.sort((a, b) => b.id - a.id), // newest first
  }));
}

// ---------- helpers ----------
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // IST, YYYY-MM-DD
const ago = n => new Date(Date.parse(TODAY + "T00:00Z") - n * 864e5).toISOString().slice(0, 10);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => "&#" + c.charCodeAt(0) + ";");
const NAME = id => esc(D.people.get(id) || "?");
const BOOK = id => D.books.find(b => b.id === id);
const SHORT = b => esc(b.short_name || b.name);
const PLACE = id => esc(D.places.find(p => p.id === id)?.name || "?");
const evOf = id => D.events.find(e => e.id === id);
const cur = () => D.events.find(e => !e.closed_at && e.host_id === ME); // one open event per person
const rupees = n => "₹" + Math.round(n).toLocaleString("en-IN");
const day = s => s === TODAY ? "Today" : new Date(s + "T00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const time = t => new Date(t).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
const booksN = n => n + (n === 1 ? " book" : " books");
const initials = name => String(name).split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
// Google photo, else initials (also when Google refuses it: it rate-limits repeat loads with 429).
// no-referrer: Google's photo server can refuse requests that send one.
const face = (name, photo) => photo ? `<img src="${esc(photo)}" alt="" referrerpolicy="no-referrer" data-i="${esc(initials(name))}" onerror="this.replaceWith(this.dataset.i)">` : initials(name);
const FACE = u => face(D.people.get(u) || "?", D.photos.get(u));
const hr = h => h === "" || h == null ? "" : Number(h).toFixed(1); // hours always with one decimal: 1.0
// Totals: event lines use the price at the time of sale; the picker uses today's price.
const tot = ls => ls.reduce((t, l) => ({ n: t.n + l.qty, amt: t.amt + l.qty * l.price }), { n: 0, amt: 0 });
const evLines = ev => ev.entries.flatMap(x => x.entry_lines);
const pickLines = qty => Object.entries(qty).map(([id, n]) => ({ book_id: +id, qty: n, price: BOOK(+id)?.price || 0 }));
const lineArg = qty => Object.entries(qty).map(([id, n]) => ({ book_id: +id, qty: n }));
const EMPTY = msg => `<p class="muted" style="margin:0;padding:24px 0;text-align:center">${msg}</p>`;
const GOOGLE = '<svg class="g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.540 0 6.710 1.220 9.210 3.600l6.850-6.850C35.900 2.380 30.470 0 24 0 14.620 0 6.510 5.380 2.560 13.220l7.980 6.190C12.430 13.720 17.740 9.500 24 9.500z"/><path fill="#4285F4" d="M46.980 24.550c0-1.570-.150-3.090-.380-4.550H24v9.020h12.940c-.580 2.960-2.260 5.480-4.780 7.180l7.730 6c4.510-4.180 7.090-10.360 7.090-17.650z"/><path fill="#FBBC05" d="M10.530 28.590c-.480-1.450-.760-2.990-.760-4.590s.270-3.140.760-4.590l-7.980-6.190C.920 16.460 0 20.120 0 24c0 3.880.920 7.540 2.560 10.780l7.970-6.190z"/><path fill="#34A853" d="M24 48c6.480 0 11.930-2.130 15.890-5.810l-7.730-6c-2.150 1.450-4.920 2.300-8.160 2.300-6.260 0-11.570-4.220-13.470-9.910l-7.980 6.190C6.510 42.620 14.620 48 24 48z"/></svg>'; // Google's own "G" logo, as its sign-in button guidelines ask
const ICON = {
  here: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.500" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.500A7 7 0 0 0 5 9.500C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.500-4 5-5 8-5s6.500 1 8 5"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.500"/><path d="M16 16l4.500 4.500"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  add: '<svg viewBox="0 0 24 24"><path d="M12 6.5C10 5 7 4.500 3.500 5v13.500C7 18 10 18.500 12 20c2-1.500 5-2 8.500-1.500V5C17 4.500 14 5 12 6.500zM12 6.500V20"/></svg>',
  event: '<svg viewBox="0 0 24 24"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  past: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  admin: '<svg viewBox="0 0 24 24"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
};

// ---------- location ----------
const metres = (a, b) => { // haversine
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
};
const far = m => m < 1000 ? Math.round(m / 10) * 10 + " m" : (m / 1000).toFixed(1) + " km";
// Asked only on Start event (today) and New location, at that moment.
function locate(then) {
  navigator.geolocation?.getCurrentPosition(p => { S.here = { lat: p.coords.latitude, lng: p.coords.longitude }; then(); },
    () => {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}
const lastUsed = id => D.events.reduce((m, e) => e.place_id === id && e.date > m ? e.date : m, "");
// Nearest first with a location for today; else most recently used first.
const sortedPlaces = date => S.here && date === TODAY
  ? [...D.places].sort((a, b) => metres(S.here, a) - metres(S.here, b))
  : [...D.places].sort((a, b) => lastUsed(b.id).localeCompare(lastUsed(a.id)) || a.name.localeCompare(b.name));

// ---------- state ----------
const newPick = () => ({ qty: {}, lang: "ENG" }); // books for the next entry
const S = /** @type {any} */ ({ screen: "loading", tab: "add", add: newPick(), evf: null, adminTab: "map", period: "week", here: null });
let pick = S.add; // the form on screen: book picker, or event details

function startForm() { // the Start event form; reads the location once for today's date
  if (S.evf) return S.evf;
  S.evf = { date: TODAY, place_id: null, team: [ME] };
  locate(() => {
    const f = S.evf, p = f && !f.place_id && f.date === TODAY && sortedPlaces(TODAY)[0];
    if (p && metres(S.here, p) <= 150) f.place_id = p.id; // preselect within 150 m
    if (S.screen === "add" || S.screen === "places") render();
  });
  return S.evf;
}

// ---------- book picker ----------
const LANG_ORDER = ["ENG", "TAM", "HIN", "KAN", "TEL"];
const tags = () => {
  const langs = [...new Set(D.books.filter(b => b.kind !== "kids").map(b => b.language))]
    .sort((a, b) => ((LANG_ORDER.indexOf(a) + 1) || 99) - ((LANG_ORDER.indexOf(b) + 1) || 99) || a.localeCompare(b));
  return ["ENG", "KIDS", ...langs.filter(l => l !== "ENG")];
};
const inTag = (b, t) => t === "KIDS" ? b.kind === "kids" : b.kind !== "kids" && b.language === t;
const tagCount = (p, t) => Object.entries(p.qty).reduce((s, [id, n]) => s + (inTag(BOOK(+id), t) ? n : 0), 0);
// Matches part of the name ("krish"), each typed word starting a name word in order, or the initials ("kb").
function matches(name, q) {
  const norm = t => t.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
  q = norm(q); name = norm(name);
  const nw = name.split(" "), ini = nw.filter(w => w !== "of" && w !== "and").map(w => w[0]).join("");
  return !q || name.includes(q) || q.split(" ").every((w, i) => nw[i] && nw[i].startsWith(w)) || ini.startsWith(q.replace(/ /g, ""));
}
function picker(p) {
  pick = p;
  const chips = tags().map(t => {
    const n = tagCount(p, t);
    return `<button class="chip" type="button" data-lang="${t}" aria-pressed="${t === p.lang}">${t}${n ? `<b>${n}</b>` : ""}</button>`;
  }).join("");
  return `<label class="field" aria-label="Search books">${ICON.search}<input id="pick-q" type="search" placeholder="Search books" data-bind="q" value="${esc(p.q)}"></label>
    <div class="chips" role="group" aria-label="Books">${chips}</div><ul class="list" id="pick-list">${pickRows(p)}</ul>`;
}
function bookRow(p, b) {
  const n = p.qty[b.id] || 0;
  return `<li class="row${n ? " on" : ""}">
      <span class="cover" style="background:var(--fill)"></span>
      <div class="info"><div class="name">${SHORT(b)} <span class="lang">${b.language}</span></div><div class="sub num">${rupees(b.price)}</div></div>
      <div class="step">
        <button type="button" data-id="${b.id}" data-d="-1" aria-label="One less ${esc(b.name)}"${n ? "" : " disabled"}>−</button><output>${n}</output>
        <button class="plus" type="button" data-id="${b.id}" data-d="1" aria-label="One more ${esc(b.name)}">+</button>
      </div></li>`;
}
// A language shows its common books, then rare ones folded under "More books" (search shows them too). KIDS shows kids books.
function pickRows(p) {
  const q = p.q || "", hit = b => matches(b.name, q) || matches(b.short_name || "", q);
  const here = D.books.filter(b => inTag(b, p.lang) && hit(b));
  const main = here.filter(b => b.kind !== "rare"), rare = here.filter(b => b.kind === "rare");
  if (!here.length) return `<li class="muted" style="padding:12px;text-align:center">No book found</li>`;
  const n = Object.entries(p.qty).reduce((s, [id, k]) => s + (BOOK(+id).kind === "rare" && inTag(BOOK(+id), p.lang) ? k : 0), 0);
  return main.map(b => bookRow(p, b)).join("") + (!rare.length || q ? "" :
    `<li><button class="link" type="button" data-act="more" aria-expanded="${!!p.more}" style="width:100%">${p.more ? "Fewer books" : "More books"}${n ? ` · ${n}` : ""}</button></li>`)
    + (p.more || q ? rare.map(b => bookRow(p, b)).join("") : "");
}

// ---------- shared pieces ----------
const totalBar = (t, label = "Save", act = "save", pre = "") =>
  `<div class="bar"><div class="total num"><strong>${booksN(t.n)}</strong><span class="muted">${rupees(t.amt)}</span></div>
    ${pre}${label ? `<button class="btn" type="button" data-act="${act}">${label}</button>` : ""}</div>`;
const saveBar = (label = "Save", pre = "") => `<div class="bar">${pre}<button class="btn wide" type="button" data-act="save">${label}</button></div>`;
const delBtn = k => `<button class="btn del" type="button" data-act="del" data-arg="${k}">Delete ${k}</button>`;
const modal = (q, no, yes, yesLabel, cls = "btn danger", sub = "") => `<div class="modal"><div class="card" role="alertdialog" aria-label="${q}"><h3>${q}</h3>${sub ? `<p class="muted" style="margin:-4px 0 0;text-align:center">${sub}</p>` : ""}
  <div class="two"><button class="btn soft" type="button" data-act="${no}">Cancel</button><button class="${cls}" type="button" data-act="${yes}">${yesLabel}</button></div></div></div>`;
const delModal = (q, sub = "") => S.del ? modal(q, "delno", "delyes", "Delete", undefined, sub) : "";
const sec = (title, act = "", label = "", aria = "") => `<div class="sec"><h2>${title}</h2>${act ? `<button class="hlink" type="button" data-act="${act}" aria-label="${aria}">${label}</button>` : ""}</div>`;
const editBtn = (act, arg, label) => `<button class="round" type="button" data-act="${act}" data-arg="${arg}" aria-label="${label}">${ICON.edit}</button>`;
function itemList(ls) {
  const m = new Map();
  ls.forEach(l => m.set(l.book_id, (m.get(l.book_id) || 0) + l.qty));
  return `<ul class="items num">${[...m].map(([id, n]) => { const b = BOOK(id);
    return `<li>${n} × <b>${SHORT(b)}</b> <span class="lang">${b.language}</span></li>`; }).join("")}</ul>`;
}
const totalEnd = ls => { const t = tot(ls); return `<div class="end num"><strong>${t.n}</strong><span class="muted">${rupees(t.amt)}</span></div>`; };
const names = ev => ev.team.map(u => NAME(u) + (u === ev.host_id ? " (Host)" : "")).join(", ");
const person = (u, end, host) => `<li class="row"><div class="avatar">${FACE(u)}</div><div class="info"><div class="name">${NAME(u)}</div>${u === host ? `<div class="sub">Host</div>` : ""}</div>${end}</li>`;
const teamList = o => `<ul class="list">${o.team.map(u => person(u, u === ME ? "" :
  `<button class="round" type="button" data-act="team" data-arg="${u}" aria-label="Remove ${NAME(u)}">${ICON.x}</button>`, ME)).join("")}</ul>`;
function evForm(o) {
  pick = o; // the place and volunteer pickers write here
  return `<ul class="list evf">
      <li><label class="row">${ICON.cal}<span class="name">Date</span><input type="date" value="${o.date}" max="${TODAY}" data-bind="date" aria-label="Date"></label></li>
      <li><button class="row" type="button" data-act="places">${ICON.pin}<span class="name">Place</span><span class="val">${o.place_id ? PLACE(o.place_id) : "Choose"}</span>${ICON.next}</button></li></ul>
    ${sec("Volunteers", "people", "Add", "Add volunteers")}
    ${teamList(o)}`;
}
// One event: details, hours once closed, and its entries newest first. Only the host can edit.
function evBody(ev) {
  const mine = ev.host_id === ME;
  const hours = !ev.closed_at ? "" : `${sec("Hours", mine ? "hours" : "", "Edit", "Edit hours")}
    <ul class="list">${ev.team.map(u => person(u, `<div class="end num"><strong>${hr(ev.hours[u] || 0)} h</strong></div>`, ev.host_id)).join("")}</ul>`;
  return `<div class="row"><div class="info"><div class="name">${day(ev.date)} · ${PLACE(ev.place_id)}</div><div class="sub">${names(ev)}</div></div>
      ${mine ? editBtn("evedit", "", "Edit event") : ""}</div>
    ${hours}${sec("Entries", mine ? "addentry" : "", "Add", "Add entry")}${ev.entries.length ? `<ul class="list">${ev.entries.map(x => `<li class="row top-align">
      <div class="info"><div class="name num">${time(x.at)}</div>${itemList(x.entry_lines)}</div>${totalEnd(x.entry_lines)}
      ${mine ? editBtn("edit", x.id, "Edit entry") : ""}</li>`).join("")}</ul>` : EMPTY("No entries yet")}`;
}
function placeRows() {
  const q = S.pq || "", withDist = S.here && pick.date === TODAY;
  const rows = sortedPlaces(pick.date).filter(p => matches(p.name, q)).map(p =>
    `<li><button class="row${p.id === pick.place_id ? " on" : ""}" type="button" data-act="place" data-arg="${p.id}">
      <div class="info"><div class="name">${esc(p.name)}</div></div><div class="end muted num">${withDist ? far(metres(S.here, p)) : ""}</div></button></li>`);
  return rows.join("") || `<li class="muted" style="padding:12px;text-align:center">No place found</li>`;
}
function peopleRows() {
  const q = S.uq || "";
  return [...D.people.keys()].filter(u => !pick.team.includes(u) && matches(D.people.get(u) || "", q)).map(u =>
    `<li><button class="row" type="button" data-act="team" data-arg="${u}" aria-label="Add ${NAME(u)}">
      <div class="avatar">${FACE(u)}</div><div class="info"><div class="name">${NAME(u)}</div></div><span class="round" aria-hidden="true">${ICON.plus}</span></button></li>`
  ).join("") || `<li class="muted" style="padding:12px;text-align:center">No volunteer found</li>`;
}
const PERIODS = { today: ["Today", 0], week: ["This week", 6], all: ["All", 99999] }; // label, days back
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = matchMedia("(display-mode: standalone)").matches || /** @type {any} */ (navigator).standalone;
let installEvt = null; // Android: Chrome's install prompt
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (S.screen === "signin") render(); });
function installHint() { // in a browser tab only
  if (standalone || S.noInstall) return "";
  const msg = isIos ? "Install: tap Share, then Add to Home Screen. Install before signing in." : installEvt ? "Install the app on this phone." : "";
  if (!msg) return "";
  return `<div class="install"><p>${msg}</p>${installEvt ? `<button class="hlink" type="button" data-act="install" style="color:var(--accent)">Install</button>` : ""}<button type="button" data-act="noinstall" aria-label="Hide">×</button></div>`;
}

// ---------- screens: each returns { title, back, body, bar } ----------
const VIEWS = {
  loading: () => ({ bare: true, body: `<div class="center"><p class="muted" style="text-align:center">Loading…</p></div>` }),
  signin: () => ({ bare: true, body: `<div class="center">
      <h1>Book Distribution</h1>
      <div class="form">
        <button class="btn line" type="button" data-act="google">${GOOGLE}Sign in with Google</button>
        ${installHint()}
      </div></div>` }),
  signup: () => ({ bare: true, body: `<div class="center">
      <h1>Sign up</h1>
      <div class="form">
        <label class="field" aria-label="Name">${ICON.user}<input id="pf-name" placeholder="Name" autocomplete="name"></label>
        <label class="field" aria-label="Phone"><span class="muted">+91</span><input id="pf-phone" type="tel" inputmode="numeric" placeholder="Phone number" autocomplete="tel"></label>
        <button class="btn" type="button" data-act="signup">Sign up</button>
        <button class="link" type="button" data-act="signout">Use another account</button>
      </div></div>` }),

  // No open event: start one here. Then this tab records books into it.
  add: () => {
    const ev = cur();
    if (!ev) return { title: "Start event", me: true, body: evForm(startForm()), bar: saveBar("Start event") };
    return { title: "Book distribution", sub: `${day(ev.date)} · ${PLACE(ev.place_id)}`, me: true, bar: totalBar(tot(pickLines(S.add.qty))),
      body: picker(S.add) };
  },
  event: () => {
    const ev = cur();
    if (!ev) return { title: "Current event", me: true, body: EMPTY("No event running"),
      bar: `<div class="bar"><button class="btn wide" type="button" data-act="tab" data-arg="add">Start event</button></div>` };
    return { title: "Current event", me: true, body: evBody(ev), bar: totalBar(tot(evLines(ev)), "Close event", "close") };
  },
  past: () => {
    const rows = D.events.filter(e => e.closed_at && e.team.includes(ME));
    return { title: "History", me: true, body: rows.length ? `<ul class="list">${rows.map(e =>
      `<li><button class="row" type="button" data-act="pv" data-arg="${e.id}">
        <div class="info"><div class="name">${day(e.date)} · ${PLACE(e.place_id)}</div><div class="sub">${names(e)}</div></div>${totalEnd(evLines(e))}</button></li>`).join("")}</ul>` : EMPTY("No past events") };
  },
  pastev: () => { const ev = evOf(S.pv); return { title: "Event", back: "past", body: evBody(ev), bar: totalBar(tot(evLines(ev)), "") }; },
  edit: () => ({ title: S.ed.entry ? "Edit entry" : "Add entry", back: S.ed.back, bar: totalBar(tot(pickLines(S.ed.qty)), "Save", "save", S.ed.entry ? delBtn("entry") : ""),
    body: picker(S.ed) + (S.ed.entry ? delModal("Delete entry?") : "") }),
  evedit: () => {
    const ev = evOf(S.ef.ev), n = ev.entries.length;
    return { title: "Edit event", back: S.ef.back, bar: saveBar("Save", delBtn("event")), body: evForm(S.ef) +
      delModal("Delete this event?", !n ? "" : n === 1 ? "Its entry will be deleted too." : `Its ${n} entries will be deleted too.`) };
  },
  hours: () => {
    const ev = evOf(S.hrs.ev), open = !ev.closed_at;
    return { title: open ? "Close event" : "Hours", back: S.hrs.back,
      body: `<h2>Hours of service</h2><ul class="list">${ev.team.map(u => person(u, `<div class="step">
        <button type="button" data-act="hr" data-arg="${u},-1" aria-label="Half an hour less for ${NAME(u)}">−</button>
        <input class="hrs num" type="text" inputmode="decimal" data-bind="h" data-u="${u}" value="${hr(S.hrs.h[u])}" aria-label="Hours for ${NAME(u)}"><span class="muted unit">h</span>
        <button class="plus" type="button" data-act="hr" data-arg="${u},1" aria-label="Half an hour more for ${NAME(u)}">+</button></div>`, ev.host_id)).join("")}</ul>
        ${S.hrs.sure ? modal("Close event?", "unsure", "save", "Close", "btn") : ""}`,
      bar: saveBar(open ? "Close event" : "Save") };
  },
  people: () => ({ title: "Volunteers", back: S.pplBack, body: `${teamList(pick)}<label class="field" aria-label="Search volunteers">${ICON.search}<input type="search" placeholder="Search volunteers" data-bind="uq" value="${esc(S.uq)}"></label>
      <ul class="list" id="ppl-list">${peopleRows()}</ul>`,
    bar: `<div class="bar"><button class="btn wide" type="button" data-act="go" data-arg="${S.pplBack}">Done</button></div>` }),
  places: () => ({ title: "Place", back: S.plBack, body: `<label class="field" aria-label="Search places">${ICON.search}<input id="pl-q" type="search" placeholder="Search places" data-bind="pq" value="${esc(S.pq)}"></label>
      <ul class="list" id="pl-list">${placeRows()}</ul>`,
    bar: `<div class="bar"><button class="btn soft wide" type="button" data-act="newplace">New location</button></div>` }),
  // Pin stays in the centre; the map moves under it. Starts at the current location. Saved places show so a duplicate is noticed.
  newplace: () => ({ title: "New location", back: "places", fill: true, body: `<div class="map fill"><div class="lmap" id="map" role="application" aria-label="Map. Move it to put the pin on the place"></div>
        <svg class="cpin" viewBox="0 0 24 32" aria-hidden="true"><path d="M12 31s10-9.500 10-18A10 10 0 0 0 2 13c0 8.500 10 18 10 18z"/><circle cx="12" cy="12.500" r="4"/></svg>
        <button class="round here" type="button" data-act="here" aria-label="Go to my location">${ICON.here}</button></div>
      <label class="field" aria-label="Place name">${ICON.pin}<input id="np-name" placeholder="Name this place" data-bind="name" value="${esc(S.np.name)}"></label>`,
    bar: saveBar() }),

  admin: () => {
    const tabs = `<div class="seg">${[["map", "Map"], ["people", "People"], ["events", "Events"]].map(([v, l]) =>
      `<button type="button" data-act="atab" data-arg="${v}" aria-pressed="${v === S.adminTab}">${l}</button>`).join("")}</div>`;
    if (S.adminTab === "events") return { title: "Admin", me: true, body: tabs + (D.events.length ? `<ul class="list">${D.events.map(ev => `<li class="row top-align">
      <div class="info"><div class="name">${NAME(ev.host_id)} · ${day(ev.date)} · ${PLACE(ev.place_id)}${ev.closed_at ? "" : ' <span class="lang">open</span>'}</div>
      <div class="sub">${names(ev)}</div>${itemList(evLines(ev))}</div>${totalEnd(evLines(ev))}</li>`).join("")}</ul>` : EMPTY("No events yet")) };
    if (S.adminTab === "people") return { title: "Admin", me: true, body: tabs + `${sec("Add a person")}<div class="form">
        <label class="field" aria-label="Name">${ICON.user}<input id="ap-name" placeholder="Name"></label>
        <label class="field" aria-label="Phone"><span class="muted">+91</span><input id="ap-phone" type="tel" inputmode="numeric" placeholder="Phone number"></label>
        <label class="field" aria-label="Email">${ICON.mail}<input id="ap-email" type="email" placeholder="Google email" autocapitalize="off"></label></div>
      ${sec("People")}<ul class="list">${[...D.people.keys()].map(u => person(u, "", 0)).join("")}</ul>`,
      bar: `<div class="bar"><button class="btn wide" type="button" data-act="addperson">Add person</button></div>` };
    const period = `<div class="caption"><div class="seg" role="group" aria-label="Period">${Object.entries(PERIODS).map(([k, [l]]) =>
        `<button type="button" data-act="period" data-arg="${k}" aria-pressed="${k === S.period}">${l}</button>`).join("")}</div></div>`;
    return { title: "Admin", me: true, body: tabs + `<div class="map"><div class="lmap" id="map" role="img" aria-label="Books distributed by place"></div>${period}</div>` };
  },
};

// ---------- maps ----------
let map = null;
function mountMap() {
  if (map) { map.remove(); map = null; }
  const el = document.getElementById("map");
  if (!el) return;
  const accent = getComputedStyle(el).getPropertyValue("--accent").trim(), muted = getComputedStyle(el).getPropertyValue("--muted").trim();
  map = L.map(el, { zoomControl: false, attributionControl: false });
  L.control.attribution({ prefix: false }).addTo(map); // credits only (the data's licence needs them), no "Leaflet"
  const ro = new ResizeObserver(() => map.invalidateSize()); // the map measures itself before the layout settles
  ro.observe(el); map.on("unload", () => ro.disconnect());
  // OpenFreeMap: free, no key, clean Google-like style (OpenStreetMap data); dark to match a dark phone.
  const style = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "liberty";
  /** @type {any} */ (L).maplibreGL({ style: `https://tiles.openfreemap.org/styles/${style}` }).addTo(map); // the style brings its own credits
  if (S.screen === "newplace") {
    D.places.forEach(p => L.circleMarker([p.lat, p.lng], { radius: 4, color: muted, fillOpacity: 1, weight: 0 }).bindTooltip(esc(p.name)).addTo(map));
    map.on("dragstart", () => { S.np.auto = false; });
    map.on("moveend", () => { const c = map.getCenter(); S.np.lat = c.lat; S.np.lng = c.lng; });
    map.setView([S.np.lat, S.np.lng], 17);
    // Live blue dot with its accuracy, like Google Maps. The map follows it until moved; map.remove() stops watching.
    const acc = L.circle([0, 0], { radius: 0, stroke: false, fillColor: "#1a73e8", fillOpacity: .15, interactive: false });
    const dot = L.circleMarker([0, 0], { radius: 7, color: "#fff", weight: 2, fillColor: "#1a73e8", fillOpacity: 1, interactive: false });
    map.on("locationfound", e => {
      S.here = { lat: e.latlng.lat, lng: e.latlng.lng };
      acc.setLatLng(e.latlng).setRadius(e.accuracy).addTo(map); dot.setLatLng(e.latlng).addTo(map);
      if (S.np.auto) map.setView(e.latlng, Math.max(map.getZoom(), 17));
    });
    map.locate({ watch: true, enableHighAccuracy: true });
    return;
  }
  const from = ago(PERIODS[S.period][1]), by = new Map();
  D.events.filter(e => e.date >= from).forEach(e => by.set(e.place_id, (by.get(e.place_id) || 0) + tot(evLines(e)).n));
  const max = Math.max(1, ...by.values()), pts = [];
  D.places.filter(p => by.get(p.id)).forEach(p => {
    const n = by.get(p.id);
    L.circleMarker([p.lat, p.lng], { radius: 8 + 22 * Math.sqrt(n / max), color: accent, weight: 1.5, fillOpacity: .28 })
      .bindTooltip(`${n}`, { permanent: true, direction: "center", className: "n" })
      .bindPopup(`${esc(p.name)}: ${booksN(n)}`).addTo(map);
    pts.push([p.lat, p.lng]);
  });
  if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 16 }); else map.setView(cityStart(), 12);
}
const cityStart = () => D.places.length ? [D.places.reduce((s, p) => s + p.lat, 0) / D.places.length, D.places.reduce((s, p) => s + p.lng, 0) / D.places.length] : CITY;

// ---------- render ----------
const $ = id => /** @type {any} */ (document.getElementById(id));
function render() {
  const v = VIEWS[S.screen]();
  const head = v.bare ? "" : `<header class="top">
      ${v.back ? `<button class="round" type="button" data-act="back" aria-label="Back">${ICON.back}</button>` : ""}
      <h1>${v.sub ? `<span class="evline">${v.sub}</span>` : ""}${v.title}</h1>
      ${v.me ? `<button class="round" type="button" data-act="account" aria-label="Account">${face(D.me.name, D.me.photo)}</button>` : ""}</header>`;
  S.backTo = v.back;
  $("view").innerHTML = head + v.body + (S.acct ? modal(esc(D.me.name), "acctno", "signout", "Sign out", "btn soft") : "")
    + (S.leave ? modal("Discard changes?", "keep", "discard", "Discard") : "");
  $("view").style.flex = v.bare || v.fill ? "1" : "";
  $("bottom").hidden = !!v.bare;
  $("bottom").innerHTML = v.bare ? "" : (v.bar || "") + `<nav class="tabs" aria-label="Sections">${
    [["add", "Distribute"], ["event", "Event"], ["past", "History"], ["admin", "Admin"]].filter(([k]) => k !== "admin" || D.me.is_admin).map(([k, l]) =>
      `<button type="button" data-act="tab" data-arg="${k}"${S.tab === k ? ' aria-current="page"' : ""}${k === "event" && !cur() ? " disabled" : ""}>${ICON[k]}${l}</button>`).join("")}</nav>`;
  mountMap();
  syncBack();
  // Unsaved Distribute counts survive the phone closing the app (e.g. while taking a UPI payment).
  try { if (D.me) localStorage.setItem("add", JSON.stringify({ me: ME, ev: cur()?.id, qty: S.add.qty })); } catch {}
}
// Phone back (Android swipe or button, iPhone edge swipe): closes a popup, else does what the screen's back button does.
// One history entry stands for "somewhere to go back to"; on a main tab there is none, so back leaves the app.
const backAct = () => S.leave ? ACTS.keep : S.del ? ACTS.delno : S.acct ? ACTS.acctno : S.screen === "hours" && S.hrs.sure ? ACTS.unsure
  : S.backTo ? ACTS.back : null;
// Leaving Edit entry or Edit event with changes asks first.
const evKey = f => JSON.stringify([f.date, f.place_id, [...f.team].sort()]);
const qtyKey = qty => JSON.stringify(Object.entries(qty).sort());
const dirty = () => S.screen === "edit" ? qtyKey(S.ed.qty) !== S.ed.orig : S.screen === "evedit" ? evKey(S.ef) !== S.ef.orig : false;
const leave = fn => { if (dirty()) { S.leave = fn; render(); } else fn(); };
let guard = false, skip = false;
function syncBack() {
  if (backAct() && !guard) { history.pushState(null, ""); guard = true; }
  else if (!backAct() && guard) { guard = false; skip = true; history.back(); } // drop it, or back would do nothing once
}
window.addEventListener("popstate", () => {
  if (skip) { skip = false; return; }
  guard = false;
  if (busy) return syncBack(); // mid-save: stay put
  backAct()?.();
});
const toTab = a => { S.tab = a; go(a); }; // after a save or delete: nothing left to discard
function go(screen) { S.screen = screen; S.del = null; S.acct = false; S.leave = null; render(); window.scrollTo(0, 0); }
let toastTimer;
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2000);
}
const errMsg = e => !navigator.onLine || /fetch|network/i.test(e?.message || "") ? "No internet. Try again."
  : e?.code === "23505" && /places_name/.test(e?.message) ? "That name is already used" : e?.code === "42501" ? "Not allowed" : e?.message || "Something went wrong";

async function save() {
  const s = S.screen, ev = cur();
  if (s === "add" && !ev) {
    const f = S.evf;
    if (!f.place_id) return toast("Choose a place");
    try { await q(sb.rpc("start_event", { p_date: f.date, p_place: f.place_id, p_volunteers: f.team })); }
    catch (e) { // started on another phone (or tab) after this one loaded: show that event
      if (!/one_open_event_per_host/.test(e?.message)) throw e;
      S.evf = null; await load(); render(); return toast("You already have an event running");
    }
    S.evf = null; await load(); render(); return toast("Event started");
  }
  if (s === "add") {
    if (!tot(pickLines(S.add.qty)).n) return toast("Add at least one book");
    await q(sb.rpc("save_entry", { p_event: ev.id, p_lines: lineArg(S.add.qty) }));
    S.add = { ...S.add, qty: {}, q: "" }; await load(); render(); // stay on the page, cleared for the next entry
  } else if (s === "edit") {
    if (!tot(pickLines(S.ed.qty)).n) return toast("Add at least one book");
    await q(sb.rpc("save_entry", { p_event: S.ed.ev, p_lines: lineArg(S.ed.qty), p_entry: S.ed.entry })); // books not listed are removed
    await load(); go(S.ed.back);
  } else if (s === "evedit") {
    const f = S.ef;
    await q(sb.rpc("update_event", { p_event: f.ev, p_date: f.date, p_place: f.place_id, p_volunteers: f.team }));
    await load(); go(f.back);
  } else if (s === "hours") {
    const e = evOf(S.hrs.ev), h = S.hrs.h;
    const hours = Object.fromEntries(e.team.map(u => [u, Math.min(999, Math.max(0, Math.round((Number(h[u]) || 0) * 10) / 10))]));
    if (!e.closed_at && !S.hrs.sure) { S.hrs.sure = true; return render(); }
    await q(sb.rpc("close_event", { p_event: e.id, p_hours: hours }));
    await load();
    if (S.hrs.back === "event") { toTab("past"); return toast("Event closed"); }
    go(S.hrs.back);
  } else if (s === "newplace") {
    const name = (S.np.name || "").trim();
    if (!name) return toast("Name this place");
    const row = await q(sb.from("places").insert({ name, lat: S.np.lat, lng: S.np.lng }).select("id").single());
    await load(); pick.place_id = row.id; go(S.plBack);
  }
  toast("Saved");
}

const ACTS = {
  go, save,
  back: () => leave(() => go(S.backTo)),
  keep: () => { S.leave = null; render(); },
  discard: () => S.leave(),
  google: () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } }),
  signup: async () => {
    const name = $("pf-name").value.trim(), phone = $("pf-phone").value.replace(/\D/g, "").slice(-10);
    if (!name) return toast("Enter your name");
    if (phone.length !== 10) return toast("Enter a 10-digit phone number");
    await q(sb.rpc("sign_up", { p_name: name, p_phone: phone }));
    await boot();
  },
  signout: async () => { await sb.auth.signOut(); D.me = null; go("signin"); },
  account: () => { S.acct = true; render(); },
  acctno: () => { S.acct = false; render(); },
  install: async () => { await installEvt?.prompt(); installEvt = null; render(); },
  noinstall: () => { S.noInstall = true; render(); },
  places: () => { S.plBack = S.screen; S.pq = ""; go("places"); }, // pick is still the form that opened it
  place: id => { pick.place_id = +id; go(S.plBack); },
  newplace: () => {
    const start = S.here || { lat: cityStart()[0], lng: cityStart()[1] };
    S.np = { name: (S.pq || "").trim(), ...start, auto: true }; // a failed search carries over as the name
    go("newplace");
  },
  here: () => {
    if (!S.here) return toast("Location is off");
    S.np.auto = true; map?.setView([S.here.lat, S.here.lng], Math.max(map.getZoom(), 17));
  },
  people: () => { S.pplBack = S.screen; S.uq = ""; go("people"); },
  team: u => { u = +u; pick.team = pick.team.includes(u) ? pick.team.filter(x => x !== u) : [...pick.team, u]; S.uq = ""; render(); },
  tab: a => leave(() => toTab(a)),
  pv: id => { S.pv = +id; go("pastev"); },
  edit: id => {
    const ev = S.screen === "pastev" ? evOf(S.pv) : cur(), x = ev.entries.find(x => x.id === +id);
    const qty = Object.fromEntries(x.entry_lines.map(l => [l.book_id, l.qty]));
    S.ed = { ev: ev.id, entry: x.id, back: S.screen, qty, orig: qtyKey(qty), lang: BOOK(x.entry_lines[0]?.book_id)?.kind === "kids" ? "KIDS" : BOOK(x.entry_lines[0]?.book_id)?.language || "ENG" };
    go("edit");
  },
  // + on the current event goes to Distribute; on a past one it opens the book picker for that event.
  addentry: () => {
    if (S.screen !== "pastev") return ACTS.tab("add");
    S.ed = { ev: S.pv, entry: null, back: S.screen, qty: {}, orig: qtyKey({}), lang: "ENG" }; go("edit");
  },
  del: k => { S.del = k; render(); },
  delno: () => { S.del = null; render(); },
  delyes: async () => {
    if (S.del === "entry") {
      await q(sb.from("entries").delete().eq("id", S.ed.entry)); await load(); go(S.ed.back);
    } else {
      const e = evOf(S.ef.ev);
      await q(sb.from("events").delete().eq("id", e.id)); await load(); toTab(e.closed_at ? "past" : "add");
    }
    toast("Deleted");
  },
  evedit: () => { const ev = S.screen === "pastev" ? evOf(S.pv) : cur(); S.ef = { ev: ev.id, back: S.screen, date: ev.date, place_id: ev.place_id, team: [...ev.team] }; S.ef.orig = evKey(S.ef); go("evedit"); },
  // Close: everyone's hours start at the time since the event started, rounded to half an hour.
  close: () => {
    if (tot(pickLines(S.add.qty)).n) return toast("Save the books on Distribute first");
    const ev = cur(), h = Math.max(0.5, Math.round((Date.now() - Date.parse(ev.started_at)) / 18e5) / 2);
    S.hrs = { ev: ev.id, back: "event", h: Object.fromEntries(ev.team.map(u => [u, h])) }; go("hours");
  },
  unsure: () => { S.hrs.sure = false; render(); },
  hr: a => { const [u, d] = a.split(","); S.hrs.sure = false; S.hrs.h[u] = Math.max(0, (Number(S.hrs.h[u]) || 0) + Number(d) * 0.5); render(); },
  hours: () => { const ev = evOf(S.pv); S.hrs = { ev: ev.id, back: "pastev", h: { ...ev.hours } }; go("hours"); },
  atab: a => { S.adminTab = a; render(); },
  period: a => { S.period = a; render(); },
  more: () => { pick.more = !pick.more; render(); },
  addperson: async () => {
    const name = $("ap-name").value.trim(), phone = $("ap-phone").value.replace(/\D/g, "").slice(-10), email = $("ap-email").value.trim().toLowerCase();
    if (!name) return toast("Enter a name");
    if (phone.length !== 10) return toast("Enter a 10-digit phone number");
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast("Enter their Google email");
    try { await q(sb.from("people").insert({ name, phone, email })); }
    catch (e) { return toast(e.code === "23505" ? "That email is already added" : errMsg(e)); }
    await load(); render(); toast("Added");
  },
};

let busy = false; // one database action at a time, so a double tap doesn't save twice
/** @param {any} [btn] the tapped button: shows "Saving…" when the action is slow */
async function run(fn, arg, btn) {
  if (busy) return;
  busy = true;
  const label = btn?.textContent, slow = setTimeout(() => { if (btn?.classList.contains("btn")) { btn.textContent = "Saving…"; btn.disabled = true; } }, 300);
  try { await fn(arg); } catch (e) { console.error(e); toast(errMsg(e)); }
  finally { busy = false; clearTimeout(slow); if (btn?.disabled && btn.isConnected) { btn.textContent = label; btn.disabled = false; } }
}
document.addEventListener("click", e => {
  const t = /** @type {Element} */ (e.target);
  const l = t.closest("[data-lang]"), b = /** @type {HTMLElement|null} */ (t.closest("[data-id]")), a = /** @type {HTMLElement|null} */ (t.closest("[data-act]"));
  if (l) { pick.lang = /** @type {HTMLElement} */ (l).dataset.lang; render(); }
  else if (b) {
    const k = b.dataset.id;
    pick.qty[k] = Math.max(0, (pick.qty[k] || 0) + Number(b.dataset.d));
    if (!pick.qty[k]) delete pick.qty[k];
    render();
  } else if (a) run(ACTS[a.dataset.act], a.dataset.arg, a);
});
document.addEventListener("input", e => { // keep typed values without redrawing the screen
  const el = /** @type {HTMLInputElement} */ (e.target), bind = el.dataset.bind, v = el.value;
  if (bind === "pq") { S.pq = v; $("pl-list").innerHTML = placeRows(); }
  else if (bind === "uq") { S.uq = v; $("ppl-list").innerHTML = peopleRows(); }
  else if (bind === "q") { pick.q = v; $("pick-list").innerHTML = pickRows(pick); } // redraw only the list so typing keeps focus
  else if (bind === "h") S.hrs.h[el.dataset.u] = v;
  else if (bind === "name") S.np.name = v;
  else if (bind === "date") pick.date = v;
});

// ---------- start ----------
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (location.search.includes("code=")) history.replaceState(null, "", location.pathname); // OAuth return
  if (!session) return go("signin");
  const [me] = await q(sb.rpc("my_person"));
  if (!me) return go("signup");
  D.me = me; ME = me.id;
  await load();
  try { const k = JSON.parse(localStorage.getItem("add") || "{}"); if (k.me === ME && k.ev && k.ev === cur()?.id) S.add.qty = k.qty; } catch {}
  S.tab = "add"; go("add");
}
run(boot);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
