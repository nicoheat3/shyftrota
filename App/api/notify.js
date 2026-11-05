// POST /api/notify
//
// Sends ShyftRota email notifications through Resend. The app calls this
// right after an admin posts a schedule or answers a request. Everything is
// looked up again here with the server key — the browser only says WHAT
// happened, never who to email or what to say.
//
// Env vars (Vercel → Settings → Environment Variables):
//   RESEND_API_KEY   — from resend.com → API Keys (required)
//   NOTIFY_FROM      — e.g. "ShyftRota <schedule@shyftrota.com>" once your
//                      domain is verified in Resend. Until then the default
//                      test sender only delivers to your own Resend email.

import { createClient } from "@supabase/supabase-js";
import { FROM, hasEmailKey, esc, unesc, to12, fmtDay, addDays, layout, sendAll } from "./_email.js";

var SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
var SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: "Server misconfigured" });
  if (!hasEmailKey()) return res.status(200).json({ skipped: "no_key" });

  var auth = req.headers.authorization || "";
  var token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in" });

  var db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  var u = await db.auth.getUser(token);
  if (u.error || !u.data || !u.data.user) return res.status(401).json({ error: "Invalid session" });

  var prof = await db.from("profiles").select("role, property_id, employee_id").eq("id", u.data.user.id).single();
  if (prof.error || !prof.data || prof.data.role !== "admin") return res.status(403).json({ error: "Only admins send notifications" });
  var propertyId = prof.data.property_id;

  var appUrl = "https://" + (req.headers["x-forwarded-host"] || req.headers.host || "shyftrota.vercel.app");
  var body = req.body || {};

  // Who wants what, and where to send it
  var ns = await db.from("notification_settings").select("*").eq("property_id", propertyId);
  if (ns.error) { console.error("notify: settings load failed", ns.error); return res.status(500).json({ error: "Couldn't load notification settings" }); }
  var settings = {};
  (ns.data || []).forEach(function (r) { if (r.email) settings[r.employee_id] = r; });

  var emps = await db.from("employees").select("id, name").eq("property_id", propertyId);
  var empName = {};
  (emps.data || []).forEach(function (e) { empName[e.id] = unesc(e.name); });

  var defs = await db.from("shift_defs").select("id, label, start_time, end_time").eq("property_id", propertyId);
  var defById = {};
  (defs.data || []).forEach(function (d) { defById[d.id] = d; });
  function shiftText(shiftId, ov) {
    var d = defById[shiftId];
    var label = d ? d.label : shiftId;
    var s = ov ? ov.start_time : d && d.start_time, e = ov ? ov.end_time : d && d.end_time;
    return esc(unesc(label)) + (s && e ? " · " + to12(s) + "–" + to12(e) : "");
  }

  var messages = [];

  // ── Test email to yourself ──────────────────────────
  if (body.type === "test") {
    var mine = prof.data.employee_id != null ? settings[prof.data.employee_id] : null;
    if (!mine) return res.status(200).json({ skipped: "no_email" });
    var t = await sendAll([{ from: FROM, to: [mine.email], subject: "ShyftRota test email",
      html: layout("Email notifications are working", '<div style="font-size:14px;line-height:1.6">If you can read this, ShyftRota can email you. Schedule and request emails will arrive just like this one.</div>', appUrl) }]);
    t.to = mine.email;
    return res.status(200).json(t);
  }

  // ── Schedule posted ─────────────────────────────────
  if (body.type === "schedule_posted") {
    var start = String(body.weekStart || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return res.status(400).json({ error: "Bad weekStart" });
    var end = addDays(start, 6);
    var pub = await db.from("schedule_publish").select("week_start").eq("property_id", propertyId).eq("week_start", start).maybeSingle();
    if (!pub.data) return res.status(409).json({ error: "That week isn't posted" });

    var entries = await db.from("schedule_entries").select("employee_id, work_date, shift_id")
      .eq("property_id", propertyId).gte("work_date", start).lte("work_date", end);
    var ovs = await db.from("shift_overrides").select("employee_id, work_date, start_time, end_time")
      .eq("property_id", propertyId).gte("work_date", start).lte("work_date", end);
    var ovByKey = {};
    (ovs.data || []).forEach(function (o) { ovByKey[o.work_date + "_" + o.employee_id] = o; });
    var byEmp = {};
    (entries.data || []).forEach(function (r) { (byEmp[r.employee_id] = byEmp[r.employee_id] || []).push(r); });

    var range = fmtDay(start) + " – " + fmtDay(end);
    var only = body.only != null ? String(body.only) : null; // send to one person only
    if (only && !settings[only]) return res.status(200).json({ sent: 0, errors: [], skipped: "no_email" });
    if (only && !settings[only].on_schedule) return res.status(200).json({ sent: 0, errors: [], skipped: "opted_out" });
    Object.keys(settings).forEach(function (eid) {
      if (only && String(eid) !== only) return;
      var s = settings[eid];
      if (!s.on_schedule) return;
      var mine = (byEmp[eid] || []).sort(function (a, b) { return a.work_date < b.work_date ? -1 : 1; });
      var rows = mine.length
        ? mine.map(function (r) {
            return '<tr><td style="padding:6px 12px 6px 0;font-weight:600;white-space:nowrap">' + fmtDay(r.work_date) + '</td><td style="padding:6px 0">' + shiftText(r.shift_id, ovByKey[r.work_date + "_" + eid]) + '</td></tr>';
          }).join("")
        : '<tr><td style="padding:6px 0;color:#7A7469">No shifts for you this week.</td></tr>';
      var title = body.repost ? "Your schedule was updated" : "Your schedule is posted";
      messages.push({
        from: FROM, to: [s.email],
        subject: (body.repost ? "Updated schedule: " : "Schedule posted: ") + range,
        html: layout(title,
          '<div style="font-size:14px;color:#7A7469;margin-bottom:10px">Hi ' + esc((empName[eid] || "").split(" ")[0]) + ', here are your shifts for ' + esc(range) + '.</div>' +
          '<table style="font-size:14px;border-collapse:collapse">' + rows + '</table>', appUrl),
      });
    });
  }

  // ── Time off / swap answered ────────────────────────
  else if (body.type === "request_decided") {
    var table = body.kind === "swap" ? "swap_requests" : body.kind === "pto" ? "pto_requests" : null;
    if (!table) return res.status(400).json({ error: "Bad kind" });
    var rq = await db.from(table).select("*").eq("id", body.id).eq("property_id", propertyId).maybeSingle();
    if (!rq.data) return res.status(404).json({ error: "Request not found" });
    var r = rq.data;
    var approved = r.status === "approved";
    var declined = r.status === "denied" || r.status === "rejected";
    var cancelled = r.status === "cancelled";
    if (!approved && !declined && !cancelled) return res.status(200).json({ skipped: "Request is still pending" });
    var word = approved ? "approved" : cancelled ? "cancelled" : "declined";
    var color = approved ? "#047857" : "#B91C1C";

    function push(eid, subject, title, html) {
      var s = settings[eid];
      if (!s || !s.on_requests) return;
      messages.push({ from: FROM, to: [s.email], subject: subject, html: layout(title, html, appUrl) });
    }

    if (table === "pto_requests") {
      var when = fmtDay(r.start_date) + (r.end_date && r.end_date !== r.start_date ? " – " + fmtDay(r.end_date) : "");
      push(r.employee_id, "Time off " + word + ": " + when, "Your time off was " + word,
        '<div style="font-size:14px;line-height:1.6"><b style="color:' + color + '">' + esc(word[0].toUpperCase() + word.slice(1)) + '</b> — ' +
        esc(r.pto_type) + ', ' + esc(when) + '.</div>');
    } else {
      var day = fmtDay(r.work_date);
      push(r.from_employee_id, "Shift swap " + word + ": " + day, "Your swap request was " + word,
        '<div style="font-size:14px;line-height:1.6"><b style="color:' + color + '">' + esc(word[0].toUpperCase() + word.slice(1)) + '</b> — ' +
        esc(empName[r.to_employee_id] || "your coworker") + ' covering ' + shiftText(r.shift_id) + ' on ' + esc(day) + '.</div>');
      if (approved) {
        push(r.to_employee_id, "You're picking up a shift on " + day, "You picked up a shift",
          '<div style="font-size:14px;line-height:1.6">Your manager approved a swap: you\'re now working ' + shiftText(r.shift_id) +
          ' on ' + esc(day) + ' (covering ' + esc(empName[r.from_employee_id] || "a coworker") + ').</div>');
      }
    }
  }

  else return res.status(400).json({ error: "Unknown notification type" });

  var result = await sendAll(messages);
  return res.status(200).json(result);
}
