# Chrome Web Store — listing & privacy disclosures (tasks 12 + 13)

Ready-to-paste answers for the Chrome Web Store submission. Keep this in sync with the
actual manifest and [`privacy-policy.html`](privacy-policy.html). The listing copy, icons and
store graphics are prepared here (task 13); the actual upload happens in task 14. Image assets
live in [`store/`](store/).

---

## Listing metadata

| Field | Value |
| --- | --- |
| **Name** | TimePrice |
| **Version** | 1.0.0 |
| **Category** | Shopping |
| **Primary language** | Čeština (CZK-only product) |
| **Secondary language** | English (optional) |
| **Icon** | `store/` → built from `public/icon/*.png` (source `assets/icons/icon.svg`) |

> Category note: **Shopping** fits best (the extension acts on e-shop product/cart prices).
> **Productivity** is an acceptable alternative if Shopping is over-crowded; pick one, don't
> dual-list.

---

## Short description (max 132 chars)

**Čeština** (100 chars):

> Převádí ceny na e-shopech na čas, který musíš odpracovat. Zjisti, kolik hodin tě nákup
> reálně stojí.

**English** (optional, 92 chars):

> Turns e-shop prices into the work time you'd need to earn them. See the real cost in hours.

---

## Detailed description (Čeština)

> **Kolik hodin práce tě ten nákup reálně stojí?**
>
> TimePrice přepíše ceny na e-shopech na čas, který musíš odpracovat, abys na ně vydělal.
> Místo „30 000 Kč" uvidíš třeba „30 h" — rovnou v textu stránky, beze změny vzhledu.
>
> **Jak to funguje**
> 1. Otevři rozšíření a zadej svou čistou hodinovou sazbu (kolik ti reálně přijde za hodinu).
> 2. Procházej e-shopy jako obvykle — ceny se samy převedou na čas (minuty, hodiny, dny).
> 3. Najedeš myší na převedený údaj a uvidíš původní cenu v Kč.
>
> **Soukromí na prvním místě**
> TimePrice **nic neposílá** — žádný server, žádná analytika, žádné sledování. Všechno běží
> jen ve tvém prohlížeči a tvoje sazba se ukládá lokálně. Na citlivých webech (banky, platební
> brány, státní správa, brokeři) se rozšíření **nikdy nespustí**, i když je globálně zapnuté.
>
> **Ovládání**
> • Globální vypínač i přepínač pro jednotlivé weby.
> • Chytré jednotky — ukazuje dvě nejbližší (např. `1 h, 59 min` nebo `46 s`), ať i levné
>   položky a slevy dávají smysl.
>
> **Kde to fungovat má**
> Optimalizováno pro přední české e-shopy — Alza, Mall, Datart, CZC a Notino — a navíc funguje
> obecně všude, kde je u ceny uvedeno „Kč", „CZK" nebo „,-".
>
> **Co (zatím) neumí**
> • Pouze české koruny (CZK). Cizí měny nepřevádíme.
> • Nepřevádíme ceny vykreslené jako obrázek/canvas (typicky bannery) — jen textové ceny.
> • Daně za tebe nepočítáme: zadáváš čistou sazbu, jakou ji znáš.

---

## Detailed description (English, optional)

> **How many hours of work does that purchase really cost?**
>
> TimePrice rewrites prices on e-shops into the work time you'd need to earn them. Instead of
> "30 000 Kč" you see "30 h" — right in the page text, with the look unchanged.
>
> **How it works**
> 1. Open the extension and enter your net hourly rate.
> 2. Browse e-shops as usual — prices convert to time (minutes, hours, days) automatically.
> 3. Hover a converted value to see the original price.
>
> **Privacy first** — TimePrice sends nothing: no server, no analytics, no tracking. Everything
> runs in your browser and your rate is stored locally. It never runs on sensitive sites
> (banks, payment gateways, government, brokers), even when globally enabled.
>
> **Note:** Czech koruna (CZK) only for now; image/canvas-rendered prices aren't converted.

---

## Screenshots & promo graphics (`store/`)

Built from neutral, fictional demo content (no real brand/product names) to avoid trademark
issues on store graphics — see "Rizika" in [task 13](../tasks/13-icons-and-store-listing.md).
Re-render with [`store/render.sh`](store/render.sh).

| File | Size | Shows |
| --- | --- | --- |
| `store/01-before-after.png` | 1280×800 | Demo e-shop: prices in Kč → the same prices in work time. |
| `store/02-popup-rate.png` | 1280×800 | Popup: setting the net hourly rate. |
| `store/03-per-site-toggle.png` | 1280×800 | Popup: global + per-site on/off toggles. |
| `store/04-tooltip.png` | 1280×800 | Hover tooltip revealing the original Kč price. |
| `store/promo-440x280.png` | 440×280 | Small promo tile (icon + tagline). |

Upload 3–5 screenshots at 1280×800. The small promo tile (440×280) is required for some store
placements; the large 1400×560 marquee tile is optional and not produced here.

---

## Single purpose

> TimePrice converts prices on e-shops into the work time needed to earn them, based on the
> user's net hourly rate.

Czech (listing locale):

> Převádí ceny na e-shopech na čas potřebný k jejich vydělání podle uživatelovy hodinové
> sazby.

The extension does exactly this one thing. It has no secondary features that would broaden
its purpose.

---

## Privacy practices form

**Does this item collect or use user data?** — The extension does **not** collect or
transmit user data.

Data-usage category checkboxes — leave **all unchecked**. TimePrice does not collect:

- ❌ Personally identifiable information
- ❌ Health information
- ❌ Financial and payment information
- ❌ Authentication information
- ❌ Personal communications
- ❌ Location
- ❌ Web history
- ❌ User activity
- ❌ Website content

> ⚠️ "Website content": the content script *reads* on-page text to find prices, but nothing
> is **collected** (stored beyond the moment) or **transmitted**. The Web Store form asks
> about collection/transmission, not in-page reading, so this stays unchecked. The privacy
> policy explains the in-page reading explicitly.

Required certifications (all true for TimePrice):

- ✅ I do not sell or transfer user data to third parties, outside of approved use cases.
- ✅ I do not use or transfer user data for purposes that are unrelated to my item's single
  purpose.
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** `https://martinfreedom.com/timeprice/privacy-policy.html` — the hosted
copy of [`privacy-policy.html`](privacy-policy.html), mirrored in
[`src/constants/urls.ts`](../src/constants/urls.ts).

---

## Permission justifications

Reviewers ask for a per-permission justification. The manifest requests the minimum:
`storage`, `activeTab`, and a `<all_urls>` content-script match. **No** `tabs`, `scripting`,
`webNavigation`, `cookies`, or `host_permissions` beyond the content match.

| Permission | Justification |
| --- | --- |
| `storage` | Stores the user's hourly rate and on/off preferences locally. No remote storage. |
| `activeTab` | When the user opens the popup, lets it read the active tab's domain so the user can toggle conversion for just that site. No background tab access. |
| `<all_urls>` (content match) | The extension rewrites displayed prices on *any* e-shop the user visits; it cannot meet its purpose without running on arbitrary sites. Used only locally to convert prices to time — nothing is transmitted. |

### `<all_urls>` trade-off and fallback (decision record)

An extension with a `<all_urls>` content script that reads page DOM gets extra review
scrutiny. We keep `<all_urls>` deliberately:

- **Why not `activeTab`-only / `optional_host_permissions`?** That model makes the user grant
  access per site before anything happens, which kills the default-on "open any shop and
  prices are already in hours" effect — the core wow of the product (decision from the
  grill-me design pass). It also adds friction that most users won't push through.
- **Compensating controls** (so broad access stays trustworthy): a hard-coded sensitive-domain
  blocklist that runs even when globally enabled (banks, payment gateways, gov, brokers —
  task 09), a global and per-site off switch (task 09), the mechanically-enforced no-network
  guarantee (ESLint ban + this task's negative test), and a clear privacy policy.
- **Fallback plan if review rejects `<all_urls>`:** migrate to `optional_host_permissions`
  where the user grants access per site (or via a one-click "enable on this site"). This
  degrades default-on UX but passes review. We accept the UX hit only if forced.

---

## `storage.sync` and the "we transmit nothing" claim

`storage.sync` data can be synced by the browser across the user's devices **through their
browser-vendor account (e.g. Google)** — that is a browser feature, not a TimePrice server.
We never see or transmit it. Phrase any disclosure precisely so it does not read as our own
data collection.

Fallback if a reviewer treats `storage.sync` as transmission: switch to `storage.local` (no
cross-device sync). Minor UX loss (settings don't follow the user between devices), no change
to the privacy posture.

---

## Manual verification checklist (before submission)

- [ ] Built manifest requests only `storage` + `activeTab`; no `host_permissions`; content
      match is `<all_urls>` (verified in `.output/*/manifest.json`).
- [ ] On a real e-shop, DevTools → Network shows **zero** requests initiated by the extension
      (content script or background) after a full page interaction.
- [ ] Popup "Soukromí" link opens the privacy policy.
- [ ] `pnpm lint` passes, including the no-network rule and its negative test.
- [ ] Built manifest has `version` `1.0.0`, `icons` 16/32/48/128, and `action.default_icon`.
- [ ] Toolbar icon is legible on light and dark toolbars (not the WXT placeholder).
- [ ] `pnpm zip` produces an uploadable package under `.output/`.
- [ ] Short description ≤ 132 chars; listing claims match the MVP (CZK-only, top CZ shops +
      generic `Kč`/`CZK`/`,-` fallback) — no "works on every shop in every currency".
