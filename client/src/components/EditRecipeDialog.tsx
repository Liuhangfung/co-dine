import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Save } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { NutritionComparisonDialog } from "./NutritionComparisonDialog";

interface Recipe {
  id: number;
  title: string;
  description: string | null;
  servings: number;
  difficulty?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  totalTime?: number | null;
  requiredEquipment?: string | string[] | null;
  totalCalories: number | null;
  caloriesPerServing: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  isPublished: boolean;
}

interface Ingredient {
  id: number;
  name: string;
  amount: string | null;
  unit: string | null;
  calories: number | null;
  notes: string | null;
  order: number;
}

interface CookingStep {
  id: number;
  instruction: string;
  duration: number | null;
  temperature: string | null;
  tips: string | null;
  order: number;
}

interface Category {
  id: number;
  name: string;
}

interface EditRecipeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe: Recipe;
  ingredients: Ingredient[];
  steps: CookingStep[];
  categories: Category[];
  selectedCategoryIds: number[];
  onSuccess: () => void;
}

export function EditRecipeDialog({
  open,
  onOpenChange,
  recipe,
  ingredients,
  steps,
  categories,
  selectedCategoryIds,
  onSuccess,
}: EditRecipeDialogProps) {
  const [basicInfo, setBasicInfo] = useState({
    title: recipe.title,
    description: recipe.description || "",
    servings: recipe.servings,
    difficulty: recipe.difficulty || undefined,
    prepTime: recipe.prepTime || undefined,
    cookTime: recipe.cookTime || undefined,
    totalTime: recipe.totalTime || undefined,
    requiredEquipment: (
      Array.isArray(recipe.requiredEquipment)
        ? recipe.requiredEquipment
        : recipe.requiredEquipment
        ? JSON.parse(recipe.requiredEquipment)
        : undefined
    ) as string[] | undefined,
    isPublished: recipe.isPublished,
  });

  const [nutrition, setNutrition] = useState({
    totalCalories: recipe.totalCalories || 0,
    caloriesPerServing: recipe.caloriesPerServing || 0,
    protein: recipe.protein || 0,
    carbs: recipe.carbs || 0,
    fat: recipe.fat || 0,
    fiber: recipe.fiber || 0,
  });

  const [editedIngredients, setEditedIngredients] = useState<Ingredient[]>([]);
  const [editedSteps, setEditedSteps] = useState<CookingStep[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [nutritionComparison, setNutritionComparison] = useState<{
    old: any;
    new: any;
  } | null>(null);

  useEffect(() => {
    setBasicInfo({
      title: recipe.title,
      description: recipe.description || "",
      servings: recipe.servings,
      difficulty: recipe.difficulty || undefined,
      prepTime: recipe.prepTime || undefined,
      cookTime: recipe.cookTime || undefined,
      totalTime: recipe.totalTime || undefined,
      requiredEquipment: (
        Array.isArray(recipe.requiredEquipment)
          ? recipe.requiredEquipment
          : recipe.requiredEquipment
          ? JSON.parse(recipe.requiredEquipment)
          : undefined
      ) as string[] | undefined,
      isPublished: recipe.isPublished,
    });
    setNutrition({
      totalCalories: recipe.totalCalories || 0,
      caloriesPerServing: recipe.caloriesPerServing || 0,
      protein: recipe.protein || 0,
      carbs: recipe.carbs || 0,
      fat: recipe.fat || 0,
      fiber: recipe.fiber || 0,
    });
    setEditedIngredients(ingredients);
    setEditedSteps(steps);
    setSelectedCategories(selectedCategoryIds);
  }, [recipe, ingredients, steps, selectedCategoryIds]);

  const updateRecipeMutation = trpc.recipes.update.useMutation();
  const updateIngredientMutation = trpc.recipes.updateIngredient.useMutation();
  const updateStepMutation = trpc.recipes.updateCookingStep.useMutation();
  const updateCategoriesMutation = trpc.recipes.updateCategories.useMutation();
  const recalculateNutritionMutation = (trpc.recipes as any).recalculateNutrition.useMutation();

  // 檢測食材是否有變更
  const hasIngredientsChanged = () => {
    if (editedIngredients.length !== ingredients.length) return true;
    
    for (let i = 0; i < editedIngredients.length; i++) {
      const edited = editedIngredients[i];
      const original = ingredients.find(ing => ing.id === edited.id);
      
      if (!original) return true;
      if (edited.name !== original.name) return true;
      if (edited.amount !== original.amount) return true;
      if (edited.unit !== original.unit) return true;
    }
    
    return false;
  };

  const handleSave = async () => {
    try {
      // 檢測食材是否有變更
      const ingredientsChanged = hasIngredientsChanged();
      
      // 保存修改前的營養數據以便後續對比
      const oldNutrition = {
        totalCalories: recipe.totalCalories,
        caloriesPerServing: recipe.caloriesPerServing,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        fiber: recipe.fiber,
      };
      // 更新基本資訊和營養資訊
      await updateRecipeMutation.mutateAsync({
        id: recipe.id,
        title: basicInfo.title,
        description: basicInfo.description,
        servings: basicInfo.servings,
        difficulty: basicInfo.difficulty as "簡單" | "中等" | "困難" | undefined,
        prepTime: basicInfo.prepTime,
        cookTime: basicInfo.cookTime,
        totalTime: basicInfo.totalTime,
        requiredEquipment: basicInfo.requiredEquipment,
        isPublished: basicInfo.isPublished,
        totalCalories: nutrition.totalCalories,
        caloriesPerServing: nutrition.caloriesPerServing,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        fiber: nutrition.fiber,
      });

      // 更新食材
      for (const ingredient of editedIngredients) {
        await updateIngredientMutation.mutateAsync({
          id: ingredient.id,
          name: ingredient.name,
          amount: ingredient.amount || undefined,
          unit: ingredient.unit || undefined,
          calories: ingredient.calories || undefined,
          notes: ingredient.notes || undefined,
          order: ingredient.order,
        });
      }

      // 更新步驟
      for (const step of editedSteps) {
        await updateStepMutation.mutateAsync({
          id: step.id,
          instruction: step.instruction,
          duration: step.duration || undefined,
          temperature: step.temperature || undefined,
          tips: step.tips || undefined,
          order: step.order,
        });
      }

      // 更新分類
      await updateCategoriesMutation.mutateAsync({
        recipeId: recipe.id,
        categoryIds: selectedCategories,
      });

      // 創建版本快照
      // 注意：這裡只是在前端記錄更新操作，實際的版本快照在後端創建
      // 後端會在每次更新後自動創建版本記錄

      // 如果食材有變更，自動重新計算營養成分
      if (ingredientsChanged) {
        try {
          const result = await recalculateNutritionMutation.mutateAsync({
            recipeId: recipe.id,
            servings: basicInfo.servings,
          });

          // 顯示對比對話框
          setNutritionComparison({
            old: oldNutrition,
            new: result.nutrition,
          });
          setShowComparison(true);
          
          toast.success("食譜已更新，營養成分已重新計算");
        } catch (error) {
          toast.error("營養成分計算失敗: " + (error as Error).message);
        }
      } else {
        toast.success("食譜已更新");
      }
      
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error("更新失敗: " + (error as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯食譜</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">基本資訊</TabsTrigger>
            <TabsTrigger value="ingredients">食材</TabsTrigger>
            <TabsTrigger value="steps">步驟</TabsTrigger>
            <TabsTrigger value="categories">分類</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">食譜名稱</Label>
              <Input
                id="title"
                value={basicInfo.title}
                onChange={(e) => setBasicInfo({ ...basicInfo, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={basicInfo.description}
                onChange={(e) => setBasicInfo({ ...basicInfo, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="servings">份量</Label>
              <Input
                id="servings"
                type="number"
                value={basicInfo.servings}
                onChange={(e) => setBasicInfo({ ...basicInfo, servings: parseInt(e.target.value) })}
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">烹飪信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="difficulty">難度等級</Label>
                  <select
                    id="difficulty"
                    value={basicInfo.difficulty || ""}
                    onChange={(e) => setBasicInfo({ ...basicInfo, difficulty: (e.target.value as "簡單" | "中等" | "困難") || undefined })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">未設置</option>
                    <option value="簡單">簡單</option>
                    <option value="中等">中等</option>
                    <option value="困難">困難</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prepTime">準備時間(分鐘)</Label>
                  <Input
                    id="prepTime"
                    type="number"
                    value={basicInfo.prepTime || ""}
                    onChange={(e) => setBasicInfo({ ...basicInfo, prepTime: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cookTime">烹飪時間(分鐘)</Label>
                  <Input
                    id="cookTime"
                    type="number"
                    value={basicInfo.cookTime || ""}
                    onChange={(e) => setBasicInfo({ ...basicInfo, cookTime: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalTime">總時間(分鐘)</Label>
                  <Input
                    id="totalTime"
                    type="number"
                    value={basicInfo.totalTime || ""}
                    onChange={(e) => setBasicInfo({ ...basicInfo, totalTime: e.target.value ? parseInt(e.target.value) : undefined })}
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="equipment">所需廚具(以逗號分隔)</Label>
                <Textarea
                  id="equipment"
                  value={typeof basicInfo.requiredEquipment === "string" ? basicInfo.requiredEquipment : Array.isArray(basicInfo.requiredEquipment) ? basicInfo.requiredEquipment.join(", ") : ""}
                  onChange={(e) => setBasicInfo({ ...basicInfo, requiredEquipment: e.target.value ? e.target.value.split(",").map(s => s.trim()) : undefined })}
                  rows={2}
                  placeholder="例如: 鐵銅鍴, 木步, 切板"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="published"
                checked={basicInfo.isPublished}
                onCheckedChange={(checked) => setBasicInfo({ ...basicInfo, isPublished: checked as boolean })}
              />
              <Label htmlFor="published">公開發布</Label>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-4">營養資訊</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalCalories">總卡路里</Label>
                  <Input
                    id="totalCalories"
                    type="number"
                    value={nutrition.totalCalories}
                    onChange={(e) => setNutrition({ ...nutrition, totalCalories: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caloriesPerServing">每份卡路里</Label>
                  <Input
                    id="caloriesPerServing"
                    type="number"
                    value={nutrition.caloriesPerServing}
                    onChange={(e) => setNutrition({ ...nutrition, caloriesPerServing: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="protein">蛋白質 (g)</Label>
                  <Input
                    id="protein"
                    type="number"
                    value={nutrition.protein}
                    onChange={(e) => setNutrition({ ...nutrition, protein: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carbs">碳水化合物 (g)</Label>
                  <Input
                    id="carbs"
                    type="number"
                    value={nutrition.carbs}
                    onChange={(e) => setNutrition({ ...nutrition, carbs: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fat">脂肪 (g)</Label>
                  <Input
                    id="fat"
                    type="number"
                    value={nutrition.fat}
                    onChange={(e) => setNutrition({ ...nutrition, fat: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fiber">纖維 (g)</Label>
                  <Input
                    id="fiber"
                    type="number"
                    value={nutrition.fiber}
                    onChange={(e) => setNutrition({ ...nutrition, fiber: parseFloat(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ingredients" className="space-y-4">
            {editedIngredients.map((ingredient, index) => (
              <Card key={ingredient.id} className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>食材名稱</Label>
                    <Input
                      value={ingredient.name}
                      onChange={(e) => {
                        const updated = [...editedIngredients];
                        updated[index].name = e.target.value;
                        setEditedIngredients(updated);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>份量</Label>
                    <Input
                      value={ingredient.amount || ""}
                      onChange={(e) => {
                        const updated = [...editedIngredients];
                        updated[index].amount = e.target.value;
                        setEditedIngredients(updated);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>單位</Label>
                    <Input
                      value={ingredient.unit || ""}
                      onChange={(e) => {
                        const updated = [...editedIngredients];
                        updated[index].unit = e.target.value;
                        setEditedIngredients(updated);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>卡路里</Label>
                    <Input
                      type="number"
                      value={ingredient.calories || ""}
                      onChange={(e) => {
                        const updated = [...editedIngredients];
                        updated[index].calories = parseFloat(e.target.value) || null;
                        setEditedIngredients(updated);
                      }}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>備註</Label>
                    <Input
                      value={ingredient.notes || ""}
                      onChange={(e) => {
                        const updated = [...editedIngredients];
                        updated[index].notes = e.target.value;
                        setEditedIngredients(updated);
                      }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="steps" className="space-y-4">
            {editedSteps.map((step, index) => (
              <Card key={step.id} className="p-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>步驟 {index + 1}</Label>
                    <Textarea
                      value={step.instruction}
                      onChange={(e) => {
                        const updated = [...editedSteps];
                        updated[index].instruction = e.target.value;
                        setEditedSteps(updated);
                      }}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>時間 (分鐘)</Label>
                      <Input
                        type="number"
                        value={step.duration || ""}
                        onChange={(e) => {
                          const updated = [...editedSteps];
                          updated[index].duration = parseInt(e.target.value) || null;
                          setEditedSteps(updated);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>溫度</Label>
                      <Input
                        value={step.temperature || ""}
                        onChange={(e) => {
                          const updated = [...editedSteps];
                          updated[index].temperature = e.target.value;
                          setEditedSteps(updated);
                        }}
                      />
                    </div>
                    <div className="col-span-1"></div>
                  </div>
                  <div className="space-y-2">
                    <Label>提示</Label>
                    <Input
                      value={step.tips || ""}
                      onChange={(e) => {
                        const updated = [...editedSteps];
                        updated[index].tips = e.target.value;
                        setEditedSteps(updated);
                      }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category.id}`}
                    checked={selectedCategories.includes(category.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedCategories([...selectedCategories, category.id]);
                      } else {
                        setSelectedCategories(selectedCategories.filter((id) => id !== category.id));
                      }
                    }}
                  />
                  <Label htmlFor={`category-${category.id}`}>{category.name}</Label>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={updateRecipeMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            儲存變更
          </Button>
        </div>
      </DialogContent>

      {/* 營養對比對話框 */}
      {nutritionComparison && (
        <NutritionComparisonDialog
          open={showComparison}
          onOpenChange={setShowComparison}
          oldNutrition={nutritionComparison.old}
          newNutrition={nutritionComparison.new}
        />
      )}
    </Dialog>
  );
}
