CREATE DATABASE limbo_game;
USE limbo_game;

CREATE TABLE IF NOT EXISTS `settlement`(
  `settlement_id` int NOT NULL AUTO_INCREMENT,
  `bet_id` varchar(255) DEFAULT NULL,
  `lobby_id` varchar(255) DEFAULT NULL,
  `user_id` varchar(255) DEFAULT NULL,
  `operator_id` varchar(255) DEFAULT NULL,
  `bet_amount` decimal(10, 2) DEFAULT 0.00,
  `max_mult` decimal(10, 2) DEFAULT 0.00,
  `match_max_mult` decimal(10, 2) DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`settlement_id`)
);

 ALTER TABLE `limbo_game`.`settlement` ADD INDEX `inx_bet_id` (`bet_id` ASC) VISIBLE, ADD INDEX `inx_lobby_id` (`lobby_id` ASC) VISIBLE, ADD INDEX `inx_user_id` (`user_id` ASC) INVISIBLE, ADD INDEX `inx_operator_id` (`operator_id` ASC) INVISIBLE, ADD INDEX `inx_bet_amount` (`bet_amount` ASC) INVISIBLE, ADD INDEX `inx_max_mult` (`max_mult` ASC) INVISIBLE;

