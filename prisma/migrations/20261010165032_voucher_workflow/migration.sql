-- CreateTable
CREATE TABLE `vouchers` (
    `id` CHAR(36) NOT NULL,
    `voucher_number` VARCHAR(32) NOT NULL,
    `voucher_date` DATE NOT NULL,
    `expense_date` DATE NOT NULL,
    `department` VARCHAR(120) NOT NULL,
    `expense_title` VARCHAR(200) NOT NULL,
    `category` VARCHAR(80) NOT NULL,
    `description` TEXT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `employee_id` CHAR(36) NOT NULL,
    `employee_signature_file_id` CHAR(36) NULL,
    `director_signature_file_id` CHAR(36) NULL,
    `approved_at` DATETIME(3) NULL,
    `rejection_reason` TEXT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `vouchers_voucher_number_key`(`voucher_number`),
    INDEX `vouchers_employee_id_created_at_idx`(`employee_id`, `created_at`),
    INDEX `vouchers_status_created_at_idx`(`status`, `created_at`),
    INDEX `vouchers_department_status_idx`(`department`, `status`),
    INDEX `vouchers_expense_date_idx`(`expense_date`),
    INDEX `vouchers_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CheckConstraint (DATABASE.md 2.2): amounts are always positive; the API
-- validates the same rule, this is the database-level backstop.
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_amount_positive` CHECK (`amount` > 0);

-- CreateTable
CREATE TABLE `stored_files` (
    `id` CHAR(36) NOT NULL,
    `storage_key` VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `sha256` CHAR(64) NULL,
    `uploaded_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `stored_files_storage_key_key`(`storage_key`),
    INDEX `stored_files_uploaded_by_id_idx`(`uploaded_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voucher_events` (
    `id` CHAR(36) NOT NULL,
    `voucher_id` CHAR(36) NOT NULL,
    `actor_id` CHAR(36) NOT NULL,
    `event_type` VARCHAR(40) NOT NULL,
    `from_status` VARCHAR(24) NULL,
    `to_status` VARCHAR(24) NULL,
    `reason` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `voucher_events_voucher_id_created_at_idx`(`voucher_id`, `created_at`),
    INDEX `voucher_events_actor_id_created_at_idx`(`actor_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voucher_counters` (
    `year` INTEGER NOT NULL,
    `next_value` INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY (`year`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_employee_signature_file_id_fkey` FOREIGN KEY (`employee_signature_file_id`) REFERENCES `stored_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vouchers` ADD CONSTRAINT `vouchers_director_signature_file_id_fkey` FOREIGN KEY (`director_signature_file_id`) REFERENCES `stored_files`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stored_files` ADD CONSTRAINT `stored_files_uploaded_by_id_fkey` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voucher_events` ADD CONSTRAINT `voucher_events_voucher_id_fkey` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voucher_events` ADD CONSTRAINT `voucher_events_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
