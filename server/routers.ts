import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { scrapeWebpage, simpleFetch } from "./webScraper";
import { storagePut } from "./storage";
import * as db from "./db";
import { eq } from "drizzle-orm";
import { ingredients, cookingSteps, recipeCategories, InsertRecipe } from "../drizzle/schema";

// Helper function to wrap AI calls with error handling
async function safeInvokeLLM(params: Parameters<typeof invokeLLM>[0]): Promise<ReturnType<typeof invokeLLM>> {
  try {
    return await invokeLLM(params);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('not configured') || errorMessage.includes('missing')) {
      throw new Error(`AI服務未配置: ${errorMessage}。請設置 BUILT_IN_FORGE_API_KEY 和 BUILT_IN_FORGE_API_URL 環境變量。`);
    }
    if (errorMessage.includes('地區不可用') || errorMessage.includes('unsupported_country')) {
      throw new Error(errorMessage); // Already translated, pass through
    }
    throw error;
  }
}

// ========== 輸入驗證 Schemas ==========

const createRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  inputMethod: z.enum(["manual", "image", "weblink"]),
  sourceUrl: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
  servings: z.number().default(1),
});

const analyzeWeblinkSchema = z.object({
  url: z.string().url(),
});

const manualRecipeSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  servings: z.number().default(1),
  difficulty: z.enum(["簡單", "中等", "困難"]).optional(),
  prepTime: z.number().optional(),
  cookTime: z.number().optional(),
  totalTime: z.number().optional(),
  requiredEquipment: z.array(z.string()).optional(),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.string().optional(),
    unit: z.string().optional(),
    notes: z.string().optional(),
  })),
  steps: z.array(z.object({
    instruction: z.string(),
    duration: z.number().optional(),
    temperature: z.string().optional(),
    tips: z.string().optional(),
  })),
  categoryIds: z.array(z.number()).optional(),
});

const createSuggestionSchema = z.object({
  recipeId: z.number(),
  suggestionType: z.enum(["nutrition", "calories", "taste", "method", "other"]),
  targetCalories: z.number().optional(),
  targetProtein: z.number().optional(),
  targetCarbs: z.number().optional(),
  targetFat: z.number().optional(),
  suggestionText: z.string().min(1),
});

const processSuggestionSchema = z.object({
  suggestionId: z.number(),
});

const updateRecipeSchema = z.object({
  id: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  servings: z.number().optional(),
  difficulty: z.enum(["簡單", "中等", "困難"]).optional(),
  prepTime: z.number().optional(),
  cookTime: z.number().optional(),
  totalTime: z.number().optional(),
  requiredEquipment: z.array(z.string()).optional(),
  isPublished: z.boolean().optional(),
  totalCalories: z.number().optional(),
  caloriesPerServing: z.number().optional(),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  fiber: z.number().optional(),
});

const updateIngredientSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  amount: z.string().optional(),
  unit: z.string().optional(),
  calories: z.number().optional(),
  notes: z.string().optional(),
  order: z.number().optional(),
});

const updateCookingStepSchema = z.object({
  id: z.number(),
  instruction: z.string().optional(),
  duration: z.number().optional(),
  temperature: z.string().optional(),
  tips: z.string().optional(),
  order: z.number().optional(),
});

const updateRecipeCategoriesSchema = z.object({
  recipeId: z.number(),
  categoryIds: z.array(z.number()),
});

const browseRecipesSchema = z.object({
  search: z.string().optional(),
  categoryIds: z.array(z.number()).optional(),
  minCalories: z.number().optional(),
  maxCalories: z.number().optional(),
  minProtein: z.number().optional(),
  maxProtein: z.number().optional(),
  limit: z.number().default(20),
  offset: z.number().default(0),
});

// 版本歷史 Router
const versionsRouter = router({
  // 獲取食譜的所有版本歷史
  list: publicProcedure
    .input(z.object({ recipeId: z.number() }))
    .query(async ({ input, ctx }) => {
      const versions = await db.getRecipeVersions(input.recipeId);
      return versions.map(v => ({
        ...v,
        snapshotData: JSON.parse(v.snapshotData),
        changedFields: v.changedFields ? JSON.parse(v.changedFields) : null,
      }));
    }),

  // 獲取特定版本的詳細資訊
  getById: publicProcedure
    .input(z.object({ versionId: z.number() }))
    .query(async ({ input }) => {
      const version = await db.getRecipeVersion(input.versionId);
      if (!version) return null;
      return {
        ...version,
        snapshotData: JSON.parse(version.snapshotData),
        changedFields: version.changedFields ? JSON.parse(version.changedFields) : null,
      };
    }),

  // 還原到指定版本
  restore: publicProcedure
    .input(z.object({ versionId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const version = await db.getRecipeVersion(input.versionId);
      if (!version) throw new Error("版本不存在");

      const snapshotData = JSON.parse(version.snapshotData);
      const recipeId = version.recipeId;

      // 在還原之前，先創建當前狀態的快照
      const currentSnapshot = await db.getRecipeSnapshotData(recipeId);
      if (currentSnapshot) {
        await db.createRecipeVersion(
          recipeId,
          1, // Default user ID since auth is disabled
          currentSnapshot,
          `還原前的快照 (即將還原到版本 ${version.versionNumber})`,
          []
        );
      }

      // 還原食譜基本資訊
      await db.updateRecipe(recipeId, {
        title: snapshotData.recipe.title,
        description: snapshotData.recipe.description,
        servings: snapshotData.recipe.servings,
        totalCalories: snapshotData.recipe.totalCalories,
        caloriesPerServing: snapshotData.recipe.caloriesPerServing,
        protein: snapshotData.recipe.protein,
        carbs: snapshotData.recipe.carbs,
        fat: snapshotData.recipe.fat,
        fiber: snapshotData.recipe.fiber,
        isPublished: snapshotData.recipe.isPublished,
      });

      // 刪除現有食材和步驟，然後重新創建
      // 注意：這是簡化的實現，實際應用中可能需要更精細的處理
      const dbInstance = await db.getDb();
      if (dbInstance) {
        // 刪除舊食材
        await dbInstance.delete(ingredients).where(eq(ingredients.recipeId, recipeId));
        // 刪除舊步驟
        await dbInstance.delete(cookingSteps).where(eq(cookingSteps.recipeId, recipeId));
        // 刪除舊分類關聯
        await dbInstance.delete(recipeCategories).where(eq(recipeCategories.recipeId, recipeId));

        // 重新創建食材
        for (const ing of snapshotData.ingredients) {
          await db.createIngredient({
            recipeId,
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            calories: ing.calories,
            notes: ing.notes,
            order: ing.order,
          });
        }

        // 重新創建步驟
        for (const step of snapshotData.steps) {
          await db.createCookingStep({
            recipeId,
            stepNumber: step.stepNumber,
            instruction: step.instruction,
            duration: step.duration,
            temperature: step.temperature,
            tips: step.tips,
          });
        }

        // 重新創建分類關聯
        for (const cat of snapshotData.categories) {
          await db.addRecipeCategory(recipeId, cat.id);
        }
      }

      // 創建還原操作的版本記錄
      await db.createRecipeVersion(
        recipeId,
        1, // Default user ID since auth is disabled
        snapshotData,
        `已還原到版本 ${version.versionNumber}`,
        ["restored"]
      );

      return { success: true, versionNumber: version.versionNumber };
    }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(() => null), // Auth disabled - return null
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ========== Recipe Management ==========
  recipes: router({
    // 獲取所有食譜
    list: publicProcedure.query(async () => {
      return await db.getAllRecipes();
    }),

    // 獲取單個食譜詳情(包含食材和步驟)
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const recipe = await db.getRecipeById(input.id);
        if (!recipe) return null;

        const ingredients = await db.getIngredientsByRecipeId(input.id);
        const steps = await db.getCookingStepsByRecipeId(input.id);
        const categories = await db.getCategoriesByRecipeId(input.id);

        return {
          ...recipe,
          ingredients,
          steps,
          categories,
        };
      }),

    // 批量獲取多個食譜詳情(用於對比)
    getByIds: publicProcedure
      .input(z.object({ ids: z.array(z.number()) }))
      .query(async ({ input }) => {
        const recipes = await Promise.all(
          input.ids.map(async (id) => {
            const recipe = await db.getRecipeById(id);
            if (!recipe) return null;

            const ingredients = await db.getIngredientsByRecipeId(id);
            const cookingSteps = await db.getCookingStepsByRecipeId(id);
            const categories = await db.getCategoriesByRecipeId(id);

            return {
              ...recipe,
              ingredients,
              cookingSteps,
              categories,
            };
          })
        );

        return recipes.filter((recipe) => recipe !== null);
      }),

    // 通過網址分析創建食譜
    createFromWeblink: publicProcedure
      .input(analyzeWeblinkSchema)
      .mutation(async ({ input }) => {
        // 先嘗試抓取網頁內容
        let scrapedContent = await scrapeWebpage(input.url);
        
        // 如果Playwright失敗,嘗試簡單fetch
        if (!scrapedContent.success) {
          scrapedContent = await simpleFetch(input.url);
        }
        
        // 如果仍然失敗,返回錯誤
        if (!scrapedContent.success) {
          // 檢查是否是小紅書或其他受限網站
          const restrictedSites = ['xiaohongshu.com', 'xhslink.com', 'douyin.com', 'tiktok.com'];
          const isRestrictedSite = restrictedSites.some(site => input.url.includes(site));
          
          if (isRestrictedSite) {
            throw new Error(`無法讀取此網站內容。小紅書、抖音等平台的內容主要以影片形式呈現，系統無法直接處理影片。\n\n建議替代方案：\n1. 根據影片內容手動輸入食材和步驟\n2. 使用「手動輸入」功能創建食譜`);
          }
          
          throw new Error(`無法訪問網址: ${scrapedContent.error || '未知錯誤'}。某些網站需要登入或有訪問限制。\n\n建議替代方案：\n1. 使用「手動輸入」功能直接輸入食譜內容\n2. 嘗試其他公開的食譜網站連結`);
        }
        
        // 檢查是否有足夠的內容
        if (!scrapedContent.content || scrapedContent.content.length < 50) {
          // 檢查是否是影片內容網站
          const videoSites = ['xiaohongshu.com', 'xhslink.com', 'youtube.com', 'youtu.be', 'bilibili.com', 'douyin.com', 'tiktok.com'];
          const isVideoSite = videoSites.some(site => input.url.includes(site));
          
          if (isVideoSite) {
            throw new Error(`此網頁主要包含影片內容，文字資訊不足。影片中的食譜步驟無法直接讀取。\n\n建議替代方案：\n1. 觀看影片後手動記錄食材和步驟，使用「手動輸入」功能\n2. 嘗試其他包含文字食譜的網站連結`);
          }
          
          throw new Error('網頁內容不足或需要登入。\n\n建議替代方案：\n1. 使用「手動輸入」功能直接輸入食譜內容\n2. 嘗試其他公開的食譜網站連結');
        }
        
        // 使用AI分析抓取的內容（增加內容長度和改進提示詞）
        const analysisResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `你是一位米芝蓮級大廾和營養師。你的任務是從網頁內容中提取完整的食譜資訊。

**強制要求（必須包含，不能為空）：**
1. **食材清單（ingredients）**：必須識別並包含所有食材，至少3個以上。不要遺漏任何一個（包括主食材、輔料、調味料、配菜等）。每種食材必須有：
   - name（食材名稱）
   - amount（數量，如「3」、「500」）
   - unit（單位，如「個」、「g」、「ml」）
   - calories（卡路里，必須是整數）

2. **烹飪步驟（steps）**：必須按順序詳細描述每一步，至少3個步驟以上。每個步驟必須有：
   - instruction（詳細的烹飪說明）
   - duration（可選，分鐘數）
   - temperature（可選，溫度）

3. **營養分析（nutrition）**：必須根據所有食材精準計算總營養成分，包括：
   - totalCalories（總卡路里，必須是整數）
   - protein（蛋白質，單位：克，必須是整數）
   - carbs（碳水化合物，單位：克，必須是整數）
   - fat（脂肪，單位：克，必須是整數）
   - fiber（纖維，單位：克，必須是整數）

4. **份量（servings）**：識別食譜的份量（幾人份），必須是正整數

**重要**：即使網頁內容不完整，你必須根據可見的食材和步驟，使用專業知識推斷並補充完整的：
- 食材清單（至少列出所有可見的食材）
- 烹飪步驟（至少3個詳細步驟）
- 營養分析（根據食材計算，不能為0）`
            },
            {
              role: "user",
              content: `網頁標題: ${scrapedContent.title}\n\n網頁內容:\n${scrapedContent.content.substring(0, 10000)}\n\n**必須返回的字段（不能為空）：**

1. **食材清單（ingredients）**：必須是數組，至少包含3個食材。每個食材必須有 name, amount, unit, calories。
   示例格式：
   [
     {"name": "雞蛋", "amount": "3", "unit": "個", "calories": 210},
     {"name": "麵粉", "amount": "200", "unit": "g", "calories": 700}
   ]

2. **烹飪步驟（steps）**：必須是數組，至少包含3個步驟。每個步驟必須有 instruction。
   示例格式：
   [
     {"instruction": "將雞蛋打散", "duration": null, "temperature": null},
     {"instruction": "加入麵粉攪拌均勻", "duration": 5, "temperature": null}
   ]

3. **營養分析（nutrition）**：必須是對象，包含 totalCalories, protein, carbs, fat, fiber（都是整數）。
   示例格式：
   {"totalCalories": 910, "protein": 30, "carbs": 120, "fat": 35, "fiber": 5}

**請從以上網頁內容提取完整的食譜資訊。如果內容不完整，請根據可見的資訊和你的專業知識補充完整。**`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "recipe_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  servings: { type: "integer" },
                  ingredients: {
                    type: "array",
                    minItems: 1,
                    description: "食材清單，必須至少包含1個食材",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "食材名稱" },
                        amount: { type: "string", description: "數量" },
                        unit: { type: "string", description: "單位" },
                        calories: { type: "integer", description: "卡路里" }
                      },
                      required: ["name", "amount", "unit", "calories"],
                      additionalProperties: false
                    }
                  },
                  steps: {
                    type: "array",
                    minItems: 1,
                    description: "烹飪步驟，必須至少包含1個步驟",
                    items: {
                      type: "object",
                      properties: {
                        instruction: { type: "string", description: "烹飪說明" },
                        duration: { type: "integer", description: "時間（分鐘）" },
                        temperature: { type: "string", description: "溫度" }
                      },
                      required: ["instruction"],
                      additionalProperties: false
                    }
                  },
                  nutrition: {
                    type: "object",
                    description: "營養分析，必須包含所有營養成分",
                    properties: {
                      totalCalories: { type: "integer", description: "總卡路里" },
                      protein: { type: "integer", description: "蛋白質（克）" },
                      carbs: { type: "integer", description: "碳水化合物（克）" },
                      fat: { type: "integer", description: "脂肪（克）" },
                      fiber: { type: "integer", description: "纖維（克）" }
                    },
                    required: ["totalCalories", "protein", "carbs", "fat", "fiber"],
                    additionalProperties: false
                  }
                },
                required: ["title", "description", "servings", "ingredients", "steps", "nutrition"],
                additionalProperties: false
              }
            }
          }
        });

        const analysis = JSON.parse(analysisResult.choices[0].message.content as string);

        // 驗證必需字段
        if (!analysis.ingredients || !Array.isArray(analysis.ingredients) || analysis.ingredients.length === 0) {
          throw new Error('AI分析結果缺少食材清單。請確保網頁內容包含食材資訊，或重試。');
        }
        
        if (!analysis.steps || !Array.isArray(analysis.steps) || analysis.steps.length === 0) {
          throw new Error('AI分析結果缺少烹飪步驟。請確保網頁內容包含烹飪步驟，或重試。');
        }
        
        if (!analysis.nutrition || typeof analysis.nutrition !== 'object') {
          throw new Error('AI分析結果缺少營養分析。請重試。');
        }
        
        // 驗證營養成分字段
        const requiredNutritionFields = ['totalCalories', 'protein', 'carbs', 'fat', 'fiber'];
        for (const field of requiredNutritionFields) {
          if (analysis.nutrition[field] === undefined || analysis.nutrition[field] === null) {
            throw new Error(`AI分析結果缺少營養成分字段：${field}。請重試。`);
          }
        }
        
        // 確保營養成分是整數
        analysis.nutrition.totalCalories = Math.round(analysis.nutrition.totalCalories || 0);
        analysis.nutrition.protein = Math.round(analysis.nutrition.protein || 0);
        analysis.nutrition.carbs = Math.round(analysis.nutrition.carbs || 0);
        analysis.nutrition.fat = Math.round(analysis.nutrition.fat || 0);
        analysis.nutrition.fiber = Math.round(analysis.nutrition.fiber || 0);
        
        // 確保servings是正整數
        if (!analysis.servings || analysis.servings < 1) {
          analysis.servings = 1;
        }
        analysis.servings = Math.round(analysis.servings);

        // 生成改良建議（恢復原始提示詞）
        const improvementResult = await safeInvokeLLM({
          messages: [
            {
              role: "system",
              content: "你是一位米芝蓮級大廚。根據食譜提供專業的改良建議,使其更健康、更美味。"
            },
            {
              role: "user",
              content: `食譜: ${analysis.title}\n食材: ${JSON.stringify(analysis.ingredients)}\n步驟: ${JSON.stringify(analysis.steps)}\n\n請提供改良建議。`
            }
          ]
        });

        const improvements = improvementResult.choices[0].message.content || "";

        // 單獨進行對比分析：計算改良後的營養成分
        let improvedNutrition: any = null;
        const improvementsText = typeof improvements === 'string' ? improvements : String(improvements);
        if (improvementsText && improvementsText.trim().length > 0) {
          try {
            console.log('[createFromWeblink] Starting comparison analysis...');
            const comparisonResult = await safeInvokeLLM({
              messages: [
                {
                  role: "system",
                  content: "你是一位營養師。根據改良建議計算改良後食譜的營養成分。你必須返回 JSON 格式。"
                },
                {
                  role: "user",
                  content: `原始食譜營養成分:\n- 總卡路里: ${analysis.nutrition.totalCalories} kcal\n- 蛋白質: ${analysis.nutrition.protein} g\n- 碳水化合物: ${analysis.nutrition.carbs} g\n- 脂肪: ${analysis.nutrition.fat} g\n- 纖維: ${analysis.nutrition.fiber} g\n\n改良建議:\n${improvementsText.substring(0, 2000)}\n\n請根據改良建議，計算改良後食譜的預估營養成分。`
                }
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "nutrition_comparison",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      calories: { type: "integer", description: "改良後總卡路里 (kcal)" },
                      protein: { type: "integer", description: "改良後蛋白質 (g)" },
                      carbs: { type: "integer", description: "改良後碳水化合物 (g)" },
                      fat: { type: "integer", description: "改良後脂肪 (g)" },
                      fiber: { type: "integer", description: "改良後纖維 (g)" }
                  },
                  required: ["calories", "protein", "carbs", "fat", "fiber"],
                  additionalProperties: false
                }
              }
            }
          });
          
            const parsedNutrition = JSON.parse(comparisonResult.choices[0].message.content as string);
            improvedNutrition = parsedNutrition;
            console.log('[createFromWeblink] Comparison analysis successful:', improvedNutrition);
            
            // 將改良後的營養成分存儲到aiAnalysis中（在創建食譜時使用）
          } catch (error) {
            console.error('[createFromWeblink] Failed to calculate improved nutrition:', error);
            console.error('[createFromWeblink] Error details:', error instanceof Error ? error.message : String(error));
            // 如果計算失敗，繼續使用原始營養成分，但不存儲 improvedNutrition
          }
        } else {
          console.log('[createFromWeblink] No improvements text, skipping comparison analysis');
        }

        // 準備aiAnalysis數據（包含改良後的營養成分）
        const aiAnalysisData = {
          ...analysis,
          ...(improvedNutrition && { improvedNutrition: improvedNutrition })
        };
        console.log('[createFromWeblink] Final aiAnalysisData:', JSON.stringify(aiAnalysisData, null, 2));

        // 創建食譜記錄
        const recipeId = await db.createRecipe({
          userId: 1, // Default user ID since auth is disabled
          title: analysis.title,
          description: analysis.description,
          inputMethod: "weblink",
          sourceUrl: input.url,
          servings: analysis.servings,
          totalCalories: analysis.nutrition.totalCalories,
          caloriesPerServing: analysis.servings > 0 ? Math.round(analysis.nutrition.totalCalories / analysis.servings) : 0,
          protein: analysis.nutrition.protein,
          carbs: analysis.nutrition.carbs,
          fat: analysis.nutrition.fat,
          fiber: analysis.nutrition.fiber,
          aiAnalysis: JSON.stringify(aiAnalysisData),
          improvementSuggestions: improvementsText,
          isPublished: false,
        });
        
        // 如果有改良後的營養成分，可以選擇性地存儲（目前存儲在aiAnalysis中）

        // 添加食材
        for (let i = 0; i < analysis.ingredients.length; i++) {
          const ing = analysis.ingredients[i];
          await db.createIngredient({
            recipeId: recipeId as number,
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            calories: ing.calories,
            order: i + 1,
          });
        }

        // 添加步驟
        for (let i = 0; i < analysis.steps.length; i++) {
          const step = analysis.steps[i];
          await db.createCookingStep({
            recipeId: recipeId as number,
            stepNumber: i + 1,
            instruction: step.instruction,
            duration: step.duration,
            temperature: step.temperature,
          });
        }

        return { recipeId, analysis, improvements };
      }),

    // 手動創建食譜
    createManual: publicProcedure
      .input(manualRecipeSchema)
      .mutation(async ({ ctx, input }) => {
        // 計算營養成分
        const totalCalories = input.ingredients.reduce((sum, ing) => sum + (ing as any).calories || 0, 0);

        // 生成改良建議（恢復原始提示詞）
        const improvementResult = await safeInvokeLLM({
          messages: [
            {
              role: "system",
              content: "你是一位米芝蓮級大廚。根據食譜提供專業的改良建議,使其更健康、更美味。"
            },
            {
              role: "user",
              content: `食譜: ${input.title}\n食材: ${JSON.stringify(input.ingredients)}\n步驟: ${JSON.stringify(input.steps)}\n\n請提供改良建議。`
            }
          ]
        });

        const improvements = improvementResult.choices[0].message.content || "";

        // 單獨進行對比分析：計算改良後的營養成分
        let improvedNutrition: any = null;
        const improvementsText = typeof improvements === 'string' ? improvements : String(improvements);
        if (improvementsText && improvementsText.trim().length > 0) {
          try {
            console.log('[createManual] Starting comparison analysis...');
            const comparisonResult = await safeInvokeLLM({
              messages: [
                {
                  role: "system",
                  content: "你是一位營養師。根據改良建議計算改良後食譜的營養成分。你必須返回 JSON 格式。"
                },
                {
                  role: "user",
                  content: `原始食譜營養成分:\n- 總卡路里: ${totalCalories} kcal\n\n改良建議:\n${improvementsText.substring(0, 2000)}\n\n請根據改良建議，計算改良後食譜的預估營養成分。`
                }
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "nutrition_comparison",
                  strict: true,
                  schema: {
                    type: "object",
                    properties: {
                      calories: { type: "integer", description: "改良後總卡路里 (kcal)" },
                      protein: { type: "integer", description: "改良後蛋白質 (g)" },
                      carbs: { type: "integer", description: "改良後碳水化合物 (g)" },
                      fat: { type: "integer", description: "改良後脂肪 (g)" },
                      fiber: { type: "integer", description: "改良後纖維 (g)" }
                  },
                  required: ["calories", "protein", "carbs", "fat", "fiber"],
                  additionalProperties: false
                }
              }
            }
          });
          
            const parsedNutrition = JSON.parse(comparisonResult.choices[0].message.content as string);
            improvedNutrition = parsedNutrition;
            console.log('[createManual] Comparison analysis successful:', improvedNutrition);
          } catch (error) {
            console.error('[createManual] Failed to calculate improved nutrition:', error);
            console.error('[createManual] Error details:', error instanceof Error ? error.message : String(error));
            // 如果計算失敗，繼續使用原始營養成分
          }
        } else {
          console.log('[createManual] No improvements text, skipping comparison analysis');
        }

        // 準備aiAnalysis數據（包含改良後的營養成分）
        const aiAnalysisData = {
          title: input.title,
          description: input.description,
          servings: input.servings,
          ingredients: input.ingredients,
          steps: input.steps,
          nutrition: {
            totalCalories: totalCalories,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0
          },
          ...(improvedNutrition && { improvedNutrition: improvedNutrition })
        };

        // 創建食譜記錄
        const recipeId = await db.createRecipe({
          userId: 1, // Default user ID since auth is disabled
          title: input.title,
          description: input.description,
          inputMethod: "manual",
          servings: input.servings,
          totalCalories,
          caloriesPerServing: input.servings > 0 ? Math.round(totalCalories / input.servings) : 0,
          aiAnalysis: JSON.stringify(aiAnalysisData),
          improvementSuggestions: improvements as string,
          isPublished: false,
        });

        // 添加食材
        for (let i = 0; i < input.ingredients.length; i++) {
          const ing = input.ingredients[i];
          await db.createIngredient({
            recipeId: recipeId as number,
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            notes: ing.notes,
            order: i + 1,
          });
        }

        // 添加步驟
        for (let i = 0; i < input.steps.length; i++) {
          const step = input.steps[i];
          await db.createCookingStep({
            recipeId: recipeId as number,
            stepNumber: i + 1,
            instruction: step.instruction,
            duration: step.duration,
            temperature: step.temperature,
            tips: step.tips,
          });
        }

        // 添加分類
        if (input.categoryIds && input.categoryIds.length > 0) {
          for (const categoryId of input.categoryIds) {
            await db.addRecipeCategory(recipeId as number, categoryId);
          }
        }

        return { recipeId, improvements };
      }),

    // 更新食譜
    update: publicProcedure
      .input(updateRecipeSchema)
      .mutation(async ({ ctx, input }) => {
        const { id, requiredEquipment, ...data } = input;
        
        // 將 requiredEquipment 數組轉換為 JSON 字符串
        const updateData: Partial<InsertRecipe> = {
          ...data,
          ...(requiredEquipment !== undefined && { requiredEquipment: JSON.stringify(requiredEquipment) }),
        };
        
        // 在更新之前，創建當前狀態的快照
        const snapshot = await db.getRecipeSnapshotData(id);
        if (snapshot) {
          await db.createRecipeVersion(
            id,
            1, // Default user ID since auth is disabled
            snapshot,
            "編輯食譜",
            Object.keys(updateData)
          );
        }
        
        await db.updateRecipe(id, updateData);
        return { success: true };
      }),

    // 刪除食譜
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const recipe = await db.getRecipeById(input.id);
        if (!recipe) {
          throw new Error("食譜不存在");
        }
        // Auth disabled - allow deletion of any recipe
        await db.deleteRecipe(input.id);
        return { success: true };
      }),

    // 更新食材
    updateIngredient: publicProcedure
      .input(updateIngredientSchema)
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateIngredient(id, data);
        return { success: true };
      }),

    // 刪除食材
    deleteIngredient: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteIngredient(input.id);
        return { success: true };
      }),

    // 更新步驟
    updateCookingStep: publicProcedure
      .input(updateCookingStepSchema)
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateCookingStep(id, data);
        return { success: true };
      }),

    // 刪除步驟
    deleteCookingStep: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCookingStep(input.id);
        return { success: true };
      }),

    // 更新食譜分類
    updateCategories: publicProcedure
      .input(updateRecipeCategoriesSchema)
      .mutation(async ({ input }) => {
        await db.updateRecipeCategories(input.recipeId, input.categoryIds);
        return { success: true };
      }),

    // 根據食材列表重新計算營養成分
    recalculateNutrition: publicProcedure
      .input(z.object({
        recipeId: z.number(),
        servings: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 獲取當前食材列表
        const ingredients = await db.getIngredientsByRecipeId(input.recipeId);
        
        if (ingredients.length === 0) {
          throw new Error("沒有食材無法計算營養成分");
        }

        // 構建食材清單字串
        const ingredientsList = ingredients.map(ing => 
          `${ing.name} ${ing.amount || ""} ${ing.unit || ""}`
        ).join(", ");

        // 調用 AI 分析營養成分
        const analysisResult = await safeInvokeLLM({
          messages: [
            {
              role: "system",
              content: "你是一位營養師。根據食材列表計算總營養成分。請返回 JSON 格式。"
            },
            {
              role: "user",
              content: `請計算以下食材的總營養成分（${input.servings} 人份）：\n${ingredientsList}`
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "nutrition_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  totalCalories: { type: "integer", description: "總卡路里" },
                  protein: { type: "integer", description: "蛋白質（克）" },
                  carbs: { type: "integer", description: "碳水化合物（克）" },
                  fat: { type: "integer", description: "脂肪（克）" },
                  fiber: { type: "integer", description: "纖維（克）" }
                },
                required: ["totalCalories", "protein", "carbs", "fat", "fiber"],
                additionalProperties: false
              }
            }
          }
        });

        const nutrition = JSON.parse(analysisResult.choices[0].message.content as string);

        // 更新食譜的營養成分
        await db.updateRecipe(input.recipeId, {
          totalCalories: nutrition.totalCalories,
          caloriesPerServing: input.servings > 0 ? Math.round(nutrition.totalCalories / input.servings) : 0,
          protein: nutrition.protein,
          carbs: nutrition.carbs,
          fat: nutrition.fat,
          fiber: nutrition.fiber,
        });

        return { 
          success: true,
          nutrition: {
            totalCalories: nutrition.totalCalories,
            caloriesPerServing: input.servings > 0 ? Math.round(nutrition.totalCalories / input.servings) : 0,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat,
            fiber: nutrition.fiber,
          }
        };
      }),

    // 公開瀏覽食譜(支援篩選)
    browse: publicProcedure
      .input(browseRecipesSchema)
      .query(async ({ input }) => {
        return await db.browsePublishedRecipes(input);
      }),

    // 公開查看食譜詳情
    getPublicById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const recipe = await db.getPublishedRecipeById(input.id);
        if (!recipe) return null;

        const ingredients = await db.getIngredientsByRecipeId(input.id);
        const steps = await db.getCookingStepsByRecipeId(input.id);
        const categories = await db.getCategoriesByRecipeId(input.id);

        return {
          ...recipe,
          ingredients,
          steps,
          categories,
        };
      }),
  }),

  // ========== Categories Management ==========
  categories: router({
    // 獲取所有分類
    list: publicProcedure.query(async () => {
      return await db.getAllCategories();
    }),

    // 按類型獲取分類
    getByType: publicProcedure
      .input(z.object({ type: z.enum(["ingredient", "cuisine", "method", "health"]) }))
      .query(async ({ input }) => {
        return await db.getCategoriesByType(input.type);
      }),

    // 創建分類
    create: publicProcedure
      .input(z.object({
        name: z.string(),
        type: z.enum(["ingredient", "cuisine", "method", "health"]),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const categoryId = await db.createCategory(input);
        return { categoryId };
      }),

    // 獲取分類下的食譜
    getRecipes: publicProcedure
      .input(z.object({ categoryId: z.number() }))
      .query(async ({ input }) => {
        return await db.getRecipesByCategory(input.categoryId);
      }),
  }),

  // ========== User Suggestions Management ==========
  suggestions: router({
    // 提交改良建議
    create: publicProcedure
      .input(createSuggestionSchema)
      .mutation(async ({ ctx, input }) => {
        const suggestionId = await db.createUserSuggestion({
          ...input,
          userId: 1, // Default user ID since auth is disabled
          status: "pending",
        });
        return { suggestionId };
      }),

    // 處理建議(使用AI生成改良方案)
    process: publicProcedure
      .input(processSuggestionSchema)
      .mutation(async ({ ctx, input }) => {
        const suggestion = await db.getUserSuggestionById(input.suggestionId);
        if (!suggestion) {
          throw new Error("找不到建議");
        }

        // 獲取原始食譜
        const recipe = await db.getRecipeById(suggestion.recipeId);
        if (!recipe) {
          throw new Error("找不到食譜");
        }

        const ingredients = await db.getIngredientsByRecipeId(recipe.id);
        const steps = await db.getCookingStepsByRecipeId(recipe.id);

        // 構建提示詞
        let prompt = `你是一位米芝蓮級大廚。以下是一個食譜的資訊：\n\n`;
        prompt += `食譜名稱: ${recipe.title}\n`;
        prompt += `描述: ${recipe.description || "無"}\n`;
        prompt += `份量: ${recipe.servings}\n`;
        prompt += `當前營養成分:\n`;
        prompt += `- 總卡路里: ${recipe.totalCalories || "未計算"} kcal\n`;
        prompt += `- 蛋白質: ${recipe.protein || "未計算"} g\n`;
        prompt += `- 碳水化合物: ${recipe.carbs || "未計算"} g\n`;
        prompt += `- 脂肪: ${recipe.fat || "未計算"} g\n\n`;
        
        prompt += `食材清單:\n`;
        ingredients.forEach(ing => {
          prompt += `- ${ing.name} ${ing.amount || ""} ${ing.unit || ""}\n`;
        });
        
        prompt += `\n烹飪步驟:\n`;
        steps.forEach(step => {
          prompt += `${step.stepNumber}. ${step.instruction}\n`;
        });

        prompt += `\n用戶的改良建議:\n${suggestion.suggestionText}\n\n`;
        
        if (suggestion.targetCalories) {
          prompt += `目標卡路里: ${suggestion.targetCalories} kcal\n`;
        }
        if (suggestion.targetProtein) {
          prompt += `目標蛋白質: ${suggestion.targetProtein} g\n`;
        }
        if (suggestion.targetCarbs) {
          prompt += `目標碳水化合物: ${suggestion.targetCarbs} g\n`;
        }
        if (suggestion.targetFat) {
          prompt += `目標脂肪: ${suggestion.targetFat} g\n`;
        }

        prompt += `\n請根據用戶的建議,提供詳細的改良方案。你必須返回 JSON 格式的回應。`;

        // 調用AI生成改良方案（使用結構化輸出）
        const aiResult = await safeInvokeLLM({
          messages: [
            {
              role: "system",
              content: "你是一位米芝蓮級大廿和營養師,擅長根據用戶的需求改良食譜,使其更健康、更美味。你必須返回 JSON 格式的回應。"
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "recipe_improvement",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  ingredientAdjustments: {
                    type: "string",
                    description: "如何調整食材份量或替換食材的詳細說明"
                  },
                  methodAdjustments: {
                    type: "string",
                    description: "如何修改烹飪方法的詳細說明"
                  },
                  improvedNutrition: {
                    type: "object",
                    properties: {
                      calories: { type: "integer", description: "優化後總卡路里 (kcal)" },
                      protein: { type: "integer", description: "優化後蛋白質 (g)" },
                      carbs: { type: "integer", description: "優化後碳水化合物 (g)" },
                      fat: { type: "integer", description: "優化後脂肪 (g)" },
                      fiber: { type: "integer", description: "優化後纖維 (g)" }
                    },
                    required: ["calories", "protein", "carbs", "fat", "fiber"],
                    additionalProperties: false
                  },
                  healthTips: {
                    type: "string",
                    description: "健康提示，說明改良後的健康益處和風味特點"
                  },
                  additionalAdvice: {
                    type: "string",
                    description: "其他專業建議"
                  }
                },
                required: ["ingredientAdjustments", "methodAdjustments", "improvedNutrition", "healthTips", "additionalAdvice"],
                additionalProperties: false
              }
            }
          }
        });

        const aiContent = aiResult.choices[0]?.message?.content;
        let parsedResponse: any;
        let aiResponse: string;
        
        try {
          parsedResponse = typeof aiContent === 'string' ? JSON.parse(aiContent) : null;
          if (!parsedResponse) {
            throw new Error('無法解析 AI 回應');
          }
          
          // 格式化文字回應
          aiResponse = `## 食材調整\n${parsedResponse.ingredientAdjustments}\n\n`;
          aiResponse += `## 烹飪方法調整\n${parsedResponse.methodAdjustments}\n\n`;
          aiResponse += `## 優化後營養成分\n`;
          aiResponse += `- 總卡路里: ${parsedResponse.improvedNutrition.calories} kcal\n`;
          aiResponse += `- 蛋白質: ${parsedResponse.improvedNutrition.protein} g\n`;
          aiResponse += `- 碳水化合物: ${parsedResponse.improvedNutrition.carbs} g\n`;
          aiResponse += `- 脂肪: ${parsedResponse.improvedNutrition.fat} g\n`;
          aiResponse += `- 纖維: ${parsedResponse.improvedNutrition.fiber} g\n\n`;
          aiResponse += `## 健康提示\n${parsedResponse.healthTips}\n\n`;
          aiResponse += `## 其他建議\n${parsedResponse.additionalAdvice}`;
        } catch (error) {
          console.error('Failed to parse AI response:', error);
          aiResponse = typeof aiContent === 'string' ? aiContent : '無法生成改良方案';
          parsedResponse = null;
        }

        // 更新建議狀態，包括優化後營養數據
        await db.updateUserSuggestion(input.suggestionId, {
          aiResponse,
          status: "processed",
          ...(parsedResponse && {
            improvedCalories: parsedResponse.improvedNutrition.calories,
            improvedProtein: parsedResponse.improvedNutrition.protein,
            improvedCarbs: parsedResponse.improvedNutrition.carbs,
            improvedFat: parsedResponse.improvedNutrition.fat,
            improvedFiber: parsedResponse.improvedNutrition.fiber,
            healthTips: parsedResponse.healthTips
          })
        });

        return { 
          suggestionId: input.suggestionId,
          aiResponse,
          improvedNutrition: parsedResponse?.improvedNutrition,
          healthTips: parsedResponse?.healthTips
        };
      }),

    // 獲取某個食譜的所有建議
    getByRecipe: publicProcedure
      .input(z.object({ recipeId: z.number() }))
      .query(async ({ input }) => {
        return await db.getSuggestionsByRecipeId(input.recipeId);
      }),

    // 獲取當前用戶的所有建議
    getMy: publicProcedure
      .query(async ({ ctx }) => {
        return await db.getSuggestionsByUserId(1); // Default user ID since auth is disabled
      }),

    // 獲取單個建議詳情
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await db.getUserSuggestionById(input.id);
      }),
  }),

  // ========== 版本歷史管理 ==========
  versions: versionsRouter,

  // ========== 評分和評論管理 ==========
  reviews: router({
    // 添加或更新評分和評論
    addOrUpdate: publicProcedure
      .input(z.object({
        recipeId: z.number(),
        rating: z.number().min(1).max(5),
        comment: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 檢查是否已經評論過
        const existing = await db.getReviewByUserAndRecipe(1, input.recipeId); // Default user ID since auth is disabled
        
        if (existing) {
          // 更新現有評論
          await db.updateReview(existing.id, 1, { // Default user ID since auth is disabled
            rating: input.rating,
            comment: input.comment,
          });
          return { id: existing.id, updated: true };
        } else {
          // 創建新評論
          await db.createReview({
            recipeId: input.recipeId,
            userId: 1, // Default user ID since auth is disabled
            rating: input.rating,
            comment: input.comment,
          });
          // 獲取剛創建的評論
          const newReview = await db.getReviewByUserAndRecipe(1, input.recipeId); // Default user ID since auth is disabled
          return { id: newReview?.id || 0, updated: false };
        }
      }),

    // 獲取某個食譜的所有評論
    getByRecipe: publicProcedure
      .input(z.object({ recipeId: z.number() }))
      .query(async ({ input }) => {
        return await db.getReviewsByRecipeId(input.recipeId);
      }),

    // 獲取某個食譜的平均評分
    getAverageRating: publicProcedure
      .input(z.object({ recipeId: z.number() }))
      .query(async ({ input }) => {
        return await db.getRecipeAverageRating(input.recipeId);
      }),

    // 獲取當前用戶對某個食譜的評論
    getMyReview: publicProcedure
      .input(z.object({ recipeId: z.number() }))
      .query(async ({ input, ctx }) => {
        return await db.getReviewByUserAndRecipe(1, input.recipeId); // Default user ID since auth is disabled
      }),

    // 刪除評論
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.deleteReview(input.id, 1); // Default user ID since auth is disabled
        return { success: true };
      }),
  }),

  // ========== 食材替換建議 ==========
  ingredients: router({
    // 獲取食材替換建議
    getSuggestions: publicProcedure
      .input(z.object({
        ingredientId: z.number(),
        recipeId: z.number(),
      }))
      .mutation(async ({ input }) => {
        // 獲取原食材信息
        const ingredient = await db.getIngredientById(input.ingredientId);
        if (!ingredient) {
          throw new Error('找不到食材');
        }

        // 獲取食譜信息（用於上下文）
        const recipe = await db.getRecipeById(input.recipeId);
        if (!recipe) {
          throw new Error('找不到食譜');
        }

        // 構建 AI 提示詞
        let prompt = `你是一位營養師和大廿。以下是一個食譜中的食材資訊：\n\n`;
        prompt += `食譜名稱: ${recipe.title}\n`;
        prompt += `食材名稱: ${ingredient.name}\n`;
        prompt += `數量: ${ingredient.amount || ''} ${ingredient.unit || ''}\n\n`;
        
        prompt += `請推薦3-5個可以替換這個食材的選項，考慮以下因素：\n`;
        prompt += `1. 營養成分相似度\n`;
        prompt += `2. 烹飪功能相似度（口感、質地、風味）\n`;
        prompt += `3. 常見過敏原考慮（如果原食材是過敏原）\n`;
        prompt += `4. 健康益處（例如低脂、高蛋白質、高纖維）\n`;
        prompt += `5. 取得容易度\n\n`;
        prompt += `每個替換選項需要包括：\n`;
        prompt += `- 食材名稱\n`;
        prompt += `- 建議數量和單位\n`;
        prompt += `- 替換原因（簡短說明為什麼這是好的替代品）\n`;
        prompt += `- 預估營養成分（卡路里、蛋白質、碳水化合物、脂肪，單位：g）\n`;
        prompt += `- 健康益處標籤（例如：低脂、高蛋白、無麩質、素食等）\n`;

        // 調用 AI 生成替換建議（使用結構化輸出）
        const aiResult = await safeInvokeLLM({
          messages: [
            {
              role: "system",
              content: "你是一位營養師和大廿，擅長根據營養和烹飪需求推薦食材替代品。你必須返回 JSON 格式的回應。"
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "ingredient_substitutions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  originalIngredient: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      amount: { type: "string" },
                      unit: { type: "string" }
                    },
                    required: ["name", "amount", "unit"],
                    additionalProperties: false
                  },
                  substitutions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "替換食材名稱" },
                        amount: { type: "string", description: "建議數量" },
                        unit: { type: "string", description: "單位" },
                        reason: { type: "string", description: "替換原因" },
                        nutrition: {
                          type: "object",
                          properties: {
                            calories: { type: "integer", description: "卡路里 (kcal)" },
                            protein: { type: "integer", description: "蛋白質 (g)" },
                            carbs: { type: "integer", description: "碳水化合物 (g)" },
                            fat: { type: "integer", description: "脂肪 (g)" }
                          },
                          required: ["calories", "protein", "carbs", "fat"],
                          additionalProperties: false
                        },
                        healthBenefits: {
                          type: "array",
                          items: { type: "string" },
                          description: "健康益處標籤"
                        }
                      },
                      required: ["name", "amount", "unit", "reason", "nutrition", "healthBenefits"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["originalIngredient", "substitutions"],
                additionalProperties: false
              }
            }
          }
        });

        const aiContent = aiResult.choices[0]?.message?.content;
        let parsedResponse: any;
        
        try {
          parsedResponse = typeof aiContent === 'string' ? JSON.parse(aiContent) : null;
          if (!parsedResponse) {
            throw new Error('無法解析 AI 回應');
          }
        } catch (error) {
          console.error('Failed to parse AI response:', error);
          throw new Error('無法生成替換建議');
        }

        return {
          originalIngredient: {
            id: ingredient.id,
            name: ingredient.name,
            amount: ingredient.amount,
            unit: ingredient.unit,
          },
          substitutions: parsedResponse.substitutions
        };
      }),

    // 替換食材
    replace: publicProcedure
      .input(z.object({
        ingredientId: z.number(),
        recipeId: z.number(),
        newName: z.string(),
        newAmount: z.string().optional(),
        newUnit: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // 更新食材
        await db.updateIngredient(input.ingredientId, {
          name: input.newName,
          amount: input.newAmount,
          unit: input.newUnit,
        });

        // 獲取更新後的所有食材
        const ingredients = await db.getIngredientsByRecipeId(input.recipeId);
        
        // 重新計算營養成分（使用 AI）
        let prompt = `以下是更新後的食材清單：\n\n`;
        ingredients.forEach(ing => {
          prompt += `- ${ing.name} ${ing.amount || ''} ${ing.unit || ''}\n`;
        });
        prompt += `\n請精準計算這些食材的總營養成分。`;

        const nutritionResult = await safeInvokeLLM({
          messages: [
            {
              role: "system",
              content: "你是一位營養師，擅長計算食材的營養成分。你必須返回 JSON 格式的回應。"
            },
            {
              role: "user",
              content: prompt
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "nutrition_calculation",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  totalCalories: { type: "integer", description: "總卡路里 (kcal)" },
                  protein: { type: "integer", description: "蛋白質 (g)" },
                  carbs: { type: "integer", description: "碳水化合物 (g)" },
                  fat: { type: "integer", description: "脂肪 (g)" },
                  fiber: { type: "integer", description: "纖維 (g)" }
                },
                required: ["totalCalories", "protein", "carbs", "fat", "fiber"],
                additionalProperties: false
              }
            }
          }
        });

        const nutritionContent = nutritionResult.choices[0]?.message?.content;
        let nutrition: any;
        
        try {
          nutrition = typeof nutritionContent === 'string' ? JSON.parse(nutritionContent) : null;
          if (!nutrition) {
            throw new Error('無法解析營養成分');
          }
        } catch (error) {
          console.error('Failed to parse nutrition response:', error);
          // 如果 AI 計算失敗，不更新營養成分
          return { success: true, nutritionUpdated: false };
        }

        // 更新食譜營養成分
        const recipe = await db.getRecipeById(input.recipeId);
        if (recipe) {
          const servings = recipe.servings || 1;
          await db.updateRecipe(input.recipeId, {
            totalCalories: nutrition.totalCalories,
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat,
            fiber: nutrition.fiber,
            caloriesPerServing: servings > 0 ? Math.round(nutrition.totalCalories / servings) : 0,
          });
        }

        return { 
          success: true, 
          nutritionUpdated: true,
          newNutrition: nutrition
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
