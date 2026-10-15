CREATE TABLE `profile_results` (
	`profile_id` text NOT NULL,
	`match_id` text NOT NULL,
	`played_at` integer NOT NULL,
	`won` integer NOT NULL,
	`arena_wins` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`profile_id`, `match_id`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_profile_results_recent` ON `profile_results` (`profile_id`,`played_at`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`username_key` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_username_key_unique` ON `profiles` (`username_key`);