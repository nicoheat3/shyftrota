// POST /api/pilot-request
//
// Receives the "Request a pilot" form from the marketing site (shyftrota.com)
// and emails it to you through Resend.
//
// Env vars (Vercel → this project → Settings → Environment Variables):
//   RESEND_API_KEY — already set for notifications
//   PILOT_TO       — where pilot requests go. Until your domain is verified in
//                    Resend, this must be the email you signed up to Resend with.
// If PILOT_TO isn't set, the site falls back to opening the visitor's email app.

import { FROM, hasEmailKey, esc, sendAll } from "./_email.js";

var ALLOWED = [/^https:\/\/(www\.)?shyftrota\.com$/, /^https:\/\/shyftrota[a-z0-9-]*\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/];
var recent = new Map(); // best-effort throttle per IP (resets when the function cold-starts)

function clean(v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max); }

export default async function handler(req, res) {
  var origin = req.headers.origin || "";
  if (ALLOWED.some(function(r){ return r.test(origin); })) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  var b = req.body || {};
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  if (clean(b.company_site, 200)) return res.status(200).json({ sent: true }); // bot filled the hidden field

  var d = {
    name: clean(b.name, 120), email: clean(b.email, 200), property: clean(b.property, 160),
    role: clean(b.role, 60), size: clean(b.size, 20), properties: clean(b.properties, 20),
    message: String(b.message == null ? "" : b.message).slice(0, 2000),
  };
  if (!d.name || !d.property || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return res.status(400).json({ error: "Name, email and property are required" });

  var ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  var now = Date.now(); var last = recent.get(ip) || [];
  last = last.filter(function(t){ return now - t < 10 * 60 * 1000; });
  if (last.length >= 5) return res.status(429).json({ error: "Too many requests" });
  last.push(now); recent.set(ip, last);

  var to = process.env.PILOT_TO;
  if (!hasEmailKey() || !to) return res.status(200).json({ skipped: "not_configured" });

  var rows = [["Name", d.name], ["Email", d.email], ["Property", d.property], ["Role", d.role], ["Employees", d.size], ["Properties", d.properties]];
  var html = '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1A1714;max-width:560px">' +
    '<div style="font-weight:800;font-size:16px;margin-bottom:12px">New pilot request</div>' +
    '<table style="border-collapse:collapse;font-size:14px">' +
    rows.map(function(r){ return '<tr><td style="padding:4px 14px 4px 0;color:#6B6460">' + r[0] + '</td><td style="padding:4px 0">' + esc(r[1]) + '</td></tr>'; }).join("") +
    '</table>' + (d.message ? '<p style="white-space:pre-wrap;font-size:14px;border-top:1px solid #E5E0D8;padding-top:12px;margin-top:12px">' + esc(d.message) + '</p>' : "") +
    '<p style="font-size:12px;color:#8A8478">Reply to this email to answer ' + esc(d.name) + ' directly.</p></div>';

  var out = await sendAll([{ from: FROM, to: [to], reply_to: d.email, subject: "Pilot request: " + d.property, html: html }]);
  if (!out.sent) return res.status(502).json({ error: "Email failed" });
  return res.status(200).json({ sent: true });
}
