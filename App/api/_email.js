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

// ── Look (matches the app: black, hairlines, one red-orange accent) ──
// Email clients ignore web fonts and most CSS, so everything is inline and
// falls back to system fonts. Monospace is used for days and times, like the app.
export var C = {
  bg: "#000000", card: "#0A0A0A", line: "#1F1F1F", text: "#FFFFFF", sub: "#A3A3A3", muted: "#5C5C5C",
  accent: "#E44E35", ok: "#4ADE80", bad: "#F87171",
};
export var SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
export var MONO = "'IBM Plex Mono',SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

// A small uppercase label with the accent dot, like the app's section headers.
export function kicker(text) {
  return '<div style="font-family:' + MONO + ';font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:' + C.sub + ';margin-bottom:10px">' +
    '<span style="color:' + C.accent + '">&#9679;</span>&nbsp; ' + esc(text) + '</div>';
}
export function para(html) {
  return '<div style="font-size:15px;line-height:1.6;color:' + C.sub + ';margin:0 0 14px">' + html + '</div>';
}
export function strong(text) { return '<span style="color:' + C.text + ';font-weight:600">' + esc(text) + '</span>'; }
export function status(word, good) {
  return '<span style="display:inline-block;font-family:' + MONO + ';font-size:11px;letter-spacing:0.06em;text-transform:uppercase;padding:3px 8px;border:1px solid ' + (good ? C.ok : C.bad) + ';color:' + (good ? C.ok : C.bad) + ';border-radius:3px">' + esc(word) + '</span>';
}
// rows: [{ day: "Sun, Nov 1", label: "Night Audit", time: "11:00 PM – 7:00 AM" }]
export function shiftTable(rows, emptyText) {
  if (!rows.length) return '<div style="font-size:14px;color:' + C.sub + ';padding:14px 0;border-top:1px solid ' + C.line + '">' + esc(emptyText || "No shifts.") + '</div>';
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' + rows.map(function (r) {
    return '<tr>' +
      '<td style="padding:12px 12px 12px 0;border-top:1px solid ' + C.line + ';font-family:' + MONO + ';font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:' + C.sub + ';white-space:nowrap;vertical-align:top;width:96px">' + esc(r.day) + '</td>' +
      '<td style="padding:12px 0;border-top:1px solid ' + C.line + ';vertical-align:top">' +
        '<div style="font-size:15px;font-weight:600;color:' + C.text + '">' + esc(r.label) + '</div>' +
        (r.time ? '<div style="font-family:' + MONO + ';font-size:13px;color:' + C.sub + ';margin-top:3px">' + esc(r.time) + '</div>' : '') +
      '</td></tr>';
  }).join("") + '<tr><td colspan="2" style="border-top:1px solid ' + C.line + ';font-size:0;line-height:0">&nbsp;</td></tr></table>';
}

// title: plain text heading. bodyHtml: built with the helpers above.
// opts.preheader: the grey preview line inbox lists show under the subject.
export function layout(title, bodyHtml, appUrl, opts) {
  opts = opts || {};
  var base = String(appUrl || "https://app.shyftrota.com").replace(/\/$/, "");
  var pre = opts.preheader ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">' + esc(opts.preheader) + '&#8199;&#65279;&#847;'.repeat(30) + '</div>' : '';
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>' + esc(title) + '</title></head>' +
    '<body style="margin:0;padding:0;background:' + C.bg + ';color:' + C.text + ';font-family:' + SANS + ';-webkit-font-smoothing:antialiased">' + pre +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.bg + '"><tr><td align="center" style="padding:28px 16px 36px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">' +
      // Header: logo + wordmark
      '<tr><td style="padding:0 0 20px">' +
        '<a href="' + esc(base) + '" style="text-decoration:none;color:' + C.text + '">' +
        '<img src="' + esc(base) + '/icon-192.png" width="36" height="36" alt="ShyftRota" style="display:inline-block;vertical-align:middle;border:1px solid ' + C.line + ';border-radius:6px">' +
        '<span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:15px;font-weight:700;letter-spacing:-0.01em;color:' + C.text + '">ShyftRota</span></a>' +
      '</td></tr>' +
      // Card
      '<tr><td style="background:' + C.card + ';border:1px solid ' + C.line + ';border-radius:6px;padding:24px 22px">' +
        '<div style="font-size:22px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:' + C.text + ';margin:0 0 14px">' + esc(title) + '</div>' +
        bodyHtml +
        '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td style="background:' + C.accent + ';border-radius:4px">' +
          '<a href="' + esc(opts.ctaHref || base) + '" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none">' + esc(opts.cta || "Open ShyftRota") + ' &rarr;</a>' +
        '</td></tr></table>' +
      '</td></tr>' +
      // Footer
      '<tr><td style="padding:16px 2px 0;font-size:12px;line-height:1.6;color:' + C.muted + '">' +
        (opts.footer ? esc(opts.footer) : 'You get these because email notifications are on in ShyftRota. Turn them off any time in Settings &rarr; Email notifications.') +
      '</td></tr>' +
    '</table></td></tr></table></body></html>';
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
