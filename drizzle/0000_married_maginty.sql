CREATE TABLE `station_events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`time` text DEFAULT '' NOT NULL,
	`all_day` integer DEFAULT 0 NOT NULL,
	`kind` text NOT NULL,
	`place` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`repeat` text DEFAULT 'none' NOT NULL,
	`until` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`deleted` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
