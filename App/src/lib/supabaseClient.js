import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase env vars. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
    "are set in .env.local (for local dev) or in your Vercel project's Environment Variables (for deploys)."
  );
}

// Read this BEFORE creating the client: the client signs the person in from a
// password-reset link and then wipes the link details from the address bar.
export const openedFromRecoveryLink =
  typeof window !== "undefined" &&
  /(^|[#&?])type=recovery(&|$)/.test(window.location.hash + "&" + window.location.search.replace(/^\?/, ""));

// New-style reset link: https://app.shyftrota.com/?reset=<token hash>
// The token is only spent when the person presses Save, so email security
// scanners that "pre-click" links can't use it up first.
export const resetTokenHash = (function () {
  if (typeof window === "undefined") return null;
  var v = new URLSearchParams(window.location.search).get("reset");
  return v && /^[A-Za-z0-9_-]{10,200}$/.test(v) ? v : null;
})();

// An old-style link that was already used or expired comes back with an
// error in the address bar instead of a session.
export const recoveryLinkError =
  typeof window !== "undefined" &&
  /error_code=(otp_expired|access_denied)|error=access_denied/.test(window.location.hash + window.location.search);

export const supabase = createClient(supabaseUrl, supabaseKey);
