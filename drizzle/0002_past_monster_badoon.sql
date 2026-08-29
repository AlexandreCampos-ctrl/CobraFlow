CREATE TABLE `payment_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`charge_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_payment_id` text NOT NULL,
	`status` text NOT NULL,
	`billing_type` text NOT NULL,
	`invoice_url` text,
	`pix_payload` text,
	`pix_qr_code` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`charge_id`) REFERENCES `charges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_payment_order_provider_id` ON `payment_orders` (`provider`,`provider_payment_id`);--> statement-breakpoint
CREATE INDEX `idx_payment_orders_org_charge` ON `payment_orders` (`organization_id`,`charge_id`);--> statement-breakpoint
CREATE TABLE `provider_customers` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_customer_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_provider_customer` ON `provider_customers` (`organization_id`,`customer_id`,`provider`);--> statement-breakpoint
ALTER TABLE `organizations` ADD `email` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `address` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `city` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `state` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `postal_code` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `currency` text DEFAULT 'BRL' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `timezone` text DEFAULT 'America/Sao_Paulo' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `payment_provider` text DEFAULT 'asaas' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `payment_environment` text DEFAULT 'sandbox' NOT NULL;