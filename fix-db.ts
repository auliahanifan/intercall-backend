import { sql } from "drizzle-orm";
import { db } from "./src/lib/db";

async function fixVerificationTable() {
  try {
    console.log("Truncating verification table...");
    await db.execute(sql`TRUNCATE TABLE "verification" CASCADE`);
    console.log("✓ Table truncated successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixVerificationTable();
