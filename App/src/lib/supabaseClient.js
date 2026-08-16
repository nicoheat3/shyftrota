import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase env vars. Make sure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
    "are set in .env.local (for local dev) or in your Vercel project's Environment Variables (for deploys)."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
