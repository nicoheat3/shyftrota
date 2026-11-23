// POST /api/request-password-reset  { email }
//
// "Forgot password?" sends the reset link to BOTH the login email and the
// personal email saved under Settings → Email notifications. Front desk
// agents often can't open their work email from home.
//
// The person can type either address. The answer is always the same
// generic "if it exists, we sent it", so nobody can use this to find out
// who has an account.

import { createClient } from "@supabase/supabase-js";
import { FROM, hasEmailKey, esc, para, layout, sendAll } from "./_email.js";

var SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
var SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
var COOLDOWN_MIN = 2;   // one reset email per account every 2 minutes

async function findAuthUserByEmail(db, email) {
  for (var page = 1; page <= 50; page++) {
    var r = await db.auth.admin.listUsers({ page: page, perPage: 1000 });
    if (r.error) throw r.error;
    var users = (r.data && r.data.users) || [];
    var hit = users.find(function (u) { return (u.email || "").toLowerCase() === email; });
    if (hit) return hit;
    if (users.length < 1000) return null;
  }
  return null;
}
async function findAuthUserById(db, id) {
  var r = await db.auth.admin.getUserById(id);
  return r.data && r.data.user ? r.data.user : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  var ok = { ok: true };   // same reply for every outcome
  var email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email" });
  if (!SUPABASE_URL || !SERVICE_KEY || !hasEmailKey()) { console.error("reset: server not configured"); return res.status(200).json(ok); }

  var db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  try {
    // 1. Who is this? Match the login email first, then a saved personal email.
    var authUser = await findAuthUserByEmail(db, email);
    if (!authUser) {
      var ns = await db.from("notification_settings").select("employee_id").eq("email", email);   // saved lowercase by the app
      var eids = (ns.data || []).map(function (r) { return r.employee_id; });
      if (eids.length === 1) {   // ambiguous matches get nothing
        var prof = await db.from("profiles").select("id").eq("employee_id", eids[0]);
        if (prof.data && prof.data.length === 1) authUser = await findAuthUserById(db, prof.data[0].id);
      }
    }
    if (!authUser || !authUser.email) return res.status(200).json(ok);

    // 2. Cooldown so the form can't be used to flood someone's inbox
    var p = await db.from("profiles").select("employee_id, name").eq("id", authUser.id).maybeSingle();
    var eid = p.data && p.data.employee_id != null ? p.data.employee_id : 0;
    var windowStart = Math.floor(Date.now() / (COOLDOWN_MIN * 60000));
    var claim = await db.from("notification_log")
      .upsert([{ kind: "pwreset", ref: authUser.id + "_" + windowStart, employee_id: eid }], { onConflict: "kind,ref,employee_id", ignoreDuplicates: true })
      .select("ref");
    if (claim.error) console.error("reset: cooldown check failed", claim.error);
    else if (!claim.data || !claim.data.length) return res.status(200).json(ok);

    // 3. A one-time link. Our page only spends it when they press Save,
    //    so work-email scanners that open links can't use it up.
    var link = await db.auth.admin.generateLink({ type: "recovery", email: authUser.email });
    var hashed = link.data && link.data.properties && link.data.properties.hashed_token;
    if (link.error || !hashed) { console.error("reset: generateLink failed", link.error); return res.status(200).json(ok); }
    var site = "https://" + (req.headers["x-forwarded-host"] || req.headers.host || "app.shyftrota.com");
    var url = site + "/?reset=" + encodeURIComponent(hashed);

    // 4. Send to the login email and the personal email, if there is one
    var to = [authUser.email.toLowerCase()];
    if (eid) {
      var mine = await db.from("notification_settings").select("email").eq("employee_id", eid).maybeSingle();
      var personal = mine.data && mine.data.email ? mine.data.email.toLowerCase() : null;
      if (personal && to.indexOf(personal) < 0) to.push(personal);
    }
    var first = p.data && p.data.name ? String(p.data.name).split(" ")[0] : "";
    var html = layout("Reset your password",
      para((first ? "Hi " + esc(first) + ", someone" : "Someone") + " asked to reset the password for your ShyftRota login (" + esc(authUser.email) + "). If that was you, choose a new one below.") +
      para("The link works once and expires in an hour. Didn't ask for this? Ignore this email and your password stays the same."),
      site, { cta: "Choose a new password", ctaUrl: url, preheader: "Choose a new ShyftRota password",
              footer: "Sent because a password reset was requested for this ShyftRota login." });
    var r = await sendAll(to.map(function (addr) { return { from: FROM, to: [addr], subject: "Reset your ShyftRota password", html: html }; }));
    if (r.errors.length) console.error("reset: send failed", r.errors);
  } catch (e) {
    console.error("reset: failed", e);
  }
  return res.status(200).json(ok);
}
