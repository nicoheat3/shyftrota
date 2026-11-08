// POST /api/notify-cron
//
// Called every 5 minutes by a Supabase timer (pg_cron). Sends:
//   • Shift reminders — up to 2 hours before a shift starts, once per shift,
//     only for weeks that are posted and never on approved time off.
//   • Missed-chat emails — when someone has messages they haven't read for
//     10+ minutes, at most one email every 30 minutes.
//
// Each one goes out by email and/or as a phone notification, depending on
// what the person has set up.
//
// Only the Supabase timer can call this: it sends a secret that lives in the
// app_secrets table, which only the server key can read.

import { createClient } from "@supabase/supabase-js";
import { FROM, hasEmailKey, esc, unesc, to12, fmtDay, addDays, layout, sendAll, kicker, para, shiftTable, C, MONO } from "./_email.js";
import { loadSubs, sendPush, itemsFor, prefOn } from "./_push.js";

var SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
var SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

var REMIND_MINUTES = 120;      // how long before a shift the reminder goes out
var CHAT_WAIT_MIN = 10;        // unread for this long before we email
var CHAT_LOOKBACK_MIN = 120;   // ignore messages older than this
var CHAT_THROTTLE_MIN = 30;    // at most one chat email per person per this long
var DOW = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };

function safeEqual(a, b) {
  a = String(a || ""); b = String(b || "");
  if (!a || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

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
// "2026-11-04" + "07:00" in America/Los_Angeles -> UTC milliseconds
function zonedToUtc(dateStr, timeStr, tz) {
  var d = dateStr.split("-").map(Number), t = String(timeStr).split(":").map(Number);
  var guess = Date.UTC(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0);
  var first = guess - offsetMs(guess, tz);
  return guess - offsetMs(first, tz);
}
function weekStartOf(dateStr, startDayName) {
  var startDow = DOW[startDayName] != null ? DOW[startDayName] : 1;
  var dow = new Date(dateStr + "T12:00:00Z").getUTCDay();
  return addDays(dateStr, -((dow - startDow + 7) % 7));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SUPABASE_URL || !SERVICE_KEY) return res.status(500).json({ error: "Server misconfigured" });

  var db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  var sec = await db.from("app_secrets").select("value").eq("name", "cron_secret").maybeSingle();
  if (!sec.data || !safeEqual(req.headers["x-cron-secret"], sec.data.value)) return res.status(401).json({ error: "Unauthorized" });

  var appUrl = "https://" + (req.headers["x-forwarded-host"] || req.headers.host || "shyftrota-7yp8.vercel.app");
  var now = Date.now();
  var summary = { reminders: 0, chat: 0, pushed: 0, errors: [] };

  var emailOn = hasEmailKey();
  var nsRes = await db.from("notification_settings").select("*");
  var prefs = {}, settings = {}; // settings = people we can email
  (nsRes.data || []).forEach(function (r) { prefs[String(r.employee_id)] = r; if (r.email && emailOn) settings[String(r.employee_id)] = r; });
  var subs = await loadSubs(db, {});
  var subProp = {};
  Object.keys(subs).forEach(function (eid) { subProp[eid] = subs[eid][0].property_id; });
  // Everyone reachable for a given preference, with their property
  function reachable(prefKey) {
    var out = {};
    Object.keys(settings).forEach(function (eid) { if (settings[eid][prefKey]) out[eid] = settings[eid].property_id; });
    Object.keys(subs).forEach(function (eid) { if (prefOn(prefs[eid], prefKey)) out[eid] = out[eid] || subProp[eid]; });
    return out;
  }
  async function flushPush(items) {
    var p = await sendPush(db, items);
    summary.pushed += p.pushed; summary.errors = summary.errors.concat(p.errors);
  }

  var empRes = await db.from("employees").select("id, name, property_id");
  var empName = {};
  (empRes.data || []).forEach(function (e) { empName[e.id] = unesc(e.name); });

  // ═══ Shift reminders ═══════════════════════════════
  try {
    var props = await db.from("properties").select("id, timezone, week_start");
    var remindable = reachable("on_reminders");
    for (var pi = 0; pi < (props.data || []).length; pi++) {
      var prop = props.data[pi];
      var tz = prop.timezone || "America/Los_Angeles";
      var wanted = Object.keys(remindable).filter(function (eid) { return remindable[eid] === prop.id; });
      if (!wanted.length) continue;

      var today = localDate(now, tz), tomorrow = addDays(today, 1);
      var entries = await db.from("schedule_entries").select("employee_id, work_date, shift_id")
        .eq("property_id", prop.id).gte("work_date", today).lte("work_date", tomorrow).in("employee_id", wanted);
      if (!entries.data || !entries.data.length) continue;

      var pubs = await db.from("schedule_publish").select("week_start").eq("property_id", prop.id)
        .in("week_start", [weekStartOf(today, prop.week_start), weekStartOf(tomorrow, prop.week_start)]);
      var posted = {};
      (pubs.data || []).forEach(function (p) { posted[p.week_start] = true; });

      var defs = await db.from("shift_defs").select("id, label, start_time, end_time").eq("property_id", prop.id);
      var defById = {};
      (defs.data || []).forEach(function (d) { defById[d.id] = d; });
      var ovs = await db.from("shift_overrides").select("employee_id, work_date, start_time, end_time")
        .eq("property_id", prop.id).gte("work_date", today).lte("work_date", tomorrow);
      var ovByKey = {};
      (ovs.data || []).forEach(function (o) { ovByKey[o.work_date + "_" + o.employee_id] = o; });
      var ptos = await db.from("pto_requests").select("employee_id, start_date, end_date")
        .eq("property_id", prop.id).eq("status", "approved").lte("start_date", tomorrow).gte("end_date", today);

      var due = [];
      entries.data.forEach(function (e) {
        if (!posted[weekStartOf(e.work_date, prop.week_start)]) return;   // draft week — stay quiet
        var onPto = (ptos.data || []).some(function (p) { return String(p.employee_id) === String(e.employee_id) && e.work_date >= p.start_date && e.work_date <= (p.end_date || p.start_date); });
        if (onPto) return;
        var d = defById[e.shift_id], ov = ovByKey[e.work_date + "_" + e.employee_id];
        var start = ov ? ov.start_time : d && d.start_time;
        var end = ov ? ov.end_time : d && d.end_time;
        if (!start) return;
        var mins = (zonedToUtc(e.work_date, start, tz) - now) / 60000;
        if (mins <= 0 || mins > REMIND_MINUTES) return;
        due.push({ eid: e.employee_id, date: e.work_date, label: unesc(d ? d.label : e.shift_id), start: start, end: end, isToday: e.work_date === today });
      });
      if (!due.length) continue;

      // Claim each reminder first so two timer runs can never double-send
      var claim = await db.from("notification_log")
        .upsert(due.map(function (x) { return { kind: "reminder", ref: x.date, employee_id: x.eid }; }), { onConflict: "kind,ref,employee_id", ignoreDuplicates: true })
        .select("employee_id, ref");
      if (claim.error) { summary.errors.push("claim: " + claim.error.message); continue; }
      var claimed = {};
      (claim.data || []).forEach(function (c) { claimed[c.ref + "_" + c.employee_id] = true; });

      var mine = due.filter(function (x) { return claimed[x.date + "_" + x.eid]; });
      var phoneItems = [];
      mine.forEach(function (x) {
        var when = (x.isToday ? "today" : "tomorrow") + " at " + to12(x.start);
        phoneItems = phoneItems.concat(itemsFor(subs, x.eid, { title: "Your shift starts soon",
          body: x.label + (/shift\s*$/i.test(x.label) ? "" : " shift") + " " + when + (x.end ? " until " + to12(x.end) : ""), url: "/", tag: "reminder-" + x.date }));
      });
      if (phoneItems.length) await flushPush(phoneItems);
      var msgs = mine.filter(function (x) { return settings[String(x.eid)] && settings[String(x.eid)].on_reminders; }).map(function (x) {
        var when = (x.isToday ? "today" : "tomorrow") + " at " + to12(x.start);
        return {
          from: FROM, to: [settings[String(x.eid)].email],
          subject: "Reminder: " + x.label + " " + when,
          html: layout("Your shift starts soon",
            kicker(x.isToday ? "Today" : "Tomorrow") +
            para("Hi " + esc((empName[x.eid] || "").split(" ")[0]) + ", heads up: you start " + esc(when) + ".") +
            shiftTable([{ day: fmtDay(x.date), label: x.label, time: to12(x.start) + (x.end ? " – " + to12(x.end) : "") }]),
            appUrl, { preheader: x.label + " " + when, cta: "Open ShyftRota" }),
        };
      });
      var r1 = await sendAll(msgs);
      summary.reminders += r1.sent; summary.errors = summary.errors.concat(r1.errors);
    }
  } catch (e) { console.error("notify-cron reminders failed:", e); summary.errors.push("reminders: " + e.message); }

  // ═══ Missed chat messages ══════════════════════════
  try {
    var from = new Date(now - CHAT_LOOKBACK_MIN * 60000).toISOString();
    var until = new Date(now - CHAT_WAIT_MIN * 60000).toISOString();
    var recent = await db.from("chat_messages").select("id, property_id, channel, dm_a, dm_b, sender_eid, sender_name, body, created_at")
      .gte("created_at", from).lte("created_at", until).order("id", { ascending: true });
    if (recent.data && recent.data.length) {
      var profs = await db.from("profiles").select("id, employee_id, property_id").not("employee_id", "is", null);
      var chatty = reachable("on_chat");
      var people = (profs.data || []).filter(function (p) { return chatty[String(p.employee_id)] != null; });
      if (people.length) {
        var reads = await db.from("chat_reads").select("user_id, channel, last_read_at").in("user_id", people.map(function (p) { return p.id; }));
        var readAt = {};
        (reads.data || []).forEach(function (r) { readAt[r.user_id + "|" + r.channel] = Date.parse(r.last_read_at); });
        var st = await db.from("chat_email_state").select("*").in("employee_id", people.map(function (p) { return p.employee_id; }));
        var state = {};
        (st.data || []).forEach(function (s) { state[s.employee_id] = s; });

        var chatMsgs = [], chatPush = [], stateUpdates = [];
        people.forEach(function (p) {
          var eid = Number(p.employee_id), s = state[eid] || { last_msg_id: 0, last_sent_at: null };
          if (s.last_sent_at && now - Date.parse(s.last_sent_at) < CHAT_THROTTLE_MIN * 60000) return;
          var unread = recent.data.filter(function (m) {
            if (m.property_id !== p.property_id) return false;
            if (Number(m.sender_eid) === eid) return false;
            if (m.channel !== "general" && Number(m.dm_a) !== eid && Number(m.dm_b) !== eid) return false;
            if (m.id <= Number(s.last_msg_id || 0)) return false;
            var lr = readAt[p.id + "|" + m.channel];
            return !lr || Date.parse(m.created_at) > lr;
          });
          if (!unread.length) return;
          var lines = unread.slice(-5).map(function (m) {
            var where = m.channel === "general" ? "#team-general" : "Direct message";
            var text = unesc(m.body); if (text.length > 140) text = text.slice(0, 137) + "…";
            return '<div style="padding:12px 0;border-top:1px solid ' + C.line + '"><div style="font-family:' + MONO + ';font-size:11px;letter-spacing:0.04em;text-transform:uppercase;color:' + C.sub + '">' + esc(where) + ' · ' + esc(unesc(m.sender_name)) + '</div><div style="font-size:15px;line-height:1.5;color:' + C.text + ';margin-top:4px">' + esc(text) + '</div></div>';
          }).join("");
          var n = unread.length;
          var last = unread[unread.length - 1], lastText = unesc(last.body);
          if (lastText.length > 140) lastText = lastText.slice(0, 137) + "…";
          chatPush = chatPush.concat(itemsFor(subs, eid, {
            title: n === 1 ? unesc(last.sender_name) : n + " unread messages",
            body: (n === 1 ? "" : unesc(last.sender_name) + ": ") + lastText, url: "/", tag: "chat" }));
          stateUpdates.push({ employee_id: eid, last_msg_id: last.id, last_sent_at: new Date(now).toISOString() });
          if (!settings[String(eid)] || !settings[String(eid)].on_chat) return;
          chatMsgs.push({
            from: FROM, to: [settings[String(eid)].email],
            subject: n === 1 ? "New message from " + unesc(unread[0].sender_name) : n + " unread messages in ShyftRota",
            html: layout(n === 1 ? "You have a new message" : "You have " + n + " unread messages",
              kicker("Team chat") + lines + '<div style="border-top:1px solid ' + C.line + '"></div>' + (n > 5 ? '<div style="font-size:13px;color:' + C.sub + ';padding-top:10px">…and ' + (n - 5) + ' more</div>' : ''),
              appUrl, { preheader: unesc(last.sender_name) + ": " + lastText, cta: "Reply in ShyftRota" }),
          });
        });

        if (stateUpdates.length) {
          var up = await db.from("chat_email_state").upsert(stateUpdates, { onConflict: "employee_id" });
          if (up.error) summary.errors.push("chat state: " + up.error.message);
          else {
            var r2 = await sendAll(chatMsgs); summary.chat += r2.sent; summary.errors = summary.errors.concat(r2.errors);
            if (chatPush.length) await flushPush(chatPush);
          }
        }
      }
    }
  } catch (e) { console.error("notify-cron chat failed:", e); summary.errors.push("chat: " + e.message); }

  return res.status(200).json(summary);
}
