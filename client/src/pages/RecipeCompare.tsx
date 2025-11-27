import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, X, Check, AlertTriangle, BarChart3, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

export default function RecipeCompare() {
  const [, params] = useRoute("/recipes/compare/:ids");
  const [, setLocation] = useLocation();
  const [recipeIds, setRecipeIds] = useState<number[]>([]);
  const [chartView, setChartView] = useState<"bar" | "radar" | null>(null);

  useEffect(() => {
    if (params?.ids) {
      const ids = params.ids.split(",").map(Number).filter(Boolean);
      setRecipeIds(ids);
    }
  }, [params]);

  const recipesQuery = (trpc.recipes as any).getByIds.useQuery(
    { ids: recipeIds },
    { enabled: recipeIds.length > 0 }
  );

  const recipes = recipesQuery.data || [];

  const handleRemoveRecipe = (id: number) => {
    const newIds = recipeIds.filter((recipeId) => recipeId !== id);
    if (newIds.length === 0) {
      setLocation("/recipes");
      return;
    }
    setLocation(`/recipes/compare/${newIds.join(",")}`);
  };

  const calculateHealthScore = (recipe: {
    protein?: number | null;
    fiber?: number | null;
    caloriesPerServing?: number | null;
    fat?: number | null;
    carbs?: number | null;
  }) => {
    let score = 5;
    if (recipe.protein && recipe.protein > 20) score += 1;
    if (recipe.fiber && recipe.fiber > 5) score += 1;
    if (recipe.caloriesPerServing && recipe.caloriesPerServing < 300) score += 1;
    if (recipe.fat && recipe.fat < 10) score += 1;
    if (recipe.carbs && recipe.carbs < 30) score += 1;
    if (recipe.caloriesPerServing && recipe.caloriesPerServing > 500) score -= 1;
    if (recipe.fat && recipe.fat > 20) score -= 1;
    if (recipe.carbs && recipe.carbs > 60) score -= 1;
    return Math.max(1, Math.min(10, score));
  };

  if (recipesQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">載入中...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (recipes.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <Button variant="ghost" onClick={() => setLocation("/recipes")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回瀏覽
          </Button>
          <div className="flex flex-col items-center justify-center h-64">
            <p className="text-gray-500 mb-4">沒有選擇要對比的食譜</p>
            <Button onClick={() => setLocation("/recipes")}>選擇食譜</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setLocation("/recipes")} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回瀏覽
            </Button>
            <h1 className="text-3xl font-bold text-gray-900">食譜對比</h1>
            <p className="text-gray-600">並排比較 {recipes.length} 個食譜</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={chartView === "bar" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartView(chartView === "bar" ? null : "bar")}
            >
              <BarChart3 className="w-4 h-4 mr-1" />
              柱狀圖
            </Button>
            <Button
              variant={chartView === "radar" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartView(chartView === "radar" ? null : "radar")}
            >
              <Activity className="w-4 h-4 mr-1" />
              雷達圖
            </Button>
          </div>
        </div>

        {/* Chart View */}
        {chartView && (
          <Card>
            <CardHeader>
              <CardTitle>營養成分對比圖表</CardTitle>
            </CardHeader>
            <CardContent>
              {chartView === "bar" && (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={recipes.map((recipe: any) => ({
                    name: recipe.title.length > 15 ? recipe.title.substring(0, 15) + "..." : recipe.title,
                    卡路里: recipe.caloriesPerServing || 0,
                    蛋白質: recipe.protein || 0,
                    碳水: recipe.carbs || 0,
                    脂肪: recipe.fat || 0,
                    纖維: recipe.fiber || 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="卡路里" fill="#f59e0b" />
                    <Bar dataKey="蛋白質" fill="#10b981" />
                    <Bar dataKey="碳水" fill="#3b82f6" />
                    <Bar dataKey="脂肪" fill="#ef4444" />
                    <Bar dataKey="纖維" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {chartView === "radar" && (
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={[
                    {
                      subject: "卡路里",
                      ...recipes.reduce((acc: any, recipe: any, idx: number) => {
                        acc[`食譜${idx + 1}`] = Math.min(((recipe.caloriesPerServing || 0) / 500) * 100, 100);
                        return acc;
                      }, {}),
                    },
                    {
                      subject: "蛋白質",
                      ...recipes.reduce((acc: any, recipe: any, idx: number) => {
                        acc[`食譜${idx + 1}`] = Math.min(((recipe.protein || 0) / 50) * 100, 100);
                        return acc;
                      }, {}),
                    },
                    {
                      subject: "碳水",
                      ...recipes.reduce((acc: any, recipe: any, idx: number) => {
                        acc[`食譜${idx + 1}`] = Math.min(((recipe.carbs || 0) / 100) * 100, 100);
                        return acc;
                      }, {}),
                    },
                    {
                      subject: "脂肪",
                      ...recipes.reduce((acc: any, recipe: any, idx: number) => {
                        acc[`食譜${idx + 1}`] = Math.min(((recipe.fat || 0) / 50) * 100, 100);
                        return acc;
                      }, {}),
                    },
                    {
                      subject: "纖維",
                      ...recipes.reduce((acc: any, recipe: any, idx: number) => {
                        acc[`食譜${idx + 1}`] = Math.min(((recipe.fiber || 0) / 20) * 100, 100);
                        return acc;
                      }, {}),
                    },
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    {recipes.map((recipe: any, idx: number) => (
                      <Radar
                        key={recipe.id}
                        name={`食譜${idx + 1}`}
                        dataKey={`食譜${idx + 1}`}
                        stroke={[
                          "#10b981",
                          "#3b82f6",
                          "#f59e0b",
                          "#ef4444",
                        ][idx % 4]}
                        fill={[
                          "#10b981",
                          "#3b82f6",
                          "#f59e0b",
                          "#ef4444",
                        ][idx % 4]}
                        fillOpacity={0.6}
                      />
                    ))}
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              )}
              <p className="text-xs text-muted-foreground text-center mt-2">
                {chartView === "radar" && "注：圖表數據已正規化到 0-100 範圍以便比較"}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Comparison Grid */}
        <div className={`grid gap-6 ${recipes.length === 2 ? "md:grid-cols-2" : recipes.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4"}`}>
          {recipes.map((recipe: any) => (
            <div key={recipe.id} className="space-y-4">
              {/* Recipe Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{recipe.title}</CardTitle>
                      {recipe.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{recipe.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRecipe(recipe.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                {recipe.imageUrl && (
                  <div className="px-6 pb-4">
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.title}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  </div>
                )}
              </Card>

              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">基本信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">份量</span>
                    <span className="font-semibold">{recipe.servings} 人份</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">總卡路里</span>
                    <span className="font-semibold">{recipe.totalCalories || "未計算"} kcal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">每份卡路里</span>
                    <span className="font-semibold">{recipe.caloriesPerServing || "未計算"} kcal</span>
                  </div>
                  {recipe.difficulty && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">難度</span>
                      <Badge className={`${
                        recipe.difficulty === "簡單" ? "bg-green-100 text-green-800" :
                        recipe.difficulty === "中等" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {recipe.difficulty}
                      </Badge>
                    </div>
                  )}
                  {recipe.totalTime && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">總時間</span>
                      <span className="font-semibold">{recipe.totalTime} 分鐘</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Nutrition */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">營養成分（每份）</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recipe.protein && (
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">蛋白質</span>
                        <span className="text-sm font-semibold text-green-600">{recipe.protein}g</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${Math.min((recipe.protein / 50) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {recipe.carbs && (
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">碳水化合物</span>
                        <span className="text-sm font-semibold text-blue-600">{recipe.carbs}g</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${Math.min((recipe.carbs / 100) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {recipe.fat && (
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">脂肪</span>
                        <span className="text-sm font-semibold text-orange-600">{recipe.fat}g</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-orange-600 h-2 rounded-full"
                          style={{ width: `${Math.min((recipe.fat / 50) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {recipe.fiber && (
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-600">纖維</span>
                        <span className="text-sm font-semibold text-purple-600">{recipe.fiber}g</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{ width: `${Math.min((recipe.fiber / 20) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Health Score */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">健康評分</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600">
                      {calculateHealthScore(recipe)}/10
                    </div>
                    <div className="mt-2 space-y-1">
                      {recipe.protein && recipe.protein > 20 && (
                        <div className="flex items-center gap-1 text-xs text-green-700">
                          <Check className="w-3 h-3" />
                          高蛋白質
                        </div>
                      )}
                      {recipe.fiber && recipe.fiber > 5 && (
                        <div className="flex items-center gap-1 text-xs text-green-700">
                          <Check className="w-3 h-3" />
                          高纖維
                        </div>
                      )}
                      {recipe.caloriesPerServing && recipe.caloriesPerServing > 500 && (
                        <div className="flex items-center gap-1 text-xs text-red-700">
                          <AlertTriangle className="w-3 h-3" />
                          高卡路里
                        </div>
                      )}
                      {recipe.fat && recipe.fat > 20 && (
                        <div className="flex items-center gap-1 text-xs text-red-700">
                          <AlertTriangle className="w-3 h-3" />
                          高脂肪
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ingredients */}
              {recipe.ingredients && recipe.ingredients.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">食材清單</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1 text-sm">
                      {recipe.ingredients.slice(0, 5).map((ingredient: any) => (
                        <li key={ingredient.id} className="flex items-start gap-2">
                          <span className="text-gray-400">•</span>
                          <span>
                            {ingredient.name}
                            {ingredient.amount && ` ${ingredient.amount}`}
                            {ingredient.unit && ` ${ingredient.unit}`}
                          </span>
                        </li>
                      ))}
                      {recipe.ingredients.length > 5 && (
                        <li className="text-gray-500 text-xs">
                          ... 還有 {recipe.ingredients.length - 5} 項
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Cooking Steps */}
              {recipe.cookingSteps && recipe.cookingSteps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">烹飪步驟</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-2 text-sm">
                      {recipe.cookingSteps.slice(0, 3).map((step: any) => (
                        <li key={step.id} className="flex gap-2">
                          <span className="font-semibold text-gray-500">{step.order}.</span>
                          <span className="line-clamp-2">{step.instruction}</span>
                        </li>
                      ))}
                      {recipe.cookingSteps.length > 3 && (
                        <li className="text-gray-500 text-xs">
                          ... 還有 {recipe.cookingSteps.length - 3} 個步驟
                        </li>
                      )}
                    </ol>
                  </CardContent>
                </Card>
              )}

              {/* View Details Button */}
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setLocation(`/recipes/${recipe.id}`)}
              >
                查看完整詳情
              </Button>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
