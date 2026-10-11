-- CreateIndex
CREATE INDEX `voucher_events_event_type_created_at_idx` ON `voucher_events`(`event_type`, `created_at`);

-- CreateIndex
CREATE INDEX `vouchers_created_at_idx` ON `vouchers`(`created_at`);

-- CreateIndex
CREATE INDEX `vouchers_voucher_date_idx` ON `vouchers`(`voucher_date`);

-- CreateIndex
CREATE INDEX `vouchers_amount_idx` ON `vouchers`(`amount`);
