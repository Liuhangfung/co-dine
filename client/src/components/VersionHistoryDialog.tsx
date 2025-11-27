import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, RotateCcw, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface VersionHistoryDialogProps {
  recipeId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreSuccess?: () => void;
}

export function VersionHistoryDialog({
  recipeId,
  open,
  onOpenChange,
  onRestoreSuccess,
}: VersionHistoryDialogProps) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // 獲取版本歷史列表
  const { data: versions, isLoading } = trpc.versions.list.useQuery(
    { recipeId },
    { enabled: open }
  );

  // 還原版本mutation
  const restoreMutation = trpc.versions.restore.useMutation({
    onSuccess: () => {
      toast.success("已成功還原到選定版本");
      utils.recipes.getById.invalidate({ id: recipeId });
      utils.versions.list.invalidate({ recipeId });
      setShowRestoreConfirm(false);
      onOpenChange(false);
      onRestoreSuccess?.();
    },
    onError: (error) => {
      toast.error(`還原失敗: ${error.message}`);
    },
  });

  const handleRestore = () => {
    if (selectedVersion) {
      restoreMutation.mutate({ versionId: selectedVersion });
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString("zh-HK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>版本歷史</DialogTitle>
            <DialogDescription>
              查看食譜的所有修改記錄,並可以還原到任何過去的版本
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[500px] pr-4">
            {isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                載入中...
              </div>
            )}

            {!isLoading && (!versions || versions.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                暫無版本歷史記錄
              </div>
            )}

            {versions && versions.length > 0 && (
              <div className="space-y-3">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            版本 {version.versionNumber}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {formatDate(version.createdAt)}
                          </span>
                        </div>

                        {version.changeDescription && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {version.changeDescription}
                          </p>
                        )}

                        {version.changedFields &&
                          version.changedFields.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {version.changedFields.map(
                                (field: string, idx: number) => (
                                  <span
                                    key={idx}
                                    className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                                  >
                                    {field}
                                  </span>
                                )
                              )}
                            </div>
                          )}

                        {/* 展開/收起詳細資訊 */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() =>
                            setExpandedVersion(
                              expandedVersion === version.id ? null : version.id
                            )
                          }
                        >
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${
                              expandedVersion === version.id ? "rotate-90" : ""
                            }`}
                          />
                          {expandedVersion === version.id
                            ? "隱藏詳情"
                            : "查看詳情"}
                        </Button>

                        {expandedVersion === version.id && (
                          <div className="mt-3 p-3 bg-muted rounded text-sm space-y-2">
                            <div>
                              <strong>食譜名稱:</strong>{" "}
                              {version.snapshotData.recipe.title}
                            </div>
                            <div>
                              <strong>描述:</strong>{" "}
                              {version.snapshotData.recipe.description ||
                                "無"}
                            </div>
                            <div>
                              <strong>份量:</strong>{" "}
                              {version.snapshotData.recipe.servings}
                            </div>
                            <div>
                              <strong>食材數量:</strong>{" "}
                              {version.snapshotData.ingredients.length}
                            </div>
                            <div>
                              <strong>步驟數量:</strong>{" "}
                              {version.snapshotData.steps.length}
                            </div>
                            <div>
                              <strong>分類數量:</strong>{" "}
                              {version.snapshotData.categories.length}
                            </div>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedVersion(version.id);
                          setShowRestoreConfirm(true);
                        }}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        還原
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 還原確認對話框 */}
      <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認還原版本</AlertDialogTitle>
            <AlertDialogDescription>
              此操作將把食譜還原到選定的版本。當前狀態會被保存為新的版本記錄。
              <br />
              <br />
              您確定要繼續嗎?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? "還原中..." : "確認還原"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
