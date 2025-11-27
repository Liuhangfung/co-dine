-- Supabase Database Initialization Script
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Create Enums
CREATE TYPE "role" AS ENUM ('user', 'admin');
CREATE TYPE "inputMethod" AS ENUM ('manual', 'image', 'weblink');
CREATE TYPE "difficulty" AS ENUM ('簡單', '中等', '困難');
CREATE TYPE "categoryType" AS ENUM ('ingredient', 'cuisine', 'method', 'health');
CREATE TYPE "suggestionType" AS ENUM ('nutrition', 'calories', 'taste', 'method', 'other');
CREATE TYPE "suggestionStatus" AS ENUM ('pending', 'processed', 'applied');

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  "name" TEXT,
  "email" VARCHAR(320),
  "loginMethod" VARCHAR(64),
  "role" "role" NOT NULL DEFAULT 'user',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastSignedIn" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Recipes table
CREATE TABLE IF NOT EXISTS "recipes" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "inputMethod" "inputMethod" NOT NULL,
  "sourceUrl" TEXT,
  "imageUrl" TEXT,
  "videoUrl" TEXT,
  "totalCalories" INTEGER,
  "servings" INTEGER DEFAULT 1,
  "caloriesPerServing" INTEGER,
  "protein" INTEGER,
  "carbs" INTEGER,
  "fat" INTEGER,
  "fiber" INTEGER,
  "difficulty" "difficulty",
  "prepTime" INTEGER,
  "cookTime" INTEGER,
  "totalTime" INTEGER,
  "requiredEquipment" TEXT,
  "aiAnalysis" TEXT,
  "improvementSuggestions" TEXT,
  "machineInstructions" TEXT,
  "isPublished" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Ingredients table
CREATE TABLE IF NOT EXISTS "ingredients" (
  "id" SERIAL PRIMARY KEY,
  "recipeId" INTEGER NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "amount" VARCHAR(100),
  "unit" VARCHAR(50),
  "calories" INTEGER,
  "notes" TEXT,
  "order" INTEGER NOT NULL
);

-- Cooking Steps table
CREATE TABLE IF NOT EXISTS "cookingSteps" (
  "id" SERIAL PRIMARY KEY,
  "recipeId" INTEGER NOT NULL,
  "stepNumber" INTEGER NOT NULL,
  "instruction" TEXT NOT NULL,
  "duration" INTEGER,
  "temperature" VARCHAR(50),
  "imageUrl" TEXT,
  "tips" TEXT
);

-- Categories table
CREATE TABLE IF NOT EXISTS "categories" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL,
  "type" "categoryType" NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Recipe Categories junction table
CREATE TABLE IF NOT EXISTS "recipeCategories" (
  "id" SERIAL PRIMARY KEY,
  "recipeId" INTEGER NOT NULL,
  "categoryId" INTEGER NOT NULL
);

-- User Suggestions table
CREATE TABLE IF NOT EXISTS "userSuggestions" (
  "id" SERIAL PRIMARY KEY,
  "recipeId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "suggestionType" "suggestionType" NOT NULL,
  "targetCalories" INTEGER,
  "targetProtein" INTEGER,
  "targetCarbs" INTEGER,
  "targetFat" INTEGER,
  "suggestionText" TEXT NOT NULL,
  "aiResponse" TEXT,
  "improvedRecipeId" INTEGER,
  "improvedCalories" INTEGER,
  "improvedProtein" INTEGER,
  "improvedCarbs" INTEGER,
  "improvedFat" INTEGER,
  "improvedFiber" INTEGER,
  "healthTips" TEXT,
  "status" "suggestionStatus" NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Recipe Versions table
CREATE TABLE IF NOT EXISTS "recipeVersions" (
  "id" SERIAL PRIMARY KEY,
  "recipeId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "snapshotData" TEXT NOT NULL,
  "changeDescription" TEXT,
  "changedFields" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Recipe Reviews table
CREATE TABLE IF NOT EXISTS "recipeReviews" (
  "id" SERIAL PRIMARY KEY,
  "recipeId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create function to update updatedAt timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updatedAt
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON "recipes"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_userSuggestions_updated_at BEFORE UPDATE ON "userSuggestions"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipeReviews_updated_at BEFORE UPDATE ON "recipeReviews"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_recipes_userId ON "recipes"("userId");
CREATE INDEX IF NOT EXISTS idx_recipes_isPublished ON "recipes"("isPublished");
CREATE INDEX IF NOT EXISTS idx_ingredients_recipeId ON "ingredients"("recipeId");
CREATE INDEX IF NOT EXISTS idx_cookingSteps_recipeId ON "cookingSteps"("recipeId");
CREATE INDEX IF NOT EXISTS idx_recipeCategories_recipeId ON "recipeCategories"("recipeId");
CREATE INDEX IF NOT EXISTS idx_recipeCategories_categoryId ON "recipeCategories"("categoryId");
CREATE INDEX IF NOT EXISTS idx_userSuggestions_recipeId ON "userSuggestions"("recipeId");
CREATE INDEX IF NOT EXISTS idx_userSuggestions_userId ON "userSuggestions"("userId");
CREATE INDEX IF NOT EXISTS idx_recipeVersions_recipeId ON "recipeVersions"("recipeId");
CREATE INDEX IF NOT EXISTS idx_recipeReviews_recipeId ON "recipeReviews"("recipeId");
CREATE INDEX IF NOT EXISTS idx_recipeReviews_userId ON "recipeReviews"("userId");

