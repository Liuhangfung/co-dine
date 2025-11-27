import { integer, pgEnum, pgTable, text, timestamp, varchar, boolean, serial } from "drizzle-orm/pg-core";

/**
 * PostgreSQL Enums
 */
export const roleEnum = pgEnum("role", ["user", "admin"]);
export const inputMethodEnum = pgEnum("inputMethod", ["manual", "image", "weblink"]);
export const difficultyEnum = pgEnum("difficulty", ["簡單", "中等", "困難"]);
export const categoryTypeEnum = pgEnum("categoryType", ["ingredient", "cuisine", "method", "health"]);
export const suggestionTypeEnum = pgEnum("suggestionType", ["nutrition", "calories", "taste", "method", "other"]);
export const suggestionStatusEnum = pgEnum("suggestionStatus", ["pending", "processed", "applied"]);

/**
 * Core user table backing auth flow.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 食譜主表 - 儲存所有食譜的基本資訊
 */
export const recipes = pgTable("recipes", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(), // 創建者
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  
  // 輸入來源
  inputMethod: inputMethodEnum("inputMethod").notNull(),
  sourceUrl: text("sourceUrl"), // 原始網址(如果是weblink)
  imageUrl: text("imageUrl"), // 圖片URL(存儲在S3)
  videoUrl: text("videoUrl"), // 影片URL(存儲在S3)
  
  // 營養資訊
  totalCalories: integer("totalCalories"), // 總卡路里
  servings: integer("servings").default(1), // 份量
  caloriesPerServing: integer("caloriesPerServing"), // 每份卡路里
  protein: integer("protein"), // 蛋白質(克)
  carbs: integer("carbs"), // 碳水化合物(克)
  fat: integer("fat"), // 脂肪(克)
  fiber: integer("fiber"), // 纖維(克)
  
  // 烹飪信息
  difficulty: difficultyEnum("difficulty"), // 難度等級
  prepTime: integer("prepTime"), // 準備時間(分鐘)
  cookTime: integer("cookTime"), // 烹飪時間(分鐘)
  totalTime: integer("totalTime"), // 總時間(分鐘)
  requiredEquipment: text("requiredEquipment"), // 所需廚具(JSON格式的數組)
  
  // AI分析結果
  aiAnalysis: text("aiAnalysis"), // AI分析的完整結果(JSON格式)
  improvementSuggestions: text("improvementSuggestions"), // 米芝蓮級改良建議
  machineInstructions: text("machineInstructions"), // 煮食機械操作指令(JSON格式)
  
  // 狀態
  isPublished: boolean("isPublished").default(false),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = typeof recipes.$inferInsert;

/**
 * 食材表 - 儲存每個食譜的食材列表
 */
export const ingredients = pgTable("ingredients", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipeId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  amount: varchar("amount", { length: 100 }), // 例如: "200克", "2湯匙"
  unit: varchar("unit", { length: 50 }), // 單位
  calories: integer("calories"), // 該食材的卡路里
  notes: text("notes"), // 備註
  order: integer("order").notNull(), // 顯示順序
});

export type Ingredient = typeof ingredients.$inferSelect;
export type InsertIngredient = typeof ingredients.$inferInsert;

/**
 * 烹飪步驟表 - 儲存每個食譜的詳細步驟
 */
export const cookingSteps = pgTable("cookingSteps", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipeId").notNull(),
  stepNumber: integer("stepNumber").notNull(),
  instruction: text("instruction").notNull(),
  duration: integer("duration"), // 所需時間(分鐘)
  temperature: varchar("temperature", { length: 50 }), // 溫度設定
  imageUrl: text("imageUrl"), // 步驟圖片
  tips: text("tips"), // 小貼士
});

export type CookingStep = typeof cookingSteps.$inferSelect;
export type InsertCookingStep = typeof cookingSteps.$inferInsert;

/**
 * 分類標籤表 - 多維度分類系統
 */
export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  type: categoryTypeEnum("type").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

/**
 * 食譜分類關聯表 - 多對多關係
 */
export const recipeCategories = pgTable("recipeCategories", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipeId").notNull(),
  categoryId: integer("categoryId").notNull(),
});

export type RecipeCategory = typeof recipeCategories.$inferSelect;
export type InsertRecipeCategory = typeof recipeCategories.$inferInsert;

/**
 * 用戶建議表 - 儲存用戶對食譜的改良建議
 */
export const userSuggestions = pgTable("userSuggestions", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipeId").notNull(),
  userId: integer("userId").notNull(),
  
  // 建議內容
  suggestionType: suggestionTypeEnum("suggestionType").notNull(),
  targetCalories: integer("targetCalories"), // 目標卡路里
  targetProtein: integer("targetProtein"), // 目標蛋白質
  targetCarbs: integer("targetCarbs"), // 目標碳水化合物
  targetFat: integer("targetFat"), // 目標脂肪
  suggestionText: text("suggestionText").notNull(), // 具體建議描述
  
  // AI回應
  aiResponse: text("aiResponse"), // AI的改良方案
  improvedRecipeId: integer("improvedRecipeId"), // 改良後的食譜ID(如果創建了新版本)
  
  // 優化後營養成分
  improvedCalories: integer("improvedCalories"), // 優化後總卡路里
  improvedProtein: integer("improvedProtein"), // 優化後蛋白質(g)
  improvedCarbs: integer("improvedCarbs"), // 優化後碳水化合物(g)
  improvedFat: integer("improvedFat"), // 優化後脂肪(g)
  improvedFiber: integer("improvedFiber"), // 優化後纖維(g)
  healthTips: text("healthTips"), // 健康提示
  
  // 狀態
  status: suggestionStatusEnum("status").default("pending").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserSuggestion = typeof userSuggestions.$inferSelect;
export type InsertUserSuggestion = typeof userSuggestions.$inferInsert;

/**
 * 食譜版本歷史表 - 記錄每次編輯的快照
 */
export const recipeVersions = pgTable("recipeVersions", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipeId").notNull(), // 所屬食譜
  userId: integer("userId").notNull(), // 編輯者
  versionNumber: integer("versionNumber").notNull(), // 版本號碼
  
  // 快照數據 - 儲存當時的完整狀態
  snapshotData: text("snapshotData").notNull(), // JSON格式儲存所有數據
  
  // 變更說明
  changeDescription: text("changeDescription"), // 變更描述
  changedFields: text("changedFields"), // 變更的欄位列表(JSON)
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RecipeVersion = typeof recipeVersions.$inferSelect;
export type InsertRecipeVersion = typeof recipeVersions.$inferInsert;

/**
 * 食譜評分和評論表 - 儲存用戶的評分和評論
 */
export const recipeReviews = pgTable("recipeReviews", {
  id: serial("id").primaryKey(),
  recipeId: integer("recipeId").notNull(), // 所屬食譜
  userId: integer("userId").notNull(), // 評論者
  
  // 評分和評論
  rating: integer("rating").notNull(), // 1-5星級評分
  comment: text("comment"), // 評論內容
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type RecipeReview = typeof recipeReviews.$inferSelect;
export type InsertRecipeReview = typeof recipeReviews.$inferInsert;
