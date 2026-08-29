CREATE TABLE `team_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`invited_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_team_invites_org_email` ON `team_invites` (`organization_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_team_invites_org_status` ON `team_invites` (`organization_id`,`status`);--> statement-breakpoint
ALTER TABLE `charges` ADD `public_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_charges_public_token` ON `charges` (`public_token`);