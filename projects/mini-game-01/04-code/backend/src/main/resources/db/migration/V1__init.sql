-- =====================================================
-- V1__init.sql — 合合小厨神 V1.0 数据库初始化
-- =====================================================

-- 用户表
CREATE TABLE IF NOT EXISTS `user` (
  `id`               BIGINT        NOT NULL AUTO_INCREMENT  COMMENT '自增主键',
  `uid`              VARCHAR(32)   NOT NULL                 COMMENT '业务UID（user_前缀+雪花ID）',
  `openid`           VARCHAR(64)   NOT NULL                 COMMENT '微信openid',
  `unionid`          VARCHAR(64)   DEFAULT NULL             COMMENT '微信unionid（多端打通预留）',
  `nick_name`        VARCHAR(64)   DEFAULT '小厨神'         COMMENT '昵称',
  `avatar_url`       VARCHAR(512)  DEFAULT NULL             COMMENT '头像URL',
  `gold`             INT           NOT NULL DEFAULT 100     COMMENT '金币',
  `energy`           INT           NOT NULL DEFAULT 100     COMMENT '当前能量',
  `energy_ts`        BIGINT        NOT NULL DEFAULT 0       COMMENT '上次能量恢复时间戳（毫秒）',
  `rating`           DECIMAL(3,1)  NOT NULL DEFAULT 3.0     COMMENT '好评度(1.0-5.0)',
  `restaurant_level` TINYINT       NOT NULL DEFAULT 1       COMMENT '餐厅等级(1-5)',
  `is_new_user`      TINYINT(1)    NOT NULL DEFAULT 1       COMMENT '是否新用户',
  `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_uid` (`uid`),
  UNIQUE KEY `uk_openid` (`openid`),
  KEY `idx_rating` (`rating`),
  KEY `idx_restaurant_level` (`restaurant_level`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户表';

-- 棋盘状态表
CREATE TABLE IF NOT EXISTS `board_state` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `uid`             VARCHAR(32)   NOT NULL                 COMMENT '用户UID',
  `cells`           JSON          NOT NULL                 COMMENT '棋盘格子数据 [{"t":"tomato","l":0,"i":1},null,...]',
  `rows`            TINYINT       NOT NULL DEFAULT 6       COMMENT '棋盘行数',
  `cols`            TINYINT       NOT NULL DEFAULT 5       COMMENT '棋盘列数',
  `version`         INT           NOT NULL DEFAULT 0       COMMENT '乐观锁版本号',
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_uid` (`uid`),
  KEY `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='棋盘状态表';

-- 合成日志表（反作弊审计 + 数据分析）
CREATE TABLE IF NOT EXISTS `merge_log` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `uid`             VARCHAR(32)   NOT NULL,
  `from_item_type`  VARCHAR(32)   NOT NULL,
  `from_level`      TINYINT       NOT NULL,
  `to_item_type`    VARCHAR(32)   NOT NULL,
  `to_level`        TINYINT       NOT NULL,
  `result_type`     VARCHAR(32)   NOT NULL,
  `result_level`    TINYINT       NOT NULL,
  `created_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_uid_created` (`uid`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='合成日志表';

-- 订单日志表
CREATE TABLE IF NOT EXISTS `order_log` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `uid`             VARCHAR(32)   NOT NULL,
  `recipe_id`       VARCHAR(32)   NOT NULL                 COMMENT '菜品ID',
  `gold_earned`     INT           NOT NULL DEFAULT 0       COMMENT '获得金币',
  `rating_change`   DECIMAL(3,1)  NOT NULL DEFAULT 0       COMMENT '好评度变化',
  `tip_gold`        INT           NOT NULL DEFAULT 0       COMMENT '小费金币',
  `served_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_uid_served_at` (`uid`, `served_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='订单日志表';

-- 餐厅表
CREATE TABLE IF NOT EXISTS `restaurant` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `uid`             VARCHAR(32)   NOT NULL,
  `level`           TINYINT       NOT NULL DEFAULT 1       COMMENT '餐厅等级(1-5)',
  `name`            VARCHAR(64)   DEFAULT '街边小摊'       COMMENT '餐厅名称',
  `unlocked_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `upgraded_at`     DATETIME      DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_uid` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='餐厅表';

-- 社交拜访表
CREATE TABLE IF NOT EXISTS `social_visit` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `visitor_uid`     VARCHAR(32)   NOT NULL                 COMMENT '拜访者UID',
  `host_uid`        VARCHAR(32)   NOT NULL                 COMMENT '被拜访者UID',
  `liked`           TINYINT(1)    NOT NULL DEFAULT 0       COMMENT '是否已点赞',
  `visited_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_host` (`host_uid`),
  KEY `idx_visitor_date` (`visitor_uid`, `visited_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='社交拜访表';

-- 广告观看日志表
CREATE TABLE IF NOT EXISTS `ad_watch_log` (
  `id`              BIGINT        NOT NULL AUTO_INCREMENT,
  `uid`             VARCHAR(32)   NOT NULL,
  `scene`           VARCHAR(32)   NOT NULL                 COMMENT '场景: energy/speedup/double_gold/extend_time',
  `platform`        VARCHAR(16)   NOT NULL                 COMMENT '平台: ylh/csj',
  `trans_id`        VARCHAR(128)  DEFAULT NULL             COMMENT '广告平台交易ID（去重用）',
  `rewarded`        TINYINT(1)    NOT NULL DEFAULT 0       COMMENT '是否已发放奖励',
  `watched_at`      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_uid_scene_date` (`uid`, `scene`, `watched_at`),
  KEY `idx_trans_id` (`trans_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='广告观看日志表';
