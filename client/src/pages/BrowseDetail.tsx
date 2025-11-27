import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Link, useParams } from "wouter";
import { ArrowLeft, Utensils, Flame, Beef, Cookie, Droplet, Users } from "lucide-react";
import { APP_TITLE } from "@/const";

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

        {/* Nutrition Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              營養資訊
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {recipe.servings && (
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Users className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{recipe.servings}</div>
                  <div className="text-sm text-gray-600">人份</div>
                </div>
              )}
              {recipe.totalCalories && (
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <Flame className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{recipe.totalCalories}</div>
                  <div className="text-sm text-gray-600">卡路里</div>
                </div>
              )}
              {recipe.protein && (
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <Beef className="h-6 w-6 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{recipe.protein}g</div>
                  <div className="text-sm text-gray-600">蛋白質</div>
                </div>
              )}
              {recipe.carbs && (
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <Cookie className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{recipe.carbs}g</div>
                  <div className="text-sm text-gray-600">碳水化合物</div>
                </div>
              )}
              {recipe.fat && (
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Droplet className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-gray-900">{recipe.fat}g</div>
                  <div className="text-sm text-gray-600">脂肪</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>食材清單</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recipe.ingredients
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((ing, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-sm font-semibold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-gray-900">{ing.name}</span>
                        {(ing.amount || ing.unit) && (
                          <span className="text-gray-600 ml-2">
                            {ing.amount} {ing.unit}
                          </span>
                        )}
                        {ing.notes && (
                          <span className="text-gray-500 text-sm ml-2">({ing.notes})</span>
                        )}
                      </div>
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
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {recipe.steps
                  .sort((a, b) => a.stepNumber - b.stepNumber)
                  .map((step) => (
                    <div key={step.stepNumber} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
                          {step.stepNumber}
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-900 mb-2">{step.instruction}</p>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                          {step.duration && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">時間:</span> {step.duration} 分鐘
                            </span>
                          )}
                          {step.temperature && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">溫度:</span> {step.temperature}
                            </span>
                          )}
                        </div>
                        {step.tips && (
                          <div className="mt-2 p-3 bg-yellow-50 rounded-lg text-sm text-gray-700">
                            💡 <span className="font-medium">小貼士:</span> {step.tips}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

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
