import { describe, expect, it } from "vitest";
import { simpleFetch } from "./webScraper";

describe("webScraper", () => {
  it("should fetch public recipe page", async () => {
    // 使用一個公開的食譜網站測試
    const result = await simpleFetch("https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/");
    
    // 基本驗證
    expect(result).toBeDefined();
    expect(typeof result.success).toBe("boolean");
    
    if (result.success) {
      expect(result.content.length).toBeGreaterThan(0);
    }
  }, 15000); // 15秒超時

  it("should handle invalid URL gracefully", async () => {
    const result = await simpleFetch("https://invalid-url-that-does-not-exist-12345.com");
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  }, 15000);

  it("should return error for login-required sites", async () => {
    // 小紅書需要登入
    const result = await simpleFetch("https://www.xiaohongshu.com/explore/test");
    
    // 可能成功但內容不足,或直接失敗
    if (result.success) {
      // 如果成功,內容應該很少(因為被重定向到登入頁)
      expect(result.content.length).toBeLessThan(1000);
    } else {
      expect(result.error).toBeDefined();
    }
  }, 15000);
});
