import { chromium } from "playwright";
import { ENV } from "./_core/env";

export interface ScrapedContent {
  title: string;
  content: string;
  images: string[];
  success: boolean;
  error?: string;
  videoTranscript?: string;
}

/**
 * 使用Playwright抓取網頁內容
 * 支援需要JavaScript渲染的動態網站
 */
export async function scrapeWebpage(url: string): Promise<ScrapedContent> {
  console.log('[WebScraper/scrapeWebpage] ========================================');
  console.log('[WebScraper/scrapeWebpage] 🌐 Starting Playwright scraping');
  console.log('[WebScraper/scrapeWebpage] 🔗 URL:', url);
  
  let browser;
  
  try {
    // 檢查是否是小紅書，需要模擬移動設備
    const isXiaohongshu = url.includes('xiaohongshu.com') || url.includes('xhslink.com');
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    
    if (isYouTube) {
      console.log('[WebScraper/scrapeWebpage] 🎥 YouTube URL detected - will extract transcript after scraping');
    }
    if (isXiaohongshu) {
      console.log('[WebScraper/scrapeWebpage] 📱 Xiaohongshu URL detected - using mobile user agent');
    }
    
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
    
    // Check if it's a YouTube URL and extract transcript
    let videoTranscript: string | undefined = undefined;
    
    if (isYouTube) {
      console.log(`[WebScraper/scrapeWebpage] 🎥 YouTube detected, extracting transcript using Supadata...`);
      videoTranscript = await getYouTubeTranscriptWithSupadata(url);
      
      if (videoTranscript && videoTranscript.length > 50) {
        console.log(`[WebScraper/scrapeWebpage] ✅ YouTube transcript extracted: ${videoTranscript.length} characters`);
        console.log(`[WebScraper/scrapeWebpage] 📄 Transcript preview: ${videoTranscript.substring(0, 200)}...`);
      } else {
        console.log(`[WebScraper/scrapeWebpage] ⚠️  No YouTube transcript available (length: ${videoTranscript?.length || 0})`);
      }
    }
    
    const result = {
      title,
      content: content.trim(),
      images,
      success: true,
      videoTranscript: videoTranscript // Include transcript if extracted
    };
    
    console.log(`[WebScraper/scrapeWebpage] ✅ Scraping completed successfully`);
    console.log(`[WebScraper/scrapeWebpage] 📊 Final result:`);
    console.log(`[WebScraper/scrapeWebpage]   - Title: ${result.title}`);
    console.log(`[WebScraper/scrapeWebpage]   - Content length: ${result.content.length}`);
    console.log(`[WebScraper/scrapeWebpage]   - Images: ${result.images.length}`);
    console.log(`[WebScraper/scrapeWebpage]   - Has videoTranscript: ${!!result.videoTranscript} (${result.videoTranscript?.length || 0} chars)`);
    console.log(`[WebScraper/scrapeWebpage] ========================================`);
    
    return result;
    
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
 * Extract YouTube video ID from URL
 */
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Get YouTube transcript using Supadata API
 */
async function getYouTubeTranscriptWithSupadata(url: string): Promise<string> {
  console.log('[YouTube Transcript] 🎬 Starting transcript extraction for:', url);
  
  try {
    // Extract video ID from URL
    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      console.log('[YouTube Transcript] ❌ Could not extract video ID from URL');
      return '';
    }
    
    console.log('[YouTube Transcript] 🆔 Video ID:', videoId);
    
    // Get API token from environment or use provided one
    const apiToken = process.env.YOUTUBE_TRANSCRIPT_API_TOKEN || '69328e51d9f9043266a8ec1a';
    
    if (!apiToken) {
      console.log('[YouTube Transcript] ❌ API token not configured');
      return '';
    }
    
    console.log('[YouTube Transcript] ⏳ Calling youtube-transcript.io API...');
    console.log('[YouTube Transcript] 📤 Request body:', JSON.stringify({ ids: [videoId] }));
    
    const response = await fetch("https://www.youtube-transcript.io/api/transcripts", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        ids: [videoId], 
      })
    });
    
    console.log('[YouTube Transcript] 📥 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error('[YouTube Transcript] ❌ API request failed');
      console.error('[YouTube Transcript]   Status:', response.status, response.statusText);
      console.error('[YouTube Transcript]   Error:', errorText.substring(0, 500));
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('[YouTube Transcript] 📋 Response structure:', JSON.stringify(data).substring(0, 500));
    
    // Extract transcript from response
    let transcriptText: string | null = null;
    
    if (data && Array.isArray(data) && data.length > 0) {
      // If response is an array of transcripts
      const transcript = data[0];
      console.log('[YouTube Transcript] 📝 Found transcript in array format');
      console.log('[YouTube Transcript]   Transcript keys:', Object.keys(transcript));
      
      // Check for tracks array (contains transcript segments)
      console.log('[YouTube Transcript]   Checking tracks:', {
        exists: !!transcript.tracks,
        isArray: Array.isArray(transcript.tracks),
        length: transcript.tracks?.length || 0,
        type: typeof transcript.tracks
      });
      
      if (transcript.tracks && Array.isArray(transcript.tracks) && transcript.tracks.length > 0) {
        console.log('[YouTube Transcript]   ✅ Found tracks array with', transcript.tracks.length, 'segments');
        console.log('[YouTube Transcript]   First track structure:', JSON.stringify(transcript.tracks[0]).substring(0, 500));
        console.log('[YouTube Transcript]   First track keys:', transcript.tracks[0] ? Object.keys(transcript.tracks[0]) : 'none');
        
        // Extract text from tracks - each track might have 'text', 'snippet', or similar
        const trackTexts = transcript.tracks.map((track: any, index: number) => {
          const text = track.text || track.snippet || track.transcript || track.content || track.caption || track.segment?.text || '';
          if (index < 3 && text) {
            console.log(`[YouTube Transcript]   Track ${index} text preview:`, text.substring(0, 100));
          }
          return text;
        }).filter((text: string) => text.length > 0);
        
        if (trackTexts.length > 0) {
          transcriptText = trackTexts.join(' ');
          console.log('[YouTube Transcript]   ✅ Extracted', trackTexts.length, 'text segments from tracks');
        } else {
          console.log('[YouTube Transcript]   ⚠️  Tracks array found but no text content extracted');
          console.log('[YouTube Transcript]   Sample track:', JSON.stringify(transcript.tracks[0]).substring(0, 500));
        }
      } else {
        console.log('[YouTube Transcript]   ⚠️  No valid tracks array found');
        if (transcript.tracks) {
          console.log('[YouTube Transcript]   Tracks value:', JSON.stringify(transcript.tracks).substring(0, 500));
        }
      }
      
      // Fallback to description field (sometimes transcript is in video description)
      if (!transcriptText && transcript.microformat?.playerMicroformatRenderer?.description?.simpleText) {
        const description = transcript.microformat.playerMicroformatRenderer.description.simpleText;
        console.log('[YouTube Transcript]   Using video description as fallback (length:', description.length, ')');
        transcriptText = description;
      }
      
      // Fallback to direct text/transcript fields
      if (!transcriptText) {
        transcriptText = transcript.text || transcript.transcript || '';
      }
    } else if (data.transcripts && Array.isArray(data.transcripts) && data.transcripts.length > 0) {
      // If response has transcripts array
      const transcript = data.transcripts[0];
      console.log('[YouTube Transcript] 📝 Found transcript in data.transcripts array');
      console.log('[YouTube Transcript]   Transcript keys:', Object.keys(transcript));
      
      if (transcript.tracks && Array.isArray(transcript.tracks)) {
        const trackTexts = transcript.tracks.map((track: any) => 
          track.text || track.snippet || track.transcript || ''
        ).filter((text: string) => text.length > 0);
        transcriptText = trackTexts.join(' ');
      } else {
        transcriptText = transcript.text || transcript.transcript || '';
      }
    } else if (data.text || data.transcript) {
      // If response has text directly
      console.log('[YouTube Transcript] 📝 Found transcript in data directly');
      transcriptText = data.text || data.transcript || '';
    }
    
    if (transcriptText && transcriptText.length > 0) {
      console.log(`[YouTube Transcript] ✅ Success! Transcript extracted (${transcriptText.length} characters)`);
      console.log('[YouTube Transcript] 📄 Preview (first 500 chars):');
      console.log('[YouTube Transcript]   ' + transcriptText.substring(0, 500).replace(/\n/g, ' '));
      return transcriptText;
    }
    
    console.log('[YouTube Transcript] ⚠️  No transcript content found in response');
    console.log('[YouTube Transcript] 📋 Full response:', JSON.stringify(data, null, 2).substring(0, 1000));
    return '';
  } catch (error) {
    console.error('[YouTube Transcript] ❌ Error occurred:');
    console.error('[YouTube Transcript]   Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[YouTube Transcript]   Error message:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('[YouTube Transcript]   Stack trace:', error.stack.substring(0, 500));
    }
    return '';
  }
}

/**
 * 使用簡單的fetch方式抓取(備用方案)
 */
export async function simpleFetch(url: string): Promise<ScrapedContent> {
  console.log('[WebScraper/simpleFetch] ========================================');
  console.log('[WebScraper/simpleFetch] 🌐 Starting web scraping');
  console.log('[WebScraper/simpleFetch] 🔗 URL:', url);
  
  try {
    // Check if it's a YouTube URL
    const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
    console.log('[WebScraper/simpleFetch] 🎥 Is YouTube URL?', isYouTube);
    
    if (isYouTube) {
      console.log('[WebScraper/simpleFetch] ✅ YouTube detected, using Supadata for transcript extraction...');
      
      // Try to get transcript from YouTube Transcript API
      console.log('[WebScraper/simpleFetch] ⏳ Calling getYouTubeTranscriptWithSupadata()...');
      const transcript = await getYouTubeTranscriptWithSupadata(url);
      
      if (transcript && transcript.length > 50) {
        console.log('[WebScraper/simpleFetch] ✅ Transcript extraction successful!');
        console.log(`[WebScraper/simpleFetch] 📊 Transcript length: ${transcript.length} characters`);
        
        // Extract title from YouTube URL or use default
        const videoId = extractYouTubeVideoId(url);
        const title = videoId ? `YouTube Video - ${videoId}` : 'YouTube Video';
        console.log('[WebScraper/simpleFetch] 📝 Title:', title);
        
        const result = {
          title,
          content: `[YouTube字幕]\n${transcript}`, // Include transcript in content as fallback
          images: [],
          success: true,
          videoTranscript: transcript, // Set videoTranscript for AI processing
        };
        
        console.log('[WebScraper/simpleFetch] ✅ Returning result with videoTranscript');
        console.log('[WebScraper/simpleFetch] ========================================');
        return result;
      } else {
        console.log('[WebScraper/simpleFetch] ⚠️  No YouTube transcript available (length:', transcript?.length || 0, ')');
        console.log('[WebScraper/simpleFetch] 🔄 Falling back to HTML description extraction...');
      }
    } else {
      console.log('[WebScraper/simpleFetch] 📄 Not a YouTube URL, using regular HTML scraping...');
    }
    
    // Regular fetch for non-YouTube or fallback
    console.log('[WebScraper/simpleFetch] 📡 Fetching HTML content...');
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('[WebScraper/simpleFetch] 📥 Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      console.log('[WebScraper/simpleFetch] ❌ HTTP error:', response.status, response.statusText);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('[WebScraper/simpleFetch] 📄 Reading HTML content...');
    const html = await response.text();
    console.log('[WebScraper/simpleFetch] 📊 HTML length:', html.length, 'characters');
    
    // 簡單的HTML解析
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : '';
    console.log('[WebScraper/simpleFetch] 📝 Extracted title:', title || '(not found)');
    
    // 移除HTML標籤獲取純文本
    console.log('[WebScraper/simpleFetch] 🧹 Cleaning HTML (removing scripts, styles, tags)...');
    const content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    console.log('[WebScraper/simpleFetch] 📊 Cleaned content length:', content.length, 'characters');
    console.log('[WebScraper/simpleFetch] 📄 Content preview (first 200 chars):', content.substring(0, 200));
    
    // 提取圖片URL
    console.log('[WebScraper/simpleFetch] 🖼️  Extracting images...');
    const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
    const images = Array.from(imgMatches)
      .map(match => match[1])
      .filter(src => src.startsWith('http'))
      .slice(0, 10);
    console.log('[WebScraper/simpleFetch] 🖼️  Found', images.length, 'images');
    
    const result = {
      title,
      content: content.substring(0, 10000), // 增加內容長度以提高完整性
      images,
      success: true
    };
    
    console.log('[WebScraper/simpleFetch] ✅ HTML scraping completed successfully');
    console.log('[WebScraper/simpleFetch] 📊 Final result:');
    console.log('[WebScraper/simpleFetch]   - Title:', result.title);
    console.log('[WebScraper/simpleFetch]   - Content length:', result.content.length);
    console.log('[WebScraper/simpleFetch]   - Images:', result.images.length);
    console.log('[WebScraper/simpleFetch]   - Has videoTranscript:', 'videoTranscript' in result ? !!result.videoTranscript : false);
    console.log('[WebScraper/simpleFetch] ========================================');
    
    return result;
    
  } catch (error) {
    console.error('[WebScraper/simpleFetch] ❌ Error during web scraping:');
    console.error('[WebScraper/simpleFetch]   Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[WebScraper/simpleFetch]   Error message:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error('[WebScraper/simpleFetch]   Stack trace:', error.stack.substring(0, 500));
    }
    console.log('[WebScraper/simpleFetch] ========================================');
    
    return {
      title: '',
      content: '',
      images: [],
      success: false,
      error: error instanceof Error ? error.message : '未知錯誤'
    };
  }
}
