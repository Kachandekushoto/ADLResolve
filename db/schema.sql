-- ITResolve database schema
-- Run: mysql -u root -p < db/schema.sql

CREATE DATABASE IF NOT EXISTS itresolve
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE itresolve;

-- ---------------------------------------------------------------
-- users — customers who submit IT problems
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120)  NOT NULL,
  email           VARCHAR(190)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,
  phone           VARCHAR(40)   NULL,
  reset_token     VARCHAR(255)  NULL,
  reset_token_expires DATETIME  NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- admin_users — IT support specialists / administrators
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(120)  NOT NULL,
  email           VARCHAR(190)  NOT NULL UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,
  role            ENUM('admin','it_staff') NOT NULL DEFAULT 'it_staff',
  is_active       TINYINT(1)    NOT NULL DEFAULT 1,
  reset_token     VARCHAR(255)  NULL,
  reset_token_expires DATETIME  NULL,
  created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                  ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- categories — the four support categories (extensible)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100)  NOT NULL UNIQUE,
  slug            VARCHAR(100)  NOT NULL UNIQUE,
  description     VARCHAR(255)  NULL,
  sort_order      SMALLINT      NOT NULL DEFAULT 0
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- support_tickets
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
  id                        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_number             VARCHAR(20)  NOT NULL UNIQUE,          -- e.g. ITR-2026-0001
  user_id                   INT UNSIGNED NOT NULL,
  category_id               INT UNSIGNED NOT NULL,
  assigned_admin_id         INT UNSIGNED NULL,

  title                     VARCHAR(180) NOT NULL,
  description               TEXT         NOT NULL,
  error_message             TEXT         NULL,
  when_started              VARCHAR(60)  NULL,
  troubleshooting_attempted TEXT         NULL,

  device_type               VARCHAR(80)  NULL,
  device_model              VARCHAR(120) NULL,
  operating_system          VARCHAR(60)  NULL,

  support_type              ENUM('Troubleshooting Guide','Remote Assistance','Professional IT Support')
                             NOT NULL DEFAULT 'Troubleshooting Guide',
  status                    ENUM('Open','Under Review','In Progress','Waiting for User','Resolved','Closed')
                             NOT NULL DEFAULT 'Open',
  priority                  ENUM('Low','Normal','High','Urgent') NOT NULL DEFAULT 'Normal',

  created_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_ticket_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ticket_category
    FOREIGN KEY (category_id) REFERENCES categories(id),
  CONSTRAINT fk_ticket_admin
    FOREIGN KEY (assigned_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL,

  INDEX idx_tickets_status (status),
  INDEX idx_tickets_category (category_id),
  INDEX idx_tickets_user (user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- ticket_messages — the conversation thread on a ticket
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_messages (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id       INT UNSIGNED NOT NULL,
  sender_type     ENUM('user','admin','system') NOT NULL,
  sender_id       INT UNSIGNED NULL,          -- references users.id or admin_users.id depending on sender_type
  message         TEXT NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_message_ticket
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  INDEX idx_messages_ticket (ticket_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- ticket_attachments — uploaded screenshots / files
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id       INT UNSIGNED NOT NULL,
  message_id      INT UNSIGNED NULL,
  file_name       VARCHAR(255) NOT NULL,
  file_path       VARCHAR(500) NOT NULL,
  mime_type       VARCHAR(100) NULL,
  file_size_bytes INT UNSIGNED NULL,
  uploaded_by_type ENUM('user','admin') NOT NULL,
  uploaded_by_id  INT UNSIGNED NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_attachment_ticket
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_attachment_message
    FOREIGN KEY (message_id) REFERENCES ticket_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- knowledge_base_articles
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_base_articles (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id     INT UNSIGNED NOT NULL,
  title           VARCHAR(200) NOT NULL,
  slug            VARCHAR(220) NOT NULL UNIQUE,
  summary         VARCHAR(255) NULL,
  content         MEDIUMTEXT   NOT NULL,
  is_published    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                             ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_article_category
    FOREIGN KEY (category_id) REFERENCES categories(id),
  FULLTEXT INDEX ft_article_search (title, summary, content)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  ticket_id       INT UNSIGNED NULL,
  type            VARCHAR(60)  NOT NULL,      -- e.g. 'status_change', 'new_reply'
  message         VARCHAR(255) NOT NULL,
  is_read         TINYINT(1)   NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notification_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_ticket
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id, is_read)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------
-- seed categories (idempotent)
-- ---------------------------------------------------------------
INSERT INTO categories (name, slug, description, sort_order) VALUES
  ('Windows & Software', 'windows-software', 'Windows errors, software installation, drivers, applications, configuration.', 1),
  ('Hardware & Peripherals', 'hardware-peripherals', 'Computer hardware, monitors, keyboards, mice, USB devices, storage.', 2),
  ('Network & Internet', 'network-internet', 'Wi-Fi, LAN, internet connectivity, DNS, IP configuration, routers.', 3),
  ('Printer Support', 'printer-support', 'Printer installation, drivers, offline printers, network printers.', 4)
ON DUPLICATE KEY UPDATE description = VALUES(description);
