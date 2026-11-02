# Time tracker

A small personal web app for tracking where my time goes. It runs in the browser on my laptop, work PC and phone, and keeps its data in a private GitHub repo, so there is no server and no database.

## What it does

- **Hours**: one row per project (or task). Tap **+** to add 30 minutes, **-** to take the last 30 minutes back. Optional note on each tap.
- **Log**: timestamped notes ("Reached Site B", "Outage reported"). The time is filled in with now and can be changed with the device's date and time picker. Searchable.
- **Attendance**: one code per day, every day of the week: `O` office, `L` leave, `S` sick, `E` emergency, `WFH` work from home, `NT` went to office but no ID scan, `OD` on duty (other office or site), `W` week off. Today is waiting when the tab opens, and days that were missed are shown dashed so they can be filled in later.
- **Report**: hours per project and task for a week or a month, attendance counts, and a CSV download.
- **Themes**: Matcha, Milk, Almond, Leaves, Sea glass, Lavender haze, Chai, Inkwell. Remembered per device.

## How the data is stored

The app is plain HTML, CSS and JavaScript (no build step). Data lives in a **separate private repo** (`time-tracker-data`) as small JSON files, one record per line:

```
catalog.json            projects and tasks
hours/2026-11.json      every + tap this month
log/2026-11.json        log entries this month
attendance/2026.json    one entry per day this year
```

The app keeps a copy of each file in the browser, so it works instantly and offline. Changes are pushed to GitHub in the background through GitHub's contents API, using a fine-grained token that is limited to the data repo. The token is typed into Settings once per device and is stored only in that browser.

### Why two devices don't overwrite each other

Every record has an `id` and an `updated` time. If GitHub says the file changed while we were saving, the app downloads the new version, merges it with local changes (keep every record, newer `updated` wins per record) and saves again. Deleting a record leaves a small `{ "id": ..., "del": true }` marker, so a stale copy on another device can't bring it back.

## Set up on a new device

1. Open the app's web address.
2. Settings, then follow the steps to create a fine-grained token with **Contents: read and write** on the data repo only.
3. Paste it and tap Connect.

## Files

```
index.html        page shell
style.css         layout (colours come from the theme)
js/util.js        dates, DOM helper, attendance codes
js/themes.js      the eight themes
js/github.js      GitHub contents API client
js/store.js       local copy, merge and sync
js/hours.js  js/log.js  js/attendance.js  js/report.js  js/settings.js   one file per screen
js/app.js         start-up and tab navigation
sw.js             lets the app open offline
tests/sync-test.html   open in a browser to run the sync tests
```
