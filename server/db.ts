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
    try {
      // Create postgres client with connection options
      // Optimized for Supabase PAID plan (higher connection limits)
      _client = postgres(process.env.DATABASE_URL, {
        max: 20, // Higher limit for paid plan (you have 200-400+ available)
        idle_timeout: 0, // Never timeout idle connections (keep alive forever)
        connect_timeout: 30, // Initial connection timeout
        max_lifetime: 60 * 60 * 24, // Recycle connections every 24 hours (paid plan is stable)
        ssl: { rejectUnauthorized: false }, // Supabase uses self-signed certificates
        connection: {
          application_name: 'co-dine-app', // Identify your app in Supabase
        },
        // Keep connection alive with periodic pings (prevents firewall timeouts)
        keep_alive: true,
        // Auto-reconnect on connection loss
        onnotice: () => {}, // Suppress notice logs
      });
      // Test connection
      await _client`SELECT 1`;
      // Create drizzle instance
      _db = drizzle(_client);
      console.log("[Database] ✅ Connected to Supabase PostgreSQL");
    } catch (error) {
      console.error("[Database] ❌ Failed to connect:", error instanceof Error ? error.message : error);
      _db = null;
      if (_client) {
        await _client.end().catch(() => {});
        _client = null;
      }
    }
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
