import { createClient } from "@supabase/supabase-js";

// This runs on Vercel's server, never in the browser — that's the whole point.
// It's the only place allowed to use the Supabase service role key, which can
// reset any user's password and bypasses Row Level Security entirely.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  var authHeader = req.headers.authorization || "";
  var token = authHeader.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  var supabaseUrl = process.env.VITE_SUPABASE_URL;
  var serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
    return res.status(500).json({ error: "Server misconfigured" });
  }

  var supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Verify the caller is a real, currently-logged-in user (not a forged request).
  var authResult = await supabaseAdmin.auth.getUser(token);
  if (authResult.error || !authResult.data || !authResult.data.user) {
    return res.status(401).json({ error: "Invalid session" });
  }
  var callerId = authResult.data.user.id;

  // Verify that user is actually an admin, and find out which property they manage.
  var callerProfileResult = await supabaseAdmin
    .from("profiles")
    .select("role, property_id")
    .eq("id", callerId)
    .single();

  if (callerProfileResult.error || !callerProfileResult.data || callerProfileResult.data.role !== "admin") {
    return res.status(403).json({ error: "Only admins can reset employee passwords" });
  }
  var propertyId = callerProfileResult.data.property_id;

  var body = req.body || {};
  var email = body.email;
  var newPassword = body.newPassword;

  if (!email || !newPassword) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  // Look up the target user by email.
  var listResult = await supabaseAdmin.auth.admin.listUsers();
  if (listResult.error) {
    return res.status(500).json({ error: "Could not look up user: " + listResult.error.message });
  }
  var targetUser = listResult.data.users.find(function (u) {
    return u.email && u.email.toLowerCase() === email.toLowerCase();
  });
  if (!targetUser) {
    return res.status(404).json({ error: "No user found with that email" });
  }

  // Make sure the admin can only reset passwords for employees at their own property.
  var targetProfileResult = await supabaseAdmin
    .from("profiles")
    .select("property_id")
    .eq("id", targetUser.id)
    .single();

  if (targetProfileResult.error || !targetProfileResult.data) {
    return res.status(404).json({ error: "No profile found for that user" });
  }
  if (targetProfileResult.data.property_id !== propertyId) {
    return res.status(403).json({ error: "That user is not at your property" });
  }

  var updateResult = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
    password: newPassword,
  });

  if (updateResult.error) {
    return res.status(400).json({ error: updateResult.error.message });
  }

  return res.status(200).json({ success: true });
}
