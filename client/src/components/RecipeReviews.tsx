import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { StarRating } from "./StarRating";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import { toast } from "sonner";
import { Trash2, Edit2, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

interface RecipeReviewsProps {
  recipeId: number;
}

export function RecipeReviews({ recipeId }: RecipeReviewsProps) {
  const { user, isAuthenticated } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const utils = trpc.useUtils();

  // 獲取所有評論
  const { data: reviews = [], isLoading: reviewsLoading } = trpc.reviews.getByRecipe.useQuery({
    recipeId,
  });

  // 獲取平均評分
  const { data: averageRating } = trpc.reviews.getAverageRating.useQuery({
    recipeId,
  });

  // 獲取當前用戶的評論
  const { data: myReview } = trpc.reviews.getMyReview.useQuery(
    { recipeId },
    { enabled: isAuthenticated }
  );

  // 添加或更新評論
  const addOrUpdateMutation = trpc.reviews.addOrUpdate.useMutation({
    onSuccess: (data) => {
      toast.success(data.updated ? "評論已更新" : "評論已添加");
      setIsEditing(false);
      setComment("");
      setRating(5);
      utils.reviews.getByRecipe.invalidate({ recipeId });
      utils.reviews.getAverageRating.invalidate({ recipeId });
      utils.reviews.getMyReview.invalidate({ recipeId });
    },
    onError: (error) => {
      toast.error("操作失敗: " + error.message);
    },
  });

  // 刪除評論
  const deleteMutation = trpc.reviews.delete.useMutation({
    onSuccess: () => {
      toast.success("評論已刪除");
      utils.reviews.getByRecipe.invalidate({ recipeId });
      utils.reviews.getAverageRating.invalidate({ recipeId });
      utils.reviews.getMyReview.invalidate({ recipeId });
    },
    onError: (error) => {
      toast.error("刪除失敗: " + error.message);
    },
  });

  const handleSubmit = () => {
    if (!isAuthenticated) {
      toast.error("請先登入");
      return;
    }

    addOrUpdateMutation.mutate({
      recipeId,
      rating,
      comment: comment.trim() || undefined,
    });
  };

  const handleEdit = () => {
    if (myReview) {
      setRating(myReview.rating);
      setComment(myReview.comment || "");
      setIsEditing(true);
    }
  };

  const handleDelete = () => {
    if (myReview && confirm("確定要刪除您的評論嗎？")) {
      deleteMutation.mutate({ id: myReview.id });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setComment("");
    setRating(5);
  };

  return (
    <div className="space-y-6">
      {/* 平均評分 */}
      {averageRating && averageRating.count > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-primary">
                  {averageRating.average.toFixed(1)}
                </div>
                <div className="text-sm text-muted-foreground">平均評分</div>
              </div>
              <div className="flex-1">
                <StarRating rating={Math.round(averageRating.average)} readonly size="lg" />
                <div className="text-sm text-muted-foreground mt-2">
                  基於 {averageRating.count} 個評論
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 評論表單 */}
      {isAuthenticated && (
        <Card>
          <CardHeader>
            <CardTitle>
              {myReview && !isEditing ? "您的評論" : isEditing ? "編輯評論" : "撰寫評論"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myReview && !isEditing ? (
              // 顯示現有評論
              <div className="space-y-3">
                <StarRating rating={myReview.rating} readonly />
                {myReview.comment && (
                  <p className="text-sm text-muted-foreground">{myReview.comment}</p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Edit2 className="w-4 h-4 mr-2" />
                    編輯
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    刪除
                  </Button>
                </div>
              </div>
            ) : (
              // 編輯表單
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">評分</label>
                  <StarRating rating={rating} onRatingChange={setRating} size="lg" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">評論 (選填)</label>
                  <Textarea
                    placeholder="分享您對這個食譜的想法..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={addOrUpdateMutation.isPending}
                  >
                    {addOrUpdateMutation.isPending ? "提交中..." : "提交評論"}
                  </Button>
                  {isEditing && (
                    <Button variant="outline" onClick={handleCancel}>
                      <X className="w-4 h-4 mr-2" />
                      取消
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 評論列表 */}
      <Card>
        <CardHeader>
          <CardTitle>所有評論 ({reviews.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {reviewsLoading ? (
            <div className="text-center py-8 text-muted-foreground">載入中...</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暫無評論，成為第一個評論的人！
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review, index) => (
                <div key={review.id}>
                  {index > 0 && <Separator className="my-4" />}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">
                          {review.userName || review.userEmail || "匿名用戶"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString("zh-HK", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                      <StarRating rating={review.rating} readonly size="sm" />
                    </div>
                    {review.comment && (
                      <p className="text-sm text-muted-foreground">{review.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
