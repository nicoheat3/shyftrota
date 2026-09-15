// POST /api/delete-account
//
// Deletes the signed-in user's own login and profile. Their employee record
// stays, renamed, so time clock punches remain valid for payroll.
//
// Needs the service role key, which is why this runs on the server and not in
// the browser. Match the env var names your other /api functions already use —
// if they read SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, this will just work.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("delete-account: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Server is not configured for account deletion" });
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Who is asking? The token proves it — never trust an id from the body.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: "Your session has expired. Sign in again." });
  }
  const uid = userData.user.id;

  const { data: profile, error: profileErr } = await admin
    .from("profiles").select("id, role, employee_id, property_id").eq("id", uid).single();
  if (profileErr || !profile) {
    console.error("delete-account: profile lookup failed", profileErr);
    return res.status(404).json({ error: "Couldn't find your profile" });
  }

  // A property with no admin left is a locked-out property. Block it.
  if (profile.role === "admin") {
    const { count, error: countErr } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("property_id", profile.property_id)
      .eq("role", "admin");
    if (countErr) {
      console.error("delete-account: admin count failed", countErr);
      return res.status(500).json({ error: "Couldn't verify admin access" });
    }
    if ((count || 0) <= 1) {
      return res.status(409).json({
        error: "You're the only admin here. Make someone else an admin first, then delete your account.",
      });
    }
  }

  // Keep the employee row so time clock punches still resolve — just strip
  // everything that identifies the person.
  if (profile.employee_id) {
    const { error: anonErr } = await admin.from("employees").update({
      name: "Former employee",
      color: null,
      avail: [],
      shift_avail: {},
      deleted_at: new Date().toISOString(),
    }).eq("id", profile.employee_id);
    if (anonErr) {
      console.error("delete-account: anonymize failed", anonErr);
      return res.status(500).json({ error: "Couldn't remove your details. Nothing was deleted." });
    }
  }

  const { error: profDelErr } = await admin.from("profiles").delete().eq("id", uid);
  if (profDelErr) {
    console.error("delete-account: profile delete failed", profDelErr);
    return res.status(500).json({ error: "Couldn't delete your profile" });
  }

  const { error: authDelErr } = await admin.auth.admin.deleteUser(uid);
  if (authDelErr) {
    console.error("delete-account: auth delete failed", authDelErr);
    return res.status(500).json({ error: "Your profile was removed but the login could not be deleted. Contact support." });
  }

  return res.status(200).json({ ok: true });
}
