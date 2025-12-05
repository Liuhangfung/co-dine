# Web Scraping & Nutrition Comparison Documentation

## 📑 Table of Contents
- [Overview](#overview)
- [Web Scraping System](#web-scraping-system)
- [Nutrition Comparison UI](#nutrition-comparison-ui)
- [Data Flow](#data-flow)
- [Implementation Details](#implementation-details)

---

## Overview

This application combines **web scraping** and **AI analysis** to extract recipe information from external websites and provides a detailed **nutrition comparison** between the original recipe and AI-improved healthy alternatives.

### Key Features
- 🕷️ Intelligent web scraping with Playwright + fallback
- 🤖 AI-powered recipe extraction and analysis
- 📊 Visual nutrition comparison (before/after)
- 💚 Health improvement recommendations
- 👤 Per-serving nutrition breakdown

---

## Web Scraping System

### 🎯 Purpose
Extract recipe content from any website URL and convert unstructured HTML into structured recipe data.

### 📂 Location
- **Main File**: `server/webScraper.ts`
- **Integration**: `server/routers.ts` (lines 320-727)

### 🔄 Two-Stage Scraping Strategy

#### **Stage 1: Playwright Scraping** (Primary Method)
```typescript
// server/webScraper.ts (lines 15-175)
export async function scrapeWebpage(url: string): Promise<ScrapedContent>
```

**Features:**
- Uses headless Chrome browser
- Handles JavaScript-heavy dynamic sites
- Special mobile device emulation for certain platforms (Xiaohongshu/小紅書)
- Waits for dynamic content to load (5-8 seconds)
- Extracts title, text content, and images

**Site-Specific Handling:**
```typescript
// Xiaohongshu (小紅書) - requires mobile user agent
const isXiaohongshu = url.includes('xiaohongshu.com') || url.includes('xhslink.com');

const context = await browser.newContext({
  userAgent: isXiaohongshu 
    ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)...'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
  viewport: isXiaohongshu 
    ? { width: 375, height: 667 } // iPhone size
    : { width: 1920, height: 1080 }
});
```

**Content Extraction Selectors:**
```typescript
// Priority-based content extraction
const recipeSelectors = [
  'article',
  '[class*="recipe"]',
  '[class*="content"]',
  'main',
  '.post-content',
  '.entry-content'
];
```

#### **Stage 2: Simple Fetch** (Fallback)
```typescript
// server/webScraper.ts (lines 180-229)
export async function simpleFetch(url: string): Promise<ScrapedContent>
```

**Features:**
- Basic HTTP request with axios
- HTML parsing
- Used when Playwright fails
- Lower resource usage

### 🚦 Error Handling

```typescript
// server/routers.ts (lines 332-355)
if (!scrapedContent.success) {
  const restrictedSites = ['xiaohongshu.com', 'xhslink.com', 'douyin.com', 'tiktok.com'];
  const isRestrictedSite = restrictedSites.some(site => input.url.includes(site));
  
  if (isRestrictedSite) {
    throw new Error('無法讀取此網站內容。小紅書、抖音等平台的內容主要以影片形式呈現...');
  }
  
  throw new Error('無法訪問網址: 建議使用手動輸入功能');
}
```

**Validates:**
- ✅ Content length (minimum 50 characters)
- ✅ Video-centric platforms detection
- ✅ Login-required websites detection

---

## AI Analysis Pipeline

### 📍 Location
`server/routers.ts` - `createFromWeblink` endpoint (lines 320-727)

### 🧠 AI Processing Stages

#### **1. Recipe Extraction** (lines 357-426)
```typescript
const analysisResult = await invokeLLM({
  messages: [
    {
      role: "system",
      content: "你是一位米芝蓮級大廚和營養師。你的任務是從網頁內容中提取完整的食譜資訊。"
    },
    {
      role: "user",
      content: `網頁標題: ${scrapedContent.title}\n\n網頁內容:\n${scrapedContent.content}`
    }
  ]
});
```

**Extracts:**
- Title & description
- Ingredients (name, amount, unit, calories)
- Cooking steps (instruction, duration, temperature)
- Nutrition analysis (totalCalories, protein, carbs, fat, fiber)
- Serving size

#### **2. Health Improvement Suggestions** (lines 526-598)
```typescript
const improvementResult = await safeInvokeLLM({
  messages: [
    {
      role: "system",
      content: `你是擁有30年經驗的米芝蓮三星大廚和註冊營養師。

🌟 核心健康原則（必須遵守）：
1. ✅ 用蜜糖或生果代替白砂糖
2. ✅ 用香菇粉代替部分鹽
3. ✅ 多用生果
4. ✅ 放棄所有精製產品
5. ✅ 炸改氣炸`
    }
  ]
});
```

**Generates:**
- Food substitution recommendations
- Nutritional enhancement techniques
- Healthy cooking methods (air-frying instead of deep-frying)
- Professional chef tips
- Health benefits summary

#### **3. Improved Nutrition Calculation** (lines 602-661)
```typescript
const comparisonResult = await safeInvokeLLM({
  messages: [
    {
      role: "system",
      content: "你是營養分析AI。只返回純JSON，不要任何markdown或額外文字。"
    },
    {
      role: "user",
      content: `原始營養: 卡路里${analysis.nutrition.totalCalories}kcal...

改良建議:
${improvementsText.substring(0, 1500)}

計算改良後營養成分，只返回JSON格式:
{"calories": 整數, "protein": 整數, "carbs": 整數, "fat": 整數, "fiber": 整數}`
    }
  ]
});
```

**Returns:**
- Improved calories
- Improved protein
- Improved carbs
- Improved fat
- Improved fiber

### 💾 Database Storage (lines 679-722)

```typescript
const recipeId = await db.createRecipe({
  userId: 1,
  title: analysis.title,
  description: analysis.description,
  inputMethod: "weblink",
  sourceUrl: input.url,
  servings: analysis.servings,
  totalCalories: analysis.nutrition.totalCalories,
  caloriesPerServing: Math.round(analysis.nutrition.totalCalories / analysis.servings),
  protein: analysis.nutrition.protein,
  carbs: analysis.nutrition.carbs,
  fat: analysis.nutrition.fat,
  fiber: analysis.nutrition.fiber,
  aiAnalysis: JSON.stringify({
    ...analysis,
    improvedNutrition: improvedNutrition,
    improvementSuggestionsFullText: improvementsText
  }),
  improvementSuggestions: improvementsText,
  isPublished: false,
});
```

**Stored Data:**
- Original nutrition data
- Improved nutrition data (in `aiAnalysis` JSON field)
- Full improvement suggestions text
- Source URL
- All ingredients and cooking steps

---

## Nutrition Comparison UI

### 📍 Location
- **Primary Page**: `client/src/pages/RecipeDetail.tsx` (lines 653-1100)
- **Public Page**: `client/src/pages/BrowseDetail.tsx` (lines 562-760)
- **Route**: `/recipes/:id`

### 🎨 UI Components

#### **1. Header Section** (lines 693-700)
```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <GitCompare className="w-5 h-5 text-green-600" />
      營養成分對比
    </CardTitle>
    <CardDescription>原始食譜 vs 米芝蓮級 AI 改良建議</CardDescription>
  </CardHeader>
```

#### **2. Side-by-Side Nutrition Cards** (lines 710-837)

**Left Card - Original Recipe:**
```tsx
<div className="bg-gray-50 rounded-lg p-4">
  <h4 className="font-semibold text-gray-700 mb-3">原始食譜</h4>
  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span className="text-gray-600">總卡路里:</span>
      <span className="font-medium">{originalNutrition.totalCalories} kcal</span>
    </div>
    <div className="flex justify-between">
      <span className="text-gray-600">蛋白質:</span>
      <span className="font-medium">{originalNutrition.protein} g</span>
    </div>
    // ... more nutrition fields
  </div>
</div>
```

**Right Card - AI Improved:**
```tsx
<div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
  <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
    <span>✨</span>
    米芝蓮級 AI 改良建議
  </h4>
  <div className="space-y-2 text-sm">
    <div className="flex justify-between">
      <span className="text-gray-700">總卡路里:</span>
      <span className={`font-medium ${
        improvedNutrition.calories < originalNutrition.totalCalories 
          ? 'text-green-600'    // Lower is better
          : 'text-orange-600'   // Higher is warning
      }`}>
        {improvedNutrition.calories} kcal
        <span className="ml-1 text-xs">
          ({improvedNutrition.calories > originalNutrition.totalCalories ? '+' : ''}
          {improvedNutrition.calories - originalNutrition.totalCalories})
        </span>
      </span>
    </div>
    // ... more nutrition fields with color coding
  </div>
</div>
```

**Color Coding Logic:**
- **Calories**: 🟢 Lower is better (green) / 🟠 Higher is warning (orange)
- **Protein**: 🟢 Higher is better (green) / 🟠 Lower is warning (orange)
- **Carbs**: 🟢 Lower is better (green) / 🟠 Higher is warning (orange)
- **Fat**: 🟢 Lower is better (green) / 🟠 Higher is warning (orange)
- **Fiber**: 🟢 Higher is better (green) / 🟠 Lower is warning (orange)

#### **3. Detailed Comparison with Visual Bars** (lines 840-987)

```tsx
<div className="bg-white border rounded-lg p-6">
  <h4 className="font-semibold text-gray-800 mb-4">📊 詳細營養對比分析</h4>
  <div className="space-y-4">
    {/* Each nutrient gets a progress bar */}
    {(() => {
      const diff = improvedNutrition.calories - originalNutrition.totalCalories;
      const percent = Math.round((diff / originalNutrition.totalCalories) * 100);
      const isGood = diff < 0;
      
      return (
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">總卡路里</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                {originalNutrition.totalCalories} → {improvedNutrition.calories} kcal
              </span>
              <span className={`text-sm font-semibold ${isGood ? 'text-green-600' : 'text-orange-600'}`}>
                {isGood ? '↓' : '↑'} {Math.abs(percent)}%
              </span>
            </div>
          </div>
          {/* Progress bar visualization */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full ${isGood ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{width: `${Math.min(100, Math.abs(percent))}%`}}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            ✓ 減少熱量攝入有助於體重控制
          </p>
        </div>
      );
    })()}
    {/* Repeat for protein, carbs, fat, fiber */}
  </div>
</div>
```

**Each Progress Bar Shows:**
- Original value → Improved value
- Percentage change (↑ or ↓)
- Visual progress bar (green for good, orange/red for warning)
- Health benefit explanation

#### **4. Per Serving Breakdown** (lines 990-1025)

```tsx
{recipe.servings && recipe.servings > 1 && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <h4 className="font-semibold text-blue-900 mb-3">👤 每人份營養</h4>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
      <div className="text-center">
        <p className="text-xs text-gray-600 mb-1">卡路里</p>
        <p className="font-bold text-blue-700">
          {Math.round(improvedNutrition.calories / recipe.servings)}
        </p>
        <p className="text-xs text-gray-500">kcal/份</p>
      </div>
      {/* Repeat for protein, carbs, fat, fiber */}
    </div>
    <p className="text-xs text-gray-600 mt-3 text-center">
      總份量：{recipe.servings} 人份
    </p>
  </div>
)}
```

**Displays:**
- Calories per serving
- Protein per serving
- Carbs per serving
- Fat per serving
- Fiber per serving
- Total servings count

#### **5. Health Benefits Summary** (lines 1027-1065)

```tsx
<div className="bg-green-50 border border-green-200 rounded-lg p-4">
  <h4 className="font-semibold text-green-900 mb-3">💚 健康改善總結</h4>
  <div className="grid md:grid-cols-2 gap-3 text-sm">
    {/* Dynamically shows only improvements that were made */}
    {improvedNutrition.calories < originalNutrition.totalCalories && (
      <div className="flex items-start gap-2">
        <span className="text-green-600 mt-0.5">✓</span>
        <p className="text-gray-700">
          減少 <strong>{Math.abs(improvedNutrition.calories - originalNutrition.totalCalories)}</strong> 卡路里，
          相當於 <strong>{Math.round(Math.abs(improvedNutrition.calories - originalNutrition.totalCalories) / 7700 * 10) / 10}</strong> kg 體重
        </p>
      </div>
    )}
    
    {improvedNutrition.fat < originalNutrition.fat && (
      <div className="flex items-start gap-2">
        <span className="text-green-600 mt-0.5">✓</span>
        <p className="text-gray-700">
          減少 <strong>{Math.abs(improvedNutrition.fat - originalNutrition.fat)}</strong> g 脂肪，降低心血管疾病風險
        </p>
      </div>
    )}
    
    {improvedNutrition.fiber > originalNutrition.fiber && (
      <div className="flex items-start gap-2">
        <span className="text-green-600 mt-0.5">✓</span>
        <p className="text-gray-700">
          增加 <strong>{improvedNutrition.fiber - originalNutrition.fiber}</strong> g 纖維，促進腸道健康
        </p>
      </div>
    )}
    
    {improvedNutrition.carbs < originalNutrition.carbs && (
      <div className="flex items-start gap-2">
        <span className="text-green-600 mt-0.5">✓</span>
        <p className="text-gray-700">
          減少 <strong>{Math.abs(improvedNutrition.carbs - originalNutrition.carbs)}</strong> g 碳水，有助血糖穩定
        </p>
      </div>
    )}
  </div>
</div>
```

**Shows:**
- ✓ Calorie reduction → weight loss equivalent (1 kg = 7700 kcal)
- ✓ Fat reduction → cardiovascular health
- ✓ Fiber increase → digestive health
- ✓ Carb reduction → blood sugar control

---

## Data Flow

### 🔄 Complete Pipeline

```
1. USER INPUTS URL
   ↓
2. WEB SCRAPING (server/webScraper.ts)
   → Playwright (primary)
   → Simple Fetch (fallback)
   ↓
3. SCRAPED CONTENT
   {
     title: string,
     content: string,
     images: string[]
   }
   ↓
4. AI ANALYSIS #1 - Recipe Extraction (server/routers.ts)
   → Extract ingredients, steps, original nutrition
   ↓
5. AI ANALYSIS #2 - Health Improvements (server/routers.ts)
   → Generate improvement suggestions
   ↓
6. AI ANALYSIS #3 - Improved Nutrition (server/routers.ts)
   → Calculate improved nutrition values
   ↓
7. DATABASE STORAGE (server/db.ts)
   → Store in recipes table with aiAnalysis JSON
   ↓
8. FRONTEND DISPLAY (client/src/pages/RecipeDetail.tsx)
   → Parse aiAnalysis
   → Display comparison UI
   ↓
9. USER VIEWS COMPARISON
   ✅ Original vs Improved
   ✅ Visual progress bars
   ✅ Health benefits
```

### 📊 Data Structure

**Stored in Database:**
```typescript
{
  // Recipe table columns
  id: number,
  title: string,
  description: string,
  sourceUrl: string,
  inputMethod: "weblink",
  servings: number,
  
  // Original nutrition (from AI analysis #1)
  totalCalories: number,
  caloriesPerServing: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number,
  
  // AI data (JSON field)
  aiAnalysis: string, // JSON.stringify({
  //   nutrition: { totalCalories, protein, carbs, fat, fiber },
  //   improvedNutrition: { calories, protein, carbs, fat, fiber },
  //   improvementSuggestionsFullText: "..."
  // }),
  
  // Full text of improvements
  improvementSuggestions: string, // Long text field
  
  isPublished: boolean
}
```

**Frontend Parsing:**
```typescript
// client/src/pages/RecipeDetail.tsx (lines 656-688)
let originalNutrition = {
  totalCalories: recipe.totalCalories || 0,
  protein: recipe.protein || 0,
  carbs: recipe.carbs || 0,
  fat: recipe.fat || 0,
  fiber: recipe.fiber || 0
};

let improvedNutrition: any = null;

if (recipe.aiAnalysis) {
  try {
    const aiAnalysis = JSON.parse(recipe.aiAnalysis);
    
    // Get original nutrition from aiAnalysis
    if (aiAnalysis.nutrition) {
      originalNutrition = aiAnalysis.nutrition;
    }
    
    // Get improved nutrition
    improvedNutrition = aiAnalysis.improvedNutrition;
  } catch (error) {
    console.error('Failed to parse aiAnalysis:', error);
  }
}
```

---

## Implementation Details

### 🛠️ Key Technologies

**Backend:**
- **Playwright**: Headless browser automation
- **Axios**: HTTP requests (fallback)
- **DeepSeek AI**: LLM for recipe analysis
- **PostgreSQL**: Data storage
- **tRPC**: Type-safe API

**Frontend:**
- **React**: UI framework
- **TailwindCSS**: Styling
- **Recharts**: (available for charts in RecipeCompare page)
- **shadcn/ui**: Component library

### 🎨 Styling Classes

**Color Coding System:**
```css
/* Green = Improvement */
.text-green-600    /* Better values */
.bg-green-50       /* Improved card background */
.bg-green-500      /* Progress bar improvement */

/* Orange/Red = Warning */
.text-orange-600   /* Worse values */
.bg-orange-500     /* Progress bar warning */

/* Gray = Neutral/Original */
.bg-gray-50        /* Original card background */
.text-gray-600     /* Default text */

/* Blue = Per Serving Info */
.bg-blue-50        /* Per serving card */
.text-blue-700     /* Per serving values */
```

### 🧪 Testing Considerations

**Scraping Tests:**
- Test with various recipe websites
- Handle login-required sites gracefully
- Test mobile vs desktop rendering
- Validate minimum content length

**AI Analysis Tests:**
- Verify JSON parsing robustness
- Handle markdown code blocks in responses
- Validate all required nutrition fields
- Test with incomplete recipes

**UI Tests:**
- Test with missing improvedNutrition data
- Verify color coding logic
- Test responsive layouts
- Validate percentage calculations

---

## 🚀 Usage Example

### Creating a Recipe from URL

**1. User Input:**
```
URL: https://www.example-recipe-site.com/healthy-chicken
```

**2. Backend Processing:**
```typescript
// Scrape → AI Extract → AI Improve → Store
const scrapedContent = await scrapeWebpage(url);
const analysis = await invokeLLM({...}); // Extract recipe
const improvements = await invokeLLM({...}); // Generate suggestions
const improvedNutrition = await invokeLLM({...}); // Calculate improved nutrition
const recipeId = await db.createRecipe({...}); // Store in database
```

**3. Frontend Display:**
```
Route: /recipes/123

┌─────────────────────────────────────────────────────┐
│  🍴 營養成分對比                                      │
│  原始食譜 vs 米芝蓮級 AI 改良建議                      │
├─────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────────────────┐  │
│  │ 原始食譜       │  │ ✨ 米芝蓮級 AI 改良建議      │  │
│  │ 1270 kcal     │  │ 1200 kcal (-70)           │  │
│  │ 180 g 蛋白質  │  │ 185 g (+5) 🟢            │  │
│  │ 10 g 碳水     │  │ 20 g (+10) 🟠            │  │
│  │ 50 g 脂肪     │  │ 45 g (-5) 🟢             │  │
│  │ 2 g 纖維      │  │ 5 g (+3) 🟢              │  │
│  └───────────────┘  └───────────────────────────┘  │
│                                                      │
│  📊 詳細營養對比分析                                  │
│  總卡路里: 1270 → 1200 kcal  ↓ 6%                   │
│  [████████░░░░░░░░░░░░] 🟢                         │
│  ✓ 減少熱量攝入有助於體重控制                          │
│                                                      │
│  👤 每人份營養 (4人份)                               │
│  300 kcal/份 | 46 g/份 | 5 g/份 | 11 g/份 | 1 g/份 │
│                                                      │
│  💚 健康改善總結                                      │
│  ✓ 減少 70 卡路里，相當於 0.01 kg 體重                │
│  ✓ 減少 5 g 脂肪，降低心血管疾病風險                  │
│  ✓ 增加 3 g 纖維，促進腸道健康                        │
└─────────────────────────────────────────────────────┘
```

---

## 📝 Future Enhancements

### Potential Improvements

**Scraping:**
- [ ] Add support for more video platforms (parse video transcripts)
- [ ] Implement OCR for recipe images
- [ ] Add caching layer for frequently scraped sites
- [ ] Support for PDF recipe files

**AI Analysis:**
- [ ] Add dietary restriction filters (vegetarian, vegan, gluten-free)
- [ ] Implement allergen detection and warnings
- [ ] Generate shopping lists
- [ ] Calculate cost per serving

**Comparison UI:**
- [ ] Add interactive charts (toggle between bar/radar)
- [ ] Export comparison as PDF
- [ ] Share comparison link
- [ ] Add comparison history
- [ ] Multi-recipe comparison (compare 3-4 recipes at once)

**Performance:**
- [ ] Implement server-side caching for scraped content
- [ ] Add progressive loading for AI analysis
- [ ] Optimize Playwright resource usage
- [ ] Implement rate limiting for scraping

---

## 🔧 Configuration

### Environment Variables

```env
# AI Service (DeepSeek)
BUILT_IN_FORGE_API_KEY=your_api_key
BUILT_IN_FORGE_API_URL=https://api.deepseek.com

# Database
DATABASE_URL=postgresql://...

# Playwright (optional)
PLAYWRIGHT_BROWSERS_PATH=/path/to/browsers
```

### Scraping Timeouts

```typescript
// server/webScraper.ts
await page.goto(url, { 
  waitUntil: 'networkidle',
  timeout: 30000  // 30 seconds
});

await page.waitForTimeout(5000); // Wait for dynamic content
```

---

## 📚 Related Files

### Backend
- `server/webScraper.ts` - Web scraping logic
- `server/routers.ts` - API endpoints and AI orchestration
- `server/_core/llm.ts` - LLM integration
- `server/db.ts` - Database operations

### Frontend
- `client/src/pages/RecipeDetail.tsx` - Main comparison UI
- `client/src/pages/BrowseDetail.tsx` - Public comparison UI
- `client/src/pages/RecipeCompare.tsx` - Multi-recipe comparison
- `client/src/components/CompareFloatingButton.tsx` - Comparison basket

### Database
- `drizzle/schema.ts` - Database schema
- `drizzle/migrations/` - Database migrations

---

## 🐛 Common Issues & Solutions

### Issue 1: Scraping Fails on Certain Sites
**Symptom:** "無法訪問網址" error
**Solution:** 
- Some sites require login → Use manual input
- Video-heavy sites → Extract from video description manually
- Try different recipe sites that are publicly accessible

### Issue 2: AI Returns Invalid JSON
**Symptom:** "AI返回的JSON格式無效" error
**Solution:**
- Enhanced JSON cleaning implemented (removes markdown code blocks)
- Extracts content between first `{` and last `}`
- Falls back to manual input if persistent

### Issue 3: Missing Improved Nutrition
**Symptom:** "對比數據正在計算中..." displayed
**Solution:**
- improvedNutrition may be null if second AI call failed
- UI gracefully handles this by showing original nutrition only
- Recipe is still usable, just without comparison

### Issue 4: Playwright Browser Not Found
**Symptom:** "Executable doesn't exist" error
**Solution:**
```bash
npx playwright install chromium
```

---

## 📄 License & Credits

This documentation describes the web scraping and nutrition comparison features of the Healthy Recipe Manager application.

**Created:** 2024
**Technologies:** Playwright, DeepSeek AI, React, TypeScript, PostgreSQL

