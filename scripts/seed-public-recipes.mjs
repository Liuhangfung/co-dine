import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);
const db = drizzle(connection);

// 獲取第一個用戶ID
const usersResult = await connection.query("SELECT id FROM users LIMIT 1");
const userId = usersResult[0][0]?.id;

if (!userId) {
  console.error("No users found in database");
  process.exit(1);
}

console.log(`Using user ID: ${userId}`);

// 創建一些公開的測試食譜
const recipes = [
  {
    userId,
    title: "健康烤雞胸配蔬菜",
    description: "低脂高蛋白的健康主菜,適合健身人士",
    inputMethod: "manual",
    totalCalories: 350,
    servings: 2,
    caloriesPerServing: 175,
    protein: 45,
    carbs: 20,
    fat: 8,
    fiber: 5,
    isPublished: true,
  },
  {
    userId,
    title: "三文魚牛油果沙拉",
    description: "富含Omega-3的營養沙拉",
    inputMethod: "manual",
    totalCalories: 420,
    servings: 1,
    caloriesPerServing: 420,
    protein: 35,
    carbs: 15,
    fat: 28,
    fiber: 8,
    isPublished: true,
  },
  {
    userId,
    title: "清蒸鱸魚",
    description: "傳統中式蒸魚,保留食材原味",
    inputMethod: "manual",
    totalCalories: 280,
    servings: 3,
    caloriesPerServing: 93,
    protein: 40,
    carbs: 5,
    fat: 12,
    fiber: 2,
    isPublished: true,
  },
  {
    userId,
    title: "藜麥蔬菜碗",
    description: "素食高蛋白選擇,營養均衡",
    inputMethod: "manual",
    totalCalories: 380,
    servings: 2,
    caloriesPerServing: 190,
    protein: 18,
    carbs: 55,
    fat: 10,
    fiber: 12,
    isPublished: true,
  },
];

for (const recipe of recipes) {
  const result = await connection.query(
    `INSERT INTO recipes (userId, title, description, inputMethod, totalCalories, servings, caloriesPerServing, protein, carbs, fat, fiber, isPublished, createdAt, updatedAt) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      recipe.userId,
      recipe.title,
      recipe.description,
      recipe.inputMethod,
      recipe.totalCalories,
      recipe.servings,
      recipe.caloriesPerServing,
      recipe.protein,
      recipe.carbs,
      recipe.fat,
      recipe.fiber,
      recipe.isPublished,
    ]
  );
  console.log(`Created recipe: ${recipe.title} (ID: ${result[0].insertId})`);
}

// 創建一些分類
const categories = [
  { name: "雞肉", type: "ingredient", description: "雞肉類食譜" },
  { name: "海鮮", type: "ingredient", description: "海鮮類食譜" },
  { name: "素食", type: "ingredient", description: "素食食譜" },
  { name: "中菜", type: "cuisine", description: "中式菜系" },
  { name: "西菜", type: "cuisine", description: "西式菜系" },
  { name: "蒸", type: "method", description: "蒸煮方式" },
  { name: "烤", type: "method", description: "烘烤方式" },
  { name: "低卡", type: "health", description: "低卡路里" },
  { name: "高蛋白", type: "health", description: "高蛋白質" },
];

const categoryIds = {};
for (const cat of categories) {
  const result = await connection.query(
    `INSERT INTO categories (name, type, description, createdAt) VALUES (?, ?, ?, NOW())`,
    [cat.name, cat.type, cat.description]
  );
  categoryIds[cat.name] = result[0].insertId;
  console.log(`Created category: ${cat.name} (ID: ${result[0].insertId})`);
}

// 為食譜添加分類
const recipeCategories = [
  { recipeTitle: "健康烤雞胸配蔬菜", categories: ["雞肉", "西菜", "烤", "低卡", "高蛋白"] },
  { recipeTitle: "三文魚牛油果沙拉", categories: ["海鮮", "西菜", "高蛋白"] },
  { recipeTitle: "清蒸鱸魚", categories: ["海鮮", "中菜", "蒸", "低卡", "高蛋白"] },
  { recipeTitle: "藜麥蔬菜碗", categories: ["素食", "西菜", "高蛋白"] },
];

for (const rc of recipeCategories) {
  const recipeResult = await connection.query(
    "SELECT id FROM recipes WHERE title = ? LIMIT 1",
    [rc.recipeTitle]
  );
  const recipeId = recipeResult[0][0]?.id;
  
  if (recipeId) {
    for (const catName of rc.categories) {
      const catId = categoryIds[catName];
      if (catId) {
        await connection.query(
          "INSERT INTO recipeCategories (recipeId, categoryId) VALUES (?, ?)",
          [recipeId, catId]
        );
        console.log(`Added category ${catName} to recipe ${rc.recipeTitle}`);
      }
    }
  }
}

await connection.end();
console.log("Seed data created successfully!");
