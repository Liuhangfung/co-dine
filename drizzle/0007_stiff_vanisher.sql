CREATE TABLE `recipeReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipeId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recipeReviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recipeVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`recipeId` int NOT NULL,
	`userId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`snapshotData` text NOT NULL,
	`changeDescription` text,
	`changedFields` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recipeVersions_id` PRIMARY KEY(`id`)
);
