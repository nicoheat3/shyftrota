// Web push helpers (phone notifications for the Home Screen app).
//
// Keys: if VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are set in Vercel they are used.
// Otherwise a stable key pair is derived from SUPABASE_SERVICE_ROLE_KEY, so it
// works with no extra setup. (If you ever rotate the service key, phones simply
// re-subscribe the next time someone opens the app.)

import crypto from "node:crypto";
import webpush from "web-push";

function b64url(buf) { return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

var cached = null;
export function vapidKeys() {
  if (cached) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cached = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return cached;
  }
  var seed = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!seed) return null;
  var priv = crypto.createHmac("sha256", seed).update("shyftrota-web-push-vapid-v1").digest();
  var ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(priv);
  cached = { publicKey: b64url(ecdh.getPublicKey()), privateKey: b64url(priv) };
  return cached;
}

var configured = false;
function setup() {
  if (configured) return true;
  var k = vapidKeys();
  if (!k) return false;
  webpush.setVapidDetails("mailto:hello@shyftrota.com", k.publicKey, k.privateKey);
  configured = true;
  return true;
}

// Notification preference: with no saved row, everything is on.
export function prefOn(row, key) { return !row || row[key] !== false; }

// { employee_id: [subscription rows] } for the given employees (or a whole property).
export async function loadSubs(db, opts) {
  var q = db.from("push_subscriptions").select("id, employee_id, property_id, endpoint, p256dh, auth");
  if (opts.propertyId) q = q.eq("property_id", opts.propertyId);
  if (opts.employeeIds) q = q.in("employee_id", opts.employeeIds);
  var r = await q;
  if (r.error) return {}; // table not created yet → no phone notifications, email still works
  var map = {};
  (r.data || []).forEach(function (s) { var k = String(s.employee_id); (map[k] = map[k] || []).push(s); });
  return map;
}

// items: [{ sub, payload: {title, body, url, tag} }]
export async function sendPush(db, items) {
  var out = { pushed: 0, errors: [] };
  if (!items.length || !setup()) return out;
  var dead = [], used = [];
  await Promise.all(items.map(function (it) {
    var sub = { endpoint: it.sub.endpoint, keys: { p256dh: it.sub.p256dh, auth: it.sub.auth } };
    return webpush.sendNotification(sub, JSON.stringify(it.payload), { TTL: 60 * 60 * 12, urgency: "normal" })
      .then(function () { out.pushed++; used.push(it.sub.id); })
      .catch(function (e) {
        if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.push(it.sub.id); // phone unsubscribed / app deleted
        else out.errors.push("push " + (e && e.statusCode ? e.statusCode : "") + " " + String(e && e.body || e && e.message || e).slice(0, 120));
      });
  }));
  if (dead.length) await db.from("push_subscriptions").delete().in("id", dead);
  if (used.length) await db.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", used);
  return out;
}

// Convenience: same payload to every phone an employee has.
export function itemsFor(subsMap, employeeId, payload) {
  return (subsMap[String(employeeId)] || []).map(function (s) { return { sub: s, payload: payload }; });
}
