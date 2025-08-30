-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Tempo de geração: 29/08/2025 às 20:47
-- Versão do servidor: 5.7.23-23
-- Versão do PHP: 8.1.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `maadad67_tvon_player`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `settings`
--

CREATE TABLE `settings` (
  `setting_key` varchar(50) COLLATE utf8_unicode_ci NOT NULL,
  `setting_value` text COLLATE utf8_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

--
-- Despejando dados para a tabela `settings`
--

INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES
('redirect_base_url', 'http://testeeng.com');

-- --------------------------------------------------------

--
-- Estrutura para tabela `system_credentials`
--

CREATE TABLE `system_credentials` (
  `system_id` int(11) NOT NULL,
  `username` varchar(50) COLLATE utf8_unicode_ci NOT NULL,
  `password` varchar(50) COLLATE utf8_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

--
-- Despejando dados para a tabela `system_credentials`
--

INSERT INTO `system_credentials` (`system_id`, `username`, `password`) VALUES
(1, '171701', 'C983c5751C'),
(2, '171702', 'Y919F4611h'),
(3, '378167321', 'c604z8526b');

-- --------------------------------------------------------

--
-- Estrutura para tabela `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(50) COLLATE utf8_unicode_ci NOT NULL,
  `password` varchar(50) COLLATE utf8_unicode_ci NOT NULL,
  `status` enum('Active','Inactive') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'Active',
  `exp_date` varchar(50) COLLATE utf8_unicode_ci NOT NULL,
  `system` int(11) NOT NULL,
  `last_access` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

--
-- Despejando dados para a tabela `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `status`, `exp_date`, `system`, `last_access`) VALUES
(34, '49019helen1', 'tvon1@', 'Active', '1758239999', 1, '2025-08-28 22:39:04'),
(35, '22885leticia1', 'tvon1@', 'Active', '1758585599', 1, NULL),
(36, '17907notebook1', 'tvon1@', 'Active', '1756339199', 2, '2025-08-29 18:41:28'),
(37, '55487adeylton1', 'tvon1@', 'Active', '1759017599', 1, '2025-08-29 02:41:07'),
(38, '97634adeylton2', 'tvon1@', 'Active', '1759017599', 1, '2025-08-29 13:19:36'),
(39, '10788simone1', 'tvon1@', 'Active', '1759103999', 1, '2025-08-29 19:54:38'),
(40, '82881jos1', 'tvon1@', 'Active', '1757980799', 1, NULL),
(41, '55311tamyris1', 'tvon1@', 'Active', '1757203199', 1, NULL),
(42, '98142luiz1', 'tvon1@', 'Active', '1757203199', 1, '2025-08-28 23:27:17'),
(43, '69402michel1', 'tvon1@', 'Active', '1754524799', 1, '2025-08-28 20:43:33'),
(44, '29057thais1', 'tvon1@', 'Active', '1757807999', 1, NULL),
(45, '64240wagner1', 'tvon1@', 'Active', '1757203199', 1, NULL),
(46, '40252felipe1', 'tvon1@', 'Active', '1757203199', 1, NULL),
(47, '79864claudia1', 'tvon1@', 'Active', '1757203199', 1, NULL),
(48, '18685gustavo1', 'tvon1@', 'Active', '1758844799', 1, NULL),
(49, '90974graziele1', 'tvon1@', 'Active', '1758412799', 1, NULL),
(50, '63265graziele2', 'tvon1@', 'Active', '1758412799', 1, NULL),
(51, '43597rick1', 'tvon1@', 'Active', '1756598399', 1, NULL),
(52, '97603rick2', 'tvon1@', 'Active', '1756598399', 1, NULL),
(53, '26206pedro1', 'tvon1@', 'Active', '1756598399', 1, NULL),
(54, '74375carlos1', 'tvon1@', 'Active', '1760140799', 1, NULL),
(56, '37390genario1', 'tvon1@', 'Active', '1756598399', 2, NULL),
(57, '31957tv1', 'tvon1@', 'Active', '1791676799', 2, '2025-08-29 20:04:48'),
(58, '26571notebook1', 'tvon1@', 'Active', '1791676799', 2, '2025-08-29 20:35:05'),
(59, '67219smart1', 'tvon1@', 'Active', '1759449599', 3, '2025-08-29 20:40:45'),
(60, '39391paulo1', 'tvon1@', 'Active', '1757203199', 2, NULL),
(62, '72226ayula1', 'tvon1@', 'Active', '1757203199', 2, '2025-08-29 10:45:44'),
(63, '42865celular1', 'tvon1@', 'Active', '1762127999', 2, '2025-08-29 19:22:06');

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`setting_key`),
  ADD KEY `idx_setting_key` (`setting_key`);

--
-- Índices de tabela `system_credentials`
--
ALTER TABLE `system_credentials`
  ADD PRIMARY KEY (`system_id`);

--
-- Índices de tabela `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `idx_username_password` (`username`,`password`);

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
