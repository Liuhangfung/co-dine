CREATE TABLE `userSuggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipeId` int NOT NULL,
	`userId` int NOT NULL,
	`suggestionType` enum('nutrition','calories','taste','method','other') NOT NULL,
	`targetCalories` int,
	`targetProtein` int,
	`targetCarbs` int,
	`targetFat` int,
	`suggestionText` text NOT NULL,
	`aiResponse` text,
	`improvedRecipeId` int,
	`status` enum('pending','processed','applied') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSuggestions_id` PRIMARY KEY(`id`)
);
