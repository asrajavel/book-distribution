// Runs the mockup's script against a stub page and plays one scenario from two members' sides.
const fs = require("fs"), assert = require("assert");
const html = fs.readFileSync(process.argv[2], "utf8");
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
const els = {};
const el = id => els[id] ||= { id, innerHTML: "", style: {}, hidden: false, value: "", textContent: "" };
global.document = { getElementById: el, addEventListener() {} };
global.window = { scrollTo() {} };
const api = new Function(js + `
  return { S, ACTS, inHand, owe, owed, HIST, LEDGER, VIEWS, me: () => ME, save, render, placeRows, PLACES, BOOKS };`)();
const { S, ACTS, inHand, owe, owed, VIEWS } = api;
const count = () => Object.values(inHand()).reduce((a, b) => a + b, 0);
const drawAll = () => { for (const t of ["add", "history", "stock", "stats", "admin"]) ACTS.tab(t); ACTS.go("signin"); ACTS.go("profile"); };

assert.equal(api.me(), "rajavel"); el("si-user").value = "pannaga"; ACTS.signin();
assert.equal(api.me(), "pannaga"); assert.equal(count(), 14); // opening stock 10 + 4 Krishna Books lent by the Temple
assert.equal(owe("temple").amt, 1200);
drawAll();

// Pannaga lends Rajavel 3 Tamil Gitas
ACTS.tab("stock"); ACTS.entry(); S.tf.person = "rajavel"; S.tf.qty = { "Tamil|bg": 3 }; api.save();
assert.equal(count(), 11); assert.equal(owed("rajavel").amt, 750); assert.equal(owed("rajavel").n, 3);
assert.equal(S.screen, "person"); assert(el("view").innerHTML.includes("Rajavel has from you"));

// Rajavel's side
el("si-user").value = "rajavel"; ACTS.signin();
assert.equal(api.me(), "rajavel"); assert.equal(count(), 3); assert.equal(owe("pannaga").amt, 750);
assert.equal(owe("tarun").n + owed("tarun").n, 0);
// Lend shows only the lender's books in hand: Rajavel has just the 3 Tamil Gitas
ACTS.tab("stock"); ACTS.entry(); S.tf.person = "tarun"; api.render();
assert(el("view").innerHTML.includes("No books in hand"));
S.tf.lang = "Tamil"; api.render(); assert(el("view").innerHTML.includes("3 in hand"));
S.tf.qty = { "Tamil|bg": 4 }; api.save(); assert.equal(S.screen, "entry");
S.tf.qty = { "English|bg": 1 }; api.save(); assert.equal(S.screen, "entry");
// "I borrowed" is limited by the lender's stock (Pannaga has 2 Tamil Gitas left); the Temple has no limit
ACTS.tfdir("got"); S.tf.person = "pannaga"; S.tf.qty = { "Tamil|bg": 3 }; api.save(); assert.equal(S.screen, "entry");
S.tf.person = "temple"; api.render(); assert(!el("view").innerHTML.includes("in hand"));
assert.equal(count(), 3); ACTS.tab("add");
// place picker: the nearest saved place is preselected; New location opens a map with a pin and a name
assert.equal(S.add.place, "Temple gate");
ACTS.places(); assert(el("view").innerHTML.includes("Bus stand")); assert(el("bottom").innerHTML.includes("New location"));
S.pq = "Dmart"; assert(api.placeRows().includes("No place found")); ACTS.newplace();
assert.equal(S.np.name, "Dmart"); assert(el("view").innerHTML.includes("np-pin"));
S.np.name = " "; api.save(); assert.equal(S.screen, "newplace"); // a name is required
S.np.name = "Dmart"; S.np.x = 100; api.save();
assert.equal(S.add.place, "Dmart"); assert.equal(S.screen, "add"); assert.equal(api.PLACES.at(-1).x, 100);
ACTS.places(); ACTS.place(2); assert.equal(S.add.place, "Market");
S.add.qty = { "Tamil|bg": 2 }; api.save();
assert.equal(count(), 1); assert.equal(owe("pannaga").amt, 750); // selling does not touch the loan
// Rajavel edits that entry: 1 book at the Bus stand, then back
ACTS.tab("history"); assert(el("view").innerHTML.includes('data-act="edit"'));
ACTS.edit(0); S.ed.qty = { "Tamil|bg": 1 }; S.ed.place = "Bus stand"; api.save();
assert.equal(S.screen, "history"); assert.equal(count(), 2); assert(el("view").innerHTML.includes("Bus stand"));
ACTS.edit(0); S.ed.qty = { "Tamil|bg": 2 }; S.ed.place = "Market"; api.save(); assert.equal(count(), 1);
// Rajavel pays for the 2 he sold: the amount is fixed by the books, stock does not move
ACTS.person("pannaga"); ACTS.settle("pay gave"); assert(el("view").innerHTML.includes("3 left"));
S.tf.qty = { "Tamil|bg": 2 }; api.render(); assert(el("bottom").innerHTML.includes("₹500")); api.save();
assert.equal(owe("pannaga").amt, 250); assert.equal(owe("pannaga").n, 1); assert.equal(count(), 1);
assert(el("view").innerHTML.includes("You paid for 2 books"));
// He cannot return more than is on loan, or a book he never borrowed
ACTS.settle("return gave"); S.tf.qty = { "Tamil|bg": 2 }; api.save(); assert.equal(S.screen, "entry");
S.tf.qty = { "English|bg": 1 }; api.save(); assert.equal(S.screen, "entry");
ACTS.all(); assert.deepEqual(S.tf.qty, { "Tamil|bg": 1 }); api.save();
assert.equal(owe("pannaga").n, 0); assert.equal(count(), 0);
ACTS.tab("stock"); assert(el("view").innerHTML.includes("Settled"));
drawAll();
ACTS.tab("stats"); assert(el("view").innerHTML.includes("Rajavel")); assert(!el("bottom").innerHTML.includes("Admin"));

// Satya is admin: Admin tab with the map
el("si-user").value = "satya"; ACTS.signin(); assert(el("bottom").innerHTML.includes("Admin"));
ACTS.tab("admin"); assert(el("view").innerHTML.includes("Market"));
ACTS.atab("entries"); assert(el("view").innerHTML.includes("Rajavel · Today · Market")); ACTS.atab("map");

// Back to Pannaga: got 1 book back and was paid for 2, so the loan to Rajavel is settled
el("si-user").value = "pannaga"; ACTS.signin();
assert.equal(count(), 12); assert.equal(owed("rajavel").n, 0);
ACTS.person("rajavel"); assert(el("view").innerHTML.includes("Paid you for 2 books"));
ACTS.tab("history"); assert(el("view").innerHTML.includes("No entries yet"));
// Remove only takes books in hand (she has 4 Krishna Books); Add has no limit
ACTS.adjust(); assert(!el("view").innerHTML.includes("in hand"));
ACTS.adjdir("remove"); assert(el("view").innerHTML.includes("4 in hand"));
S.adj.qty = { "English|kb": 5 }; api.save(); assert.equal(S.screen, "adjust");
S.adj.qty = { "English|kb": 1 }; api.save(); assert.equal(count(), 11);
assert.equal(owe("temple").amt, 1200); // a lost borrowed book is still owed
// Value is at the price on the day lent; a return takes the oldest books first
const bg = api.BOOKS.find(b => b.id === "bg");
ACTS.person("tarun"); ACTS.entry(); S.tf.qty = { "English|bg": 2 }; api.save();
bg.price = 300; ACTS.entry(); S.tf.qty = { "English|bg": 1 }; api.save();
assert.equal(owed("tarun").amt, 800);
// Tarun sells 2 of his 3, so only 1 can come back; the rest must be paid for
api.HIST.unshift({ who: "tarun", date: "2026-01-01", place: "Market", items: { "English|bg": 2 } });
ACTS.settle("return got"); assert(el("view").innerHTML.includes("3 on loan · 1 in hand"));
S.tf.qty = { "English|bg": 2 }; api.save(); assert.equal(S.screen, "entry");
S.tf.qty = { "English|bg": 1 }; api.render(); assert(el("bottom").innerHTML.includes("₹250")); api.save();
assert.equal(owed("tarun").amt, 550); bg.price = 250;
ACTS.settle("return got"); assert(el("view").innerHTML.includes("No books in hand to return"));
ACTS.settle("pay got"); assert(el("view").innerHTML.includes("2 left"));
ACTS.tab("stock");
drawAll();
console.log("all checks passed");

// Size tags filter the picker; Kids hides the language chips and its books are always English
ACTS.tab("add"); S.add.lang = "Tamil"; S.add.size = "kids"; api.render();
let v = el("view").innerHTML;
assert(v.includes("Krishna Coloring Book") && !v.includes("Krishna Book<") && !v.includes('aria-label="Language"'));
S.add.size = "large"; api.render(); v = el("view").innerHTML;
assert(v.includes("Krishna Book<") && !v.includes("Sri Isopanisad") && !v.includes("Coloring"));
S.add.size = null; api.render(); assert(!el("view").innerHTML.includes("Coloring")); // kids only under English
S.add.lang = "English"; S.add.size = null; api.render(); assert(el("view").innerHTML.includes("Coloring"));
console.log("size tags ok");

// Steps mode: size, then language (skipped for Kids), then books; back goes one step; Save starts again
ACTS.mode("true"); S.add.qty = {}; api.render(); v = el("view").innerHTML;
assert(v.includes('data-size="large"') && !v.includes("pick-list"));
S.add.size = "large"; api.render(); assert(el("view").innerHTML.includes('data-lang="Tamil"'));
S.add.lang = "Tamil"; S.add.langPicked = true; api.render(); v = el("view").innerHTML;
assert(v.includes("Krishna Book<") && !v.includes("Sri Isopanisad") && v.includes("Large · Tamil"));
ACTS.restart(); assert(el("view").innerHTML.includes('data-lang="Tamil"')); ACTS.restart(); assert(!S.add.size);
S.add.size = "kids"; api.render(); assert(el("view").innerHTML.includes("Coloring") && !el("view").innerHTML.includes('data-lang'));
S.add.qty = { "English|kc": 1 }; S.add.place = "Market"; api.save(); assert(!S.add.size);
ACTS.mode("false");
console.log("steps ok");
