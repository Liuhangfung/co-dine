import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { GitCompare, X } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export function CompareFloatingButton() {
  const [compareList, setCompareList] = useState<number[]>([]);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // 初始化對比列表
    const list = JSON.parse(localStorage.getItem("compareList") || "[]");
    setCompareList(list);

    // 監聽對比列表更新事件
    const handleUpdate = () => {
      const updatedList = JSON.parse(localStorage.getItem("compareList") || "[]");
      setCompareList(updatedList);
    };

    window.addEventListener("compareListUpdated", handleUpdate);
    return () => window.removeEventListener("compareListUpdated", handleUpdate);
  }, []);

  const handleClearList = () => {
    localStorage.removeItem("compareList");
    setCompareList([]);
    toast.success("對比列表已清空");
  };

  const handleCompare = () => {
    if (compareList.length < 2) {
      toast.error("請至少選擇 2 個食譜進行對比");
      return;
    }
    setLocation(`/recipes/compare/${compareList.join(",")}`);
  };

  if (compareList.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">
              對比列表 ({compareList.length}/4)
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearList}
            className="h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleCompare}
            disabled={compareList.length < 2}
            className="flex-1"
          >
            查看對比
          </Button>
        </div>
      </div>
    </div>
  );
}
