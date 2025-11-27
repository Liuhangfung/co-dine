import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Link, PlusCircle, Utensils, BarChart3, BookOpen, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { toast } from "sonner";
import { Link as RouterLink } from "wouter";

const RECIPES_PER_PAGE = 5;

export default function Dashboard() {
  const { data: recipes, isLoading } = trpc.recipes.list.useQuery();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const utils = trpc.useUtils();
  
  const deleteMutation = trpc.recipes.delete.useMutation({
    onSuccess: () => {
      toast.success("食譜已刪除");
      utils.recipes.list.invalidate();
      setDeleteId(null);
    },
    onError: (error) => {
      toast.error("刪除失敗: " + error.message);
    },
  });

  const stats = {
    total: recipes?.length || 0,
    published: recipes?.filter(r => r.isPublished).length || 0,
    draft: recipes?.filter(r => !r.isPublished).length || 0,
  };

  // 分頁計算
  const totalPages = recipes ? Math.ceil(recipes.length / RECIPES_PER_PAGE) : 0;
  const startIndex = (currentPage - 1) * RECIPES_PER_PAGE;
  const endIndex = startIndex + RECIPES_PER_PAGE;
  const paginatedRecipes = recipes?.slice(startIndex, endIndex) || [];

  // 當食譜列表變化時，確保當前頁碼有效
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (currentPage < 1 && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">儀表板</h1>
            <p className="text-gray-600 mt-1">管理您的健康食譜</p>
          </div>
          <RouterLink href="/recipes/new">
            <Button size="lg">
              <PlusCircle className="mr-2 h-5 w-5" />
              新增食譜
            </Button>
          </RouterLink>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                總食譜數
              </CardTitle>
              <Utensils className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
              <p className="text-xs text-gray-500 mt-1">所有食譜</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                已發布
              </CardTitle>
              <BookOpen className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{stats.published}</div>
              <p className="text-xs text-gray-500 mt-1">公開可見</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                草稿
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-600">{stats.draft}</div>
              <p className="text-xs text-gray-500 mt-1">未發布</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>快速操作</CardTitle>
            <CardDescription>選擇輸入方式創建新食譜</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <RouterLink href="/recipes/new?method=weblink">
                <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
                  <Link className="h-6 w-6" />
                  <span>網址連結</span>
                </Button>
              </RouterLink>
              <RouterLink href="/recipes/new?method=manual">
                <Button variant="outline" className="w-full h-24 flex flex-col gap-2">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>手動輸入</span>
                </Button>
              </RouterLink>
            </div>
          </CardContent>
        </Card>

        {/* Recent Recipes */}
        <Card>
          <CardHeader>
            <CardTitle>最近食譜</CardTitle>
            <CardDescription>您最近創建的食譜</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">載入中...</div>
            ) : recipes && recipes.length > 0 ? (
              <>
                <div className="space-y-4">
                  {paginatedRecipes.map((recipe) => (
                    <RouterLink key={recipe.id} href={`/recipes/${recipe.id}`}>
                      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-4">
                          {recipe.imageUrl ? (
                            <img
                              src={recipe.imageUrl}
                              alt={recipe.title}
                              className="h-16 w-16 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="h-16 w-16 bg-green-100 rounded-lg flex items-center justify-center">
                              <Utensils className="h-8 w-8 text-green-600" />
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-gray-900">{recipe.title}</h3>
                            <p className="text-sm text-gray-500">
                              {recipe.totalCalories ? `${recipe.totalCalories} 卡路里` : '營養資訊待計算'}
                              {recipe.servings && ` · ${recipe.servings} 人份`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {recipe.isPublished ? (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                              已發布
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                              草稿
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteId(recipe.id);
                            }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </RouterLink>
                  ))}
                </div>
                
                {/* 分頁控件 */}
                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (currentPage > 1) {
                                setCurrentPage(currentPage - 1);
                              }
                            }}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                        
                        {/* 顯示頁碼 */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                          // 只顯示當前頁、第一頁、最後一頁，以及當前頁前後各一頁
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setCurrentPage(page);
                                  }}
                                  isActive={currentPage === page}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          } else if (
                            page === currentPage - 2 ||
                            page === currentPage + 2
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }
                          return null;
                        })}
                        
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (currentPage < totalPages) {
                                setCurrentPage(currentPage + 1);
                              }
                            }}
                            className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                    
                    {/* 顯示當前頁信息 */}
                    <div className="text-center mt-4 text-sm text-gray-500">
                      顯示第 {startIndex + 1}-{Math.min(endIndex, recipes.length)} 個，共 {recipes.length} 個食譜
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Utensils className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">還沒有食譜</p>
                <RouterLink href="/recipes/new">
                  <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    創建第一個食譜
                  </Button>
                </RouterLink>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 刪除確認對話框 */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除食譜？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作無法復原。食譜及其所有相關資料（食材、步驟、分類）將被永久刪除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              className="bg-red-600 hover:bg-red-700"
            >
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
