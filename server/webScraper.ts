import { chromium } from "playwright";

export interface ScrapedContent {
  title: string;
  content: string;
  images: string[];
  success: boolean;
  error?: string;
}

/**
 * 使用Playwright抓取網頁內容
 * 支援需要JavaScript渲染的動態網站
 */
export async function scrapeWebpage(url: string): Promise<ScrapedContent> {
  let browser;
  
  try {
    // 檢查是否是小紅書，需要模擬移動設備
    const isXiaohongshu = url.includes('xiaohongshu.com') || url.includes('xhslink.com');
    
    // 啟動瀏覽器
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // 小紅書需要模擬移動設備
    const context = await browser.newContext({
      userAgent: isXiaohongshu 
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: isXiaohongshu 
        ? { width: 375, height: 667 } // iPhone 尺寸
        : { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    // 設置超時時間
    await page.goto(url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // 小紅書需要更長的等待時間和滾動以觸發內容加載
    if (isXiaohongshu) {
      await page.waitForTimeout(8000); // 增加等待時間
      // 嘗試滾動頁面以觸發內容加載
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(3000);
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(2000);
    } else {
      // 等待頁面加載（增加等待時間以確保動態內容完全加載）
      await page.waitForTimeout(5000);
    }
    
    // 提取標題
    const title = await page.title();
    
    // 提取主要文本內容（優先尋找食譜相關區域）
    const content = await page.evaluate((isXHS) => {
      // 移除腳本和樣式標籤
      const scripts = document.querySelectorAll('script, style, nav, header, footer, .advertisement, .ad, .sidebar');
      scripts.forEach(el => el.remove());
      
      // 小紅書特定的選擇器
      if (isXHS) {
        // 嘗試多種小紅書內容選擇器
        const xhsSelectors = [
          '[class*="note-content"]',
          '[class*="desc"]',
          '[class*="content"]',
          '[class*="text"]',
          '[class*="detail"]',
          'article',
          'main',
          '[data-v-]', // Vue 組件
        ];
        
        let mainContent: HTMLElement | null = null;
        for (const selector of xhsSelectors) {
          const elements = document.querySelectorAll(selector);
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i] as HTMLElement;
            const text = element.innerText || element.textContent || '';
            if (text && text.length > 100) {
              mainContent = element;
              break;
            }
          }
          if (mainContent) break;
        }
        
        // 如果找不到，嘗試從所有可見元素中提取文本
        if (!mainContent || !mainContent.innerText || mainContent.innerText.length < 50) {
          const allText = document.body.innerText || document.body.textContent || '';
          if (allText && allText.length > 50) {
            return allText;
          }
        }
        
        return mainContent ? (mainContent.innerText || mainContent.textContent || '') : '';
      }
      
      // 其他網站的選擇器
      const recipeSelectors = [
        'article',
        '[class*="recipe"]',
        '[class*="content"]',
        'main',
        '.post-content',
        '.entry-content'
      ];
      
      let mainContent: HTMLElement | null = null;
      for (const selector of recipeSelectors) {
        const element = document.querySelector(selector) as HTMLElement;
        if (element && element.innerText && element.innerText.length > 200) {
          mainContent = element;
          break;
        }
      }
      
      // 如果找不到特定區域，使用整個 body
      const targetElement = mainContent || document.body;
      return targetElement ? (targetElement.innerText || targetElement.textContent || '') : '';
    }, isXiaohongshu);
    
    // 提取圖片URL
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs
        .map(img => img.src)
        .filter(src => src && (src.startsWith('http') || src.startsWith('//')))
        .slice(0, 10); // 最多10張圖片
    });
    
    await browser.close();
    
    // 調試日誌
    console.log(`[WebScraper] URL: ${url}`);
    console.log(`[WebScraper] Title: ${title}`);
    console.log(`[WebScraper] Content length: ${content.trim().length}`);
    console.log(`[WebScraper] Content preview (first 500 chars): ${content.trim().substring(0, 500)}`);
    if (isXiaohongshu) {
      console.log(`[WebScraper] Xiaohongshu detected, used mobile user agent`);
    }
    
    return {
      title,
      content: content.trim(),
      images,
      success: true
    };
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    
    return {
      title: '',
      content: '',
      images: [],
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    };
  }
}

/**
 * 使用簡單的fetch方式抓取(備用方案)
 */
export async function simpleFetch(url: string): Promise<ScrapedContent> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    
    // 簡單的HTML解析
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : '';
    
    // 移除HTML標籤獲取純文本
    const content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // 提取圖片URL
    const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
    const images = Array.from(imgMatches)
      .map(match => match[1])
      .filter(src => src.startsWith('http'))
      .slice(0, 10);
    
    return {
      title,
      content: content.substring(0, 10000), // 增加內容長度以提高完整性
      images,
      success: true
    };
    
  } catch (error) {
    return {
      title: '',
      content: '',
      images: [],
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    };
  }
}
