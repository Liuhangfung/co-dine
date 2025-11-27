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
