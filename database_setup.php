<?php
/**
 * Database Setup Script for Realtime Quiz
 * This script creates the necessary tables in your MySQL/MariaDB database.
 */

// --- Database Configuration ---
$host = '127.0.0.1';
$db   = 'realtime_quiz';
$user = 'platform1';
$pass = 'Himanshu@1272';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    echo "Connected to database successfully! 🚀\n\n";

    // 1. Users Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `Users` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `username` VARCHAR(255) NOT NULL UNIQUE,
        `password` VARCHAR(255) NOT NULL,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");
    echo "✔ Users table ready.\n";

    // 2. Quizzes Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `Quizzes` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `title` VARCHAR(255) NOT NULL,
        `hostId` INT NOT NULL,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");
    echo "✔ Quizzes table ready.\n";

    // 3. Questions Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `Questions` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `quizId` INT NOT NULL,
        `questionText` TEXT NOT NULL,
        `options` JSON NOT NULL,
        `correctIndex` INT NOT NULL,
        `timer` INT DEFAULT 20,
        `image` VARCHAR(255) NULL,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");
    echo "✔ Questions table ready.\n";

    // 4. GameSessions Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `GameSessions` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `pin` VARCHAR(6) NOT NULL UNIQUE,
        `quizId` INT NOT NULL,
        `hostId` INT NOT NULL,
        `status` ENUM('lobby', 'question', 'result', 'finished') DEFAULT 'lobby',
        `gameMode` VARCHAR(255) DEFAULT 'classic',
        `currentQuestionIndex` INT DEFAULT -1,
        `questionStartTime` DATETIME NULL,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");
    echo "✔ GameSessions table ready.\n";

    // 5. Players Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `Players` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `sessionId` INT NOT NULL,
        `nickname` VARCHAR(255) NOT NULL,
        `teamName` VARCHAR(255) NULL,
        `socketId` VARCHAR(255) NULL,
        `score` INT DEFAULT 0,
        `lastAnswerCorrect` TINYINT(1) DEFAULT 0,
        `lastAnswerTime` INT DEFAULT 0,
        `lastAnswerIndex` INT DEFAULT -1,
        `streak` INT DEFAULT 0,
        `avatar` VARCHAR(255) NULL,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY `session_nickname` (`sessionId`, `nickname`),
        INDEX `score_idx` (`score`),
        INDEX `team_idx` (`teamName`)
    ) ENGINE=InnoDB;");
    echo "✔ Players table ready.\n";

    // 6. PlayerAnswers Table
    $pdo->exec("CREATE TABLE IF NOT EXISTS `PlayerAnswers` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `sessionId` INT NOT NULL,
        `playerId` INT NOT NULL,
        `questionIndex` INT NOT NULL,
        `answerIndex` INT NOT NULL,
        `isCorrect` TINYINT(1) NOT NULL,
        `timeTaken` INT NOT NULL,
        `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");
    echo "✔ PlayerAnswers table ready.\n";

    echo "\nDatabase setup completed successfully! 🎉";

} catch (PDOException $e) {
    die("Error: " . $e->getMessage());
}
?>
