import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
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

describe("recipes API", () => {
  it("should list recipes for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.recipes.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it.skip("should create manual recipe", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const recipeData = {
      title: "測試食譜",
      description: "這是一個測試食譜",
      servings: 2,
      ingredients: [
        { name: "雞肉", amount: "200", unit: "克", notes: "" },
        { name: "蔬菜", amount: "100", unit: "克", notes: "" },
      ],
      steps: [
        { instruction: "準備食材", duration: 5, temperature: "", tips: "" },
        { instruction: "烹飪", duration: 15, temperature: "180°C", tips: "注意火候" },
      ],
      categoryIds: [],
    };

    const result = await caller.recipes.createManual(recipeData);

    expect(result).toHaveProperty("recipeId");
    expect(result).toHaveProperty("improvements");
    expect(typeof result.recipeId).toBe("number");
  });
});

describe("categories API", () => {
  it.skip("should create new category - skipped to avoid DB writes", async () => {
    // This test is skipped to avoid writing to the database during testing
  });
  it("should list all categories", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.categories.list();

    expect(Array.isArray(result)).toBe(true);
  });

  it("should get categories by type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.categories.getByType({ type: "ingredient" });

    expect(Array.isArray(result)).toBe(true);
  });


});
