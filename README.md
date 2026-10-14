# Workout Tracker

A small home-screen app for iPhone that shows a 4-day workout schedule with target reps, logs the weight and reps for every set, and remembers your last session for each exercise, so you know what to beat next time.

- Works offline once it's installed.
- All data stays on your iPhone in browser storage. There's no account and no server.
- Plain HTML/CSS/JS with no build step.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | App shell and iOS home-screen tags |
| `styles.css` | Mobile styles (dark theme, notch/home-bar safe areas) |
| `schedule.js` | **Your routine.** Edit exercises, target reps, and notes here |
| `app.js` | Screens, logging, history, chart, settings, backup |
| `sw.js` | Offline cache. Bump `VERSION` after changing any file |
| `manifest.json`, `icons/` | App name and icons |
| `make-icons.ps1` | Generates the PNG icons from the same design as `icons/icon.svg` |

## 1. Generate the icons (once)

In PowerShell, from this folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\make-icons.ps1
```

This creates `icons/apple-touch-icon.png`, `icons/icon-192.png`, and `icons/icon-512.png`. If you skip this step, the app draws its icon at runtime instead, but real PNGs are more reliable.

## 2. Test on your PC (optional)

You can open `index.html` directly in a browser. Offline caching only works over `http(s)`, so to test that too, serve the folder, for example:

```powershell
npx serve .
# or
python -m http.server 8000
```

## 3. Publish with GitHub Pages

1. Create a new repository on GitHub, for example `workout-tracker`.
2. Push this folder to it.
3. In the repository, go to **Settings > Pages**. Under "Build and deployment", choose **Deploy from a branch**, then set the branch to `main` and the folder to `/ (root)`, and save.
4. After a minute or so the app is live at `https://<your-username>.github.io/<repo-name>/`.

## 4. Install on iPhone

1. Open that URL in **Safari**. It has to be Safari; other browsers on iOS can't add web apps to the home screen as reliably.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Always open the app from the home-screen icon. It runs full-screen and keeps working offline.

Data saved in the home-screen app is separate from data in a regular Safari tab, so log your workouts from the icon.

## Using it

- **Home:** the four days. The day after your most recent workout is marked **Next**, and a day with unsaved sets is marked **In progress**.
- **Day view:** each exercise shows its target reps and what you did last time. The set rows are pre-filled with last session's weights and today's target reps. Adjust them, then tap the check mark on each set you complete. Entries save as you type, so closing the app mid-workout loses nothing.
- **Finish workout:** saves the ticked sets. Sets you didn't tick are not saved.
- **History** (button on each exercise): best set, last top weight, estimated 1 rep max, a chart of top weight per session, and every past session.
- **Settings** (gear icon): switch between kg and lb, export or import a backup, or delete all data.

## Backups

iOS keeps the home-screen app's data, but if you delete the app or reset the phone, it's gone. Every few weeks, go to **Settings > Export backup** and save the file to Files or iCloud Drive. **Import backup** merges a backup file into what's already on the phone, without creating duplicates.

## Changing the routine

Edit `schedule.js`. Each exercise has:

```javascript
{ id: "flat-db-press", name: "Flat Dumbbell Press", reps: [12, 10, 10, 8], note: "optional" }
```

- `reps` is the target for each set. Its length sets how many set rows appear.
- Keep an exercise's `id` the same if you rename it, or its history won't carry over. Two exercises that share an `id` (like Hammer Curl on Day 2 and Day 4) share history.
- Exercises that had no reps in the original plan (Tricep Overhead Extension, Cable Tricep Push, and all of Day 4) are set to `12 x 4`. Adjust them as needed.

After editing any file, increase `VERSION` in `sw.js` (for example from `"v1"` to `"v2"`) and push. Then open the app on your phone, and close and reopen it once to pick up the update.
