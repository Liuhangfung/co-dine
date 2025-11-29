import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import { ArrowLeft, Utensils, Flame, Beef, Cookie, Droplet, Users, Clock, ThumbsUp, ThumbsDown, Star, CheckCircle2, GitCompare } from "lucide-react";
import { APP_TITLE } from "@/const";
import { Streamdown } from "streamdown";

export default function BrowseDetail() {
  const params = useParams<{ id: string }>();
  const recipeId = parseInt(params.id || "0");

  const { data: recipe, isLoading } = trpc.recipes.getPublicById.useQuery({ id: recipeId });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Utensils className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">食譜不存在</h2>
          <p className="text-gray-600 mb-6">此食譜可能已被刪除或未公開</p>
          <Link href="/browse">
            <Button>返回瀏覽</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/browse">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回瀏覽
              </Button>
            </Link>
            <Link href="/">
              <div className="flex items-center gap-2 cursor-pointer">
                <Utensils className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-gray-900">{APP_TITLE}</span>
              </div>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Recipe Header */}
        <div className="mb-8">
          {recipe.imageUrl && (
            <div className="aspect-video w-full overflow-hidden rounded-xl mb-6">
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{recipe.title}</h1>
          {recipe.description && (
            <p className="text-lg text-gray-600 mb-4">{recipe.description}</p>
          )}

          {/* Categories */}
          {recipe.categories && recipe.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {recipe.categories.map(cat => (
                <Badge key={cat.id} variant="secondary">
                  {cat.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Source Info */}
        {(recipe.inputMethod || recipe.sourceUrl) && (
          <Card className="mb-8 bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 mb-2">📖 原始來源</p>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">輸入方式：</span>
                      {recipe.inputMethod === "weblink" && "網址連結"}
                      {recipe.inputMethod === "image" && "圖片上傳"}
                      {recipe.inputMethod === "manual" && "手動輸入"}
                    </p>
                    {recipe.sourceUrl && (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-700 flex-1">
                          <span className="font-semibold">原始連結：</span>
                          <a 
                            href={recipe.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline break-all"
                          >
                            {recipe.sourceUrl}
                          </a>
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const url = recipe.sourceUrl || '';
                            // Fallback for non-HTTPS environments
                            if (navigator.clipboard && window.isSecureContext) {
                              navigator.clipboard.writeText(url);
                              toast.success('連結已複製到剪貼板');
                            } else {
                              // Fallback method for HTTP
                              const textArea = document.createElement('textarea');
                              textArea.value = url;
                              textArea.style.position = 'fixed';
                              textArea.style.left = '-999999px';
                              document.body.appendChild(textArea);
                              textArea.focus();
                              textArea.select();
                              try {
                                document.execCommand('copy');
                                toast.success('連結已複製到剪貼板');
                              } catch (err) {
                                toast.error('複製失敗，請手動複製');
                              }
                              document.body.removeChild(textArea);
                            }
                          }}
                        >
                          複製
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => recipe.sourceUrl && window.open(recipe.sourceUrl, "_blank")}
                        >
                          打開
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata - Servings and Calories */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Utensils className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">份量</p>
                  <p className="text-lg font-semibold">{recipe.servings || 1} 人份</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Flame className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">總卡路里</p>
                  <p className="text-lg font-semibold">
                    {recipe.totalCalories || "未計算"} {recipe.totalCalories && "kcal"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">每份卡路里</p>
                  <p className="text-lg font-semibold">
                    {recipe.caloriesPerServing || "未計算"} {recipe.caloriesPerServing && "kcal"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cooking Info */}
        {(recipe.difficulty || recipe.prepTime || recipe.cookTime || recipe.totalTime || recipe.requiredEquipment) && (
          <Card className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
            <CardHeader>
              <CardTitle className="text-amber-900">烹飪信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {recipe.difficulty && (
                  <div>
                    <p className="text-sm font-medium text-amber-700 mb-2">難度等級</p>
                    <Badge className={`${
                      recipe.difficulty === "簡單" ? "bg-green-100 text-green-800" :
                      recipe.difficulty === "中等" ? "bg-yellow-100 text-yellow-800" :
                      "bg-red-100 text-red-800"
                    }`}>
                      {recipe.difficulty}
                    </Badge>
                  </div>
                )}
                {recipe.prepTime && (
                  <div>
                    <p className="text-sm font-medium text-amber-700 mb-2">準備時間</p>
                    <p className="text-lg font-semibold text-amber-900">{recipe.prepTime} 分鐘</p>
                  </div>
                )}
                {recipe.cookTime && (
                  <div>
                    <p className="text-sm font-medium text-amber-700 mb-2">烹飪時間</p>
                    <p className="text-lg font-semibold text-amber-900">{recipe.cookTime} 分鐘</p>
                  </div>
                )}
                {recipe.totalTime && (
                  <div>
                    <p className="text-sm font-medium text-amber-700 mb-2">總時間</p>
                    <p className="text-lg font-semibold text-amber-900">{recipe.totalTime} 分鐘</p>
                  </div>
                )}
              </div>
              {recipe.requiredEquipment && (
                <div className="mt-6 pt-6 border-t border-amber-200">
                  <p className="text-sm font-medium text-amber-700 mb-3">所需廚具</p>
                  <div className="flex flex-wrap gap-2">
                    {(() => {
                      let equipment: string[] = [];
                      if (typeof recipe.requiredEquipment === "string") {
                        try {
                          equipment = JSON.parse(recipe.requiredEquipment);
                        } catch (e) {
                          equipment = [];
                        }
                      } else if (Array.isArray(recipe.requiredEquipment)) {
                        equipment = recipe.requiredEquipment;
                      }
                      return equipment.map((item: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="bg-white border-amber-200">
                          {item}
                        </Badge>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Nutrition Info */}
        {(recipe.protein || recipe.carbs || recipe.fat || recipe.fiber) && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>營養成分</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {recipe.protein && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{recipe.protein}g</p>
                    <p className="text-sm text-gray-500">蛋白質</p>
                  </div>
                )}
                {recipe.carbs && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{recipe.carbs}g</p>
                    <p className="text-sm text-gray-500">碳水化合物</p>
                  </div>
                )}
                {recipe.fat && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600">{recipe.fat}g</p>
                    <p className="text-sm text-gray-500">脂肪</p>
                  </div>
                )}
                {recipe.fiber && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{recipe.fiber}g</p>
                    <p className="text-sm text-gray-500">纖維</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Nutrition Benefits & Concerns */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              營養分析
            </CardTitle>
            <CardDescription>詳細的營養好處和需要注意的地方</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Benefits */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-lg text-green-700">營養好處</h3>
                </div>
                <div className="space-y-3">
                  {recipe.protein && recipe.protein > 20 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="font-medium text-green-900">✓ 高蛋白質</p>
                      <p className="text-sm text-green-700 mt-1">{recipe.protein}g 蛋白質有助於肌肉生長、修復和維持，適合健身和恢復</p>
                    </div>
                  )}
                  {recipe.fiber && recipe.fiber > 5 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="font-medium text-green-900">✓ 高纖維</p>
                      <p className="text-sm text-green-700 mt-1">{recipe.fiber}g 纖維促進腸道健康、改善消化，有助於血糖控制</p>
                    </div>
                  )}
                  {recipe.totalCalories && recipe.servings && (recipe.totalCalories / recipe.servings) < 300 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="font-medium text-green-900">✓ 低卡路里</p>
                      <p className="text-sm text-green-700 mt-1">每份 {Math.round(recipe.totalCalories / recipe.servings)} 卡，適合體重管理和健康飲食</p>
                    </div>
                  )}
                  {recipe.fat && recipe.fat < 10 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="font-medium text-green-900">✓ 低脂肪</p>
                      <p className="text-sm text-green-700 mt-1">{recipe.fat}g 脂肪，適合心臟健康和低脂飲食</p>
                    </div>
                  )}
                  {recipe.carbs && recipe.carbs < 30 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="font-medium text-green-900">✓ 低碳水</p>
                      <p className="text-sm text-green-700 mt-1">{recipe.carbs}g 碳水化合物，適合低碳飲食和血糖管理</p>
                </div>
              )}
                </div>
              </div>

              {/* Concerns */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsDown className="w-5 h-5 text-red-600" />
                  <h3 className="font-semibold text-lg text-red-700">需要注意的地方</h3>
                </div>
                <div className="space-y-3">
                  {recipe.totalCalories && recipe.servings && (recipe.totalCalories / recipe.servings) > 500 && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="font-medium text-red-900">⚠ 高卡路里</p>
                      <p className="text-sm text-red-700 mt-1">每份 {Math.round(recipe.totalCalories / recipe.servings)} 卡，建議搭配運動或作為主餐</p>
                    </div>
                  )}
                  {recipe.fat && recipe.fat > 20 && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="font-medium text-red-900">⚠ 高脂肪</p>
                      <p className="text-sm text-red-700 mt-1">{recipe.fat}g 脂肪，建議適量食用，特別是心臟病患者</p>
                    </div>
                  )}
                  {recipe.carbs && recipe.carbs > 60 && (
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <p className="font-medium text-red-900">⚠ 高碳水</p>
                      <p className="text-sm text-red-700 mt-1">{recipe.carbs}g 碳水化合物，建議糖尿病患者控制份量</p>
                    </div>
                  )}
                  {recipe.protein && recipe.protein < 10 && (
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="font-medium text-orange-900">ℹ 蛋白質較低</p>
                      <p className="text-sm text-orange-700 mt-1">{recipe.protein}g 蛋白質，建議搭配其他高蛋白食物</p>
                    </div>
                  )}
                  {recipe.fiber && recipe.fiber < 3 && (
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="font-medium text-orange-900">ℹ 纖維較低</p>
                      <p className="text-sm text-orange-700 mt-1">{recipe.fiber}g 纖維，建議增加蔬菜或全穀物</p>
                </div>
              )}
                </div>
              </div>
            </div>

            {/* Health Score */}
            <div className="mt-6 pt-6 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">整體健康評分</p>
                  <p className="text-3xl font-bold text-green-600">
                    {(() => {
                      let score = 5;
                      if (recipe.protein && recipe.protein > 20) score += 1;
                      if (recipe.fiber && recipe.fiber > 5) score += 1;
                      if (recipe.totalCalories && recipe.servings && (recipe.totalCalories / recipe.servings) < 300) score += 1;
                      if (recipe.fat && recipe.fat < 10) score += 1;
                      if (recipe.carbs && recipe.carbs < 30) score += 1;
                      if (recipe.fat && recipe.fat > 20) score -= 1;
                      if (recipe.totalCalories && recipe.servings && (recipe.totalCalories / recipe.servings) > 500) score -= 1;
                      return Math.max(1, Math.min(10, score));
                    })()}/10
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600 mb-2">推薦食用人群</p>
                  <div className="flex flex-wrap gap-2 justify-end">
                    {recipe.protein && recipe.protein > 20 && <Badge className="bg-green-100 text-green-800">健身愛好者</Badge>}
                    {recipe.totalCalories && recipe.servings && (recipe.totalCalories / recipe.servings) < 300 && <Badge className="bg-blue-100 text-blue-800">減肥人士</Badge>}
                    {recipe.fiber && recipe.fiber > 5 && <Badge className="bg-purple-100 text-purple-800">腸道健康</Badge>}
                    {recipe.carbs && recipe.carbs < 30 && <Badge className="bg-yellow-100 text-yellow-800">低碳飲食</Badge>}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>食材清單</CardTitle>
              <CardDescription>所需材料</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recipe.ingredients
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((ing) => (
                    <div key={ing.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-medium">{ing.name}</span>
                      {ing.amount && <span className="text-gray-600">{ing.amount}</span>}
                      {ing.unit && <span className="text-gray-500">{ing.unit}</span>}
                      {ing.notes && <span className="text-sm text-gray-400">({ing.notes})</span>}
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cooking Steps */}
        {recipe.steps && recipe.steps.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>烹飪步驟</CardTitle>
              <CardDescription>詳細製作過程</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {recipe.steps
                  .sort((a, b) => a.stepNumber - b.stepNumber)
                  .map((step) => (
                    <div key={step.id} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 bg-green-600 text-white rounded-full flex items-center justify-center font-semibold">
                          {step.stepNumber}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900 mb-2">{step.instruction}</p>
                        <div className="flex gap-4 text-sm text-gray-500">
                          {step.duration && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {step.duration} 分鐘
                            </span>
                          )}
                          {step.temperature && (
                            <span className="flex items-center gap-1">
                              <Flame className="h-3 w-3" />
                              {step.temperature}
                            </span>
                          )}
                        </div>
                        {step.tips && (
                          <p className="mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded">
                            💡 {step.tips}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Improvement Suggestions */}
        {recipe.improvementSuggestions && (() => {
          let improvementText = "";
          let healthBenefits = "";
          
          try {
            const parsed = JSON.parse(recipe.improvementSuggestions);
            if (parsed.improvementText) {
              improvementText = parsed.improvementText;
              healthBenefits = parsed.healthBenefits || "";
            } else {
              improvementText = recipe.improvementSuggestions;
            }
          } catch {
            improvementText = recipe.improvementSuggestions;
          }
          
          return (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">👨‍🍳</span>
                  米芝蓮級 AI 改良建議
                </CardTitle>
                <CardDescription>專業大廚的優化建議</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <Streamdown>{improvementText}</Streamdown>
                  {healthBenefits && (
                    <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <h4 className="font-semibold text-green-800 mb-2">健康益處</h4>
                      <p className="text-gray-700 text-sm">{healthBenefits}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Nutrition Comparison */}
        {(() => {
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
              if (aiAnalysis.nutrition) {
                originalNutrition = {
                  totalCalories: aiAnalysis.nutrition.totalCalories || originalNutrition.totalCalories,
                  protein: aiAnalysis.nutrition.protein || originalNutrition.protein,
                  carbs: aiAnalysis.nutrition.carbs || originalNutrition.carbs,
                  fat: aiAnalysis.nutrition.fat || originalNutrition.fat,
                  fiber: aiAnalysis.nutrition.fiber || originalNutrition.fiber
                };
              }
              improvedNutrition = aiAnalysis.improvedNutrition;
            } catch (error) {
              console.error('[BrowseDetail] Failed to parse aiAnalysis:', error);
            }
          }
          
          if (recipe.improvementSuggestions) {
            return (
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitCompare className="w-5 h-5 text-green-600" />
                    營養成分對比
                  </CardTitle>
                  <CardDescription>原始食譜 vs 米芝蓮級 AI 改良建議</CardDescription>
                </CardHeader>
                <CardContent>
                  {improvedNutrition && 
                   typeof improvedNutrition.calories === 'number' &&
                   typeof improvedNutrition.protein === 'number' &&
                   typeof improvedNutrition.carbs === 'number' &&
                   typeof improvedNutrition.fat === 'number' &&
                   typeof improvedNutrition.fiber === 'number' ? (
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Original */}
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
                          <div className="flex justify-between">
                            <span className="text-gray-600">碳水化合物:</span>
                            <span className="font-medium">{originalNutrition.carbs} g</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">脂肪:</span>
                            <span className="font-medium">{originalNutrition.fat} g</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">纖維:</span>
                            <span className="font-medium">{originalNutrition.fiber} g</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Improved */}
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
                                ? 'text-green-600' 
                                : improvedNutrition.calories > originalNutrition.totalCalories 
                                ? 'text-orange-600' 
                                : ''
                            }`}>
                              {improvedNutrition.calories} kcal
                              {improvedNutrition.calories !== originalNutrition.totalCalories && (
                                <span className="ml-1 text-xs">
                                  ({improvedNutrition.calories > originalNutrition.totalCalories ? '+' : ''}
                                  {improvedNutrition.calories - originalNutrition.totalCalories})
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">蛋白質:</span>
                            <span className={`font-medium ${
                              improvedNutrition.protein > originalNutrition.protein 
                                ? 'text-green-600' 
                                : improvedNutrition.protein < originalNutrition.protein 
                                ? 'text-orange-600' 
                                : ''
                            }`}>
                              {improvedNutrition.protein} g
                              {improvedNutrition.protein !== originalNutrition.protein && (
                                <span className="ml-1 text-xs">
                                  ({improvedNutrition.protein > originalNutrition.protein ? '+' : ''}
                                  {improvedNutrition.protein - originalNutrition.protein})
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">碳水化合物:</span>
                            <span className={`font-medium ${
                              improvedNutrition.carbs < originalNutrition.carbs 
                                ? 'text-green-600' 
                                : improvedNutrition.carbs > originalNutrition.carbs 
                                ? 'text-orange-600' 
                                : ''
                            }`}>
                              {improvedNutrition.carbs} g
                              {improvedNutrition.carbs !== originalNutrition.carbs && (
                                <span className="ml-1 text-xs">
                                  ({improvedNutrition.carbs > originalNutrition.carbs ? '+' : ''}
                                  {improvedNutrition.carbs - originalNutrition.carbs})
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">脂肪:</span>
                            <span className={`font-medium ${
                              improvedNutrition.fat < originalNutrition.fat 
                                ? 'text-green-600' 
                                : improvedNutrition.fat > originalNutrition.fat 
                                ? 'text-orange-600' 
                                : ''
                            }`}>
                              {improvedNutrition.fat} g
                              {improvedNutrition.fat !== originalNutrition.fat && (
                                <span className="ml-1 text-xs">
                                  ({improvedNutrition.fat > originalNutrition.fat ? '+' : ''}
                                  {improvedNutrition.fat - originalNutrition.fat})
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">纖維:</span>
                            <span className={`font-medium ${
                              improvedNutrition.fiber > originalNutrition.fiber 
                                ? 'text-green-600' 
                                : improvedNutrition.fiber < originalNutrition.fiber 
                                ? 'text-orange-600' 
                                : ''
                            }`}>
                              {improvedNutrition.fiber} g
                              {improvedNutrition.fiber !== originalNutrition.fiber && (
                                <span className="ml-1 text-xs">
                                  ({improvedNutrition.fiber > originalNutrition.fiber ? '+' : ''}
                                  {improvedNutrition.fiber - originalNutrition.fiber})
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">對比數據正在計算中...</p>
                      <div className="bg-gray-50 rounded-lg p-4 inline-block">
                        <h4 className="font-semibold text-gray-700 mb-3">當前營養成分</h4>
                        <div className="space-y-2 text-sm text-left">
                          <div className="flex justify-between gap-8">
                            <span className="text-gray-600">總卡路里:</span>
                            <span className="font-medium">{originalNutrition.totalCalories} kcal</span>
                          </div>
                          <div className="flex justify-between gap-8">
                            <span className="text-gray-600">蛋白質:</span>
                            <span className="font-medium">{originalNutrition.protein} g</span>
                          </div>
                          <div className="flex justify-between gap-8">
                            <span className="text-gray-600">碳水化合物:</span>
                            <span className="font-medium">{originalNutrition.carbs} g</span>
                          </div>
                          <div className="flex justify-between gap-8">
                            <span className="text-gray-600">脂肪:</span>
                            <span className="font-medium">{originalNutrition.fat} g</span>
                          </div>
                          <div className="flex justify-between gap-8">
                            <span className="text-gray-600">纖維:</span>
                            <span className="font-medium">{originalNutrition.fiber} g</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          }
          return null;
        })()}

        {/* Call to Action */}
        <Card className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-3">喜歡這個食譜？</h3>
            <p className="mb-6 text-green-50">加入我們的系統,創建和管理您自己的健康食譜</p>
            <Link href="/dashboard">
              <Button size="lg" variant="secondary">
                開始使用
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-green-100 mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-gray-600">
          <p>© 2025 {APP_TITLE}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
