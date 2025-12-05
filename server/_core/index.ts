import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (2 levels up from server/_core/)
// In Docker, environment variables come from docker-compose.yml, so .env file is optional
const envPath = path.resolve(__dirname, "../../.env");
console.log("[Startup] 📁 Attempting to load .env from:", envPath);

// Try to load .env file if it exists (for local development)
// In Docker, this file won't exist and that's OK - use environment variables from docker-compose.yml
try {
  const envContent = readFileSync(envPath, "utf-8");
  console.log("[Startup] ✅ .env file found, loading variables...");
  
  // Read DATABASE_URL directly from .env file and set it
  const dbUrlMatch = envContent.match(/^DATABASE_URL\s*=\s*(.+)$/m);
  if (dbUrlMatch && dbUrlMatch[1]) {
    const dbUrl = dbUrlMatch[1].trim();
    // Remove quotes if present
    const cleanUrl = dbUrl.replace(/^["']|["']$/g, '');
    // Make sure it doesn't start with "DATABASE_URL="
    const finalUrl = cleanUrl.startsWith('DATABASE_URL=') ? cleanUrl.substring('DATABASE_URL='.length) : cleanUrl;
    process.env.DATABASE_URL = finalUrl;
    const masked = finalUrl.replace(/:[^:@]+@/, ':****@');
    console.log(`[Startup] ✅ DATABASE_URL set from .env file: ${masked}`);
  }
  
  // Load all variables with dotenv (override: true to ensure .env file takes precedence)
  const result = dotenv.config({ path: envPath, override: true });
  if (result.parsed) {
    console.log(`[Startup] ✅ Loaded ${Object.keys(result.parsed).length} variables from .env file`);
  }
} catch (error: any) {
  // File doesn't exist - this is normal in Docker, so just log info
  if (error.code === 'ENOENT') {
    console.log("[Startup] ℹ️ .env file not found (this is OK in Docker - using environment variables from docker-compose.yml)");
  } else {
    console.error("[Startup] ⚠️ Error reading .env file (non-critical):", error.message);
  }
  
  // Try dotenv.config as fallback (it handles missing files gracefully)
  // Don't override in Docker case - use existing environment variables
  const result = dotenv.config({ path: envPath, override: false });
  if (result.error) {
    const errorCode = (result.error as any).code;
    if (errorCode !== 'ENOENT') {
      console.error("[Startup] ⚠️ dotenv.config error (non-critical):", result.error.message);
    }
  }
}

// Final check
if (process.env.DATABASE_URL) {
  const masked = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log(`[Startup] 📋 Final DATABASE_URL in process.env: ${masked}`);
} else {
  console.error("[Startup] ❌ DATABASE_URL is still not set!");
}

// Check SUPADATA_API_KEY
if (process.env.SUPADATA_API_KEY) {
  const masked = process.env.SUPADATA_API_KEY.substring(0, 10) + '...' + process.env.SUPADATA_API_KEY.substring(process.env.SUPADATA_API_KEY.length - 5);
  console.log(`[Startup] ✅ SUPADATA_API_KEY loaded: ${masked}`);
} else {
  console.log("[Startup] ℹ️ SUPADATA_API_KEY not set (optional, for Supadata transcript extraction)");
}

// Check YOUTUBE_TRANSCRIPT_API_TOKEN
if (process.env.YOUTUBE_TRANSCRIPT_API_TOKEN) {
  const masked = process.env.YOUTUBE_TRANSCRIPT_API_TOKEN.substring(0, 10) + '...' + process.env.YOUTUBE_TRANSCRIPT_API_TOKEN.substring(process.env.YOUTUBE_TRANSCRIPT_API_TOKEN.length - 5);
  console.log(`[Startup] ✅ YOUTUBE_TRANSCRIPT_API_TOKEN loaded: ${masked}`);
} else {
  console.log("[Startup] ℹ️ YOUTUBE_TRANSCRIPT_API_TOKEN not set (will use default token for youtube-transcript.io)");
}

// Check ASSEMBLYAI_API_KEY
if (process.env.ASSEMBLYAI_API_KEY) {
  const masked = process.env.ASSEMBLYAI_API_KEY.substring(0, 10) + '...' + process.env.ASSEMBLYAI_API_KEY.substring(process.env.ASSEMBLYAI_API_KEY.length - 5);
  console.log(`[Startup] ✅ ASSEMBLYAI_API_KEY loaded: ${masked}`);
} else {
  console.log("[Startup] ℹ️ ASSEMBLYAI_API_KEY not set (optional, for RedNote transcription)");
}

// Check BUILT_IN_FORGE_API_KEY and BUILT_IN_FORGE_API_URL (required for AI analysis)
if (process.env.BUILT_IN_FORGE_API_KEY) {
  const masked = process.env.BUILT_IN_FORGE_API_KEY.substring(0, 10) + '...' + process.env.BUILT_IN_FORGE_API_KEY.substring(process.env.BUILT_IN_FORGE_API_KEY.length - 5);
  console.log(`[Startup] ✅ BUILT_IN_FORGE_API_KEY loaded: ${masked}`);
} else {
  console.warn("[Startup] ⚠️ BUILT_IN_FORGE_API_KEY not found in environment variables!");
}

if (process.env.BUILT_IN_FORGE_API_URL) {
  console.log(`[Startup] ✅ BUILT_IN_FORGE_API_URL loaded: ${process.env.BUILT_IN_FORGE_API_URL}`);
} else {
  console.warn("[Startup] ⚠️ BUILT_IN_FORGE_API_URL not found in environment variables!");
}

// Check image generation API keys
if (process.env.STABILITY_AI_API_KEY) {
  const masked = process.env.STABILITY_AI_API_KEY.substring(0, 10) + '...' + process.env.STABILITY_AI_API_KEY.substring(process.env.STABILITY_AI_API_KEY.length - 5);
  console.log(`[Startup] ✅ STABILITY_AI_API_KEY loaded: ${masked} (for Stable Diffusion image generation - NO VPN needed)`);
} else {
  console.log("[Startup] ℹ️ STABILITY_AI_API_KEY not set (optional, for AI image generation - NO VPN needed)");
}

if (process.env.REPLICATE_API_TOKEN) {
  const masked = process.env.REPLICATE_API_TOKEN.substring(0, 10) + '...' + process.env.REPLICATE_API_TOKEN.substring(process.env.REPLICATE_API_TOKEN.length - 5);
  console.log(`[Startup] ✅ REPLICATE_API_TOKEN loaded: ${masked} (for Stable Diffusion via Replicate - NO VPN needed)`);
} else {
  console.log("[Startup] ℹ️ REPLICATE_API_TOKEN not set (optional, for AI image generation via Replicate - NO VPN needed)");
}

if (process.env.OPENAI_API_KEY) {
  const masked = process.env.OPENAI_API_KEY.substring(0, 10) + '...' + process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 5);
  console.log(`[Startup] ✅ OPENAI_API_KEY loaded: ${masked} (for DALL-E image generation - may require VPN)`);
} else {
  console.log("[Startup] ℹ️ OPENAI_API_KEY not set (optional, for AI image generation with DALL-E 3 - may require VPN)");
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Log what DATABASE_URL is actually loaded
  if (process.env.DATABASE_URL) {
    const maskedUrl = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
    console.log("[Startup] 📋 DATABASE_URL loaded from environment:", maskedUrl);
  } else {
    console.warn("[Startup] ⚠️ DATABASE_URL not found in environment variables!");
  }
  
  // Test database connection first
  console.log("\n[Startup] 🔍 Testing database connection...");
  try {
    const db = await getDb();
    if (db) {
      console.log("[Startup] ✅ Database connection successful!");
    } else {
      console.log("[Startup] ⚠️ Database connection test failed - check logs above");
    }
  } catch (error) {
    console.error("[Startup] ❌ Database connection test error:", error);
  }
  console.log(""); // Empty line for readability
  
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Health check endpoint with database status
  app.get("/api/health", async (req, res) => {
    try {
      const db = await getDb();
      const dbStatus = db ? "connected" : "disconnected";
      res.status(200).json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        database: dbStatus
      });
    } catch (error) {
      res.status(503).json({ 
        status: "error", 
        timestamp: new Date().toISOString(),
        database: "error",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
