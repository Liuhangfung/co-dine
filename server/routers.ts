import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { scrapeWebpage, simpleFetch } from "./webScraper";
import { storagePut } from "./storage";
import { ENV } from "./_core/env";
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
  improvementSuggestions: z.string().optional(),
  aiAnalysis: z.string().optional(),
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
        console.log('[createFromWeblink] ========================================');
        console.log('[createFromWeblink] 🚀 Starting recipe creation from URL');
        console.log('[createFromWeblink] 🔗 URL:', input.url);
        console.log('[createFromWeblink] 📍 Step 1: Attempting web scraping...');
        
        // 先嘗試抓取網頁內容
        let scrapedContent = await scrapeWebpage(input.url);
        console.log('[createFromWeblink] 📊 Playwright scraping result:', scrapedContent.success ? '✅ Success' : '❌ Failed');
        
        // 如果Playwright失敗,嘗試簡單fetch
        if (!scrapedContent.success) {
          console.log('[createFromWeblink] 🔄 Step 2: Playwright failed, trying simpleFetch()...');
          scrapedContent = await simpleFetch(input.url);
          console.log('[createFromWeblink] 📊 simpleFetch result:', scrapedContent.success ? '✅ Success' : '❌ Failed');
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
        
        // 檢查是否有足夠的內容或影片字幕
        console.log('[createFromWeblink] 📍 Step 3: Validating scraped content...');
        const hasVideoTranscript = scrapedContent.videoTranscript && scrapedContent.videoTranscript.length > 50;
        const hasContent = scrapedContent.content && scrapedContent.content.length >= 50;
        
        console.log('[createFromWeblink] 📊 Content validation:');
        console.log('[createFromWeblink]   - Has video transcript:', hasVideoTranscript, `(${scrapedContent.videoTranscript?.length || 0} chars)`);
        console.log('[createFromWeblink]   - Has content:', hasContent, `(${scrapedContent.content?.length || 0} chars)`);
        
        if (!hasContent && !hasVideoTranscript) {
          console.log('[createFromWeblink] ❌ No sufficient content found');
          // 檢查是否是影片內容網站
          const videoSites = ['xiaohongshu.com', 'xhslink.com', 'youtube.com', 'youtu.be', 'bilibili.com', 'douyin.com', 'tiktok.com'];
          const isVideoSite = videoSites.some(site => input.url.includes(site));
          
          if (isVideoSite) {
            throw new Error(`此網頁主要包含影片內容，文字資訊不足。影片中的食譜步驟無法直接讀取。\n\n建議替代方案：\n1. 觀看影片後手動記錄食材和步驟，使用「手動輸入」功能\n2. 嘗試其他包含文字食譜的網站連結`);
          }
          
          throw new Error('網頁內容不足或需要登入。\n\n建議替代方案：\n1. 使用「手動輸入」功能直接輸入食譜內容\n2. 嘗試其他公開的食譜網站連結');
        }

        // ===== TWO-STAGE AI ANALYSIS FLOW =====
        console.log('[createFromWeblink] 📍 Step 4: Starting AI analysis flow...');
        console.log('[createFromWeblink] ========================================');
        
        // Pre-filter Stage: Extract ONLY food/cooking related content from transcript
        let filteredTranscript = scrapedContent.videoTranscript || '';
        if (hasVideoTranscript) {
          console.log('[createFromWeblink] 📍 Step 4a: PRE-FILTER STAGE');
          console.log('[createFromWeblink] 🔍 Pre-filter: Extracting food-related content only...');
          console.log('[createFromWeblink] 📊 Original transcript length:', scrapedContent.videoTranscript?.length || 0, 'characters');
          console.log('[createFromWeblink] 📊 Transcript preview (first 200 chars):', scrapedContent.videoTranscript?.substring(0, 200));
          console.log('[createFromWeblink] ⏳ Calling LLM for pre-filter...');
          const preFilterStartTime = Date.now();
          
          try {
            const preFilterResult = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `你是一位專業的食譜內容過濾器和翻譯專家。你的任務是從提供的影片字幕中，提取與食物、烹飪、食材、食譜步驟、烹飪技巧、營養相關的內容，並將所有內容翻譯成繁體中文。

**必須保留的內容**：
- 所有食材和用量
- 所有烹飪步驟和技巧
- 烹飪方法比較（例如：「用這種方法比那種方法好」）
- 食材選擇建議和比較（例如：「挪威的比澳洲的軟」）
- 烹飪時間、溫度、火候等技術細節
- 口感描述和特色（例如：「脆皮」、「爆汁」、「完美口感」）
- 烹飪提示和注意事項

**可以移除的內容**：
- 影片開頭或結尾的問候語、感謝語（如「大家好」、「謝謝觀看」）
- 純廣告、推廣內容
- 與烹飪完全無關的閒聊
- 影片製作相關的評論（如「記得訂閱」）
- 重複的內容
- 表情符號和特殊符號

**翻譯要求**：
- **必須將所有非繁體中文的內容翻譯成繁體中文**
- 如果原始字幕是英文、簡體中文或其他語言，請完整翻譯成繁體中文
- 保留所有專業術語和烹飪用語的準確性
- 確保翻譯後的內容自然流暢，符合繁體中文的表達習慣
- 如果原始內容已經是繁體中文，則保持不變

**重要**：
1. 保留所有烹飪技巧、比較說明和重要細節
2. 確保所有內容都是繁體中文
3. 翻譯要準確且自然

只返回純文本，不包含任何額外說明或Markdown格式。所有輸出必須是繁體中文。`
              },
              {
                role: "user",
                content: `請過濾以下影片字幕，只保留食譜相關內容（保留所有烹飪技巧和比較說明），並將所有內容翻譯成繁體中文：\n\n${scrapedContent.videoTranscript}`
              }
            ]
          });
          
          const preFilterElapsedTime = Date.now() - preFilterStartTime;
          console.log(`[createFromWeblink] ⏱️  Pre-filter LLM call completed in ${preFilterElapsedTime}ms`);
          console.log('[createFromWeblink] 📥 Pre-filter response received');
          console.log('[createFromWeblink] 📊 Response structure:', {
            hasChoices: !!preFilterResult.choices,
            choicesLength: preFilterResult.choices?.length || 0,
            hasMessage: !!preFilterResult.choices?.[0]?.message,
            hasContent: !!preFilterResult.choices?.[0]?.message?.content
          });
          
          filteredTranscript = preFilterResult.choices[0].message.content as string;
          console.log('[createFromWeblink] ✅ Pre-filter complete:');
          const originalLength = scrapedContent.videoTranscript?.length || 0;
          console.log(`  Original: ${originalLength} chars`);
          console.log(`  Filtered: ${filteredTranscript.length} chars (${originalLength > 0 ? ((1 - filteredTranscript.length / originalLength) * 100).toFixed(1) : 0}% reduction)`);
          console.log(`  Preview: ${filteredTranscript.substring(0, 200)}...`);
          
          } catch (preFilterError) {
            console.error('[createFromWeblink] ❌ Pre-filter LLM call failed:');
            console.error('[createFromWeblink]   Error type:', preFilterError instanceof Error ? preFilterError.constructor.name : typeof preFilterError);
            console.error('[createFromWeblink]   Error message:', preFilterError instanceof Error ? preFilterError.message : String(preFilterError));
            if (preFilterError instanceof Error && preFilterError.stack) {
              console.error('[createFromWeblink]   Stack trace:', preFilterError.stack.substring(0, 500));
            }
            // Fallback: use original transcript if pre-filter fails
            console.log('[createFromWeblink] ⚠️  Using original transcript as fallback');
            filteredTranscript = scrapedContent.videoTranscript || '';
          }
        }

        // Stage 1: Detect and extract ALL recipes from the filtered transcript
        console.log('[createFromWeblink] ========================================');
        console.log('[createFromWeblink] 📍 Step 4b: STAGE 1 - RECIPE DETECTION');
        console.log('[createFromWeblink] 🔍 Stage 1: Detecting and extracting ALL recipes from transcript...');
        console.log('[createFromWeblink] 📊 Input transcript length:', hasVideoTranscript ? filteredTranscript.length : scrapedContent.content.substring(0, 10000).length, 'characters');
        console.log('[createFromWeblink] 📝 Video title:', scrapedContent.title);
        console.log('[createFromWeblink] ⏳ Calling LLM for Stage 1 (recipe detection)...');
        const stage1StartTime = Date.now();
        
        let extractionResult;
        let extractedRecipes: Array<{title: string; ingredients?: string[]; steps?: string[]; tips?: string}> = [];
        
        // Build context with video title
        const videoTitleContext = scrapedContent.title ? `\n\n**影片標題**: ${scrapedContent.title}\n\n` : '';
        const stage1Prompt = `請從以下影片字幕中識別並提取**所有食譜**。${videoTitleContext}**影片字幕內容**:\n\n${hasVideoTranscript ? filteredTranscript : scrapedContent.content.substring(0, 10000)}`;
        
        try {
          extractionResult = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `你是一位專業的食譜分析師。你的任務是從影片字幕中識別並提取**所有**食譜。

如果影片包含多個食譜，你必須將它們分別提取出來。每個食譜應該有：
- title（食譜名稱）- **重要**：請保留影片標題中的關鍵描述詞，例如「米芝連」、「脆皮爆汁」、「完美口感」等特色描述
- ingredients（食材列表，數組格式）
- steps（步驟列表，數組格式）
- tips（可選，烹飪提示）

**重要規則**：
1. 如果影片標題包含特殊描述（如「米芝連」、「脆皮爆汁」等），請在食譜名稱中保留這些特色
2. 如果影片只有一個食譜，返回包含一個元素的數組。如果有多個食譜，返回包含多個元素的數組。
3. 保留所有烹飪技巧和重要細節

只返回JSON數組格式，不要markdown代碼塊。`
            },
            {
              role: "user",
              content: stage1Prompt
            }
          ]
        });
        
        const stage1ElapsedTime = Date.now() - stage1StartTime;
        console.log(`[createFromWeblink] ⏱️  Stage 1 LLM call completed in ${stage1ElapsedTime}ms`);
        console.log('[createFromWeblink] 📥 Stage 1 response received');
        console.log('[createFromWeblink] 📊 Response structure:', {
          hasChoices: !!extractionResult.choices,
          choicesLength: extractionResult.choices?.length || 0,
          hasMessage: !!extractionResult.choices?.[0]?.message,
          hasContent: !!extractionResult.choices?.[0]?.message?.content
        });

        let extractionJson = extractionResult.choices[0].message.content as string;
        console.log('[createFromWeblink] ✅ Stage 1 raw response (first 500 chars):', extractionJson.substring(0, 500));
        
        // Clean JSON
        extractionJson = extractionJson.replace(/```json/gi, '').replace(/```/g, '');
        const firstBracket = extractionJson.indexOf('[');
        const lastBracket = extractionJson.lastIndexOf(']');
        
        if (firstBracket === -1 || lastBracket === -1) {
          console.error('[createFromWeblink] ❌ Stage 1: No valid JSON array found');
          throw new Error('AI返回的分析結果格式錯誤，找不到有效的食譜數組。請重試。');
        }
        
        extractionJson = extractionJson.substring(firstBracket, lastBracket + 1);
        
        try {
          extractedRecipes = JSON.parse(extractionJson);
          if (!Array.isArray(extractedRecipes)) {
            extractedRecipes = [extractedRecipes];
          }
        } catch (parseError) {
          console.error('[createFromWeblink] ❌ Stage 1 JSON parse error:', parseError);
          throw new Error('AI返回的JSON格式無效，請重試。');
        }
        
        console.log(`[createFromWeblink] ✅ Stage 1 detected ${extractedRecipes.length} recipe(s)`);
        extractedRecipes.forEach((recipe, idx) => {
          console.log(`[createFromWeblink]   Recipe ${idx + 1}: ${recipe.title}`);
        });
        
        } catch (stage1Error) {
          console.error('[createFromWeblink] ❌ Stage 1 LLM call failed:');
          console.error('[createFromWeblink]   Error type:', stage1Error instanceof Error ? stage1Error.constructor.name : typeof stage1Error);
          console.error('[createFromWeblink]   Error message:', stage1Error instanceof Error ? stage1Error.message : String(stage1Error));
          if (stage1Error instanceof Error && stage1Error.stack) {
            console.error('[createFromWeblink]   Stack trace:', stage1Error.stack.substring(0, 500));
          }
          throw stage1Error; // Re-throw to stop processing
        }

        // Process each detected recipe IN PARALLEL for faster processing
        console.log('[createFromWeblink] ========================================');
        console.log('[createFromWeblink] 📍 Step 5: Processing detected recipes (PARALLEL)...');
        const createdRecipeIds: string[] = [];
        const createdRecipeTitles: string[] = [];
        
        console.log(`[createFromWeblink] 🔄 Processing ${extractedRecipes.length} recipe(s) in parallel...`);
        
        // Process all recipes in parallel
        const recipeProcessingPromises = extractedRecipes.map(async (recipe, i) => {
          console.log('[createFromWeblink] ========================================');
          console.log(`[createFromWeblink] 📝 Processing recipe ${i + 1}/${extractedRecipes.length}: ${recipe.title}`);
          
          try {
            // Stage 2: Create structured JSON for each recipe
            console.log(`[createFromWeblink] 📍 Step 5.${i + 1}a: STAGE 2 - RECIPE STRUCTURING`);
            console.log(`[createFromWeblink] 🔍 Stage 2: Creating structured recipe for: ${recipe.title}`);
            
            // Include video title and original transcript for context
            const videoTitleInfo = scrapedContent.title ? `\n**影片標題**: ${scrapedContent.title}\n` : '';
            const originalTranscriptContext = hasVideoTranscript && scrapedContent.videoTranscript 
              ? `\n**原始影片字幕（供參考）**:\n${scrapedContent.videoTranscript.substring(0, 1000)}...\n` 
              : '';
            
            const recipeAnalysis = await invokeLLM({
              messages: [
                {
                  role: "system",
                  content: `你是一位米芝蓮級大廚和營養師。你的任務是從提供的食譜細節中，生成一個完整的、結構化的JSON食譜。

**強制要求（必須包含，不能為空）：**
1. **標題（title）**：**重要** - 如果影片標題包含特殊描述（如「米芝連」、「脆皮爆汁」、「完美口感」等），請在食譜標題中保留這些特色描述。例如：「米芝連脆皮爆汁三文魚」而不是簡單的「煎三文魚」。

2. **描述（description）**：根據影片標題和內容，寫一個吸引人的描述，突出食譜的特色（如「米芝連級別」、「脆皮爆汁」、「完美口感」等）。

3. **食材清單（ingredients）**：必須識別並包含所有食材，至少3個以上。每種食材必須有：
   - name（食材名稱）
   - amount（數量，如「3」、「500」）
   - unit（單位，如「個」、「g」、「ml」）
   - calories（卡路里，必須是整數）

4. **烹飪步驟（steps）**：必須按順序詳細描述每一步，至少3個步驟以上。每個步驟必須有：
   - instruction（詳細的烹飪說明）
   - duration（可選，分鐘數）
   - temperature（可選，溫度）
   - tips（可選，烹飪提示）
   **重要**：保留所有烹飪技巧、比較說明和重要細節。

5. **營養分析（nutrition）**：必須根據所有食材精準計算總營養成分，包括：
   - totalCalories（總卡路里，必須是整數）
   - protein（蛋白質，單位：克，必須是整數）
   - carbs（碳水化合物，單位：克，必須是整數）
   - fat（脂肪，單位：克，必須是整數）
   - fiber（纖維，單位：克，必須是整數）

6. **份量（servings）**：識別食譜的份量（幾人份），必須是正整數

**重要**：根據提供的食譜細節和影片標題，使用專業知識補充完整的食材清單、烹飪步驟和營養分析。保留所有特色描述和烹飪技巧。`
                },
                {
                  role: "user",
                  content: `將以下食譜轉換為JSON格式：${videoTitleInfo}
食譜名稱：${recipe.title}
食材：${recipe.ingredients?.join(', ') || '無'}
步驟：${recipe.steps?.join(' → ') || '無'}
提示：${recipe.tips || '無'}${originalTranscriptContext}

**只返回JSON格式（不要markdown代碼塊）：**
{
  "title": "食譜名稱",
  "description": "簡短描述",
  "servings": 份量數字,
  "ingredients": [{"name": "食材名", "amount": "數量", "unit": "單位", "calories": 卡路里數字}],
  "steps": [{"instruction": "步驟說明", "duration": 分鐘數字或null, "temperature": "溫度或null", "tips": "提示或null"}],
  "nutrition": {"totalCalories": 數字, "protein": 數字, "carbs": 數字, "fat": 數字, "fiber": 數字}
}`
                }
              ]
            });

            // Clean the JSON response
            let analysisJson = recipeAnalysis.choices[0].message.content as string;
            console.log(`[createFromWeblink] 🔍 Stage 2 raw response for recipe ${i + 1} (first 500 chars):`, analysisJson.substring(0, 500));
            
            // Clean JSON
            analysisJson = analysisJson.replace(/```json/gi, '').replace(/```/g, '');
            const firstBrace = analysisJson.indexOf('{');
            const lastBrace = analysisJson.lastIndexOf('}');
            
            if (firstBrace === -1 || lastBrace === -1) {
              console.error(`[createFromWeblink] ❌ Recipe ${i + 1}: No valid JSON found`);
              throw new Error(`AI返回的分析結果格式錯誤，找不到有效的JSON結構。請重試。`);
            }
            
            analysisJson = analysisJson.substring(firstBrace, lastBrace + 1);
            
            let analysis;
            try {
              analysis = JSON.parse(analysisJson);
            } catch (parseError) {
              console.error(`[createFromWeblink] ❌ Recipe ${i + 1} JSON parse error:`, parseError);
              throw new Error('AI返回的JSON格式無效，請重試。');
            }
            console.log(`[createFromWeblink] 📋 Recipe ${i + 1} parsed:`, {
              title: analysis.title,
              ingredientsCount: analysis.ingredients?.length || 0,
              stepsCount: analysis.steps?.length || 0,
            });

            // Validate and normalize
            if (!analysis.title || typeof analysis.title !== 'string' || analysis.title.trim().length === 0) {
              analysis.title = recipe.title || `食譜 ${i + 1}`;
            }
            if (!analysis.description || typeof analysis.description !== 'string') {
              analysis.description = analysis.title;
            }
            if (!analysis.ingredients || !Array.isArray(analysis.ingredients) || analysis.ingredients.length === 0) {
              throw new Error(`食譜 ${i + 1} 缺少食材清單。`);
            }
            if (!analysis.steps || !Array.isArray(analysis.steps) || analysis.steps.length === 0) {
              throw new Error(`食譜 ${i + 1} 缺少烹飪步驟。`);
            }
            if (!analysis.nutrition || typeof analysis.nutrition !== 'object') {
              throw new Error(`食譜 ${i + 1} 缺少營養分析。`);
            }
            
            // Normalize nutrition values
            analysis.nutrition.totalCalories = Math.round(analysis.nutrition.totalCalories || 0);
            analysis.nutrition.protein = Math.round(analysis.nutrition.protein || 0);
            analysis.nutrition.carbs = Math.round(analysis.nutrition.carbs || 0);
            analysis.nutrition.fat = Math.round(analysis.nutrition.fat || 0);
            analysis.nutrition.fiber = Math.round(analysis.nutrition.fiber || 0);
            if (!analysis.servings || analysis.servings < 1) {
              analysis.servings = 2;
            }
            analysis.servings = Math.round(analysis.servings);

            // Create recipe in database
            console.log(`[createFromWeblink] 📍 Step 5.${i + 1}b: DATABASE SAVE`);
            console.log(`[createFromWeblink] 💾 Saving recipe to database: ${analysis.title}`);
            console.log(`[createFromWeblink] 📊 Recipe details:`);
            console.log(`[createFromWeblink]   - Ingredients: ${analysis.ingredients.length}`);
            console.log(`[createFromWeblink]   - Steps: ${analysis.steps.length}`);
            console.log(`[createFromWeblink]   - Servings: ${analysis.servings}`);
            
            // Generate improvement suggestions and nutritional comparison IN PARALLEL
            console.log(`[createFromWeblink] 📍 Step 5.${i + 1}c: GENERATING IMPROVEMENT SUGGESTIONS & NUTRITION (PARALLEL)`);
            console.log(`[createFromWeblink] 🔍 Generating AI improvement suggestions and nutrition for: ${analysis.title}`);
            
            let improvements = '';
            let improvedNutrition: any = null;
            
            try {
              // Build ingredients and steps summary for improvement suggestions
              const ingredientsSummary = analysis.ingredients?.map((ing: any) => 
                `${ing.name} ${ing.amount}${ing.unit}`
              ).join('\n') || '';
              
              const stepsSummary = analysis.steps?.map((step: any, idx: number) => 
                `${idx + 1}. ${step.instruction}`
              ).join('\n') || '';
              
              // Generate improvement suggestions
              const improvementResult = await safeInvokeLLM({
                messages: [
                  {
                    role: "system",
                    content: `你是擁有30年經驗的米芝蓮三星大廚和註冊營養師。你精通中西料理，擅長將傳統食譜改造成既健康又美味的現代版本。目的健康革命，均衡飲食的重要性，讓人享受美食之餘能有效了解成分、卡路裡、營養素，及提醒潛在不同的好處及風險。

🌟 **核心健康原則（必須遵守）**：
1. ✅ **用蜜糖或生果代替白砂糖** - 所有精製糖必須替換
2. ✅ **用香菇粉代替部分鹽** - 減少鈉攝入，增加鮮味
3. ✅ **精製產品 → 天然食材** - 優先使用全穀物、天然調味料
4. ✅ **增加生果和蔬菜** - 提升纖維和維生素攝入
5. ✅ **減少油脂和鹽分** - 使用健康烹飪方法

**當前食譜營養成分**：
- 總卡路里: ${analysis.nutrition?.totalCalories || 0} kcal
- 蛋白質: ${analysis.nutrition?.protein || 0} g
- 碳水化合物: ${analysis.nutrition?.carbs || 0} g
- 脂肪: ${analysis.nutrition?.fat || 0} g
- 纖維: ${analysis.nutrition?.fiber || 0} g

**當前食譜內容**：
標題: ${analysis.title}
描述: ${analysis.description || ''}
份量: ${analysis.servings} 人份

食材:
${ingredientsSummary}

步驟:
${stepsSummary}

---

請以米芝蓮級大廚的專業角度，提供**全面且詳細**的改良建議，包括：

## 📝 請按以下結構回覆：

### 🍎 健康升級方案（必須嚴格執行）
1. **食材替代建議**：
   - 列出3-5項具體的食材替代方案
   - 說明每項替代的健康益處（如減糖、減鹽、增加纖維等）
   - 提供替代食材的用量建議
   - 例：白砂糖50g → 蜜糖40g（減少20%精製糖，天然果糖更健康）

2. **營養強化技巧**：
   - 如何在不改變風味的前提下增加營養價值
   - 可以添加哪些超級食材（如奇亞籽、亞麻籽、堅果等）
   - 如何增加蔬菜攝入量

3. **健康烹飪方法**：
   - 改良烹飪技巧以減少油脂和鹽分
   - **🔥 重要：如果食譜涉及油炸（炸），必須建議改用氣炸鍋（氣炸）**
     * 說明氣炸的溫度和時間設置（如：200°C氣炸15分鐘）
     * 解釋如何達到酥脆效果但減少80%以上的油脂
     * 提供噴油技巧（用噴霧器噴少量橄欖油）
     * 氣炸的具體操作步驟和注意事項
   - 推薦的烹飪溫度和時間調整
   - 如何保留更多營養素

### 👨‍🍳 烹飪技巧提升
1. **專業技巧**：
   - 分享3-5個米芝蓮級的烹飪秘訣
   - 如何提升口感和風味層次
   - 食材處理的專業手法

2. **常見錯誤與解決**：
   - 指出這道菜可能出現的問題
   - 提供避免失敗的關鍵提示

3. **擺盤與呈現**：
   - 專業的擺盤建議
   - 如何讓這道菜更有視覺吸引力

### 🌟 風味升級建議
1. **香料與調味**：
   - 推薦額外的香料或調味料
   - 如何用天然食材取代人工調味料
   - 香料的使用時機和份量

2. **質感與口感**：
   - 如何改善食材的質感
   - 創造多層次的口感體驗

3. **創意變化**：
   - 提供2-3種創意變化版本
   - 適合不同場合的調整建議

### 💡 實用貼士
1. **食材採購**：
   - 如何挑選最優質的食材
   - 什麼季節最適合製作這道菜

2. **提前準備**：
   - 哪些步驟可以提前完成
   - 如何節省烹飪時間

3. **儲存與再加熱**：
   - 最佳儲存方法
   - 如何保持最佳風味

4. **搭配建議**：
   - 推薦的配菜或主食
   - 適合的飲品搭配

### 📊 營養優化總結
- 列出改良後的主要健康益處
- 預估營養成分的改善幅度（如減少XX%的鈉、增加XX%的纖維）
- 適合的人群（如健身人士、糖尿病患者、兒童等）

---

**請提供詳細、具體、可操作的建議。用專業但易懂的語言，讓家庭廚師能輕鬆實踐。每個部分提供2-3個要點即可，總長度約800-1000字。**`
                  },
                  {
                    role: "user",
                    content: `請為以下食譜提供米芝蓮級的健康改良建議：\n\n${analysis.title}\n\n${ingredientsSummary}\n\n${stepsSummary}`
                  }
                ]
              });

              const improvementContent = improvementResult.choices[0].message.content;
              improvements = typeof improvementContent === 'string' ? improvementContent : String(improvementContent || "");
              console.log(`[createFromWeblink] ✅ Improvement suggestions generated (${improvements.length} chars)`);

              // Calculate improved nutrition (runs after improvements, but recipes are processed in parallel)
              const improvementsText = typeof improvements === 'string' ? improvements : String(improvements);
              if (improvementsText && improvementsText.trim().length > 0) {
                console.log(`[createFromWeblink] 📊 Calculating improved nutrition...`);
                const comparisonResult = await safeInvokeLLM({
                  messages: [
                    {
                      role: "system",
                      content: "你是營養分析AI。只返回純JSON，不要任何markdown或額外文字。"
                    },
                    {
                      role: "user",
                      content: `原始營養: 卡路里${analysis.nutrition?.totalCalories || 0}kcal, 蛋白質${analysis.nutrition?.protein || 0}g, 碳水化合物${analysis.nutrition?.carbs || 0}g, 脂肪${analysis.nutrition?.fat || 0}g, 纖維${analysis.nutrition?.fiber || 0}g

改良建議:
${improvementsText.substring(0, 1500)}

計算改良後營養成分，只返回JSON格式:
{"calories": 整數, "protein": 整數, "carbs": 整數, "fat": 整數, "fiber": 整數}`
                    }
                  ]
                });

                // Clean JSON response
                let jsonResponse = comparisonResult.choices[0].message.content as string;
                jsonResponse = jsonResponse.replace(/```json/gi, '').replace(/```/g, '');
                jsonResponse = jsonResponse.replace(/\n/g, ' ').replace(/\s+/g, ' ');
                
                const firstBrace = jsonResponse.indexOf('{');
                const lastBrace = jsonResponse.lastIndexOf('}');
                
                if (firstBrace !== -1 && lastBrace !== -1) {
                  jsonResponse = jsonResponse.substring(firstBrace, lastBrace + 1).trim();
                  const parsedNutrition = JSON.parse(jsonResponse);
                  improvedNutrition = parsedNutrition;
                  console.log(`[createFromWeblink] ✅ Improved nutrition calculated:`, improvedNutrition);
                }
              }
            } catch (improvementError) {
              console.error(`[createFromWeblink] ⚠️  Failed to generate improvement suggestions:`, improvementError);
              // Continue without improvements - recipe is still valid
            }

            // Prepare aiAnalysis data with improved nutrition
            const aiAnalysisData = {
              ...analysis,
              ...(improvedNutrition && { improvedNutrition: improvedNutrition }),
              improvementSuggestionsFullText: improvements
            };

            // No images - always set to null
            const finalImageUrl = null;

            const recipeId = await db.createRecipe({
              userId: 1,
              title: analysis.title || recipe.title,
              description: analysis.description || `來自影片的食譜 ${i + 1}`,
              inputMethod: "weblink",
              sourceUrl: input.url,
              imageUrl: finalImageUrl,
              servings: analysis.servings || 2,
              totalCalories: analysis.nutrition?.totalCalories || 0,
              caloriesPerServing: analysis.servings > 0 ? Math.round(analysis.nutrition.totalCalories / analysis.servings) : 0,
              protein: analysis.nutrition?.protein || 0,
              carbs: analysis.nutrition?.carbs || 0,
              fat: analysis.nutrition?.fat || 0,
              fiber: analysis.nutrition?.fiber || 0,
              aiAnalysis: JSON.stringify(aiAnalysisData),
              improvementSuggestions: improvements, // Save improvement suggestions
              isPublished: true,
            });

            // Add ingredients
            if (analysis.ingredients && Array.isArray(analysis.ingredients)) {
              for (let ingIndex = 0; ingIndex < analysis.ingredients.length; ingIndex++) {
                const ing = analysis.ingredients[ingIndex];
                await db.createIngredient({
                  recipeId: recipeId,
                  name: ing.name || '',
                  amount: ing.amount || '',
                  unit: ing.unit || '',
                  calories: ing.calories || 0,
                  order: ingIndex + 1,
                });
              }
            }

            // Add cooking steps
            if (analysis.steps && Array.isArray(analysis.steps)) {
              for (let stepIndex = 0; stepIndex < analysis.steps.length; stepIndex++) {
                const step = analysis.steps[stepIndex];
                
                // Convert duration to integer (round to nearest minute, minimum 1 if > 0)
                let durationInt: number | null = null;
                if (step.duration != null && step.duration !== undefined) {
                  if (step.duration > 0) {
                    durationInt = Math.max(1, Math.round(step.duration));
                  } else {
                    durationInt = null;
                  }
                }
                
                await db.createCookingStep({
                  recipeId: recipeId,
                  stepNumber: stepIndex + 1,
                  instruction: step.instruction || '',
                  duration: durationInt,
                  temperature: step.temperature || null,
                  tips: step.tips || null,
                });
              }
            }

            const recipeTitle = analysis.title || recipe.title || `食譜 ${i + 1}`;
            console.log(`[createFromWeblink] ✅ Recipe ${i + 1}/${extractedRecipes.length} created successfully!`);
            console.log(`[createFromWeblink]   - Recipe ID: ${recipeId}`);
            console.log(`[createFromWeblink]   - Title: ${recipeTitle}`);
            
            return {
              recipeId: String(recipeId),
              title: recipeTitle
            };
            
          } catch (e) {
            console.error(`[createFromWeblink] ❌ Failed to create recipe ${i + 1}/${extractedRecipes.length}:`, e);
            console.error(`[createFromWeblink]   Error type:`, e instanceof Error ? e.constructor.name : typeof e);
            console.error(`[createFromWeblink]   Error message:`, e instanceof Error ? e.message : String(e));
            return null; // Return null for failed recipes
          }
        });
        
        // Wait for all recipes to be processed in parallel
        console.log('[createFromWeblink] ⏳ Waiting for all recipes to complete (processing in parallel)...');
        const recipeResults = await Promise.all(recipeProcessingPromises);
        
        // Collect successful recipe IDs and titles
        recipeResults.forEach((result) => {
          if (result) {
            createdRecipeIds.push(result.recipeId);
            createdRecipeTitles.push(result.title);
          }
        });
        
        console.log(`[createFromWeblink] ✅ Parallel processing complete! ${createdRecipeIds.length}/${extractedRecipes.length} recipes succeeded`);

        // Return result
        console.log('[createFromWeblink] ========================================');
        console.log('[createFromWeblink] 📍 Step 6: Finalizing results...');
        
        if (createdRecipeIds.length === 0) {
          console.error('[createFromWeblink] ❌ No recipes were created successfully');
          throw new Error('未能創建任何食譜，請重試。');
        }

        const allRecipes = createdRecipeIds.map((id, idx) => ({
          id,
          title: createdRecipeTitles[idx] || `食譜 ${idx + 1}`
        }));

        console.log(`[createFromWeblink] 🎉 SUCCESS! Created ${createdRecipeIds.length} recipe(s) successfully!`);
        console.log('[createFromWeblink] 📊 Final results:');
        allRecipes.forEach((r, idx) => {
          console.log(`[createFromWeblink]   Recipe ${idx + 1}: ${r.title} (ID: ${r.id})`);
        });
        console.log('[createFromWeblink] ========================================');
        
        return {
          recipeId: createdRecipeIds[0], // For backward compatibility
          recipeCount: createdRecipeIds.length,
          allRecipeIds: createdRecipeIds,
          allRecipes: allRecipes,
        };
      }),

    // 手動創建食譜
    createManual: publicProcedure
      .input(manualRecipeSchema)
      .mutation(async ({ ctx, input }) => {
        // 計算營養成分
        const totalCalories = input.ingredients.reduce((sum, ing) => sum + (ing as any).calories || 0, 0);

        // 生成改良建議（詳細版本）
        const improvementResult = await safeInvokeLLM({
          messages: [
            {
              role: "system",
              content: `你是擁有30年經驗的米芝蓮三星大廚和註冊營養師。你精通中西料理，擅長將傳統食譜改造成既健康又美味的現代版本。目的健康革命，均衡飲食的重要性，讓人享受美食之餘能有效了解成分、卡路裡、營養素，及提醒潛在不同的好處及風險。

🌟 **核心健康原則（必須遵守）**：
1. ✅ **用蜜糖或生果代替白砂糖** - 所有精製糖必須替換
2. ✅ **用香菇粉代替部分鹽** - 減少鈉攝入，增加鮮味
3. ✅ **多用生果** - 增加天然甜味和營養
4. ✅ **放棄所有精製產品** - 白砂糖改黃糖/蜜糖，白米改糙米
5. ✅ **炸改氣炸** - 所有油炸食物必須改用氣炸鍋，減少80%油脂

請提供詳細、專業、實用的改良建議，幫助家庭廚師提升烹飪水平。`
            },
            {
              role: "user",
              content: `我有以下食譜需要你的專業意見：

📋 **食譜名稱**: ${input.title}

🥘 **食材清單**:
${input.ingredients.map((ing: any) => `- ${ing.name} ${ing.amount || ''} ${ing.unit || ''}`).join('\n')}

👨‍🍳 **烹飪步驟**:
${input.steps.map((step: any, idx: number) => `${idx + 1}. ${step.instruction}`).join('\n')}

---

請以米芝蓮級大廚的專業角度，提供**全面且詳細**的改良建議，包括：

## 📝 請按以下結構回覆：

### 🍎 健康升級方案
1. **食材替代建議**：
   - 列出3-5項具體的食材替代方案
   - 說明每項替代的健康益處（如減糖、減鹽、增加纖維等）
   - 提供替代食材的用量建議
   - 例：白砂糖50g → 蜜糖40g（減少20%精製糖，天然果糖更健康）

2. **營養強化技巧**：
   - 如何在不改變風味的前提下增加營養價值
   - 可以添加哪些超級食材（如奇亞籽、亞麻籽、堅果等）
   - 如何增加蔬菜攝入量

3. **健康烹飪方法**：
   - 改良烹飪技巧以減少油脂和鹽分
   - **🔥 重要：如果食譜涉及油炸（炸），必須建議改用氣炸鍋（氣炸）**
     * 說明氣炸的溫度和時間設置（如：200°C氣炸15分鐘）
     * 解釋如何達到酥脆效果但減少80%以上的油脂
     * 提供噴油技巧（用噴霧器噴少量橄欖油）
     * 氣炸的具體操作步驟和注意事項
   - 推薦的烹飪溫度和時間調整
   - 如何保留更多營養素

### 👨‍🍳 烹飪技巧提升
1. **專業技巧**：
   - 分享3-5個米芝蓮級的烹飪秘訣
   - 如何提升口感和風味層次
   - 食材處理的專業手法

2. **常見錯誤與解決**：
   - 指出這道菜可能出現的問題
   - 提供避免失敗的關鍵提示

3. **擺盤與呈現**：
   - 專業的擺盤建議
   - 如何讓這道菜更有視覺吸引力

### 🌟 風味升級建議
1. **香料與調味**：
   - 推薦額外的香料或調味料
   - 如何用天然食材取代人工調味料
   - 香料的使用時機和份量

2. **質感與口感**：
   - 如何改善食材的質感
   - 創造多層次的口感體驗

3. **創意變化**：
   - 提供2-3種創意變化版本
   - 適合不同場合的調整建議

### 💡 實用貼士
1. **食材採購**：
   - 如何挑選最優質的食材
   - 什麼季節最適合製作這道菜

2. **提前準備**：
   - 哪些步驟可以提前完成
   - 如何節省烹飪時間

3. **儲存與再加熱**：
   - 最佳儲存方法
   - 如何保持最佳風味

4. **搭配建議**：
   - 推薦的配菜或主食
   - 適合的飲品搭配

### 📊 營養優化總結
- 列出改良後的主要健康益處
- 預估營養成分的改善幅度（如減少XX%的鈉、增加XX%的纖維）
- 適合的人群（如健身人士、糖尿病患者、兒童等）

---

**請提供詳細、具體、可操作的建議。用專業但易懂的語言，讓家庭廚師能輕鬆實踐。每個部分提供2-3個要點即可，總長度約800-1000字。**`
            }
          ]
        });

        const improvements = improvementResult.choices[0].message.content || "";

        // 單獨進行對比分析：計算改良後的營養成分 (SEPARATE CALL FOR JSON)
        let improvedNutrition: any = null;
        const improvementsText = typeof improvements === 'string' ? improvements : String(improvements);
        if (improvementsText && improvementsText.trim().length > 0) {
          try {
            console.log('[createManual] Starting comparison analysis...');
            const comparisonResult = await safeInvokeLLM({
              messages: [
                {
                  role: "system",
                  content: "你是營養分析AI。只返回純JSON，不要任何markdown或額外文字。"
                },
                {
                  role: "user",
                  content: `原始營養: 卡路里${totalCalories}kcal

改良建議:
${improvementsText.substring(0, 1500)}

計算改良後營養成分，只返回JSON格式:
{"calories": 整數, "protein": 整數, "carbs": 整數, "fat": 整數, "fiber": 整數}`
                }
              ]
              // 不使用 response_format，DeepSeek 不支援
          });
          
            // 超強清理 - DeepSeek 經常返回 ```json...``` 包裹的內容
            let jsonResponse = comparisonResult.choices[0].message.content as string;
            console.log('[createManual] 🔍 Raw response:', jsonResponse);
            
            // 移除所有 markdown 代碼塊
            jsonResponse = jsonResponse.replace(/```json/gi, '').replace(/```/g, '');
            
            // 移除所有換行和多餘空格
            jsonResponse = jsonResponse.replace(/\n/g, ' ').replace(/\s+/g, ' ');
            
            // 只提取 { 到 } 之間的內容
            const firstBrace = jsonResponse.indexOf('{');
            const lastBrace = jsonResponse.lastIndexOf('}');
            
            if (firstBrace === -1 || lastBrace === -1) {
              throw new Error('No valid JSON object found in response');
            }
            
            jsonResponse = jsonResponse.substring(firstBrace, lastBrace + 1).trim();
            console.log('[createManual] ✅ Cleaned JSON:', jsonResponse);
            
            const parsedNutrition = JSON.parse(jsonResponse);
            improvedNutrition = parsedNutrition;
            console.log('[createManual] ✅ Parsed nutrition:', improvedNutrition);
          } catch (error) {
            console.error('[createManual] Failed to calculate improved nutrition:', error);
            console.error('[createManual] Error details:', error instanceof Error ? error.message : String(error));
            // 如果計算失敗，繼續使用原始營養成分
          }
        } else {
          console.log('[createManual] No improvements text, skipping comparison analysis');
        }

        // 準備aiAnalysis數據（包含改良後的營養成分和完整改良建議）
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
          ...(improvedNutrition && { improvedNutrition: improvedNutrition }),
          // 將完整的改良建議存儲在 aiAnalysis 中，避免 text 欄位長度限制
          improvementSuggestionsFullText: improvementsText
        };

        const recipeId = await db.createRecipe({
          userId: 1, // Default user ID since auth is disabled
          title: input.title,
          description: input.description,
          inputMethod: "manual",
          servings: input.servings,
          totalCalories,
          caloriesPerServing: input.servings > 0 ? Math.round(totalCalories / input.servings) : 0,
          aiAnalysis: JSON.stringify(aiAnalysisData),
          improvementSuggestions: improvementsText, // Save FULL text - PostgreSQL text type has NO limit
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
          
          // Convert duration to integer (round to nearest minute, minimum 1 if > 0)
          let durationInt: number | null = null;
          if (step.duration != null && step.duration !== undefined) {
            if (step.duration > 0) {
              durationInt = Math.max(1, Math.round(step.duration));
            } else {
              durationInt = null;
            }
          }
          
          await db.createCookingStep({
            recipeId: recipeId as number,
            stepNumber: i + 1,
            instruction: step.instruction,
            duration: durationInt,
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

        // Clean the JSON response - DeepSeek wraps JSON in markdown code blocks
        let nutritionJson = analysisResult.choices[0].message.content as string;
        nutritionJson = nutritionJson.replace(/```json/gi, '').replace(/```/g, '');
        nutritionJson = nutritionJson.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        
        const firstBrace = nutritionJson.indexOf('{');
        const lastBrace = nutritionJson.lastIndexOf('}');
        
        if (firstBrace !== -1 && lastBrace !== -1) {
          nutritionJson = nutritionJson.substring(firstBrace, lastBrace + 1).trim();
        }
        
        const nutrition = JSON.parse(nutritionJson);

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

        prompt += `\n請根據用戶的建議,提供詳細的改良方案。

返回以下JSON格式:
{
  "ingredientAdjustments": "如何調整食材",
  "methodAdjustments": "如何修改烹飪方法",
  "improvedNutrition": {
    "calories": 整數,
    "protein": 整數,
    "carbs": 整數,
    "fat": 整數,
    "fiber": 整數
  },
  "healthTips": "健康益處說明",
  "additionalAdvice": "其他建議"
}`;

        // 調用AI生成改良方案（簡化版，不使用 response_format）
        const aiResult = await safeInvokeLLM({
          messages: [
            {
              role: "system",
              content: "你是營養分析AI。只返回純JSON，不要任何markdown或額外文字。"
            },
            {
              role: "user",
              content: prompt
            }
          ]
          // 不使用 response_format，DeepSeek 不支援
        });

        const aiContent = aiResult.choices[0]?.message?.content;
        let parsedResponse: any;
        let aiResponse: string;
        
        try {
          // 超強清理 - DeepSeek 經常返回 ```json...``` 包裹的內容
          let jsonResponse = typeof aiContent === 'string' ? aiContent : String(aiContent);
          console.log('[process] 🔍 Raw response:', jsonResponse.substring(0, 300));
          
          // 移除所有 markdown 代碼塊
          jsonResponse = jsonResponse.replace(/```json/gi, '').replace(/```/g, '');
          
          // 移除所有換行和多餘空格
          jsonResponse = jsonResponse.replace(/\n/g, ' ').replace(/\s+/g, ' ');
          
          // 只提取 { 到 } 之間的內容
          const firstBrace = jsonResponse.indexOf('{');
          const lastBrace = jsonResponse.lastIndexOf('}');
          
          if (firstBrace === -1 || lastBrace === -1) {
            throw new Error('No valid JSON object found in response');
          }
          
          jsonResponse = jsonResponse.substring(firstBrace, lastBrace + 1).trim();
          console.log('[process] ✅ Cleaned JSON:', jsonResponse.substring(0, 300));
          
          parsedResponse = JSON.parse(jsonResponse);
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
