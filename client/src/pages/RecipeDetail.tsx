import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Loader2, Utensils, Clock, Flame, Edit, Trash2, CheckCircle2, History, AlertCircle, ThumbsUp, ThumbsDown, Star, GitCompare } from "lucide-react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { SuggestionDialog } from "@/components/SuggestionDialog";
import { EditRecipeDialog } from "@/components/EditRecipeDialog";
import { VersionHistoryDialog } from "@/components/VersionHistoryDialog";
import { RecipeReviews } from "@/components/RecipeReviews";
import IngredientSubstitutionDialog from "@/components/IngredientSubstitutionDialog";
import { useState } from "react";

export default function RecipeDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const recipeId = parseInt(params.id || "0");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [substitutionDialogOpen, setSubstitutionDialogOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<{ id: number; name: string } | null>(null);

  const { data: recipe, isLoading, refetch } = trpc.recipes.getById.useQuery({ id: recipeId });
  const { data: suggestions } = trpc.suggestions.getByRecipe.useQuery({ recipeId });
  const { data: allCategories } = trpc.categories.list.useQuery();

  const updateRecipe = trpc.recipes.update.useMutation({
    onSuccess: () => {
      toast.success("食譜已更新");
      window.location.reload();
    },
  });

  const deleteRecipe = trpc.recipes.delete.useMutation({
    onSuccess: () => {
      toast.success("食譜已刪除");
      setLocation("/dashboard");
    },
  });

  const handlePublishToggle = () => {
    if (!recipe) return;
    updateRecipe.mutate({
      id: recipeId,
      isPublished: !recipe.isPublished,
    });
  };

  const handleDelete = () => {
    if (confirm("確定要刪除這個食譜嗎?")) {
      deleteRecipe.mutate({ id: recipeId });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    );
  }

  if (!recipe) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-gray-500">找不到食譜</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{recipe.title}</h1>
              {recipe.isPublished ? (
                <Badge className="bg-green-100 text-green-700">已發布</Badge>
              ) : (
                <Badge variant="secondary">草稿</Badge>
              )}
            </div>
            {recipe.description && (
              <p className="text-gray-600">{recipe.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
              <Edit className="w-4 h-4 mr-2" />
              編輯
            </Button>
            <Button variant="outline" onClick={() => setVersionHistoryOpen(true)}>
              <History className="w-4 w-4 mr-2" />
              版本歷史
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const compareList = JSON.parse(localStorage.getItem("compareList") || "[]");
                if (compareList.includes(recipeId)) {
                  toast.info("此食譜已在對比列表中");
                  return;
                }
                if (compareList.length >= 4) {
                  toast.error("最多只能選擇 4 個食譜進行對比");
                  return;
                }
                compareList.push(recipeId);
                localStorage.setItem("compareList", JSON.stringify(compareList));
                toast.success("已加入對比列表");
                window.dispatchEvent(new Event("compareListUpdated"));
              }}
            >
              <GitCompare className="w-4 w-4 mr-2" />
              加入對比
            </Button>
            <SuggestionDialog 
              recipeId={recipeId}
              currentNutrition={{
                calories: recipe.totalCalories || undefined,
                protein: recipe.protein || undefined,
                carbs: recipe.carbs || undefined,
                fat: recipe.fat || undefined,
              }}
            />
            <Button variant="outline" onClick={handlePublishToggle}>
              {recipe.isPublished ? "取消發布" : "發布"}
            </Button>
            <Button variant="outline" size="icon">
              <Edit className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Source Info */}
        {(recipe.inputMethod || recipe.sourceUrl) && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-700 mb-2">📖 原始來源</p>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">輸入方式：</span>
                      {recipe.inputMethod === "weblink" && "網址連結"}
                      {recipe.inputMethod === "image" && "圖片上傳（已停用）"}
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

        {/* Image */}
        {recipe.imageUrl && (
          <div className="rounded-lg overflow-hidden">
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-96 object-cover"
            />
          </div>
        )}

        {/* Metadata */}
        <div className="grid md:grid-cols-3 gap-4">
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
          <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
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
          <Card>
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
        <Card>
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

        {/* Categories */}
        {recipe.categories && recipe.categories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>分類標籤</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {recipe.categories.map((cat) => (
                  <Badge key={cat.id} variant="outline">
                    {cat.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>食材清單</CardTitle>
              <CardDescription>所需材料</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recipe.ingredients.map((ing) => (
                  <div 
                    key={ing.id} 
                    className="flex items-center gap-3 py-2 border-b last:border-0 hover:bg-green-50 cursor-pointer rounded px-2 transition-colors group"
                    onClick={() => {
                      setSelectedIngredient({ id: ing.id, name: ing.name });
                      setSubstitutionDialogOpen(true);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium">{ing.name}</span>
                    {ing.amount && <span className="text-gray-600">{ing.amount}</span>}
                    {ing.unit && <span className="text-gray-500">{ing.unit}</span>}
                    {ing.notes && <span className="text-sm text-gray-400">({ing.notes})</span>}
                    <span className="ml-auto text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      🔄 點擊查看替換建議
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cooking Steps */}
        {recipe.steps && recipe.steps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>烹飪步驟</CardTitle>
              <CardDescription>詳細製作過程</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {recipe.steps.map((step) => (
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
          // 直接使用 improvementSuggestions（已包含完整文本）
          let improvementText = "";
          let healthBenefits = "";
          let isJsonFormat = false;
          
          try {
            const parsed = JSON.parse(recipe.improvementSuggestions);
            if (parsed.improvementText) {
              improvementText = parsed.improvementText;
              healthBenefits = parsed.healthBenefits || "";
              isJsonFormat = true;
            } else {
              improvementText = recipe.improvementSuggestions;
            }
          } catch {
            // 如果不是 JSON，直接使用原始文本
            improvementText = recipe.improvementSuggestions;
          }
          
          return (
            <Card>
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

        {/* 營養成分對比 - 獨立卡片 */}
        {(() => {
          // 嘗試從 aiAnalysis 獲取對比數據
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
              // 優先使用 aiAnalysis 中的營養數據
              if (aiAnalysis.nutrition) {
                originalNutrition = {
                  totalCalories: aiAnalysis.nutrition.totalCalories || originalNutrition.totalCalories,
                  protein: aiAnalysis.nutrition.protein || originalNutrition.protein,
                  carbs: aiAnalysis.nutrition.carbs || originalNutrition.carbs,
                  fat: aiAnalysis.nutrition.fat || originalNutrition.fat,
                  fiber: aiAnalysis.nutrition.fiber || originalNutrition.fiber
                };
              }
              // 獲取改良後的營養成分
              improvedNutrition = aiAnalysis.improvedNutrition;
              
              // 調試日誌
              console.log('[RecipeDetail] aiAnalysis:', aiAnalysis);
              console.log('[RecipeDetail] improvedNutrition:', improvedNutrition);
              console.log('[RecipeDetail] originalNutrition:', originalNutrition);
            } catch (error) {
              console.error('[RecipeDetail] Failed to parse aiAnalysis:', error);
            }
          }
          
          // 如果有改良建議，總是顯示對比卡片（即使 improvedNutrition 不存在，也顯示原始數據）
          if (recipe.improvementSuggestions) {
            return (
              <Card>
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
                    // 有完整的改良後營養數據，顯示詳細對比
                    <div className="space-y-6">
                      {/* Summary Cards */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* 原始食譜 */}
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
                      
                      {/* 改良後 */}
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

                      {/* Detailed Comparison with Visual Bars */}
                      <div className="bg-white border rounded-lg p-6">
                        <h4 className="font-semibold text-gray-800 mb-4">📊 詳細營養對比分析</h4>
                        <div className="space-y-4">
                          {/* Calories */}
                          {(() => {
                            const diff = improvedNutrition.calories - originalNutrition.totalCalories;
                            const percent = originalNutrition.totalCalories ? Math.round((diff / originalNutrition.totalCalories) * 100) : 0;
                            const isGood = diff < 0;
                            return (
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium">總卡路里</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">{originalNutrition.totalCalories} → {improvedNutrition.calories} kcal</span>
                                    <span className={`text-sm font-semibold ${isGood ? 'text-green-600' : 'text-orange-600'}`}>
                                      {isGood ? '↓' : '↑'} {Math.abs(percent)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${isGood ? 'bg-green-500' : 'bg-orange-500'}`}
                                    style={{width: `${Math.min(100, Math.abs(percent))}%`}}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {isGood ? '✓ 減少熱量攝入有助於體重控制' : '注意：卡路里增加'}
                                </p>
                              </div>
                            );
                          })()}

                          {/* Protein */}
                          {(() => {
                            const diff = improvedNutrition.protein - originalNutrition.protein;
                            const percent = originalNutrition.protein ? Math.round((diff / originalNutrition.protein) * 100) : 0;
                            const isGood = diff > 0;
                            return (
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium">蛋白質</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">{originalNutrition.protein} → {improvedNutrition.protein} g</span>
                                    <span className={`text-sm font-semibold ${isGood ? 'text-green-600' : diff < 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                                      {diff > 0 ? '↑' : diff < 0 ? '↓' : '='} {Math.abs(percent)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${isGood ? 'bg-green-500' : 'bg-blue-500'}`}
                                    style={{width: `${Math.min(100, Math.abs(percent))}%`}}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {isGood ? '✓ 增加蛋白質有助肌肉生長和飽足感' : diff < 0 ? '注意：蛋白質減少' : '蛋白質維持不變'}
                                </p>
                              </div>
                            );
                          })()}

                          {/* Carbs */}
                          {(() => {
                            const diff = improvedNutrition.carbs - originalNutrition.carbs;
                            const percent = originalNutrition.carbs ? Math.round((diff / originalNutrition.carbs) * 100) : 0;
                            const isGood = diff < 0;
                            return (
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium">碳水化合物</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">{originalNutrition.carbs} → {improvedNutrition.carbs} g</span>
                                    <span className={`text-sm font-semibold ${isGood ? 'text-green-600' : diff > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                                      {diff > 0 ? '↑' : diff < 0 ? '↓' : '='} {Math.abs(percent)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${isGood ? 'bg-green-500' : 'bg-yellow-500'}`}
                                    style={{width: `${Math.min(100, Math.abs(percent))}%`}}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {isGood ? '✓ 減少碳水化合物有助血糖控制' : diff > 0 ? '注意：碳水化合物增加' : '碳水化合物維持不變'}
                                </p>
                              </div>
                            );
                          })()}

                          {/* Fat */}
                          {(() => {
                            const diff = improvedNutrition.fat - originalNutrition.fat;
                            const percent = originalNutrition.fat ? Math.round((diff / originalNutrition.fat) * 100) : 0;
                            const isGood = diff < 0;
                            return (
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium">脂肪</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">{originalNutrition.fat} → {improvedNutrition.fat} g</span>
                                    <span className={`text-sm font-semibold ${isGood ? 'text-green-600' : diff > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                                      {diff > 0 ? '↑' : diff < 0 ? '↓' : '='} {Math.abs(percent)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${isGood ? 'bg-green-500' : 'bg-red-500'}`}
                                    style={{width: `${Math.min(100, Math.abs(percent))}%`}}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {isGood ? '✓ 減少脂肪有助心血管健康' : diff > 0 ? '注意：脂肪增加' : '脂肪維持不變'}
                                </p>
                              </div>
                            );
                          })()}

                          {/* Fiber */}
                          {(() => {
                            const diff = improvedNutrition.fiber - originalNutrition.fiber;
                            const percent = originalNutrition.fiber ? Math.round((diff / originalNutrition.fiber) * 100) : 0;
                            const isGood = diff > 0;
                            return (
                              <div>
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-sm font-medium">纖維</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600">{originalNutrition.fiber} → {improvedNutrition.fiber} g</span>
                                    <span className={`text-sm font-semibold ${isGood ? 'text-green-600' : diff < 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                                      {diff > 0 ? '↑' : diff < 0 ? '↓' : '='} {Math.abs(percent)}%
                                    </span>
                                  </div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${isGood ? 'bg-green-500' : 'bg-gray-400'}`}
                                    style={{width: `${Math.min(100, Math.abs(percent))}%`}}
                                  />
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {isGood ? '✓ 增加纖維有助消化和飽足感' : diff < 0 ? '注意：纖維減少' : '纖維維持不變'}
                                </p>
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Per Serving Breakdown */}
                      {recipe.servings && recipe.servings > 1 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h4 className="font-semibold text-blue-900 mb-3">👤 每人份營養</h4>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            <div className="text-center">
                              <p className="text-xs text-gray-600 mb-1">卡路里</p>
                              <p className="font-bold text-blue-700">{Math.round(improvedNutrition.calories / recipe.servings)}</p>
                              <p className="text-xs text-gray-500">kcal/份</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-600 mb-1">蛋白質</p>
                              <p className="font-bold text-blue-700">{Math.round(improvedNutrition.protein / recipe.servings)}</p>
                              <p className="text-xs text-gray-500">g/份</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-600 mb-1">碳水</p>
                              <p className="font-bold text-blue-700">{Math.round(improvedNutrition.carbs / recipe.servings)}</p>
                              <p className="text-xs text-gray-500">g/份</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-600 mb-1">脂肪</p>
                              <p className="font-bold text-blue-700">{Math.round(improvedNutrition.fat / recipe.servings)}</p>
                              <p className="text-xs text-gray-500">g/份</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-600 mb-1">纖維</p>
                              <p className="font-bold text-blue-700">{Math.round(improvedNutrition.fiber / recipe.servings)}</p>
                              <p className="text-xs text-gray-500">g/份</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 mt-3 text-center">
                            總份量：{recipe.servings} 人份
                          </p>
                        </div>
                      )}

                      {/* Health Benefits Summary */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 className="font-semibold text-green-900 mb-3">💚 健康改善總結</h4>
                        <div className="grid md:grid-cols-2 gap-3 text-sm">
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
                      </div>
                    </div>
                  ) : (
                    // 沒有改良後營養數據，只顯示原始數據和提示
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

        {/* User Suggestions */}
        {suggestions && suggestions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">💡</span>
                用戶改良建議
              </CardTitle>
              <CardDescription>根據您的需求提供的定制化建議</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="border-l-4 border-green-500 pl-4 py-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={suggestion.status === "processed" ? "default" : "secondary"}>
                        {suggestion.status === "processed" ? "已處理" : "處理中"}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(suggestion.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mb-3">
                      <p className="font-medium text-gray-700 mb-1">您的建議:</p>
                      <p className="text-gray-600">{suggestion.suggestionText}</p>
                      {(suggestion.targetCalories || suggestion.targetProtein || suggestion.targetCarbs || suggestion.targetFat) && (
                        <div className="flex gap-4 mt-2 text-sm">
                          {suggestion.targetCalories && (
                            <span className="text-orange-600">目標卡路里: {suggestion.targetCalories} kcal</span>
                          )}
                          {suggestion.targetProtein && (
                            <span className="text-blue-600">目標蛋白質: {suggestion.targetProtein} g</span>
                          )}
                          {suggestion.targetCarbs && (
                            <span className="text-yellow-600">目標碳水: {suggestion.targetCarbs} g</span>
                          )}
                          {suggestion.targetFat && (
                            <span className="text-red-600">目標脂肪: {suggestion.targetFat} g</span>
                          )}
                        </div>
                      )}
                    </div>
                    {suggestion.aiResponse && (
                      <div className="space-y-4">
                        {/* 營養對比 */}
                        {(suggestion.improvedCalories || suggestion.improvedProtein || suggestion.improvedCarbs || suggestion.improvedFat) && (
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                              <span>📊</span> 營養成分對比
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              {suggestion.improvedCalories && (
                                <div className="text-center">
                                  <p className="text-xs text-gray-600 mb-1">卡路里</p>
                                  <p className="text-sm line-through text-gray-400">{recipe?.totalCalories || 0}</p>
                                  <p className="text-lg font-bold text-orange-600">{suggestion.improvedCalories}</p>
                                  <p className="text-xs text-gray-500">kcal</p>
                                  {recipe?.totalCalories && (
                                    <p className={`text-xs mt-1 ${
                                      suggestion.improvedCalories < recipe.totalCalories 
                                        ? 'text-green-600' 
                                        : 'text-red-600'
                                    }`}>
                                      {suggestion.improvedCalories < recipe.totalCalories ? '↓' : '↑'}
                                      {Math.abs(Math.round((suggestion.improvedCalories - recipe.totalCalories) / recipe.totalCalories * 100))}%
                                    </p>
                                  )}
                                </div>
                              )}
                              {suggestion.improvedProtein && (
                                <div className="text-center">
                                  <p className="text-xs text-gray-600 mb-1">蛋白質</p>
                                  <p className="text-sm line-through text-gray-400">{recipe?.protein || 0}</p>
                                  <p className="text-lg font-bold text-blue-600">{suggestion.improvedProtein}</p>
                                  <p className="text-xs text-gray-500">g</p>
                                  {recipe?.protein && (
                                    <p className={`text-xs mt-1 ${
                                      suggestion.improvedProtein > recipe.protein 
                                        ? 'text-green-600' 
                                        : 'text-red-600'
                                    }`}>
                                      {suggestion.improvedProtein > recipe.protein ? '↑' : '↓'}
                                      {Math.abs(Math.round((suggestion.improvedProtein - recipe.protein) / recipe.protein * 100))}%
                                    </p>
                                  )}
                                </div>
                              )}
                              {suggestion.improvedCarbs && (
                                <div className="text-center">
                                  <p className="text-xs text-gray-600 mb-1">碳水</p>
                                  <p className="text-sm line-through text-gray-400">{recipe?.carbs || 0}</p>
                                  <p className="text-lg font-bold text-yellow-600">{suggestion.improvedCarbs}</p>
                                  <p className="text-xs text-gray-500">g</p>
                                  {recipe?.carbs && (
                                    <p className={`text-xs mt-1 ${
                                      suggestion.improvedCarbs < recipe.carbs 
                                        ? 'text-green-600' 
                                        : 'text-red-600'
                                    }`}>
                                      {suggestion.improvedCarbs < recipe.carbs ? '↓' : '↑'}
                                      {Math.abs(Math.round((suggestion.improvedCarbs - recipe.carbs) / recipe.carbs * 100))}%
                                    </p>
                                  )}
                                </div>
                              )}
                              {suggestion.improvedFat && (
                                <div className="text-center">
                                  <p className="text-xs text-gray-600 mb-1">脂肪</p>
                                  <p className="text-sm line-through text-gray-400">{recipe?.fat || 0}</p>
                                  <p className="text-lg font-bold text-red-600">{suggestion.improvedFat}</p>
                                  <p className="text-xs text-gray-500">g</p>
                                  {recipe?.fat && (
                                    <p className={`text-xs mt-1 ${
                                      suggestion.improvedFat < recipe.fat 
                                        ? 'text-green-600' 
                                        : 'text-red-600'
                                    }`}>
                                      {suggestion.improvedFat < recipe.fat ? '↓' : '↑'}
                                      {Math.abs(Math.round((suggestion.improvedFat - recipe.fat) / recipe.fat * 100))}%
                                    </p>
                                  )}
                                </div>
                              )}
                              {suggestion.improvedFiber && (
                                <div className="text-center">
                                  <p className="text-xs text-gray-600 mb-1">纖維</p>
                                  <p className="text-sm line-through text-gray-400">{recipe?.fiber || 0}</p>
                                  <p className="text-lg font-bold text-green-600">{suggestion.improvedFiber}</p>
                                  <p className="text-xs text-gray-500">g</p>
                                  {recipe?.fiber && (
                                    <p className={`text-xs mt-1 ${
                                      suggestion.improvedFiber > recipe.fiber 
                                        ? 'text-green-600' 
                                        : 'text-red-600'
                                    }`}>
                                      {suggestion.improvedFiber > recipe.fiber ? '↑' : '↓'}
                                      {Math.abs(Math.round((suggestion.improvedFiber - recipe.fiber) / recipe.fiber * 100))}%
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* 健康提示 */}
                        {suggestion.healthTips && (
                          <div className="bg-green-50 p-4 rounded-lg">
                            <p className="font-medium text-green-900 mb-2 flex items-center gap-2">
                              <span>✨</span> 健康提示
                            </p>
                            <p className="text-green-800 text-sm leading-relaxed">{suggestion.healthTips}</p>
                          </div>
                        )}
                        
                        {/* AI改良方案 */}
                        <div className="bg-amber-50 p-4 rounded-lg">
                          <p className="font-medium text-amber-900 mb-2 flex items-center gap-2">
                            <span>👨‍🍳</span> AI改良方案
                          </p>
                          <div className="prose prose-sm max-w-none">
                            <Streamdown>{suggestion.aiResponse}</Streamdown>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 編輯對話框 */}
      {recipe && (
        <EditRecipeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          recipe={{
            id: recipe.id,
            title: recipe.title,
            description: recipe.description,
            servings: recipe.servings || 1,
            totalCalories: recipe.totalCalories,
            caloriesPerServing: recipe.caloriesPerServing,
            protein: recipe.protein,
            carbs: recipe.carbs,
            fat: recipe.fat,
            fiber: recipe.fiber,
            isPublished: recipe.isPublished || false,
          }}
          ingredients={recipe.ingredients.map(ing => ({
            id: ing.id,
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
            calories: ing.calories,
            notes: ing.notes,
            order: ing.order || 0,
          }))}
          steps={recipe.steps.map(step => ({
            id: step.id,
            instruction: step.instruction,
            duration: step.duration,
            temperature: step.temperature,
            tips: step.tips,
            order: step.stepNumber,
          }))}
          categories={allCategories || []}
          selectedCategoryIds={recipe.categories.map(c => c.id)}
          onSuccess={() => {
            refetch();
          }}
        />
      )}

      {/* 版本歷史對話框 */}
      <VersionHistoryDialog
        recipeId={recipeId}
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
        onRestoreSuccess={() => {
          refetch();
        }}
      />

      {/* 食材替換對話框 */}
      {selectedIngredient && (
        <IngredientSubstitutionDialog
          open={substitutionDialogOpen}
          onOpenChange={setSubstitutionDialogOpen}
          ingredientId={selectedIngredient.id}
          ingredientName={selectedIngredient.name}
          recipeId={recipeId}
          onSubstituted={() => {
            refetch();
          }}
        />
      )}

      {/* 評分和評論 */}
      <RecipeReviews recipeId={recipeId} />
    </DashboardLayout>
  );
}
