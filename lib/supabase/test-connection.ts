
import { createClient } from "./client";

export async function testConnection() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .limit(1);

  if (error) {
    console.error("Supabase connection failed:", error.message);
    return false;
  }

  console.log("Supabase connection successful!", data);
  return true;
}
