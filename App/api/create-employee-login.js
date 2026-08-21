import { createClient } from "@supabase/supabase-js";

// This runs on Vercel's server, never in the browser — that's the whole point.
// It's the only place allowed to use the Supabase service role key, which can
// create user accounts and bypasses Row Level Security entirely.
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
  // Never trust a property_id sent from the browser — always look up the caller's own.
  var callerProfileResult = await supabaseAdmin
    .from("profiles")
    .select("role, property_id")
    .eq("id", callerId)
    .single();

  if (callerProfileResult.error || !callerProfileResult.data || callerProfileResult.data.role !== "admin") {
    return res.status(403).json({ error: "Only admins can create employee logins" });
  }
  var propertyId = callerProfileResult.data.property_id;

  var body = req.body || {};
  var name = body.name;
  var email = body.email;
  var password = body.password;
  var role = body.role;
  var employeeId = body.employeeId;

  if (!name || !email || !password || !employeeId) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  var createResult = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
  });

  if (createResult.error || !createResult.data || !createResult.data.user) {
    var msg = createResult.error ? createResult.error.message : "Could not create account";
    return res.status(400).json({ error: msg });
  }
  var newUserId = createResult.data.user.id;

  var linkResult = await supabaseAdmin.from("profiles").insert({
    id: newUserId,
    property_id: propertyId,
    employee_id: employeeId,
    name: name,
    role: role === "admin" ? "admin" : "employee",
  });

  if (linkResult.error) {
    // Don't leave an orphaned login with no profile behind.
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return res.status(500).json({ error: "Could not link account: " + linkResult.error.message });
  }

  return res.status(200).json({ success: true, userId: newUserId });
}
