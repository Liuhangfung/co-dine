import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, Lightbulb } from "lucide-react";

interface SuggestionDialogProps {
  recipeId: number;
  currentNutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
}

export function SuggestionDialog({ recipeId, currentNutrition }: SuggestionDialogProps) {
  const [open, setOpen] = useState(false);
  const [suggestionType, setSuggestionType] = useState<string>("calories");
  const [suggestionText, setSuggestionText] = useState("");
  const [targetCalories, setTargetCalories] = useState<number | undefined>();
  const [targetProtein, setTargetProtein] = useState<number | undefined>();
  const [targetCarbs, setTargetCarbs] = useState<number | undefined>();
  const [targetFat, setTargetFat] = useState<number | undefined>();

  const createSuggestion = trpc.suggestions.create.useMutation({
    onSuccess: (data) => {
      toast.success("建議已提交!");
      setOpen(false);
      // 自動處理建議
      processSuggestion.mutate({ suggestionId: data.suggestionId });
    },
    onError: (error) => {
      toast.error(`提交失敗: ${error.message}`);
    },
  });

  const processSuggestion = trpc.suggestions.process.useMutation({
    onSuccess: (data) => {
      toast.success("AI已生成改良方案!");
      // 重新加載頁面以顯示建議
      window.location.reload();
    },
    onError: (error) => {
      toast.error(`處理失敗: ${error.message}`);
    },
  });

  const handleSubmit = () => {
    if (!suggestionText.trim()) {
      toast.error("請輸入建議內容");
      return;
    }

    createSuggestion.mutate({
      recipeId,
      suggestionType: suggestionType as any,
      suggestionText,
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
    });
  };

  const isProcessing = createSuggestion.isPending || processSuggestion.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <Lightbulb className="mr-2 h-5 w-5" />
          提出改良建議
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>提出改良建議</DialogTitle>
          <DialogDescription>
            告訴我們您希望如何改良這個食譜,AI將為您提供專業的改良方案
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 建議類型 */}
          <div className="space-y-2">
            <Label htmlFor="type">建議類型</Label>
            <Select value={suggestionType} onValueChange={setSuggestionType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calories">降低卡路里</SelectItem>
                <SelectItem value="nutrition">改善營養平衡</SelectItem>
                <SelectItem value="taste">提升口味</SelectItem>
                <SelectItem value="method">簡化烹飪方法</SelectItem>
                <SelectItem value="other">其他</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 目標營養值 */}
          {(suggestionType === "calories" || suggestionType === "nutrition") && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetCalories">
                  目標卡路里 (當前: {currentNutrition?.calories || "未知"})
                </Label>
                <Input
                  id="targetCalories"
                  type="number"
                  placeholder="例如: 400"
                  value={targetCalories || ""}
                  onChange={(e) => setTargetCalories(parseInt(e.target.value) || undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetProtein">
                  目標蛋白質(g) (當前: {currentNutrition?.protein || "未知"})
                </Label>
                <Input
                  id="targetProtein"
                  type="number"
                  placeholder="例如: 30"
                  value={targetProtein || ""}
                  onChange={(e) => setTargetProtein(parseInt(e.target.value) || undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetCarbs">
                  目標碳水(g) (當前: {currentNutrition?.carbs || "未知"})
                </Label>
                <Input
                  id="targetCarbs"
                  type="number"
                  placeholder="例如: 50"
                  value={targetCarbs || ""}
                  onChange={(e) => setTargetCarbs(parseInt(e.target.value) || undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetFat">
                  目標脂肪(g) (當前: {currentNutrition?.fat || "未知"})
                </Label>
                <Input
                  id="targetFat"
                  type="number"
                  placeholder="例如: 15"
                  value={targetFat || ""}
                  onChange={(e) => setTargetFat(parseInt(e.target.value) || undefined)}
                />
              </div>
            </div>
          )}

          {/* 詳細建議 */}
          <div className="space-y-2">
            <Label htmlFor="suggestion">詳細說明您的建議 *</Label>
            <Textarea
              id="suggestion"
              placeholder="例如: 我希望降低卡路里到400以下,同時保持蛋白質含量..."
              rows={4}
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              disabled={isProcessing}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isProcessing}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                處理中...
              </>
            ) : (
              "提交建議"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
