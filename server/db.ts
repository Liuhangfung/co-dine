import { eq, and, or, like, gte, lte, inArray, desc } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { 
  InsertUser, 
  users,
  recipes,
  ingredients,
  cookingSteps,
  categories,
  recipeCategories,
  userSuggestions,
  recipeVersions,
  recipeReviews,
  InsertRecipe,
  InsertIngredient,
  InsertCookingStep,
  InsertCategory,
  InsertRecipeCategory,
  InsertUserSuggestion,
  InsertRecipeVersion,
  InsertRecipeReview
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _client: postgres.Sql | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    // Parse and log connection details (masked)
    const dbUrl = process.env.DATABASE_URL;
    const urlMatch = dbUrl.match(/postgresql?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    
    if (urlMatch) {
      const [, user, , host, port, database] = urlMatch;
      console.log("[Database] 🔌 Attempting to connect to Supabase...");
      console.log(`[Database]   Host: ${host}`);
      console.log(`[Database]   Port: ${port}`);
      console.log(`[Database]   User: ${user}`);
      console.log(`[Database]   Database: ${database}`);
      console.log(`[Database]   Connection type: ${port === '6543' ? 'Pooler' : port === '5432' ? 'Direct' : 'Unknown'}`);
    } else {
      console.log("[Database] 🔌 Attempting to connect...");
      console.log("[Database]   URL format: (could not parse)");
    }
    
    try {
      console.log("[Database] ⏳ Creating postgres client...");
      // Create postgres client with connection options
      // Optimized for Supabase PAID plan (higher connection limits)
      _client = postgres(dbUrl, {
        max: 20, // Higher limit for paid plan (you have 200-400+ available)
        idle_timeout: 0, // Never timeout idle connections (keep alive forever)
        connect_timeout: 30, // Initial connection timeout
        max_lifetime: 60 * 60 * 24, // Recycle connections every 24 hours (paid plan is stable)
        ssl: { rejectUnauthorized: false }, // Supabase uses self-signed certificates
        connection: {
          application_name: 'co-dine-app', // Identify your app in Supabase
        },
        // Keep connection alive with periodic pings (prevents firewall timeouts)
        // Auto-reconnect on connection loss
        onnotice: () => {}, // Suppress notice logs
      });
      
      console.log("[Database] ⏳ Testing connection with SELECT 1...");
      const startTime = Date.now();
      const result = await _client`SELECT 1 as test`;
      const connectTime = Date.now() - startTime;
      
      console.log(`[Database] ✅ Connection test successful (${connectTime}ms)`);
      console.log(`[Database] ✅ Test query result:`, result);
      
      // Create drizzle instance
      _db = drizzle(_client);
      console.log("[Database] ✅ Connected to Supabase PostgreSQL");
      console.log("[Database] ✅ Drizzle ORM initialized");
      
      // Additional health check: Try a simple query
      try {
        const healthCheck = await _db.select().from(users).limit(1);
        console.log("[Database] ✅ Health check passed - can query users table");
        console.log(`[Database]   Sample query returned ${healthCheck.length} row(s)`);
      } catch (healthError) {
        console.warn("[Database] ⚠️ Health check query failed (non-critical):", healthError instanceof Error ? healthError.message : healthError);
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("[Database] ❌ Failed to connect:", errorMsg);
      console.error("[Database] Connection URL (masked):", dbUrl.replace(/:[^:@]+@/, ':****@'));
      
      // Provide helpful error messages with Supabase-specific guidance
      if (errorMsg.includes('getaddrinfo ENOTFOUND')) {
        console.error("[Database] 💡 Error type: DNS resolution failed");
        console.error("[Database] 💡 Supabase Settings to Check:");
        console.error("  1. ✅ Project Status: Dashboard → Ensure project is ACTIVE (not paused)");
        console.error("  2. ✅ Connection String: Settings → Database → Copy exact string");
        console.error("  3. ✅ Network Access: Settings → Database → Network restrictions (if enabled, add your IP)");
        console.error("[Database] 💡 Solutions:");
        console.error("  - Verify hostname matches Supabase Dashboard exactly");
        console.error("  - Check if project is paused (unpause in Dashboard)");
        console.error("  - Disable IP restrictions temporarily for testing");
      } else if (errorMsg.includes('password authentication failed') || errorMsg.includes('authentication failed')) {
        console.error("[Database] 💡 Error type: Authentication failed");
        console.error("[Database] 💡 Supabase Settings to Check:");
        console.error("  1. ✅ Database Password: Settings → Database → Database password");
        console.error("     → Click 'Reset database password' if unsure");
        console.error("     → Copy the NEW password (not your Supabase account password!)");
        console.error("  2. ✅ Connection String Format: Settings → Database → Connection string");
        console.error("     → Use 'Session pooler' or 'Transaction pooler'");
        console.error("     → Copy the ENTIRE string including password");
        console.error("  3. ✅ Username Format: Should be 'postgres.[PROJECT-REF]'");
        console.error("     → Example: postgres.yvtuehrylsqqbiawlftu");
        console.error("[Database] 💡 Common Issues:");
        console.error("  ❌ Using Supabase account password instead of database password");
        console.error("  ❌ Password contains special characters (may need URL encoding)");
        console.error("  ❌ Connection string copied incorrectly");
        console.error("[Database] 💡 Solutions:");
        console.error("  1. Go to Supabase Dashboard → Settings → Database");
        console.error("  2. Click 'Reset database password'");
        console.error("  3. Copy the NEW connection string (includes new password)");
        console.error("  4. Paste directly into .env file");
        console.error("  5. Try Transaction pooler (port 6543) if Session pooler fails");
      } else if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
        console.error("[Database] 💡 Error type: Connection timeout");
        console.error("[Database] 💡 Supabase Settings to Check:");
        console.error("  1. ✅ Network Restrictions: Settings → Database → Network restrictions");
        console.error("     → If enabled, add your IP address or disable temporarily");
        console.error("  2. ✅ Connection Pooling: Settings → Database → Connection pooling");
        console.error("     → Ensure pooling is enabled");
        console.error("[Database] 💡 Solutions:");
        console.error("  - Check firewall/antivirus settings");
        console.error("  - Disable IP restrictions in Supabase temporarily");
        console.error("  - Try Transaction pooler (port 6543)");
      } else if (errorMsg.includes('Invalid URL')) {
        console.error("[Database] 💡 Error type: Invalid connection string format");
        console.error("[Database] 💡 Check:");
        console.error("  1. ✅ Connection string doesn't have duplicate 'DATABASE_URL=' prefix");
        console.error("  2. ✅ No extra spaces or quotes around the URL");
        console.error("  3. ✅ Format: postgresql://user:password@host:port/database");
      } else {
        console.error("[Database] 💡 Unknown error - check error message above");
        console.error("[Database] 💡 Supabase Settings Checklist:");
        console.error("  ✅ Project is ACTIVE (not paused)");
        console.error("  ✅ Database password is correct (reset if unsure)");
        console.error("  ✅ Connection string copied exactly from Dashboard");
        console.error("  ✅ Network restrictions allow your IP (or disabled)");
        console.error("  ✅ Using correct port (5432 for Direct, 6543 for Pooler)");
      }
      
      _db = null;
      if (_client) {
        await _client.end().catch(() => {});
        _client = null;
      }
    }
  } else if (!process.env.DATABASE_URL) {
    console.error("[Database] ❌ DATABASE_URL environment variable is not set!");
    console.error("[Database] 💡 Please set DATABASE_URL in your .env file");
  } else if (_db) {
    console.log("[Database] ✅ Using existing database connection");
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ========== Recipe Management ==========

export async function createRecipe(recipe: InsertRecipe) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(recipes).values(recipe).returning({ id: recipes.id });
  return result[0].id;
}

export async function getRecipeById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
  const recipe = result[0];
  
  if (!recipe) return null;
  
  // 獲取食材
  const ingredientsList = await db.select().from(ingredients).where(eq(ingredients.recipeId, id)).orderBy(ingredients.order);
  
  // 獲取烹飪步驟
  const stepsList = await db.select().from(cookingSteps).where(eq(cookingSteps.recipeId, id)).orderBy(cookingSteps.stepNumber);
  
  // 獲取分類
  const categoriesList = await db.select({
    id: categories.id,
    name: categories.name,
    type: categories.type,
  }).from(recipeCategories)
    .innerJoin(categories, eq(categories.id, recipeCategories.categoryId))
    .where(eq(recipeCategories.recipeId, id));
  
  return {
    ...recipe,
    ingredients: ingredientsList,
    steps: stepsList,
    categories: categoriesList,
  };
}

export async function getRecipesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(recipes).where(eq(recipes.userId, userId)).orderBy(desc(recipes.createdAt));
}

export async function getAllRecipes() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(recipes).orderBy(desc(recipes.createdAt));
}

export async function updateRecipe(id: number, data: Partial<InsertRecipe>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(recipes).set(data).where(eq(recipes.id, id));
}

export async function deleteRecipe(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 刪除關聯數據
  await db.delete(ingredients).where(eq(ingredients.recipeId, id));
  await db.delete(cookingSteps).where(eq(cookingSteps.recipeId, id));
  await db.delete(recipeCategories).where(eq(recipeCategories.recipeId, id));
  await db.delete(recipes).where(eq(recipes.id, id));
}

// ========== Ingredients Management ==========

export async function createIngredient(ingredient: InsertIngredient) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(ingredients).values(ingredient).returning({ id: ingredients.id });
  return result[0].id;
}

export async function getIngredientsByRecipeId(recipeId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(ingredients).where(eq(ingredients.recipeId, recipeId)).orderBy(ingredients.order);
}

export async function deleteIngredientsByRecipeId(recipeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(ingredients).where(eq(ingredients.recipeId, recipeId));
}

// ========== Cooking Steps Management ==========

export async function createCookingStep(step: InsertCookingStep) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(cookingSteps).values(step).returning({ id: cookingSteps.id });
  return result[0].id;
}

export async function getCookingStepsByRecipeId(recipeId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(cookingSteps).where(eq(cookingSteps.recipeId, recipeId)).orderBy(cookingSteps.stepNumber);
}

export async function deleteCookingStepsByRecipeId(recipeId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(cookingSteps).where(eq(cookingSteps.recipeId, recipeId));
}

// ========== Categories Management ==========

export async function createCategory(category: InsertCategory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(categories).values(category).returning({ id: categories.id });
  return result[0].id;
}

export async function getAllCategories() {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(categories);
}

export async function getCategoriesByType(type: "ingredient" | "cuisine" | "method" | "health") {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(categories).where(eq(categories.type, type));
}

export async function getCategoriesByRecipeId(recipeId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
      description: categories.description,
      createdAt: categories.createdAt,
    })
    .from(recipeCategories)
    .innerJoin(categories, eq(recipeCategories.categoryId, categories.id))
    .where(eq(recipeCategories.recipeId, recipeId));
  
  return result;
}

export async function addRecipeCategory(recipeId: number, categoryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.insert(recipeCategories).values({ recipeId, categoryId });
}

export async function removeRecipeCategory(recipeId: number, categoryId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(recipeCategories).where(
    and(
      eq(recipeCategories.recipeId, recipeId),
      eq(recipeCategories.categoryId, categoryId)
    )
  );
}

export async function getRecipesByCategory(categoryId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const result = await db
    .select({
      id: recipes.id,
      userId: recipes.userId,
      title: recipes.title,
      description: recipes.description,
      inputMethod: recipes.inputMethod,
      sourceUrl: recipes.sourceUrl,
      imageUrl: recipes.imageUrl,
      videoUrl: recipes.videoUrl,
      totalCalories: recipes.totalCalories,
      servings: recipes.servings,
      caloriesPerServing: recipes.caloriesPerServing,
      protein: recipes.protein,
      carbs: recipes.carbs,
      fat: recipes.fat,
      fiber: recipes.fiber,
      aiAnalysis: recipes.aiAnalysis,
      improvementSuggestions: recipes.improvementSuggestions,
      machineInstructions: recipes.machineInstructions,
      isPublished: recipes.isPublished,
      createdAt: recipes.createdAt,
      updatedAt: recipes.updatedAt,
    })
    .from(recipeCategories)
    .innerJoin(recipes, eq(recipeCategories.recipeId, recipes.id))
    .where(eq(recipeCategories.categoryId, categoryId))
    .orderBy(desc(recipes.createdAt));
  
  return result;
}

// ========== 用戶建議相關函數 ==========

export async function createUserSuggestion(suggestion: InsertUserSuggestion) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(userSuggestions).values(suggestion).returning({ id: userSuggestions.id });
  return result[0].id;
}

export async function getUserSuggestionById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select().from(userSuggestions).where(eq(userSuggestions.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getSuggestionsByRecipeId(recipeId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(userSuggestions)
    .where(eq(userSuggestions.recipeId, recipeId))
    .orderBy(desc(userSuggestions.createdAt));
}

export async function getSuggestionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  
  return await db.select()
    .from(userSuggestions)
    .where(eq(userSuggestions.userId, userId))
    .orderBy(desc(userSuggestions.createdAt));
}

export async function updateUserSuggestion(id: number, updates: Partial<InsertUserSuggestion>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(userSuggestions)
    .set(updates)
    .where(eq(userSuggestions.id, id));
}

// ========== 公開瀏覽功能 ==========

export async function browsePublishedRecipes(filters: {
  search?: string;
  categoryIds?: number[];
  minCalories?: number;
  maxCalories?: number;
  minProtein?: number;
  maxProtein?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const { search, categoryIds, minCalories, maxCalories, minProtein, maxProtein, limit = 20, offset = 0 } = filters;

  let query = db
    .select({
      id: recipes.id,
      title: recipes.title,
      description: recipes.description,
      servings: recipes.servings,
      totalCalories: recipes.totalCalories,
      protein: recipes.protein,
      carbs: recipes.carbs,
      fat: recipes.fat,
      imageUrl: recipes.imageUrl,
      createdAt: recipes.createdAt,
    })
    .from(recipes)
    .where(eq(recipes.isPublished, true))
    .$dynamic();

  // 關鍵字搜索
  if (search) {
    query = query.where(
      or(
        like(recipes.title, `%${search}%`),
        like(recipes.description, `%${search}%`)
      )
    );
  }

  // 營養範圍篩選
  if (minCalories !== undefined) {
    query = query.where(gte(recipes.totalCalories, minCalories));
  }
  if (maxCalories !== undefined) {
    query = query.where(lte(recipes.totalCalories, maxCalories));
  }
  if (minProtein !== undefined) {
    query = query.where(gte(recipes.protein, minProtein));
  }
  if (maxProtein !== undefined) {
    query = query.where(lte(recipes.protein, maxProtein));
  }

  // 分類篩選
  if (categoryIds && categoryIds.length > 0) {
    const recipeIds = await db
      .select({ recipeId: recipeCategories.recipeId })
      .from(recipeCategories)
      .where(inArray(recipeCategories.categoryId, categoryIds));
    
    const ids = recipeIds.map(r => r.recipeId);
    if (ids.length > 0) {
      query = query.where(inArray(recipes.id, ids));
    } else {
      return []; // 沒有符合分類的食譜
    }
  }

  const results = await query
    .orderBy(desc(recipes.createdAt))
    .limit(limit)
    .offset(offset);

  return results;
}

export async function getPublishedRecipeById(recipeId: number) {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.isPublished, true)))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// 更新食材
export async function getIngredientById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(ingredients).where(eq(ingredients.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateIngredient(id: number, data: Partial<InsertIngredient>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(ingredients).set(data).where(eq(ingredients.id, id));
}

export async function deleteIngredient(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(ingredients).where(eq(ingredients.id, id));
}

// 更新步驟
export async function updateCookingStep(id: number, data: Partial<InsertCookingStep>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(cookingSteps).set(data).where(eq(cookingSteps.id, id));
}

export async function deleteCookingStep(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(cookingSteps).where(eq(cookingSteps.id, id));
}

// 更新食譜分類關聯
export async function updateRecipeCategories(recipeId: number, categoryIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 刪除現有關聯
  await db.delete(recipeCategories).where(eq(recipeCategories.recipeId, recipeId));
  
  // 添加新關聯
  if (categoryIds.length > 0) {
    await db.insert(recipeCategories).values(
      categoryIds.map(categoryId => ({ recipeId, categoryId }))
    );
  }
}

// ==================== 版本歷史相關函數 ====================

/**
 * 創建食譜版本快照
 */
export async function createRecipeVersion(
  recipeId: number,
  userId: number,
  snapshotData: any,
  changeDescription?: string,
  changedFields?: string[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 獲取當前最大版本號
  const versions = await db
    .select()
    .from(recipeVersions)
    .where(eq(recipeVersions.recipeId, recipeId))
    .orderBy(desc(recipeVersions.versionNumber))
    .limit(1);

  const nextVersionNumber = versions.length > 0 ? (versions[0].versionNumber + 1) : 1;

  const version: InsertRecipeVersion = {
    recipeId,
    userId,
    versionNumber: nextVersionNumber,
    snapshotData: JSON.stringify(snapshotData),
    changeDescription: changeDescription || null,
    changedFields: changedFields ? JSON.stringify(changedFields) : null,
  };

  await db.insert(recipeVersions).values(version);
  return nextVersionNumber;
}

/**
 * 獲取食譜的所有版本歷史
 */
export async function getRecipeVersions(recipeId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(recipeVersions)
    .where(eq(recipeVersions.recipeId, recipeId))
    .orderBy(desc(recipeVersions.createdAt));
}

/**
 * 獲取特定版本的快照數據
 */
export async function getRecipeVersion(versionId: number) {
  const db = await getDb();
  if (!db) return null;

  const results = await db
    .select()
    .from(recipeVersions)
    .where(eq(recipeVersions.id, versionId))
    .limit(1);

  return results.length > 0 ? results[0] : null;
}

/**
 * 獲取食譜的完整數據(用於創建快照)
 */
export async function getRecipeSnapshotData(recipeId: number) {
  const db = await getDb();
  if (!db) return null;

  // 獲取食譜基本資訊
  const recipeResults = await db
    .select()
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .limit(1);

  if (recipeResults.length === 0) return null;
  const recipe = recipeResults[0];

  // 獲取食材
  const ingredientsList = await db
    .select()
    .from(ingredients)
    .where(eq(ingredients.recipeId, recipeId))
    .orderBy(ingredients.order);

  // 獲取步驟
  const stepsList = await db
    .select()
    .from(cookingSteps)
    .where(eq(cookingSteps.recipeId, recipeId))
    .orderBy(cookingSteps.stepNumber);

  // 獲取分類
  const categoryLinks = await db
    .select()
    .from(recipeCategories)
    .where(eq(recipeCategories.recipeId, recipeId));

  const categoryIds = categoryLinks.map(link => link.categoryId);
  const categoriesList = categoryIds.length > 0
    ? await db
        .select()
        .from(categories)
        .where(inArray(categories.id, categoryIds))
    : [];

  return {
    recipe,
    ingredients: ingredientsList,
    steps: stepsList,
    categories: categoriesList,
  };
}

// ==================== Recipe Reviews ====================

export async function createReview(review: InsertRecipeReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(recipeReviews).values(review).returning();
  return result;
}

export async function getReviewsByRecipeId(recipeId: number) {
  const db = await getDb();
  if (!db) return [];
  
  const reviews = await db
    .select({
      id: recipeReviews.id,
      recipeId: recipeReviews.recipeId,
      userId: recipeReviews.userId,
      rating: recipeReviews.rating,
      comment: recipeReviews.comment,
      createdAt: recipeReviews.createdAt,
      updatedAt: recipeReviews.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(recipeReviews)
    .leftJoin(users, eq(recipeReviews.userId, users.id))
    .where(eq(recipeReviews.recipeId, recipeId))
    .orderBy(desc(recipeReviews.createdAt));
  
  return reviews;
}

export async function getReviewByUserAndRecipe(userId: number, recipeId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(recipeReviews)
    .where(and(eq(recipeReviews.userId, userId), eq(recipeReviews.recipeId, recipeId)))
    .limit(1);
  
  return result.length > 0 ? result[0] : null;
}

export async function updateReview(id: number, userId: number, data: { rating?: number; comment?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .update(recipeReviews)
    .set(data)
    .where(and(eq(recipeReviews.id, id), eq(recipeReviews.userId, userId)));
}

export async function deleteReview(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db
    .delete(recipeReviews)
    .where(and(eq(recipeReviews.id, id), eq(recipeReviews.userId, userId)));
}

export async function getRecipeAverageRating(recipeId: number): Promise<{ average: number; count: number }> {
  const db = await getDb();
  if (!db) return { average: 0, count: 0 };
  
  const reviews = await db
    .select()
    .from(recipeReviews)
    .where(eq(recipeReviews.recipeId, recipeId));
  
  if (reviews.length === 0) {
    return { average: 0, count: 0 };
  }
  
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  const average = sum / reviews.length;
  
  return { average: Math.round(average * 10) / 10, count: reviews.length };
}
