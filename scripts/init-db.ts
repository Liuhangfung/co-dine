import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../drizzle/schema";
import "dotenv/config";

async function initDatabase() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error("❌ DATABASE_URL is not set in .env file");
    process.exit(1);
  }

  console.log("🔌 Connecting to Supabase...");
  console.log("💡 Note: Use your PROJECT database password (not your Supabase account password)");
  console.log("💡 Find it in: Supabase Dashboard → Settings → Database → Database password");
  
  try {
    const client = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: { rejectUnauthorized: false }, // Supabase uses self-signed certificates
    });

    // Test connection
    await client`SELECT 1`;
    console.log("✅ Connected to Supabase!");

    const db = drizzle(client, { schema });

    // Check existing tables
    const tables = await client`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log(`\n📊 Existing tables: ${tables.length}`);
    if (tables.length > 0) {
      tables.forEach((t: any) => console.log(`   - ${t.table_name}`));
    } else {
      console.log("   (no tables found - database is empty)");
    }

    // Push schema (create tables)
    console.log("\n📦 Creating database schema...");
    // We'll use drizzle-kit push via exec, or create tables manually
    
    await client.end();
    console.log("\n✅ Database check complete!");
    console.log("\n💡 To create tables, run: pnpm drizzle-kit push");
    
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    if (error instanceof Error) {
      if (error.message.includes("ENOTFOUND")) {
        console.error("\n💡 DNS Error: Check your internet connection or Supabase project status");
      } else if (error.message.includes("password")) {
        console.error("\n💡 Authentication Error: Check your DATABASE_URL password");
      }
    }
    process.exit(1);
  }
}

initDatabase();

