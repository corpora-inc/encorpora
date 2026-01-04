import { createClient } from "@supabase/supabase-js";

// // Load environment variables
// const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// // Ensure they exist (Fail Fast)
// if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
//     throw new Error("Missing Supabase environment variables!");
// }

// Create a Supabase client
export const supabase = createClient(
    "https://oltimmufcpezjisfuqkb.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sdGltbXVmY3Blemppc2Z1cWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkzMzA2ODIsImV4cCI6MjA1NDkwNjY4Mn0.3Q7GkT5O2bMgaQWzQ5DGAsdUdPpsH3roJZE7J1MoCkk"
);
