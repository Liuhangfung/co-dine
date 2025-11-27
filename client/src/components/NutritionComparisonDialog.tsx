import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingDown, TrendingUp, BarChart3, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { useState } from "react";

interface NutritionData {
  totalCalories: number | null;
  caloriesPerServing: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
}

interface NutritionComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldNutrition: NutritionData;
  newNutrition: NutritionData;
}

export function NutritionComparisonDialog({
  open,
  onOpenChange,
  oldNutrition,
  newNutrition,
}: NutritionComparisonDialogProps) {
  const [viewMode, setViewMode] = useState<"table" | "bar" | "radar">("table");
  const calculateChange = (oldValue: number | null, newValue: number | null) => {
    if (oldValue === null || newValue === null) return null;
    const diff = newValue - oldValue;
    const percentage = oldValue !== 0 ? ((diff / oldValue) * 100).toFixed(1) : "N/A";
    return { diff, percentage };
  };

  const renderComparison = (
    label: string,
    oldValue: number | null,
    newValue: number | null,
    unit: string
  ) => {
    const change = calculateChange(oldValue, newValue);
    const isIncrease = change && change.diff > 0;
    const isDecrease = change && change.diff < 0;

    return (
      <div className="flex items-center justify-between py-3 border-b last:border-b-0">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              {oldValue !== null ? `${oldValue}${unit}` : "未設定"}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
          <div className="text-right min-w-[80px]">
            <p className="text-sm font-semibold">
              {newValue !== null ? `${newValue}${unit}` : "未設定"}
            </p>
            {change && change.diff !== 0 && (
              <div className="flex items-center gap-1 justify-end mt-1">
                {isIncrease && <TrendingUp className="w-3 h-3 text-red-500" />}
                {isDecrease && <TrendingDown className="w-3 h-3 text-green-500" />}
                <span
                  className={`text-xs ${
                    isIncrease ? "text-red-500" : "text-green-500"
                  }`}
                >
                  {isIncrease ? "+" : ""}
                  {change.diff}{unit}
                  {change.percentage !== "N/A" && ` (${change.percentage}%)`}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 準備圖表數據
  const chartData = [
    {
      name: "總卡路里",
      "修改前": oldNutrition.totalCalories || 0,
      "修改後": newNutrition.totalCalories || 0,
    },
    {
      name: "蛋白質",
      "修改前": oldNutrition.protein || 0,
      "修改後": newNutrition.protein || 0,
    },
    {
      name: "碳水化合物",
      "修改前": oldNutrition.carbs || 0,
      "修改後": newNutrition.carbs || 0,
    },
    {
      name: "脂肪",
      "修改前": oldNutrition.fat || 0,
      "修改後": newNutrition.fat || 0,
    },
    {
      name: "纖維",
      "修改前": oldNutrition.fiber || 0,
      "修改後": newNutrition.fiber || 0,
    },
  ];

  // 雷達圖數據（正規化到 0-100 範圍）
  const radarData = [
    {
      subject: "卡路里",
      "修改前": Math.min(((oldNutrition.totalCalories || 0) / 1000) * 100, 100),
      "修改後": Math.min(((newNutrition.totalCalories || 0) / 1000) * 100, 100),
    },
    {
      subject: "蛋白質",
      "修改前": Math.min(((oldNutrition.protein || 0) / 50) * 100, 100),
      "修改後": Math.min(((newNutrition.protein || 0) / 50) * 100, 100),
    },
    {
      subject: "碳水",
      "修改前": Math.min(((oldNutrition.carbs || 0) / 100) * 100, 100),
      "修改後": Math.min(((newNutrition.carbs || 0) / 100) * 100, 100),
    },
    {
      subject: "脂肪",
      "修改前": Math.min(((oldNutrition.fat || 0) / 50) * 100, 100),
      "修改後": Math.min(((newNutrition.fat || 0) / 50) * 100, 100),
    },
    {
      subject: "纖維",
      "修改前": Math.min(((oldNutrition.fiber || 0) / 20) * 100, 100),
      "修改後": Math.min(((newNutrition.fiber || 0) / 20) * 100, 100),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>營養成分變更對比</DialogTitle>
          <p className="text-sm text-muted-foreground">
            以下是修改前後的營養成分對比
          </p>
        </DialogHeader>

        {/* 視圖切換按鈕 */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            表格視圖
          </Button>
          <Button
            variant={viewMode === "bar" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("bar")}
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            柱狀圖
          </Button>
          <Button
            variant={viewMode === "radar" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("radar")}
          >
            <Activity className="w-4 h-4 mr-1" />
            雷達圖
          </Button>
        </div>

        {/* 表格視圖 */}
        {viewMode === "table" && (
          <div className="space-y-1 mt-4">
          {renderComparison(
            "總卡路里",
            oldNutrition.totalCalories,
            newNutrition.totalCalories,
            " kcal"
          )}
          {renderComparison(
            "每份卡路里",
            oldNutrition.caloriesPerServing,
            newNutrition.caloriesPerServing,
            " kcal"
          )}
          {renderComparison(
            "蛋白質",
            oldNutrition.protein,
            newNutrition.protein,
            "g"
          )}
          {renderComparison(
            "碳水化合物",
            oldNutrition.carbs,
            newNutrition.carbs,
            "g"
          )}
          {renderComparison(
            "脂肪",
            oldNutrition.fat,
            newNutrition.fat,
            "g"
          )}
          {renderComparison(
            "纖維",
            oldNutrition.fiber,
            newNutrition.fiber,
            "g"
          )}
          </div>
        )}

        {/* 柱狀圖視圖 */}
        {viewMode === "bar" && (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="修改前" fill="#94a3b8" />
                <Bar dataKey="修改後" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 雷達圖視圖 */}
        {viewMode === "radar" && (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" />
                <PolarRadiusAxis angle={90} domain={[0, 100]} />
                <Radar
                  name="修改前"
                  dataKey="修改前"
                  stroke="#94a3b8"
                  fill="#94a3b8"
                  fillOpacity={0.6}
                />
                <Radar
                  name="修改後"
                  dataKey="修改後"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground text-center mt-2">
              注：圖表數據已正規化到 0-100 範圍以便比較
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button onClick={() => onOpenChange(false)}>
            關閉
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
