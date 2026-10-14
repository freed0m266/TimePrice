# TimePrice

A browser extension that rewrites prices on e-shop pages into the work time needed to earn them,
entirely on the user's device.

## Language

**Work time**:
The amount of working time needed to earn a price at the user's hourly rate, shown as the top two
units (e.g. `3 h, 45 min`).
_Avoid_: duration, converted value

**Converted price**:
A price on a page that TimePrice has taken over: it can show either its work time or its original
price, and always keeps the original so it can be restored.
_Avoid_: replaced price, tp span

**Tooltip**:
The browser's own small grey label that appears after hovering a converted price, showing just
the value that is not currently displayed in the page text (no caption).
_Avoid_: bubble, popover, hover-swap (the retired in-place text swap)

**Time-first mode**:
The default: converted prices show their work time, and the tooltip shows the original price.

**Price-first mode**:
The opt-in mirror of time-first mode: converted prices keep showing the original price, and the
tooltip shows the work time.
_Avoid_: inverted mode, invert hover, price view
