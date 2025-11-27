import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { toast } from "sonner";
import { Loader2, Link as LinkIcon, PenTool } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function NewRecipe() {
  const [, setLocation] = useLocation();
  const params = useParams<{ method?: string }>();
  const search = useSearch();
  const [activeTab, setActiveTab] = useState<string>("weblink");

  // 根據URL參數設置初始tab(支援路徑參數和查詢參數)
  useEffect(() => {
    const methodMap: Record<string, string> = {
      'weblink': 'weblink',
      'manual': 'manual'
    };
    
    // 優先使用路徑參數
    if (params.method) {
      const tab = methodMap[params.method] || 'weblink';
      setActiveTab(tab);
    } else {
      // 其次使用查詢參數
      const searchParams = new URLSearchParams(search);
      const methodParam = searchParams.get('method');
      if (methodParam) {
        const tab = methodMap[methodParam] || 'weblink';
        setActiveTab(tab);
      }
    }
  }, [params.method, search]);

  // Weblink state
  const [weblinkUrl, setWeblinkUrl] = useState("");

  // Manual state
  const [manualData, setManualData] = useState({
    title: "",
    description: "",
    servings: 1,
    ingredients: [{ name: "", amount: "", unit: "", notes: "" }],
    steps: [{ instruction: "", duration: 0, temperature: "", tips: "" }],
  });

  const createFromWeblink = trpc.recipes.createFromWeblink.useMutation({
    onSuccess: (data) => {
      toast.success("食譜創建成功!");
      setLocation(`/recipes/${data.recipeId}`);
    },
    onError: (error) => {
      const errorMsg = error.message;
      
      // 分離錯誤標題和建議（如果有換行符）
      const parts = errorMsg.split('\n\n');
      const mainError = parts[0];
      const suggestions = parts.length > 1 ? parts.slice(1).join('\n') : null;
      
      if (errorMsg.includes('影片') || errorMsg.includes('小紅書') || errorMsg.includes('抖音')) {
        toast.error(
          mainError,
          {
            description: suggestions || "請嘗試使用手動輸入方式",
            duration: 8000
          }
        );
      } else if (errorMsg.includes('無法訪問') || errorMsg.includes('需要登入') || errorMsg.includes('內容不足')) {
        toast.error(
          mainError,
          {
            description: suggestions || "請嘗試使用手動輸入方式",
            duration: 6000
          }
        );
      } else {
        toast.error(`創建失敗: ${errorMsg}`, { duration: 5000 });
      }
    },
  });

  const createManual = trpc.recipes.createManual.useMutation({
    onSuccess: (data) => {
      toast.success("食譜創建成功!");
      setLocation(`/recipes/${data.recipeId}`);
    },
    onError: (error) => {
      toast.error(`創建失敗: ${error.message}`);
    },
  });

  const handleWeblinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!weblinkUrl) {
      toast.error("請輸入網址");
      return;
    }
    createFromWeblink.mutate({ url: weblinkUrl });
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualData.title) {
      toast.error("請輸入食譜名稱");
      return;
    }
    createManual.mutate(manualData);
  };

  const addIngredient = () => {
    setManualData({
      ...manualData,
      ingredients: [...manualData.ingredients, { name: "", amount: "", unit: "", notes: "" }],
    });
  };

  const removeIngredient = (index: number) => {
    setManualData({
      ...manualData,
      ingredients: manualData.ingredients.filter((_, i) => i !== index),
    });
  };

  const updateIngredient = (index: number, field: string, value: string) => {
    const newIngredients = [...manualData.ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setManualData({ ...manualData, ingredients: newIngredients });
  };

  const addStep = () => {
    setManualData({
      ...manualData,
      steps: [...manualData.steps, { instruction: "", duration: 0, temperature: "", tips: "" }],
    });
  };

  const removeStep = (index: number) => {
    setManualData({
      ...manualData,
      steps: manualData.steps.filter((_, i) => i !== index),
    });
  };

  const updateStep = (index: number, field: string, value: string | number) => {
    const newSteps = [...manualData.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setManualData({ ...manualData, steps: newSteps });
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">新增食譜</h1>
          <p className="text-gray-600 mt-1">選擇輸入方式創建新食譜</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="weblink">
              <LinkIcon className="mr-2 h-4 w-4" />
              網址連結
            </TabsTrigger>
            <TabsTrigger value="manual">
              <PenTool className="mr-2 h-4 w-4" />
              手動輸入
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weblink">
            <Card>
              <CardHeader>
                <CardTitle>從網址導入</CardTitle>
                <CardDescription>
                  貼上食譜網址,AI將自動提取所有資訊
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                  <p className="font-medium mb-1">⚠️ 注意事項:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>某些網站(如小紅書、Instagram)需要登入才能訪問</li>
                    <li>如果網址分析失敗,請使用手動輸入</li>
                    <li>建議使用公開的食譜網站連結</li>
                  </ul>
                </div>
                <form onSubmit={handleWeblinkSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="url">食譜網址</Label>
                    <Input
                      id="url"
                      type="url"
                      placeholder="https://example.com/recipe"
                      value={weblinkUrl}
                      onChange={(e) => setWeblinkUrl(e.target.value)}
                      disabled={createFromWeblink.isPending}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={createFromWeblink.isPending}
                    className="w-full"
                  >
                    {createFromWeblink.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        分析中...
                      </>
                    ) : (
                      "開始分析"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual">
            <Card>
              <CardHeader>
                <CardTitle>手動輸入</CardTitle>
                <CardDescription>
                  完全自定義食譜的所有細節
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleManualSubmit} className="space-y-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">食譜名稱 *</Label>
                      <Input
                        id="title"
                        value={manualData.title}
                        onChange={(e) => setManualData({ ...manualData, title: e.target.value })}
                        placeholder="例如: 清蒸石斑魚"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">描述</Label>
                      <Textarea
                        id="description"
                        value={manualData.description}
                        onChange={(e) => setManualData({ ...manualData, description: e.target.value })}
                        placeholder="簡單描述這道菜..."
                        rows={3}
                      />
                    </div>
                    <div>
                      <Label htmlFor="servings">份量</Label>
                      <Input
                        id="servings"
                        type="number"
                        min="1"
                        value={manualData.servings}
                        onChange={(e) => setManualData({ ...manualData, servings: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>食材</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                        + 添加食材
                      </Button>
                    </div>
                    {manualData.ingredients.map((ing, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4">
                          <Input
                            placeholder="食材名稱"
                            value={ing.name}
                            onChange={(e) => updateIngredient(index, "name", e.target.value)}
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            placeholder="份量"
                            value={ing.amount}
                            onChange={(e) => updateIngredient(index, "amount", e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            placeholder="單位"
                            value={ing.unit}
                            onChange={(e) => updateIngredient(index, "unit", e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            placeholder="備註"
                            value={ing.notes}
                            onChange={(e) => updateIngredient(index, "notes", e.target.value)}
                          />
                        </div>
                        <div className="col-span-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeIngredient(index)}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Steps */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>烹飪步驟</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addStep}>
                        + 添加步驟
                      </Button>
                    </div>
                    {manualData.steps.map((step, index) => (
                      <div key={index} className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <Label>步驟 {index + 1}</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStep(index)}
                          >
                            刪除
                          </Button>
                        </div>
                        <Textarea
                          placeholder="詳細說明這個步驟..."
                          value={step.instruction}
                          onChange={(e) => updateStep(index, "instruction", e.target.value)}
                          rows={2}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">時間(分鐘)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={step.duration || ""}
                              onChange={(e) => updateStep(index, "duration", parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">溫度</Label>
                            <Input
                              placeholder="例如: 180°C"
                              value={step.temperature}
                              onChange={(e) => updateStep(index, "temperature", e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">小貼士</Label>
                          <Input
                            placeholder="額外提示..."
                            value={step.tips}
                            onChange={(e) => updateStep(index, "tips", e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="submit"
                    disabled={createManual.isPending}
                    className="w-full"
                  >
                    {createManual.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        創建中...
                      </>
                    ) : (
                      "創建食譜"
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
