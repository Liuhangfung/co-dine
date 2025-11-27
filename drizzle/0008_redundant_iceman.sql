ALTER TABLE `recipes` ADD `difficulty` enum('簡單','中等','困難');--> statement-breakpoint
ALTER TABLE `recipes` ADD `prepTime` int;--> statement-breakpoint
ALTER TABLE `recipes` ADD `cookTime` int;--> statement-breakpoint
ALTER TABLE `recipes` ADD `totalTime` int;--> statement-breakpoint
ALTER TABLE `recipes` ADD `requiredEquipment` text;