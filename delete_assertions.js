import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Deleting assertions...");
  
  // Try to find the assertions by claim text or rule title. We'll just delete them if they match.
  const { data: assertions, error } = await supabase
    .from("aio_assertions")
    .select("*, rule:attention_rules!rule_id(*)")
    .or("claim_text.ilike.%GPT-5%,claim_text.ilike.%Trump%,claim_text.ilike.%Polymarket%");

  if (error) {
    console.error("Error fetching assertions:", error);
    return;
  }

  for (const a of assertions) {
    if (a.rule?.question?.includes("GPT-5") || a.rule?.question?.includes("US Presidential") || a.claim_text.includes("GPT-5") || a.claim_text.includes("Polymarket")) {
      console.log("Deleting assertion:", a.id, a.claim_text);
      const { error: delErr } = await supabase.from("aio_assertions").delete().eq("id", a.id);
      if (delErr) console.error("Error deleting:", delErr);
    }
  }
  
  console.log("Done.");
}

run();
