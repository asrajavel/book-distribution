# Stock and ledger (parked)

Removed from requirements.md on 2026-11-18. Full mockup with stock: `mockup-with-stock.html`, its check: `check-with-stock.js`.

## Stock and ledger (only people with the Stock page)

Purpose: a main volunteer takes books from the temple on credit, hands some to other
volunteers, and must track who holds his books and who owes him money.

### Loans

Books between two people are a loan, tracked per title and language, never as a rupee total.

    on loan from A to B = books A lent B − books B returned to A − books B paid A for   (per title)

- Each direction is separate: "You have from A" and "A has from you" never cancel out.
- Value is at the price on the day the books were lent, copied onto the entry.
  Returns and payments take the oldest books of that title first.
- Amount due = value of the books still on loan. A loan is settled when its list is empty.
- A volunteer can hold books from several people; each pair is independent.
- It does not depend on distribution entries, so missed sales entries never corrupt it.

### Ledger entries

All entries have: kind, from, to, date, entered-by, books.

| Kind | Books allowed | Effect |
| --- | --- | --- |
| Lend | only books the lender has in hand, up to that number (any for the Temple) | adds to the loan; stock of both |
| Return | only titles on loan from that person, up to the number left and the number the returner has in hand | removes from the loan; stock of both |
| Pay | only titles on loan, up to the number left (books in hand not needed); amount fills in at the lent price, not editable | removes from the loan; no stock change |
| Adjustment (add or remove) | Add: any title. Remove: only books in hand, up to that number. One side empty, plus a reason | that person's stock only |

- No money-only payments: every payment names the books it pays for.
- The Temple is one of the parties. The main volunteer enters temple pickups (Lend received),
  returns and payments himself; there is no temple login and no link to the temple's own app.
- A small volunteer lending books to someone for a stall is a Lend the other way.

### Screens

- Stock tab, People: for each person, amount and book count in each direction, or Settled.
- Person page: "You have from A" and "A has from you", each listing title, language, count and
  value, with Return and Pay buttons. Lend button, then history.
- Return and Pay pickers show only the books on loan, each with how many are left, plus Select all.
  Return also shows how many are in hand; sold books can only be paid for, not returned.
- Lend picker shows only the lender's books in hand, each with the number held. This applies
  whoever enters it: a borrower entering "I borrowed" is limited by the lender's stock.

### Books in hand

    in hand = books lent to me + returned to me − lent by me − returned by me
              − books distributed ± adjustments

- Calculated per title and language; never typed in directly.
- **Adjust stock** is a logged entry with a reason:
  Add (opening stock, books owed to nobody), Remove (damaged, gifted, lost).
- Books taken from the Temple or a volunteer must be entered as a Lend from them,
  not as an Add, so the loan is recorded. Removing a borrowed book (lost, damaged) does not
  reduce the loan; it is still returned or paid for.
- Only a distribution can take stock below zero (shown in red): it means books were
  distributed that were never entered as received. It is fixed by entering the missing Lend or an Add.
- A book missing from someone's stock cannot be lent until the missing Lend or Add is entered.

### Who enters

- Either party can enter a lend, return or payment; it counts immediately. No approvals,
  because volunteers are trusted.
- Both sides see the entry with who entered it and when. Either can edit or delete it.
- Warn before saving a likely duplicate (same two people, same day, same books).
- An edit or delete that would leave more books returned or paid than lent is refused.


### Related rules removed from the main requirements

- Per-person switch, set by an admin: **Stock page** on or off. Off for most volunteers at first, because it is confusing.
- A distribution is always accepted, whatever the stock figure says.
- Build order step (3): stock and ledger.
- Decided against:
  - Linking a sale to "whose stock" it came from (so no live split of sold vs still held).
  - Integration with the temple's own stock app.
  - Checking limits as of a back-dated entry's date: they use the stock at the time of entry.
- Open point:
  - Whether volunteers without the Stock page get a read-only "what I owe" view.
