// GET /api/calendar?t=<token>
//
// A private calendar feed (iCalendar / .ics) of one employee's shifts, for
// Apple Calendar, Google Calendar or Outlook to subscribe to. Calendar apps
// can't sign in, so the secret token in the link is the key; employees can
// reset it from My Schedule (calendar_feeds table, App/sql/calendar-feeds.sql).
//
// Includes posted weeks only (drafts stay private), skips days on approved
// time off, and uses custom shift times when a manager set them. Covers 30
// days back through 90 days ahead. Calendar apps re-check it on their own
// schedule (Apple: about hourly; Google: every few hours).

import { createClient } from "@supabase/supabase-js";

var SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
var SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
var DOW = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };

// ── Time zone helpers (no libraries) ─────────────────
function zoneParts(ms, tz) {
  var f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  var o = {};
  f.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
  return o;
}
function localDate(ms, tz) { var p = zoneParts(ms, tz); return p.year + "-" + p.month + "-" + p.day; }
function offsetMs(ms, tz) {
  var p = zoneParts(ms, tz);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}
function zonedToUtc(dateStr, timeStr, tz) {
  var d = dateStr.split("-").map(Number), t = String(timeStr).split(":").map(Number);
  var guess = Date.UTC(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0);
  var first = guess - offsetMs(guess, tz);
  return guess - offsetMs(first, tz);
}
function addDays(dateStr, n) {
  var d = new Date(dateStr + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function weekStartOf(dateStr, startDayName) {
  var startDow = DOW[startDayName] != null ? DOW[startDayName] : 1;
  var dow = new Date(dateStr + "T12:00:00Z").getUTCDay();
  return addDays(dateStr, -((dow - startDow + 7) % 7));
}
function unesc(s) {
  return String(s == null ? "" : s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
}

// ── iCalendar helpers ────────────────────────────────
function icsTime(ms) { return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
function icsText(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
// Lines over 75 bytes must be folded (RFC 5545).
function fold(line) {
  var out = [], cur = "";
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (Buffer.byteLength(cur + ch) > (out.length ? 74 : 75)) { out.push(cur); cur = ""; }
    cur += ch;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return res.status(405).send("Method not allowed");
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).send("Server misconfigured");
  var token = String((req.query && req.query.t) || "");
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(404).send("Not found");

  var db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  var feed = await db.from("calendar_feeds").select("employee_id, property_id").eq("token", token).maybeSingle();
  if (!feed.data) return res.status(404).send("Not found");
  var eid = feed.data.employee_id, pid = feed.data.property_id;

  var prop = await db.from("properties").select("name, timezone, week_start").eq("id", pid).maybeSingle();
  var tz = (prop.data && prop.data.timezone) || "America/Los_Angeles";
  var weekStartName = prop.data && prop.data.week_start;
  var placeName = unesc((prop.data && prop.data.name) || "");

  var today = localDate(Date.now(), tz);
  var from = addDays(today, -30), to = addDays(today, 90);

  var results = await Promise.all([
    db.from("schedule_entries").select("work_date, shift_id").eq("property_id", pid).eq("employee_id", eid).gte("work_date", from).lte("work_date", to),
    db.from("schedule_publish").select("week_start").eq("property_id", pid).gte("week_start", addDays(from, -7)).lte("week_start", to),
    db.from("shift_defs").select("id, label, start_time, end_time").eq("property_id", pid),
    db.from("shift_overrides").select("work_date, start_time, end_time").eq("property_id", pid).eq("employee_id", eid).gte("work_date", from).lte("work_date", to),
    db.from("pto_requests").select("start_date, end_date").eq("property_id", pid).eq("employee_id", eid).eq("status", "approved").lte("start_date", to).gte("end_date", from),
  ]);
  var failed = results.find(function (r) { return r.error; });
  if (failed) { console.error("calendar feed load failed:", failed.error); return res.status(500).send("Couldn't load schedule"); }
  var entries = results[0].data || [], pubs = results[1].data || [], defs = results[2].data || [], ovs = results[3].data || [], ptos = results[4].data || [];

  var posted = {}; pubs.forEach(function (p) { posted[p.week_start] = true; });
  var defById = {}; defs.forEach(function (d) { defById[d.id] = d; });
  var ovByDate = {}; ovs.forEach(function (o) { ovByDate[o.work_date] = o; });

  var lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ShyftRota//Schedule//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + icsText("ShyftRota shifts"), "X-WR-TIMEZONE:" + tz,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H",
  ];
  var stamp = icsTime(Date.now());
  entries.forEach(function (e) {
    if (!posted[weekStartOf(e.work_date, weekStartName)]) return;
    if (ptos.some(function (p) { return e.work_date >= p.start_date && e.work_date <= (p.end_date || p.start_date); })) return;
    var d = defById[e.shift_id], ov = ovByDate[e.work_date];
    var start = ov ? ov.start_time : d && d.start_time;
    var end = ov ? ov.end_time : d && d.end_time;
    if (!start || !end) return;
    var startMs = zonedToUtc(e.work_date, start, tz);
    var endMs = zonedToUtc(e.work_date, end, tz);
    if (endMs <= startMs) endMs = zonedToUtc(addDays(e.work_date, 1), end, tz); // overnight shift
    var label = unesc(d ? d.label : e.shift_id);
    lines.push(
      "BEGIN:VEVENT",
      "UID:" + e.work_date + "-" + eid + "@shyftrota.com",
      "DTSTAMP:" + stamp,
      "DTSTART:" + icsTime(startMs),
      "DTEND:" + icsTime(endMs),
      fold("SUMMARY:" + icsText(/shift$/i.test(label) ? label : label + " shift")),
      placeName ? fold("LOCATION:" + icsText(placeName)) : null,
      "DESCRIPTION:" + icsText("From ShyftRota. Changes to your schedule update here automatically."),
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");

  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", 'inline; filename="shyftrota.ics"');
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Robots-Tag", "noindex");
  return res.status(200).send(lines.filter(Boolean).join("\r\n") + "\r\n");
}
