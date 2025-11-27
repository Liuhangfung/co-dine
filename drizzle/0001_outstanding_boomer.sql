CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('ingredient','cuisine','method','health') NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cookingSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipeId` int NOT NULL,
	`stepNumber` int NOT NULL,
	`instruction` text NOT NULL,
	`duration` int,
	`temperature` varchar(50),
	`imageUrl` text,
	`tips` text,
	CONSTRAINT `cookingSteps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ingredients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipeId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`amount` varchar(100),
	`unit` varchar(50),
	`calories` int,
	`notes` text,
	`order` int NOT NULL,
	CONSTRAINT `ingredients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipeCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipeId` int NOT NULL,
	`categoryId` int NOT NULL,
	CONSTRAINT `recipeCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`inputMethod` enum('manual','image','weblink') NOT NULL,
	`sourceUrl` text,
	`imageUrl` text,
	`videoUrl` text,
	`totalCalories` int,
	`servings` int DEFAULT 1,
	`caloriesPerServing` int,
	`protein` int,
	`carbs` int,
	`fat` int,
	`fiber` int,
	`aiAnalysis` text,
	`improvementSuggestions` text,
	`machineInstructions` text,
	`isPublished` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recipes_id` PRIMARY KEY(`id`)
);
