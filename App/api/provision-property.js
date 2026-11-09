import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { sendAll, layout, hasEmailKey, FROM, kicker, para, strong, shiftTable, unesc } from "./_email.js";

// Creates a brand new customer workspace: auth login, property, admin profile,
// and enough shifts and departments that the first screen isn't empty.
//
// Runs on Vercel's server only. Like create-employee-login.js, it is one of the
// few places allowed to touch SUPABASE_SERVICE_ROLE_KEY, which bypasses Row
// Level Security entirely. Guarded by a shared secret rather than a user
// session, because the people it creates accounts for don't have one yet.
//
// Required env vars (Vercel -> Settings -> Environment Variables):
//   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (already set)
//   PROVISION_SECRET                              (new - a long random string)

var APP_URL = "https://app.shyftrota.com";

// Same ratios as seedThresholds() in src/volume.jsx. Keep the two in step.
function seedThresholds(roomCount) {
  var rc = Number(roomCount);
  if (!rc || rc <= 0) return { depTwo: 125, depMid: 165, arrTwo: 85 };
  return {
    depTwo: Math.round(rc * 0.48),
    depMid: Math.round(rc * 0.64),
    arrTwo: Math.round(rc * 0.33),
  };
}

// Shift ids are the label itself, matching how the app creates them.
var SEED_SHIFTS = [
  { id: "AM",    label: "AM",    start_time: "07:00", end_time: "15:30", color: "Morning 6-2" },
  { id: "MID",   label: "MID",   start_time: "11:00", end_time: "19:30", color: "Day 9-5" },
  { id: "PM",    label: "PM",    start_time: "15:00", end_time: "23:30", color: "Evening 2-10" },
  { id: "AUDIT", label: "AUDIT", start_time: "23:00", end_time: "07:30", color: "Night 10-6" },
];

function slugId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "_" + Date.now();
}

function strongPassword() {
  var upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  var lower = "abcdefghijkmnopqrstuvwxyz";
  var digit = "23456789";
  var sym   = "!@#$%&*?";
  var all   = upper + lower + digit + sym;
  function pick(set) { return set[crypto.randomInt(0, set.length)]; }
  // Guarantee the app's own rule: 8+ with an uppercase, a number and a symbol.
  var out = [pick(upper), pick(lower), pick(digit), pick(sym)];
  while (out.length < 14) out.push(pick(all));
  for (var i = out.length - 1; i > 0; i--) {
    var j = crypto.randomInt(0, i + 1);
    var t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out.join("");
}

function secretMatches(given, expected) {
  if (!given || !expected) return false;
  var a = Buffer.from(String(given));
  var b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  var supabaseUrl = process.env.VITE_SUPABASE_URL;
  var serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  var provisionSecret = process.env.PROVISION_SECRET;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Server misconfigured" });
  }
  if (!provisionSecret) {
    console.error("PROVISION_SECRET is not set - refusing to provision");
    return res.status(500).json({ error: "Server misconfigured" });
  }
  if (!secretMatches(req.headers["x-provision-secret"], provisionSecret)) {
    return res.status(401).json({ error: "Not authorised" });
  }

  var body = req.body || {};
  var propertyName = String(body.propertyName || "").trim();
  var adminName    = String(body.adminName || "").trim();
  var adminEmail   = String(body.adminEmail || "").trim().toLowerCase();
  var roomCount    = body.roomCount ? Number(body.roomCount) : null;
  var weekStart    = body.weekStart === "Sunday" ? "Sunday" : "Monday";
  var timeClock    = body.timeClock !== false;
  var defaultLayout = ["grid","cards","slots","timeline","list","month"].indexOf(body.defaultLayout) >= 0 ? body.defaultLayout : "grid";
  var password     = body.password ? String(body.password) : strongPassword();
  var generated    = !body.password;

  if (!propertyName || !adminName || !adminEmail) {
    return res.status(400).json({ error: "Property name, admin name and admin email are all required" });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    return res.status(400).json({ error: "That admin email doesn't look right" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  if (roomCount !== null && (!Number.isFinite(roomCount) || roomCount < 0 || roomCount > 10000)) {
    return res.status(400).json({ error: "Room count must be a number between 0 and 10000" });
  }

  var admin = createClient(supabaseUrl, serviceRoleKey);

  // Track what we create so a half-finished workspace can be cleaned up.
  var createdUserId = null;
  var createdPropertyId = null;

  async function rollback() {
    try { if (createdPropertyId) await admin.from("properties").delete().eq("id", createdPropertyId); } catch (e) {}
    try { if (createdUserId) await admin.auth.admin.deleteUser(createdUserId); } catch (e) {}
  }

  try {
    // 1. The login. email_confirm so they can sign in straight away.
    var userRes = await admin.auth.admin.createUser({
      email: adminEmail,
      password: password,
      email_confirm: true,
    });
    if (userRes.error) {
      var m = userRes.error.message || "";
      if (/already|registered|exists/i.test(m)) {
        return res.status(409).json({ error: "That email already has a ShyftRota login" });
      }
      console.error("createUser failed:", userRes.error);
      return res.status(500).json({ error: "Couldn't create the login: " + m });
    }
    createdUserId = userRes.data.user.id;

    // 2. The property.
    var propertyId = crypto.randomUUID();
    var propertyRow = {
      id: propertyId,
      name: propertyName,
      week_start: weekStart,
      room_count: roomCount,
      vol_thresholds: seedThresholds(roomCount),
      time_clock: timeClock,
      default_layout: defaultLayout,
    };
    var propRes = await admin.from("properties").insert(propertyRow).select("id").single();
    if (propRes.error) {
      console.error("properties insert failed:", propRes.error);
      await rollback();
      return res.status(500).json({
        error: "Couldn't create the property: " + (propRes.error.message || "unknown"),
        hint: "If this mentions a 'name' column, run provisioning-setup.sql in the Supabase SQL editor first.",
      });
    }
    createdPropertyId = propertyId;

    // 3. The admin profile. This is what loadProfile() reads on sign-in.
    var profRes = await admin.from("profiles").insert({
      id: createdUserId,
      name: adminName,
      role: "admin",
      property_id: propertyId,
      employee_id: null,
    });
    if (profRes.error) {
      console.error("profiles insert failed:", profRes.error);
      await rollback();
      return res.status(500).json({ error: "Couldn't create the admin profile: " + (profRes.error.message || "unknown") });
    }

    // 4. Shifts and a first department, so the schedule grid isn't blank.
    //    Non-fatal: the workspace works without them, they're just a head start.
    var seedWarnings = [];
    var shiftRes = await admin.from("shift_defs").insert(
      SEED_SHIFTS.map(function (s) { return Object.assign({ property_id: propertyId }, s); })
    );
    if (shiftRes.error) { seedWarnings.push("default shifts"); console.error("shift_defs seed failed:", shiftRes.error); }

    var deptRes = await admin.from("departments").insert({
      id: slugId("Front Desk"), property_id: propertyId, name: "Front Desk", color: "#E44E35", linked: [],
    });
    if (deptRes.error) { seedWarnings.push("the Front Desk department"); console.error("departments seed failed:", deptRes.error); }

    // 5. Send the credentials over. Never fail the whole call on email.
    var emailed = false;
    if (hasEmailKey()) {
      try {
        var bodyHtml =
          kicker("Workspace ready") +
          para("Your ShyftRota workspace for " + strong(unesc(propertyName)) + " is ready. Here's how to sign in:") +
          shiftTable([
            { day: "Sign in", label: APP_URL.replace(/^https?:\/\//, ""), time: "" },
            { day: "Email", label: adminEmail, time: "" },
            { day: "Password", label: password, time: "Temporary. Change it under Settings." },
          ]) +
          para("Add your team, then tap Auto-Generate to build your first week. Reply to this email if anything looks wrong and I'll sort it out.");
        var sendRes = await sendAll([{
          from: FROM,
          to: [adminEmail],
          subject: "Your ShyftRota workspace is ready",
          html: layout("Welcome to ShyftRota", bodyHtml, APP_URL, { preheader: "Your workspace is ready. Sign-in details inside.", cta: "Sign in" }),
        }]);
        emailed = !!(sendRes && sendRes.sent > 0);
      } catch (e) {
        console.error("provisioning email failed:", e);
      }
    }

    return res.status(200).json({
      ok: true,
      propertyId: propertyId,
      userId: createdUserId,
      adminEmail: adminEmail,
      password: generated ? password : undefined,
      emailed: emailed,
      warnings: seedWarnings,
    });
  } catch (err) {
    console.error("provision-property blew up:", err);
    await rollback();
    return res.status(500).json({ error: "Something went wrong creating the workspace. Nothing was left behind." });
  }
}
