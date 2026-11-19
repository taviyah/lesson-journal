/**
 * יומן שיעורים – אפליקציית Google Apps Script
 *
 * השיעורים נקראים מיומן "שיעורים" ב-Google Calendar (כותרת האירוע = שם התלמיד/ה).
 * הסיכומים, השירים ורשימת התלמידים נשמרים בגיליון "יומן שיעורים – נתונים".
 * קבצים מצורפים נשמרים בתיקייה "יומן שיעורים – קבצים" ב-Google Drive.
 *
 * הפעלה ראשונה: להריץ פעם אחת את הפונקציה setup.
 */

var CAL_NAME = 'שיעורים';
var DB_NAME = 'יומן שיעורים – נתונים';
var FOLDER_NAME = 'יומן שיעורים – קבצים';
var TZ = 'Asia/Jerusalem';
var DEFAULT_MINUTES = 60;
var HISTORY_DAYS_BACK = 730;
var HISTORY_DAYS_FORWARD = 90;

var STUDENT_SHEET = 'תלמידים';
var LESSON_SHEET = 'שיעורים';
var STUDENT_HEADERS = ['id', 'name', 'hiddenSongs', 'created'];
var LESSON_HEADERS = ['key', 'studentId', 'date', 'time', 'summary', 'songs', 'files', 'updated'];

/* ---------- Web app ---------- */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('יומן שיעורים')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes');
}

/** Run once from the editor: creates the calendar, the data sheet and the files folder. */
function setup() {
  var cal = getCal_();
  var db = getDb_();
  var folder = getFolder_();
  Logger.log('מוכן. יומן: ' + cal.getName());
  Logger.log('גיליון נתונים: ' + db.getUrl());
  Logger.log('תיקיית קבצים: ' + folder.getUrl());
}

/**
 * Prints every calendar she can see with its ID (View > Logs / Execution log).
 * Copy the ID of a calendar to read from into the script property EXTRA_CAL_IDS.
 */
function listCalendars() {
  CalendarApp.getAllCalendars().forEach(function (c) {
    Logger.log(c.getName() + '   ->   ' + c.getId());
  });
}

/**
 * Use only if setup() ran with broken Hebrew names: forgets the calendar, sheet and folder
 * this project created (nothing is deleted), so the next setup() creates fresh ones.
 */
function resetSetup() {
  props_().deleteAllProperties();
  Logger.log('Reset done. Now run setup.');
}

/* ---------- Public functions (called from the app) ---------- */

/** Lessons for 7 days starting at startStr (yyyy-MM-dd, a Sunday). */
function getWeek(startStr) {
  return withLock_(function () {
    var now = Date.now();
    var dayStrs = [];
    for (var i = 0; i <= 7; i++) dayStrs.push(dayAfter_(startStr, i));
    var start = parseDay_(dayStrs[0]);
    var end = parseDay_(dayStrs[7]);

    var studs = students_();
    var recs = lessons_();
    var byKey = indexBy_(recs, 'key');
    var items = [];
    var seen = {};

    eventsIn_(start, end, null).forEach(function (ev) {
      if (ev.isAllDayEvent()) return;
      var base = baseFromEvent_(ev, studs);
      if (!base) return;
      seen[base.key] = true;
      items.push(toItem_(base, byKey[base.key], now));
    });
    recs.forEach(function (r) {
      if (seen[r.key]) return;
      if (r.date >= dayStrs[0] && r.date < dayStrs[7]) items.push(toItem_(baseFromRecord_(r, studs), r, now));
    });
    items = dedupe_(items);

    var days = [];
    for (var d = 0; d < 7; d++) {
      days.push({
        date: dayStrs[d],
        lessons: items.filter(function (it) { return it.date === dayStrs[d]; }).sort(byTimeAsc_)
      });
    }
    return { start: startStr, today: ymd_(new Date()), days: days };
  });
}

/** All students with last lesson date, lesson count and how many lessons wait for a summary. */
function getStudents() {
  return withLock_(function () {
    var now = Date.now();
    var studs = students_();
    var recs = lessons_();
    var items = allItems_(studs, recs, now, null);
    return studs.map(function (s) {
      var mine = items.filter(function (it) { return it.studentId === s.id; });
      var past = mine.filter(function (it) { return it.status !== 'planned'; }).sort(byTimeDesc_);
      return {
        id: s.id,
        name: s.name,
        count: past.length,
        last: past.length ? past[0].date : '',
        missing: mine.filter(function (it) { return it.status === 'missing'; }).length
      };
    }).sort(function (a, b) { return a.name.localeCompare(b.name, 'he'); });
  });
}

/** One student: full lesson history (newest first) and the songs list. */
function getStudent(id) {
  return withLock_(function () {
    var now = Date.now();
    var studs = students_();
    var s = studs.filter(function (x) { return x.id === id; })[0];
    if (!s) throw new Error('התלמיד/ה לא נמצא/ה');
    var recs = lessons_();
    var history = allItems_(studs, recs, now, s.name)
      .filter(function (it) { return it.studentId === s.id; })
      .sort(byTimeDesc_);
    return { id: s.id, name: s.name, history: history, songs: songsOf_(s, recs) };
  });
}

/** One lesson with its summary, songs, files and the student's earlier songs. */
function getLesson(base) {
  return withLock_(function () {
    var studs = students_();
    var recs = lessons_();
    var rec = indexBy_(recs, 'key')[base.key];
    var s = studs.filter(function (x) { return x.id === base.studentId; })[0];
    return {
      key: base.key,
      studentId: base.studentId,
      name: s ? s.name : '',
      date: base.date,
      time: base.time,
      summary: rec ? rec.summary : '',
      songs: rec ? rec.songs : [],
      files: rec ? rec.files : [],
      prevSongs: s ? songsOf_(s, recs).map(function (x) { return x.name; }) : []
    };
  });
}

function saveLesson(p) {
  return withLock_(function () {
    var songs = uniqueClean_(p.songs || []);
    var studs = students_();
    var s = studs.filter(function (x) { return x.id === p.studentId; })[0];
    if (s && s.hiddenSongs.length) {
      var hidden = s.hiddenSongs.filter(function (h) { return songs.indexOf(h) === -1; });
      if (hidden.length !== s.hiddenSongs.length) {
        s.hiddenSongs = hidden;
        writeStudent_(s);
      }
    }
    upsertLesson_(p, { summary: String(p.summary || ''), songs: songs });
    return { ok: true };
  });
}

/** Removes a song from a student's songs list. Lessons themselves are not changed. */
function hideSong(studentId, song) {
  return withLock_(function () {
    var s = students_().filter(function (x) { return x.id === studentId; })[0];
    if (!s) throw new Error('התלמיד/ה לא נמצא/ה');
    var n = norm_(song);
    if (s.hiddenSongs.indexOf(n) === -1) s.hiddenSongs.push(n);
    writeStudent_(s);
    return { ok: true };
  });
}

function uploadFile(base, fileName, mimeType, b64) {
  var studs = withLock_(function () { return students_(); });
  var s = studs.filter(function (x) { return x.id === base.studentId; })[0];
  var folder = studentFolder_(s ? s.name : 'ללא שם');
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), mimeType || 'application/octet-stream', fileName);
  var file = folder.createFile(blob);
  var info = { id: file.getId(), name: fileName, url: file.getUrl(), mime: mimeType || '', size: file.getSize() };
  return withLock_(function () {
    var cur = indexBy_(lessons_(), 'key')[base.key];
    var files = (cur ? cur.files : []).concat([info]);
    upsertLesson_(base, { files: files });
    return files;
  });
}

/** Removes a file from a lesson and moves it to the Google Drive trash (recoverable there). */
function removeFile(base, fileId) {
  var files = withLock_(function () {
    var cur = indexBy_(lessons_(), 'key')[base.key];
    var left = (cur ? cur.files : []).filter(function (f) { return f.id !== fileId; });
    upsertLesson_(base, { files: left });
    return left;
  });
  try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { /* already gone */ }
  return files;
}

/** Adds a lesson by creating an event in the "שיעורים" calendar. */
function addLesson(p) {
  return withLock_(function () {
    var s = ensureStudent_(p.name, students_());
    if (!s) throw new Error('חסר שם תלמיד/ה');
    var start = Utilities.parseDate(p.date + ' ' + p.time, TZ, 'yyyy-MM-dd HH:mm');
    var minutes = Number(p.minutes) || DEFAULT_MINUTES;
    getCal_().createEvent(s.name, start, new Date(start.getTime() + minutes * 60000));
    return { ok: true, name: s.name };
  });
}

function addStudent(name) {
  return withLock_(function () {
    var s = ensureStudent_(name, students_());
    if (!s) throw new Error('חסר שם');
    return { id: s.id, name: s.name };
  });
}

/* ---------- Lessons: building items ---------- */

function baseFromEvent_(ev, studs) {
  var title = norm_(ev.getTitle());
  if (!title) return null;
  var s = ensureStudent_(title, studs);
  var startTime = ev.getStartTime();
  var key = ev.isRecurringEvent() ? ev.getId() + '|' + ymd_(startTime) : ev.getId();
  return { key: key, studentId: s.id, name: s.name, date: ymd_(startTime), time: hm_(startTime), endMs: ev.getEndTime().getTime() };
}

function baseFromRecord_(r, studs) {
  var s = studs.filter(function (x) { return x.id === r.studentId; })[0];
  var startMs = Utilities.parseDate(r.date + ' ' + (r.time || '00:00'), TZ, 'yyyy-MM-dd HH:mm').getTime();
  return { key: r.key, studentId: r.studentId, name: s ? s.name : '', date: r.date, time: r.time, endMs: startMs + DEFAULT_MINUTES * 60000 };
}

function toItem_(base, rec, now) {
  var summary = rec ? String(rec.summary || '') : '';
  var status = summary.trim() ? 'done' : (base.endMs < now ? 'missing' : 'planned');
  return {
    key: base.key,
    studentId: base.studentId,
    name: base.name,
    date: base.date,
    time: base.time,
    status: status,
    summary: summary,
    songs: rec ? rec.songs : [],
    files: rec ? rec.files : []
  };
}

/** Lessons from the calendar (history range) merged with saved records. search = student name or null. */
function allItems_(studs, recs, now, search) {
  var byKey = indexBy_(recs, 'key');
  var from = new Date(now - HISTORY_DAYS_BACK * 86400000);
  var to = new Date(now + HISTORY_DAYS_FORWARD * 86400000);
  var events = eventsIn_(from, to, search);
  var items = [];
  var seen = {};
  events.forEach(function (ev) {
    if (ev.isAllDayEvent()) return;
    if (search && norm_(ev.getTitle()) !== norm_(search)) return;
    var base = baseFromEvent_(ev, studs);
    if (!base) return;
    seen[base.key] = true;
    items.push(toItem_(base, byKey[base.key], now));
  });
  recs.forEach(function (r) {
    if (!seen[r.key]) items.push(toItem_(baseFromRecord_(r, studs), r, now));
  });
  return dedupe_(items);
}

/** Events from the main calendar plus any calendars listed in the script property EXTRA_CAL_IDS. */
function eventsIn_(from, to, search) {
  var cals = [getCal_()];
  String(props_().getProperty('EXTRA_CAL_IDS') || '').split(/[\s,]+/).forEach(function (id) {
    if (!id) return;
    var c = null;
    try { c = CalendarApp.getCalendarById(id); } catch (e) { c = null; }
    if (c && c.getId() !== cals[0].getId()) cals.push(c);
  });
  var out = [];
  cals.forEach(function (c) {
    out = out.concat(search ? c.getEvents(from, to, { search: search }) : c.getEvents(from, to));
  });
  return out;
}

/** The same student at the same date and time is one lesson, even if it is in two calendars. */
function dedupe_(items) {
  var best = {};
  var order = [];
  items.forEach(function (it) {
    var k = it.studentId + '|' + it.date + '|' + it.time;
    var cur = best[k];
    var score = (it.summary.trim() ? 2 : 0) + (it.files.length || it.songs.length ? 1 : 0);
    if (!cur) { best[k] = { it: it, score: score }; order.push(k); }
    else if (score > cur.score) best[k] = { it: it, score: score };
  });
  return order.map(function (k) { return best[k].it; });
}

/** Songs a student has worked on, newest first, without the ones she deleted from the list. */
function songsOf_(s, recs) {
  var map = {};
  recs.filter(function (r) { return r.studentId === s.id; }).forEach(function (r) {
    r.songs.forEach(function (name) {
      var n = norm_(name);
      if (!n || s.hiddenSongs.indexOf(n) !== -1) return;
      if (!map[n]) map[n] = { name: n, count: 0, last: '' };
      map[n].count++;
      if (r.date > map[n].last) map[n].last = r.date;
    });
  });
  return Object.keys(map).map(function (k) { return map[k]; })
    .sort(function (a, b) { return a.last < b.last ? 1 : a.last > b.last ? -1 : 0; });
}

/* ---------- Storage ---------- */

function props_() { return PropertiesService.getScriptProperties(); }

function getCal_() {
  var p = props_();
  var id = p.getProperty('CAL_ID');
  var cal = id ? CalendarApp.getCalendarById(id) : null;
  if (!cal) {
    var found = CalendarApp.getOwnedCalendarsByName(CAL_NAME);
    cal = found.length ? found[0] : CalendarApp.createCalendar(CAL_NAME, { color: CalendarApp.Color.PURPLE });
    p.setProperty('CAL_ID', cal.getId());
  }
  return cal;
}

function getDb_() {
  var p = props_();
  var id = p.getProperty('DB_ID');
  var ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(DB_NAME);
    var s1 = ss.getSheets()[0];
    s1.setName(STUDENT_SHEET);
    var s2 = ss.insertSheet(LESSON_SHEET);
    prepSheet_(s1, STUDENT_HEADERS);
    prepSheet_(s2, LESSON_HEADERS);
    p.setProperty('DB_ID', ss.getId());
  }
  return ss;
}

function prepSheet_(sh, headers) {
  sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setRightToLeft(true);
}

function getFolder_() {
  var p = props_();
  var id = p.getProperty('FOLDER_ID');
  var folder = null;
  if (id) { try { folder = DriveApp.getFolderById(id); } catch (e) { folder = null; } }
  if (!folder) {
    folder = DriveApp.createFolder(FOLDER_NAME);
    p.setProperty('FOLDER_ID', folder.getId());
  }
  return folder;
}

function studentFolder_(name) {
  var parent = getFolder_();
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function sheet_(name) { return getDb_().getSheetByName(name); }

function readRows_(sh, headers) {
  var last = sh.getLastRow();
  if (last < 2) return [];
  var values = sh.getRange(2, 1, last - 1, headers.length).getValues();
  return values.map(function (row, i) {
    var o = { _row: i + 2 };
    headers.forEach(function (h, j) {
      var v = row[j];
      if (v instanceof Date) v = h === 'time' ? hm_(v) : ymd_(v);
      o[h] = v === null || v === undefined ? '' : String(v);
    });
    return o;
  }).filter(function (o) { return o[headers[0]]; });
}

function writeVals_(sh, rowIndex, vals) {
  var r = rowIndex || sh.getLastRow() + 1;
  var range = sh.getRange(r, 1, 1, vals.length);
  range.setNumberFormat('@');
  range.setValues([vals]);
}

function students_() {
  return readRows_(sheet_(STUDENT_SHEET), STUDENT_HEADERS).map(function (r) {
    r.hiddenSongs = parseJson_(r.hiddenSongs, []);
    return r;
  });
}

function writeStudent_(s) {
  writeVals_(sheet_(STUDENT_SHEET), s._row, [s.id, s.name, JSON.stringify(s.hiddenSongs || []), s.created || nowStr_()]);
}

function ensureStudent_(name, list) {
  var n = norm_(name);
  if (!n) return null;
  var found = list.filter(function (s) { return norm_(s.name) === n; })[0];
  if (found) return found;
  var s = { id: 's' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), name: n, hiddenSongs: [], created: nowStr_() };
  var sh = sheet_(STUDENT_SHEET);
  s._row = sh.getLastRow() + 1;
  writeStudent_(s);
  list.push(s);
  return s;
}

function lessons_() {
  return readRows_(sheet_(LESSON_SHEET), LESSON_HEADERS).map(function (r) {
    r.songs = parseJson_(r.songs, []);
    r.files = parseJson_(r.files, []);
    return r;
  });
}

function upsertLesson_(base, changes) {
  var sh = sheet_(LESSON_SHEET);
  var cur = indexBy_(lessons_(), 'key')[base.key];
  var o = {
    key: base.key,
    studentId: base.studentId || (cur && cur.studentId) || '',
    date: base.date || (cur && cur.date) || '',
    time: base.time || (cur && cur.time) || '',
    summary: cur ? cur.summary : '',
    songs: cur ? cur.songs : [],
    files: cur ? cur.files : []
  };
  Object.keys(changes).forEach(function (k) { o[k] = changes[k]; });
  writeVals_(sh, cur ? cur._row : null, [o.key, o.studentId, o.date, o.time, o.summary, JSON.stringify(o.songs), JSON.stringify(o.files), nowStr_()]);
  return o;
}

/* ---------- Helpers ---------- */

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function indexBy_(arr, k) { var m = {}; arr.forEach(function (x) { m[x[k]] = x; }); return m; }
function parseJson_(s, dflt) { try { var v = JSON.parse(s); return v === null ? dflt : v; } catch (e) { return dflt; } }
function norm_(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function uniqueClean_(arr) {
  var out = [];
  arr.forEach(function (x) { var n = norm_(x); if (n && out.indexOf(n) === -1) out.push(n); });
  return out;
}
function ymd_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function hm_(d) { return Utilities.formatDate(d, TZ, 'HH:mm'); }
function nowStr_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function parseDay_(s) { return Utilities.parseDate(s, TZ, 'yyyy-MM-dd'); }
function dayAfter_(s, n) {
  // Noon avoids landing on the wrong day when clocks change.
  var noon = Utilities.parseDate(s + ' 12:00', TZ, 'yyyy-MM-dd HH:mm');
  return ymd_(new Date(noon.getTime() + n * 86400000));
}
function byTimeAsc_(a, b) { var x = a.date + a.time, y = b.date + b.time; return x < y ? -1 : x > y ? 1 : 0; }
function byTimeDesc_(a, b) { return -byTimeAsc_(a, b); }
