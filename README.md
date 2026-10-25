# Moon Phases

A free, ad-free moon-phase web app: today's Moon, the next 14 days, any month, any year, as far into the future as you like. Everything is computed in the browser (Meeus, *Astronomical Algorithms*: phase instants to about a minute). No network calls, no tracking, works offline once opened, and installs to a phone home screen like a native app.

Live at https://jpkamil.github.io/moon/

**Install on iPhone/iPad:** open the URL in Safari → Share → *Add to Home Screen*.
**Install on Android / desktop Chrome:** use the browser's *Install app* prompt.

**Use it:** tabs switch between Today / Days / Month / Year. The arrows step by a day, a fortnight, a month or a year depending on the view; the date box jumps anywhere; **N/S** flips the view for the Southern Hemisphere. Keyboard: ← → to step, **T** for today. Tap a day in any calendar to open it.

Run locally with no build step: `python3 -m http.server 8000` and open http://localhost:8000.

Files: `index.html` shell; `app.js` views and drawing; `moon.js` astronomy (Meeus ch. 25, 47, 48, 49); `style.css`; `sw.js` service worker (bump `VERSION` in it when shipping changes, or phones keep the old cached copy); `manifest.webmanifest`; icons.
