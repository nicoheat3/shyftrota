import { createClient } from "@supabase/supabase-js";
import { layout, para, strong, sendAll, hasEmailKey, FROM } from "./_email.js";

// "Forgot password?" on the sign-in screen posts here with an email address.
// We make a one-time Supabase recovery link with the service role key (server
// only) and send it through Resend in the ShyftRota email style.
//
// It always answers { ok:true }, whether or not the email has a login, so the
// form can't be used to find out who works where.

var recent = {}; // email -> last send time; best effort, per server instance
var GAP_MS = 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  var email = String((req.body && req.body.email) || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
    return res.status(400).json({ error: "Enter the email you sign in with." });
  }

  var supabaseUrl = process.env.VITE_SUPABASE_URL;
  var serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey || !hasEmailKey()) {
    console.error("forgot-password: missing Supabase or Resend env vars");
    return res.status(500).json({ error: "Password reset isn't available right now. Ask your manager to reset it." });
  }

  var now = Date.now();
  if (recent[email] && now - recent[email] < GAP_MS) return res.status(200).json({ ok:true });
  recent[email] = now;

  var appUrl = "https://app.shyftrota.com";
  try {
    var admin = createClient(supabaseUrl, serviceRoleKey);
    var link = await admin.auth.admin.generateLink({ type:"recovery", email:email, options:{ redirectTo: appUrl + "/?reset=1" } });
    if (link.error || !link.data || !link.data.properties || !link.data.properties.action_link) {
      // Most often: no login with that email. Say nothing different to the browser.
      if (link.error && !/not.*found|no user/i.test(link.error.message || "")) console.error("forgot-password: generateLink failed:", link.error.message);
      return res.status(200).json({ ok:true });
    }
    var html = layout("Reset your password",
      para("Someone asked to reset the ShyftRota password for " + strong(email) + ". Tap the button to choose a new one. The link works once and expires in an hour.") +
      para("If this wasn't you, ignore this email. Your password stays the same."),
      appUrl,
      { cta:"Choose a new password", ctaHref:link.data.properties.action_link, preheader:"Choose a new ShyftRota password. The link expires in an hour.", footer:"You got this because someone used Forgot password on the ShyftRota sign-in screen." });
    var sent = await sendAll([{ from:FROM, to:[email], subject:"Reset your ShyftRota password", html:html }]);
    if (sent.errors.length) console.error("forgot-password: send failed", sent.errors[0]);
  } catch (e) {
    console.error("forgot-password: unexpected", e && e.message);
  }
  return res.status(200).json({ ok:true });
}
