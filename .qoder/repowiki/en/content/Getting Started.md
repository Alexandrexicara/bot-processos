# Getting Started

<cite>
**Referenced Files in This Document**
- [package.json](file://package.json)
- [README.md](file://README.md)
- [server.js](file://server.js)
- [worker.js](file://worker.js)
- [db.js](file://db.js)
- [database.sql](file://database.sql)
- [auth.js](file://auth.js)
- [botManager.js](file://botManager.js)
- [apiRouter.js](file://apiRouter.js)
- [services/datajud.js](file://services/datajud.js)
- [services/premium.js](file://services/premium.js)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [System Requirements](#system-requirements)
5. [Environment Configuration](#environment-configuration)
6. [Database Setup](#database-setup)
7. [Telegram Bot Setup](#telegram-bot-setup)
8. [Dual-Server Architecture](#dual-server-architecture)
9. [First-Time User Walkthrough](#first-time-user-walkthrough)
10. [Verification Steps](#verification-steps)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Conclusion](#conclusion)

## Introduction
This guide helps you set up the Judicial Process Monitoring SaaS system. It covers prerequisites, installation, configuration, database schema setup, Telegram bot creation, environment variables, and explains the dual-server architecture with practical first-run steps and troubleshooting tips.

## Prerequisites
- Node.js runtime installed on your system
- PostgreSQL server running and accessible
- Telegram account to create and manage bots
- Basic familiarity with command-line tools and terminal sessions

## Installation
Follow these steps to install and prepare the application:

1. Clone or download the repository to your local machine.
2. Open a terminal in the project root directory.
3. Install dependencies using the package manager:
   ```bash
   npm install
   ```
4. Verify installation by checking that the `node_modules` directory exists and contains the expected packages.

**Section sources**
- [README.md:13-17](file://README.md#L13-L17)
- [package.json:1-21](file://package.json#L1-L21)

## System Requirements
- Node.js runtime environment
- PostgreSQL database server
- Telegram account and access to BotFather for bot creation
- Network connectivity for external APIs (DataJud free API and optional premium API)

**Section sources**
- [package.json:11-19](file://package.json#L11-L19)
- [services/datajud.js:1-32](file://services/datajud.js#L1-L32)

## Environment Configuration
Create a `.env` file in the project root with the following keys and values:

- Database connection:
  - `DB_HOST`: PostgreSQL host
  - `DB_USER`: PostgreSQL user
  - `DB_PASSWORD`: PostgreSQL password
  - `DB_NAME`: Database name (must match the database created during schema setup)
  - `DB_PORT`: PostgreSQL port (default is usually 5432)

- Authentication:
  - `JWT_SECRET`: Secret key for JWT token signing (use a strong random secret)

Set these values according to your PostgreSQL setup and security preferences.

**Section sources**
- [db.js:4-10](file://db.js#L4-L10)
- [auth.js:5](file://auth.js#L5)

## Database Setup
The system requires a PostgreSQL database with two tables: `usuarios` and `processos`. Follow these steps:

1. Connect to PostgreSQL as a superuser or user with sufficient privileges.
2. Execute the SQL commands from the provided schema file:
   - The schema creates the database and defines the `usuarios` and `processos` tables.
3. Confirm that the tables exist and are populated with the expected columns.

Important notes:
- The schema includes a unique constraint on the `email` column in the `usuarios` table.
- The `processos` table references `usuarios` via `usuario_id`.

**Section sources**
- [database.sql:1-25](file://database.sql#L1-L25)

## Telegram Bot Setup
Create and configure Telegram bots for user accounts:

1. Open Telegram and talk to @BotFather.
2. Send `/newbot` and follow the prompts to create a new bot.
3. Note the bot token provided by BotFather.
4. Obtain your Telegram user ID using @userinfobot.
5. In the admin panel, register a new user with:
   - Telegram ID (from @userinfobot)
   - Bot token (from BotFather)
   - Mode: free, hybrid, or paid
6. Optionally, provide an API key if using the paid mode.

How it works:
- The system starts a Telegram bot instance for each registered user with a bot token.
- Users can send process numbers to the bot to initiate monitoring.
- The worker periodically checks for updates and notifies users via Telegram messages.

**Section sources**
- [README.md:49-55](file://README.md#L49-L55)
- [botManager.js:7-42](file://botManager.js#L7-L42)
- [worker.js:42-59](file://worker.js#L42-L59)

## Dual-Server Architecture
The system runs with two distinct processes:

- Main server (web + Telegram bots):
  - Handles HTTP requests for authentication, user management, and process listings.
  - Starts and manages Telegram bot instances for each user.
  - Runs on the configured port (default 3000).

- Worker process:
  - Periodically queries external APIs for process updates.
  - Compares current status with stored data and sends Telegram notifications when changes occur.
  - Runs on a fixed interval (every 5 minutes).

Why two terminals are needed:
- The main server listens for HTTP requests and manages Telegram bots.
- The worker runs continuously to poll for updates and send notifications.
- Running both in separate terminals ensures neither process blocks the other.

Starting the system:
- Terminal 1: Start the main server
  ```bash
  npm start
  ```
- Terminal 2: Start the worker
  ```bash
  npm run worker
  ```

Alternative: Run both in development mode with a single command:
```bash
npm run dev
```

**Section sources**
- [README.md:28-42](file://README.md#L28-L42)
- [server.js:137-140](file://server.js#L137-L140)
- [worker.js:63-70](file://worker.js#L63-L70)

## First-Time User Walkthrough
Complete these steps to set up your admin account and onboard users:

1. Access the admin panel:
   - Open your browser and navigate to the configured port (default http://localhost:3000).
   - The admin panel is exposed via static files served by the main server.

2. Create an admin user automatically:
   - On first startup, the system attempts to create a default admin if none exists.
   - Default credentials are provided in the logs (typically admin email and a temporary password).

3. Register a client user:
   - From the admin panel, create a new user record with:
     - Email
     - Telegram ID (obtained via @userinfobot)
     - Bot token (from BotFather)
     - Mode: free, hybrid, or paid
     - Optional API key for paid mode

4. Verify bot functionality:
   - Send a process number to the Telegram bot associated with the user.
   - The bot responds with process details and begins monitoring.

5. Monitor processes:
   - The worker checks for updates every 5 minutes and sends Telegram notifications when statuses change.

**Section sources**
- [README.md:43-45](file://README.md#L43-L45)
- [server.js:142-162](file://server.js#L142-L162)
- [server.js:12-36](file://server.js#L12-L36)
- [botManager.js:13-39](file://botManager.js#L13-L39)

## Verification Steps
Ensure everything is working correctly:

- Database connectivity:
  - Confirm the PostgreSQL connection using the environment variables.
  - Verify that the `usuarios` and `processos` tables exist and accept inserts.

- Main server:
  - Check that the server starts and logs the listening port.
  - Test authentication endpoints for login and registration.
  - Confirm that the admin panel static files are served.

- Telegram bot:
  - Verify that bots are loaded on startup for existing users.
  - Test sending a process number to the bot and receiving a response.

- Worker:
  - Confirm the worker logs periodic checks.
  - Ensure the worker queries external APIs and updates process statuses.
  - Validate that Telegram notifications are sent when statuses change.

**Section sources**
- [db.js:4-10](file://db.js#L4-L10)
- [server.js:137-140](file://server.js#L137-L140)
- [botManager.js:44-50](file://botManager.js#L44-L50)
- [worker.js:17-61](file://worker.js#L17-L61)

## Troubleshooting Guide
Common setup issues and resolutions:

- PostgreSQL connection errors:
  - Verify that the database exists and the credentials in `.env` are correct.
  - Ensure the PostgreSQL service is running and accessible from your machine.

- Port conflicts:
  - Change the server port in your environment configuration if port 3000 is in use.

- Missing environment variables:
  - Ensure all required variables (`DB_*`, `JWT_SECRET`) are present in `.env`.

- Telegram bot not responding:
  - Confirm the bot token is valid and the user has granted the bot access.
  - Check that the bot instances are loaded on server startup.

- Worker not sending notifications:
  - Verify that users have both `bot_token` and `telegram_id` configured.
  - Ensure the worker can reach external APIs and that process numbers are valid.

- Authentication failures:
  - Confirm that JWT_SECRET is set and consistent across restarts.
  - Check that passwords are hashed and verified correctly.

**Section sources**
- [db.js:4-10](file://db.js#L4-L10)
- [auth.js:5](file://auth.js#L5)
- [botManager.js:44-50](file://botManager.js#L44-L50)
- [worker.js:39-44](file://worker.js#L39-L44)

## Conclusion
You now have the system installed, configured, and ready to use. The main server handles HTTP requests and manages Telegram bots, while the worker performs background monitoring and notifications. Use the admin panel to register users, configure modes, and monitor system activity. For production deployments, secure your environment variables, configure HTTPS, and consider scaling the worker process as needed.