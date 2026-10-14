ALTER TABLE `paymentAttempt` ADD `expiresAt` integer;--> statement-breakpoint
CREATE INDEX `paymentAttempt_status_expiresAt_idx` ON `paymentAttempt` (`status`,`expiresAt`);