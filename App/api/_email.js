// Shared email helpers for /api/notify and /api/notify-cron.
// (Files starting with "_" are not turned into routes by Vercel.)

export var FROM = process.env.NOTIFY_FROM || "ShyftRota <onboarding@resend.dev>";
var RESEND_KEY = process.env.RESEND_API_KEY;

export function hasEmailKey() { return !!RESEND_KEY; }

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
// The app stores some text already HTML-escaped; undo that before re-escaping.
export function unesc(s) {
  return String(s == null ? "" : s)
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&");
}
export function to12(t) {
  if (!t || typeof t !== "string" || t.indexOf(":") < 0) return t || "";
  var p = t.split(":"); var h = parseInt(p[0], 10); var ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
  return h + ":" + p[1] + " " + ap;
}
export function fmtDay(iso) {
  var d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
export function addDays(iso, n) {
  var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function layout(title, bodyHtml, appUrl) {
  return '<!doctype html><html><body style="margin:0;background:#F5F2ED;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#1A1714">' +
    '<div style="max-width:520px;margin:0 auto;padding:28px 18px">' +
    '<div style="font-weight:800;font-size:15px;letter-spacing:-0.01em;margin-bottom:18px">ShyftRota</div>' +
    '<div style="background:#fff;border:1px solid #E0D9D0;border-radius:10px;padding:22px">' +
    '<div style="font-size:18px;font-weight:700;margin-bottom:12px">' + title + '</div>' + bodyHtml +
    '<a href="' + esc(appUrl) + '" style="display:inline-block;margin-top:18px;background:#C84B31;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:7px">Open ShyftRota</a>' +
    '</div>' +
    '<div style="font-size:11px;color:#7A7469;margin-top:14px;line-height:1.5">You get these because email notifications are on in your ShyftRota settings. Turn them off any time under Settings → Email notifications.</div>' +
    '</div></body></html>';
}

export async function sendAll(messages) {
  if (!messages.length) return { sent: 0, errors: [] };
  var sent = 0, errors = [];
  for (var i = 0; i < messages.length; i += 100) {
    var chunk = messages.slice(i, i + 100);
    var r = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { "Authorization": "Bearer " + RESEND_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    if (r.ok) sent += chunk.length;
    else { var t = await r.text(); console.error("email: resend failed", r.status, t); errors.push(t.slice(0, 300)); }
  }
  return { sent: sent, errors: errors };
}
