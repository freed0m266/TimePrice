# Chrome Web Store — listing & privacy disclosures (task 12)

Ready-to-paste answers for the Chrome Web Store submission. Keep this in sync with the
actual manifest and [`privacy-policy.html`](privacy-policy.html). Hosting the policy and the
final submission happen in tasks 13/14; this file is the prepared content.

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

**Privacy policy URL:** the hosted copy of [`privacy-policy.html`](privacy-policy.html)
(GitHub Pages — finalize URL at submission; planned
`https://freed0m266.github.io/TimePrice/privacy-policy.html`, mirrored in
[`src/constants/urls.ts`](../src/constants/urls.ts)).

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
