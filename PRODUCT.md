# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
ISKCON temple volunteers, mostly young and comfortable with phones, recording the books they hand out
while standing outdoors (street, market), phone in one hand, often in bright sunlight.
A few main volunteers are admins who review every event and a map of places.

## Product Purpose
Record which books each volunteer distributes, per outing (event), fast enough to do between
conversations on the street. Success: an entry takes a few taps and the temple sees what went out where.

## Operating Context
An event is one outing: date, place, volunteers, host. The host records entries (books and quantities)
and closes the event with each volunteer's hours. Books are a title in a language with a fixed price,
kind Common, Rare or Kids. Places are shared named map points. Full rules live in requirements.md.

## Capabilities and Constraints
- Installable mobile-first web app (PWA), static hosting, Supabase backend. Leaflet + OpenStreetMap map.
- Live app: `index.html` + `app.js` on GitHub Pages; the earlier mockups are in `archive/mockup/`.
- No alert/confirm/prompt; popups are in-page.
- Tabs: Distribute, Current event, Past events, Admin (admins only).

## Brand Commitments
None. No required name, logo or colors.

## Evidence on Hand
Book covers in `covers/`. No testimonials or brand assets.

## Product Principles
- Speed on the street beats completeness: the distribute screen is the product.
- One hand, glanceable, readable in sunlight.
- Very little text; every screen simple.
- Only the host edits; others see.
