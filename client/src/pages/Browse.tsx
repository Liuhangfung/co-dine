import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Search, Filter, Utensils, Flame, Beef } from "lucide-react";
import { APP_LOGO, APP_TITLE } from "@/const";
import { StarRating } from "@/components/StarRating";

const RECIPES_PER_PAGE = 12;

// 小組件：顯示食譜評分
function RecipeRatingDisplay({ recipeId }: { recipeId: number }) {
  const { data: rating } = trpc.reviews.getAverageRating.useQuery({ recipeId });
  
  if (!rating || rating.count === 0) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-2">
      <StarRating rating={Math.round(rating.average)} readonly size="sm" />
      <span className="text-sm text-gray-600">
        {rating.average.toFixed(1)} ({rating.count})
      </span>
    </div>
  );
}

export default function Browse() {
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [minCalories, setMinCalories] = useState<string>("");
  const [maxCalories, setMaxCalories] = useState<string>("");
  const [minProtein, setMinProtein] = useState<string>("");
  const [maxProtein, setMaxProtein] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: categories } = trpc.categories.list.useQuery();
  
  // 計算offset
  const offset = (currentPage - 1) * RECIPES_PER_PAGE;
  
  const { data: recipes, isLoading } = trpc.recipes.browse.useQuery({
    search: search || undefined,
    categoryIds: selectedCategories.length > 0 ? selectedCategories : undefined,
    minCalories: minCalories ? parseInt(minCalories) : undefined,
    maxCalories: maxCalories ? parseInt(maxCalories) : undefined,
    minProtein: minProtein ? parseInt(minProtein) : undefined,
    maxProtein: maxProtein ? parseInt(maxProtein) : undefined,
    limit: RECIPES_PER_PAGE,
    offset: offset,
  });

  // 當篩選條件改變時，重置到第一頁
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategories, minCalories, maxCalories, minProtein, maxProtein]);

  // 判斷是否還有更多頁面（如果返回的結果等於每頁數量，可能還有更多）
  const hasMore = recipes && recipes.length === RECIPES_PER_PAGE;

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedCategories([]);
    setMinCalories("");
    setMaxCalories("");
    setMinProtein("");
    setMaxProtein("");
  };

  const categoriesByType = {
    ingredient: categories?.filter(c => c.type === "ingredient") || [],
    cuisine: categories?.filter(c => c.type === "cuisine") || [],
    method: categories?.filter(c => c.type === "method") || [],
    health: categories?.filter(c => c.type === "health") || [],
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="bg-white border-b border-green-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                  <Utensils className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{APP_TITLE}</h1>
                  <p className="text-xs text-gray-500">智能食譜管理與分析</p>
                </div>
              </div>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline">進入系統</Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-gray-900 mb-3">探索健康食譜</h2>
          <p className="text-lg text-gray-600">瀏覽我們精心挑選的健康均衡食譜</p>
        </div>

        {/* Search Bar */}
        <div className="max-w-3xl mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="搜索食譜名稱或描述..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-4 py-6 text-lg"
            />
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="max-w-3xl mx-auto mb-6">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full"
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? "隱藏篩選" : "顯示篩選"}
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <Card className="max-w-3xl mx-auto mb-8">
            <CardHeader>
              <CardTitle>篩選條件</CardTitle>
              <CardDescription>根據分類和營養資訊篩選食譜</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Category Filters */}
              {Object.entries(categoriesByType).map(([type, cats]) => {
                if (cats.length === 0) return null;
                const typeNames: Record<string, string> = {
                  ingredient: "主要食材",
                  cuisine: "菜系分類",
                  method: "烹調方法",
                  health: "健康標籤",
                };
                return (
                  <div key={type}>
                    <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                      {typeNames[type]}
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {cats.map(cat => (
                        <Button
                          key={cat.id}
                          variant={selectedCategories.includes(cat.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleCategory(cat.id)}
                        >
                          {cat.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Nutrition Filters */}
              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                  <Flame className="inline h-4 w-4 mr-1" />
                  卡路里範圍
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minCalories" className="text-xs text-gray-600">最低</Label>
                    <Input
                      id="minCalories"
                      type="number"
                      placeholder="例如: 200"
                      value={minCalories}
                      onChange={(e) => setMinCalories(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxCalories" className="text-xs text-gray-600">最高</Label>
                    <Input
                      id="maxCalories"
                      type="number"
                      placeholder="例如: 600"
                      value={maxCalories}
                      onChange={(e) => setMaxCalories(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 mb-2 block">
                  <Beef className="inline h-4 w-4 mr-1" />
                  蛋白質範圍 (克)
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="minProtein" className="text-xs text-gray-600">最低</Label>
                    <Input
                      id="minProtein"
                      type="number"
                      placeholder="例如: 20"
                      value={minProtein}
                      onChange={(e) => setMinProtein(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxProtein" className="text-xs text-gray-600">最高</Label>
                    <Input
                      id="maxProtein"
                      type="number"
                      placeholder="例如: 50"
                      value={maxProtein}
                      onChange={(e) => setMaxProtein(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Button variant="ghost" onClick={clearFilters} className="w-full">
                清除所有篩選
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
              <p className="mt-4 text-gray-600">載入中...</p>
            </div>
          ) : recipes && recipes.length > 0 ? (
            <>
              <p className="text-sm text-gray-600 mb-4">
                顯示第 {offset + 1}-{offset + recipes.length} 個食譜
                {hasMore && `（可能還有更多）`}
              </p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recipes.map(recipe => (
                  <Link key={recipe.id} href={`/browse/${recipe.id}`}>
                    <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                      {recipe.imageUrl && (
                        <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                          <img
                            src={recipe.imageUrl}
                            alt={recipe.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardHeader>
                        <CardTitle className="line-clamp-2">{recipe.title}</CardTitle>
                        {recipe.description && (
                          <CardDescription className="line-clamp-2">
                            {recipe.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent>
                        <RecipeRatingDisplay recipeId={recipe.id} />
                        <div className="flex items-center gap-4 text-sm text-gray-600 mt-3">
                          {recipe.totalCalories && (
                            <div className="flex items-center gap-1">
                              <Flame className="h-4 w-4 text-orange-500" />
                              <span>{recipe.totalCalories} 卡</span>
                            </div>
                          )}
                          {recipe.protein && (
                            <div className="flex items-center gap-1">
                              <Beef className="h-4 w-4 text-red-500" />
                              <span>{recipe.protein}g 蛋白質</span>
                            </div>
                          )}
                          {recipe.servings && (
                            <div>
                              <span>{recipe.servings} 人份</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
              
              {/* 分頁控件 */}
              {(currentPage > 1 || hasMore) && (
                <div className="mt-8">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) {
                              setCurrentPage(currentPage - 1);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                          }}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      
                      {/* 顯示頁碼 */}
                      {(() => {
                        const pages: number[] = [];
                        // 總是顯示第一頁
                        if (currentPage > 1) {
                          pages.push(1);
                        }
                        // 如果第一頁和當前頁之間有間隔，顯示省略號
                        if (currentPage > 3) {
                          pages.push(-1); // -1 表示省略號
                        }
                        // 顯示當前頁前後各一頁
                        for (let i = Math.max(1, currentPage - 1); i <= currentPage + 1; i++) {
                          if (i !== 1 && !pages.includes(i)) {
                            pages.push(i);
                          }
                        }
                        // 如果有更多頁面，顯示下一頁
                        if (hasMore && !pages.includes(currentPage + 1)) {
                          pages.push(currentPage + 1);
                        }
                        
                        return pages.map((page, idx) => {
                          if (page === -1) {
                            return (
                              <PaginationItem key={`ellipsis-${idx}`}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setCurrentPage(page);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                isActive={currentPage === page}
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        });
                      })()}
                      
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (hasMore) {
                              setCurrentPage(currentPage + 1);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }
                          }}
                          className={!hasMore ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                  
                  {/* 顯示當前頁信息 */}
                  <div className="text-center mt-4 text-sm text-gray-500">
                    第 {currentPage} 頁
                    {hasMore && " · 還有更多"}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Utensils className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-xl text-gray-600 mb-2">沒有找到符合條件的食譜</p>
              <p className="text-gray-500 mb-4">試試調整篩選條件或搜索關鍵字</p>
              <Button onClick={clearFilters} variant="outline">清除篩選</Button>
            </div>
          )}
        </div>
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
