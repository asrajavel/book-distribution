// Runs the mockup's script against a stub page and plays one event from the starter's, a volunteer's and an admin's side.
const fs = require("fs"), assert = require("assert");
const html = fs.readFileSync(process.argv[2], "utf8");
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const els = {};
const el = id => els[id] ||= { id, innerHTML: "", style: {}, hidden: false, value: "", textContent: "" };
global.document = { getElementById: el, addEventListener() {} };
global.window = { scrollTo() {} };
const api = new Function(js + `
  return { S, ACTS, EVENTS, VIEWS, me: () => ME, save, render, placeRows, PLACES, keyOf, setRareLang, cur };`)();
const { S, ACTS } = api;
const view = () => el("view").innerHTML, bottom = () => el("bottom").innerHTML;
const drawAll = () => { for (const t of ["add", "event", "past", "admin"]) ACTS.tab(t); ACTS.go("signin"); ACTS.go("profile"); ACTS.tab("add"); };

assert.equal(api.me(), "rajavel"); drawAll();
assert(!bottom().includes("Admin") && !bottom().includes("Stats") && bottom().includes("Current event"));
// No open event: Distribute is the start form. Nearest place preselected; New location opens a map
assert(!api.cur() && view().includes("Start event") && !view().includes("pick-list"));
assert(/data-arg="event" disabled/.test(bottom())); // Current event is greyed out with no open event
assert.equal(S.evf.place, "Temple gate");
ACTS.places(); assert(view().includes("Bus stand")); assert(bottom().includes("New location"));
S.pq = "Dmart"; assert(api.placeRows().includes("No place found")); ACTS.newplace();
assert.equal(S.np.name, "Dmart"); assert(view().includes("np-pin"));
S.np.name = " "; api.save(); assert.equal(S.screen, "newplace"); // a name is required
S.np.name = "Dmart"; S.np.x = 100; api.save();
assert.equal(S.evf.place, "Dmart"); assert.equal(S.screen, "add"); assert.equal(api.PLACES.at(-1).x, 100);
ACTS.places(); ACTS.place(2); assert.equal(S.evf.place, "Market");
// volunteers: add Satya and Tarun, remove Tarun
ACTS.people(); ACTS.team("satya"); ACTS.team("tarun"); ACTS.team("tarun");
assert(view().includes('aria-label="Remove Satya"') && !view().includes('aria-label="Add Satya"') && view().includes('aria-label="Add Tarun"')); // added ones move to the top
ACTS.go("add");
assert.deepEqual(S.evf.team, ["rajavel", "satya"]); assert(view().includes("Satya"));
api.save(); const ev = api.cur(); assert(ev && ev.place === "Market" && view().includes("pick-list"));
assert(!/data-arg="event" disabled/.test(bottom()));
// entries: books only
api.save(); assert.equal(ev.entries.length, 0); // no books, no entry
S.add.qty = { "Tamil|bg": 2 }; api.save(); S.add.qty = { "English|kb": 1 }; api.save();
assert.equal(ev.entries.length, 2); assert.deepEqual(S.add.qty, {}); assert.equal(S.screen, "add");
ACTS.tab("event"); assert(view().includes('data-act="edit"') && bottom().includes("Close event") && bottom().includes("3 books"));
ACTS.edit(1); S.ed.qty = { "Tamil|bg": 1 }; api.save(); assert.equal(S.screen, "event"); assert.deepEqual(ev.entries[1].items, { "Tamil|bg": 1 });
ACTS.evedit(); S.ef.place = "Bus stand"; api.save(); assert.equal(ev.place, "Bus stand"); assert.equal(S.screen, "event");
// close: unsaved books block it; hours start at the time since the start
S.add.qty = { "Tamil|bg": 1 }; ACTS.close(); assert.equal(S.screen, "event"); S.add.qty = {};
ACTS.close(); assert.equal(S.screen, "hours"); assert.equal(S.hrs.h.rajavel, 0.5);
ACTS.hr("satya,1"); ACTS.hr("satya,1"); ACTS.hr("rajavel,-1"); ACTS.hr("rajavel,-1"); // ± half an hour, not below 0
assert.equal(S.hrs.h.rajavel, 0); assert(view().includes('value="1.5"') && view().includes('value="0.0"'));
assert(view().includes(">Host<")); // the host is marked
api.save(); assert(ev.open && view().includes('class="modal"')); // asks first
ACTS.unsure(); assert(!view().includes('class="modal"')); api.save(); api.save();
assert(!ev.open && ev.hours.satya === 1.5 && S.screen === "past" && view().includes("Bus stand"));
ACTS.pv(api.EVENTS.indexOf(ev)); ACTS.hours(); S.hrs.h.rajavel = "2"; api.save();
assert.equal(ev.hours.rajavel, 2); assert.equal(S.screen, "pastev"); assert(view().includes("2.0 h"));
// add an entry to a past event, then delete it after a popup
const n0 = ev.entries.length;
ACTS.addentry(); assert.equal(S.screen, "edit"); assert(!bottom().includes("Delete"));
S.ed.qty = { "English|kb": 4 }; api.save(); assert.equal(ev.entries.length, n0 + 1); assert.equal(S.screen, "pastev");
ACTS.edit(0); assert(bottom().includes(">Delete entry<")); ACTS.del("entry"); assert(view().includes("Delete entry?"));
ACTS.delno(); assert(!view().includes('class="modal"')); ACTS.del("entry"); ACTS.delyes();
assert.equal(ev.entries.length, n0); assert.equal(S.screen, "pastev");
ACTS.tab("add"); assert(view().includes("Start event")); ACTS.tab("event"); assert(view().includes("No event running"));
drawAll();

// Satya was on it: sees it read only. Admin sees every event.
el("si-user").value = "satya"; ACTS.signin(); assert(bottom().includes("Admin"));
ACTS.tab("past"); ACTS.pv(api.EVENTS.indexOf(ev)); assert(view().includes("Bus stand") && !view().includes('data-act="edit"') && !view().includes("Edit hours"));
ACTS.tab("admin"); assert(view().includes("Bus stand"));
ACTS.atab("events"); assert(view().includes("Rajavel · Today · Bus stand") && view().includes("Rajavel (Host), Satya")); ACTS.atab("map");
drawAll();
// Pannaga was on neither event
el("si-user").value = "pannaga"; ACTS.signin(); ACTS.tab("past"); assert(view().includes("No past events"));
ACTS.tab("add"); api.save(); assert(api.cur()); // starts an event at the preselected place
drawAll();
console.log("all checks passed");

// One tag row: a language shows its common books, rare ones folded under More books; KIDS is English only
ACTS.tab("add"); S.add.lang = "Tamil"; api.render();
let v = view();
assert(v.includes('data-lang="kids"') && !v.includes('data-lang="rare"') && v.includes(">Krsna ") && !v.includes(">Raja-vidya ") && !v.includes(">Krishna Coloring Book "));
assert(v.includes(">More books<"));
ACTS.more(); v = view(); assert(v.includes(">Raja-vidya ") && v.includes(">Fewer books<"));
assert.equal(api.keyOf(S.add, "rv"), "Tamil|rv"); // a rare book takes the selected language
S.add.qty = { "Tamil|bg": 1, "Tamil|rv": 2 }; ACTS.more(); v = view();
assert(!v.includes(">Raja-vidya ") && v.includes(">More books · 2<") && v.includes('aria-pressed="true">TAM<b>3</b>'));
S.add.q = "raja"; api.render(); assert(view().includes(">Raja-vidya ")); S.add.q = ""; // search finds rare books while folded
S.add.lang = "kids"; api.render(); v = view();
assert(v.includes(">Krishna Coloring Book ") && !v.includes(">Krsna ") && !v.includes("More books") && api.keyOf(S.add, "kc") === "English|kc");
S.add.qty = {}; S.add.lang = "English";
console.log("tags ok");

// Test toggle: RARE as its own tag; each rare book has a language (English first); changing it moves the count
ACTS.mode("true"); S.add.lang = "Tamil"; api.render(); v = view();
assert(v.includes('data-lang="rare"') && v.includes(">Krsna ") && !v.includes(">Raja-vidya ") && !v.includes("More books"));
S.add.lang = "rare"; api.render(); v = view();
assert(v.includes(">Raja-vidya ") && !v.includes(">Krsna ") && v.includes('data-rl="rv"') && v.includes('<option value="English" selected>'));
assert.equal(api.keyOf(S.add, "rv"), "English|rv");
S.add.qty = { "Tamil|bg": 1 }; api.setRareLang(S.add, "rv", "Hindi"); S.add.qty[api.keyOf(S.add, "rv")] = 2;
api.setRareLang(S.add, "rv", "Kannada"); assert.deepEqual(S.add.qty, { "Tamil|bg": 1, "Kannada|rv": 2 }); // count moves
api.render(); v = view();
assert(v.includes('aria-pressed="true">RARE<b>2</b>') && v.includes('aria-pressed="false">TAM<b>1</b>'));
ACTS.mode("false"); assert.equal(S.add.lang, "English"); assert(!view().includes('data-lang="rare"')); // back to More books
S.add.qty = {};
console.log("rare tag ok");

// + on the current event opens Distribute; deleting the event asks first, naming it and its entries
el("si-user").value = "pannaga"; ACTS.signin(); ACTS.tab("event"); ACTS.addentry(); assert.equal(S.screen, "add");
ACTS.tab("event"); ACTS.evedit(); ACTS.del("event"); assert(view().includes("and its 0 entries?"));
ACTS.delyes(); assert(!api.cur()); assert.equal(S.screen, "add"); assert(view().includes("Start event"));
console.log("add and delete ok");
