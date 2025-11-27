import mysql from 'mysql2/promise';

const connection = await mysql.createConnection({
  host: process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost',
  user: 'root',
  password: process.env.DATABASE_URL?.split(':')[1]?.split('@')[0] || '',
  database: process.env.DATABASE_URL?.split('/').pop() || 'test',
});

// 查詢食譜基本信息
const [recipes] = await connection.execute(
  'SELECT * FROM recipes WHERE id = ?',
  [90011]
);
console.log('Recipe:', JSON.stringify(recipes, null, 2));

// 查詢食材
const [ingredients] = await connection.execute(
  'SELECT * FROM ingredients WHERE recipeId = ? ORDER BY `order`',
  [90011]
);
console.log('\nIngredients:', JSON.stringify(ingredients, null, 2));

// 查詢步驟
const [steps] = await connection.execute(
  'SELECT * FROM steps WHERE recipeId = ? ORDER BY stepNumber',
  [90011]
);
console.log('\nSteps:', JSON.stringify(steps, null, 2));

await connection.end();
