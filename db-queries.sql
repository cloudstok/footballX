DROP DATABASE IF EXISTS `footballx_game`;
CREATE DATABASE IF NOT EXISTS `footballx_game`;
USE `footballx_game`;

CREATE TABLE IF NOT EXISTS `settlement`(
  `settlement_id` int NOT NULL AUTO_INCREMENT,
  `lobby_id` varchar(255) DEFAULT NULL,
  `user_id` varchar(255) DEFAULT NULL,
  `operator_id` varchar(255) DEFAULT NULL,
  `bet_amount` decimal(10, 2) DEFAULT 0.00,
  `max_mult` decimal(10, 2) DEFAULT 0.00,
  `match_max_mult` decimal(10, 2) DEFAULT 0.00,
  `win_amount` decimal(10, 2) DEFAULT 0.00,
  `status` ENUM('win', 'loss') not null,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`settlement_id`)
);

 ALTER TABLE `footballx_game`.`settlement` ADD INDEX `inx_lobby_id` (`lobby_id` ASC) VISIBLE, ADD INDEX `inx_user_id` (`user_id` ASC) INVISIBLE, ADD INDEX `inx_operator_id` (`operator_id` ASC) INVISIBLE, ADD INDEX `inx_bet_amount` (`bet_amount` ASC) INVISIBLE, ADD INDEX `inx_max_mult` (`max_mult` ASC) INVISIBLE;

