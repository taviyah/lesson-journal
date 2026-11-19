# Lesson Journal (יומן שיעורים)

A small web app for a private **vocal coach** to log lessons. It runs entirely inside the teacher's
own Google account as a Google Apps Script web app: free, no server to maintain, and student data
never leaves her account. Hebrew, right-to-left, built for the iPad and also used on a laptop.
In daily use since 2026.

**Live demo with made-up students:** https://aviyah-apps.taviyah.workers.dev/demo/lesson-journal/

## What it does

- A weekly board pulled from Google Calendar: each lesson by student name and time, with lessons
  still waiting for a summary marked
- Tap a lesson to paste the summary (written by an AI from the teacher's voice note), tag songs and
  attach PDFs or recordings
- A page per student with the full history, newest first, and a "songs we've done" list
- Lessons from a second, read-only calendar (a studio's) are merged in and de-duplicated

## How it is built

| Path | What |
|---|---|
| `src/Code.gs` | Server code (Google Apps Script): Calendar for lessons, a Sheet for records, Drive for files |
| `src/Index.html` | The whole UI: HTML + CSS + plain JavaScript, no framework |
| `tools/build.py` | Writes `deploy/`: copies of `src/` with every non-ASCII character escaped, so the files survive being sent by message or renamed (the first install arrived as gibberish) |
| `tests/` | Node tests with fake Google services: 20 server checks (two calendars, de-duplication, songs, files, the daylight-saving week), a migration test that proves an upgrade keeps existing data, and UI tests in jsdom |

Data rules: new sheet columns are only ever appended, never reordered, so older rows keep working.
All server calls run under a script lock because the sheet is read and written as a whole.

## Run the tests

```bash
cd tests
npm install
node server.test.js ../src/Code.gs
node migrate.test.js fixtures/Code.before-absent.gs ../src/Code.gs
python ../tools/build.py && node ui-test.test.js
```

## Install your own copy

1. Create a new Apps Script project at script.google.com.
2. Run `python tools/build.py`, then paste `deploy/Code.gs` and `deploy/Index.html` into the project.
3. Run `setup()` once from the editor. It creates the lessons calendar, the data sheet and the files
   folder, and stores their IDs in Script Properties.
4. Deploy → New deployment → Web app.

Built with AI coding tools (Claude Code), designed with and tested by the teacher who uses it.

## License

MIT
