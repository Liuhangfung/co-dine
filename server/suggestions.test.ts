import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("suggestions API", () => {
  it("should create a user suggestion", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 先創建一個食譜
    const recipe = await caller.recipes.createManual({
      title: "測試食譜",
      description: "用於測試建議功能",
      servings: 2,
      ingredients: [
        { name: "雞胸肉", amount: "200", unit: "克" },
        { name: "西蘭花", amount: "100", unit: "克" },
      ],
      steps: [
        { instruction: "將雞胸肉切塊" },
        { instruction: "煮熟西蘭花" },
      ],
    });

    expect(recipe.recipeId).toBeDefined();

    // 創建建議
    const suggestion = await caller.suggestions.create({
      recipeId: recipe.recipeId,
      suggestionType: "calories",
      targetCalories: 400,
      suggestionText: "希望降低卡路里到400以下,同時保持蛋白質含量",
    });

    expect(suggestion.suggestionId).toBeDefined();
    expect(typeof suggestion.suggestionId).toBe("number");
  }, 15000);

  it("should get suggestions by recipe", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 創建食譜
    const recipe = await caller.recipes.createManual({
      title: "測試食譜2",
      servings: 1,
      ingredients: [{ name: "雞蛋", amount: "2", unit: "個" }],
      steps: [{ instruction: "煎蛋" }],
    });

    // 創建建議
    await caller.suggestions.create({
      recipeId: recipe.recipeId,
      suggestionType: "nutrition",
      suggestionText: "增加蔬菜",
    });

    // 獲取建議
    const suggestions = await caller.suggestions.getByRecipe({
      recipeId: recipe.recipeId,
    });

    expect(suggestions).toBeDefined();
    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);
  }, 15000);

  it.skip("should process suggestion with AI (skipped - requires LLM)", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // 這個測試需要實際調用LLM,所以跳過
    // 在實際環境中可以手動測試
  });
});
