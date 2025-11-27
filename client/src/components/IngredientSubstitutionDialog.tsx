import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface IngredientSubstitutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ingredientId: number;
  ingredientName: string;
  recipeId: number;
  onSubstituted?: () => void;
}

export default function IngredientSubstitutionDialog({
  open,
  onOpenChange,
  ingredientId,
  ingredientName,
  recipeId,
  onSubstituted,
}: IngredientSubstitutionDialogProps) {
  const [selectedSubstitution, setSelectedSubstitution] = useState<any>(null);

  const getSuggestions = trpc.ingredients.getSuggestions.useMutation({
    onError: (error) => {
      toast.error("無法獲取替換建議", {
        description: error.message,
      });
    },
  });

  const replaceIngredient = trpc.ingredients.replace.useMutation({
    onSuccess: () => {
      toast.success("食材已成功替換！", {
        description: "營養成分已重新計算",
      });
      onOpenChange(false);
      onSubstituted?.();
    },
    onError: (error) => {
      toast.error("替換失敗", {
        description: error.message,
      });
    },
  });

  // 當對話框打開時，自動獲取建議
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
    if (newOpen && !getSuggestions.data) {
      getSuggestions.mutate({ ingredientId, recipeId });
    }
  };

  const handleSubstitute = (substitution: any) => {
    replaceIngredient.mutate({
      ingredientId,
      recipeId,
      newName: substitution.name,
      newAmount: substitution.amount,
      newUnit: substitution.unit,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>🔄</span> 智能食材替換建議
          </DialogTitle>
          <DialogDescription>
            為「{ingredientName}」推薦營養相似的替換選項
          </DialogDescription>
        </DialogHeader>

        {getSuggestions.isPending && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            <span className="ml-3 text-gray-600">AI 正在分析並生成替換建議...</span>
          </div>
        )}

        {getSuggestions.data && (
          <div className="space-y-4">
            {/* 原食材信息 */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <p className="text-sm text-gray-600 mb-2">原食材</p>
                <p className="text-lg font-semibold text-blue-900">
                  {getSuggestions.data.originalIngredient.name}{" "}
                  <span className="text-sm font-normal text-gray-600">
                    {getSuggestions.data.originalIngredient.amount}{" "}
                    {getSuggestions.data.originalIngredient.unit}
                  </span>
                </p>
              </CardContent>
            </Card>

            {/* 替換選項 */}
            <div className="space-y-3">
              <p className="font-medium text-gray-700">推薦替換選項：</p>
              {getSuggestions.data.substitutions.map((sub: any, index: number) => (
                <Card
                  key={index}
                  className={`cursor-pointer transition-all ${
                    selectedSubstitution === sub
                      ? "ring-2 ring-green-500 bg-green-50"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedSubstitution(sub)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {sub.name}
                          </h3>
                          <span className="text-sm text-gray-600">
                            {sub.amount} {sub.unit}
                          </span>
                          {selectedSubstitution === sub && (
                            <Check className="w-5 h-5 text-green-600" />
                          )}
                        </div>

                        <p className="text-sm text-gray-700 mb-3">{sub.reason}</p>

                        {/* 健康益處標籤 */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          {sub.healthBenefits.map((benefit: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="bg-green-100 text-green-800">
                              {benefit}
                            </Badge>
                          ))}
                        </div>

                        {/* 營養成分 */}
                        <div className="grid grid-cols-4 gap-3 text-center bg-white p-3 rounded-lg">
                          <div>
                            <p className="text-xs text-gray-600">卡路里</p>
                            <p className="text-sm font-semibold text-orange-600">
                              {sub.nutrition.calories}
                            </p>
                            <p className="text-xs text-gray-500">kcal</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">蛋白質</p>
                            <p className="text-sm font-semibold text-blue-600">
                              {sub.nutrition.protein}
                            </p>
                            <p className="text-xs text-gray-500">g</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">碳水</p>
                            <p className="text-sm font-semibold text-yellow-600">
                              {sub.nutrition.carbs}
                            </p>
                            <p className="text-xs text-gray-500">g</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">脂肪</p>
                            <p className="text-sm font-semibold text-red-600">
                              {sub.nutrition.fat}
                            </p>
                            <p className="text-xs text-gray-500">g</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 操作按鈕 */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={replaceIngredient.isPending}
              >
                取消
              </Button>
              <Button
                onClick={() => selectedSubstitution && handleSubstitute(selectedSubstitution)}
                disabled={!selectedSubstitution || replaceIngredient.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {replaceIngredient.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    替換中...
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    確認替換
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
