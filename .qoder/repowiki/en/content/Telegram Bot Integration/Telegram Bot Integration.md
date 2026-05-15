# Telegram Bot Integration

<cite>
**Referenced Files in This Document**
- [server.js](file://server.js)
- [botManager.js](file://botManager.js)
- [worker.js](file://worker.js)
- [apiRouter.js](file://apiRouter.js)
- [services/datajud.js](file://services/datajud.js)
- [services/premium.js](file://services/premium.js)
- [auth.js](file://auth.js)
- [db.js](file://db.js)
- [database.sql](file://database.sql)
- [package.json](file://package.json)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the Telegram bot integration for a multi-user SaaS platform that monitors Brazilian judicial processes. It covers bot creation and configuration, message processing workflows, event handling, dynamic per-user bot instances, caching strategies, message parsing, validation against legal databases, bot management commands, user interaction patterns, response formatting, and the worker system that monitors process updates and sends real-time notifications. Practical examples and integration points with external legal APIs are included, along with common bot-related issues and solutions.

## Project Structure
The system consists of:
- Web server and bot manager for user registration, login, and dynamic bot initialization
- Worker daemon that periodically checks for process updates and notifies users
- API router orchestrating free and paid legal data sources
- Services for free (DataJud CNJ) and paid (premium) legal data retrieval
- Authentication middleware and database connection
- PostgreSQL schema for users and monitored processes

```mermaid
graph TB
subgraph "Web Server"
S["server.js"]
BM["botManager.js"]
AR["apiRouter.js"]
AU["auth.js"]
DB["db.js"]
end
subgraph "Worker Daemon"
W["worker.js"]
end
subgraph "Legal Data Services"
DJ["services/datajud.js"]
PR["services/premium.js"]
end
subgraph "Database"
SQL["database.sql"]
end
S --> BM
S --> AR
S --> AU
S --> DB
W --> AR
W --> DB
AR --> DJ
AR --> PR
BM --> DB
BM --> AR
DB --> SQL
```

**Diagram sources**
- [server.js:1-162](file://server.js#L1-L162)
- [botManager.js:1-53](file://botManager.js#L1-L53)
- [worker.js:1-70](file://worker.js#L1-L70)
- [apiRouter.js:1-19](file://apiRouter.js#L1-L19)
- [services/datajud.js:1-32](file://services/datajud.js#L1-L32)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)
- [db.js:1-11](file://db.js#L1-L11)
- [database.sql:1-25](file://database.sql#L1-L25)

**Section sources**
- [README.md:1-56](file://README.md#L1-L56)
- [package.json:1-21](file://package.json#L1-L21)

## Core Components
- Dynamic Bot Manager: Creates and caches Telegram bot instances per user token, listens for messages, validates input, queries legal APIs, persists process records, and responds to users.
- Worker Daemon: Periodically polls legal APIs for process updates, compares with stored statuses, and sends Telegram notifications.
- API Router: Orchestrates free and paid legal data sources with fallback logic.
- Legal Data Services: Free DataJud CNJ integration and placeholder for premium legal API.
- Authentication and Authorization: JWT-based authentication, password hashing, and admin middleware.
- Database Layer: PostgreSQL connection and schema for users and monitored processes.

**Section sources**
- [botManager.js:1-53](file://botManager.js#L1-L53)
- [worker.js:1-70](file://worker.js#L1-L70)
- [apiRouter.js:1-19](file://apiRouter.js#L1-L19)
- [services/datajud.js:1-32](file://services/datajud.js#L1-L32)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)
- [auth.js:1-59](file://auth.js#L1-L59)
- [db.js:1-11](file://db.js#L1-L11)
- [database.sql:1-25](file://database.sql#L1-L25)

## Architecture Overview
The system integrates Telegram bots with a backend that manages users, processes, and legal data retrieval. Two primary runtime components coexist:
- Web server initializes bots and exposes admin endpoints
- Worker daemon runs independently to monitor and notify

```mermaid
sequenceDiagram
participant U as "User"
participant T as "Telegram Bot"
participant BM as "botManager.js"
participant AR as "apiRouter.js"
participant DJ as "services/datajud.js"
participant PR as "services/premium.js"
participant DB as "db.js"
participant W as "worker.js"
U->>T : "Send process number"
T->>BM : "message event"
BM->>AR : "consultarProcesso(numero, user)"
AR->>DJ : "consultarDataJud(numero)"
DJ-->>AR : "data or null"
AR->>PR : "consultarPremium(numero, api_key) if needed"
PR-->>AR : "data or null"
AR-->>BM : "data or null"
alt "Found"
BM->>DB : "INSERT process record"
BM-->>U : "Formatted response"
else "Not Found"
BM-->>U : "Not found message"
end
Note over W,DB : "Periodic loop checks for updates"
W->>DB : "SELECT all processes"
W->>AR : "consultarProcesso(numero, user)"
AR->>DJ : "consultarDataJud(numero)"
DJ-->>AR : "data or null"
AR-->>W : "data or null"
alt "Status changed"
W->>DB : "UPDATE process status"
W-->>U : "Notification via Telegram"
end
```

**Diagram sources**
- [botManager.js:13-39](file://botManager.js#L13-L39)
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)
- [services/datajud.js:3-29](file://services/datajud.js#L3-L29)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)
- [worker.js:17-61](file://worker.js#L17-L61)
- [db.js:1-11](file://db.js#L1-L11)

## Detailed Component Analysis

### Dynamic Bot Creation and Message Processing
- Per-user bot tokens: Each user can register a Telegram bot token and a Telegram chat ID. On registration or admin creation, the system initializes a Telegram bot instance keyed by token and cached in memory.
- Message event handling: The bot listens for incoming messages, extracts the text as a potential process number, validates it against legal databases, persists the record, and replies with formatted information.
- Caching: Bots are cached by token to avoid recreating instances. This reduces overhead and ensures consistent message handling per user.

```mermaid
flowchart TD
Start(["Message received"]) --> Parse["Extract text as process number"]
Parse --> Validate{"Valid process number?"}
Validate --> |No| ReplyNotFound["Reply 'Not found'"]
Validate --> |Yes| LookupUser["Lookup user by userId"]
LookupUser --> CallAPI["Call consultarProcesso(numero, user)"]
CallAPI --> Found{"Found in legal API?"}
Found --> |No| ReplyNotFound
Found --> |Yes| InsertDB["Insert process record"]
InsertDB --> FormatResp["Format response with tribunal/class/date"]
FormatResp --> SendMsg["Send Telegram message"]
SendMsg --> End(["Done"])
ReplyNotFound --> End
```

**Diagram sources**
- [botManager.js:13-39](file://botManager.js#L13-L39)
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)
- [services/datajud.js:3-29](file://services/datajud.js#L3-L29)

**Section sources**
- [botManager.js:7-42](file://botManager.js#L7-L42)
- [server.js:12-36](file://server.js#L12-L36)
- [server.js:70-92](file://server.js#L70-L92)

### Worker System for Monitoring Updates
- Periodic polling: The worker runs a loop every 5 minutes to check for process updates.
- Grouping and caching: Processes are grouped by user to minimize repeated queries. A user cache avoids redundant database lookups.
- Notification delivery: When a newer status is detected, the worker updates the database and sends a Telegram notification to the user’s chat ID using the cached bot instance.

```mermaid
sequenceDiagram
participant W as "worker.js"
participant DB as "db.js"
participant AR as "apiRouter.js"
participant DJ as "services/datajud.js"
participant BOT as "TelegramBot (cached)"
W->>DB : "SELECT * FROM processos"
loop "For each process"
W->>DB : "SELECT user by usuario_id (cached)"
DB-->>W : "user"
alt "user has bot_token and telegram_id"
W->>AR : "consultarProcesso(numero, user)"
AR->>DJ : "consultarDataJud(numero)"
DJ-->>AR : "data or null"
AR-->>W : "data or null"
alt "status changed"
W->>DB : "UPDATE ultimo_status and atualizado_em"
W->>BOT : "sendMessage(telegram_id, update)"
else "no change"
W-->>W : "continue"
end
else "missing credentials"
W-->>W : "skip"
end
end
```

**Diagram sources**
- [worker.js:17-61](file://worker.js#L17-L61)
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)
- [services/datajud.js:3-29](file://services/datajud.js#L3-L29)

**Section sources**
- [worker.js:6-15](file://worker.js#L6-L15)
- [worker.js:17-67](file://worker.js#L17-L67)

### API Router and Legal Data Integration
- Free-first policy: The router attempts free DataJud CNJ integration first. If not found, it falls back to a paid legal API when configured and allowed by user mode.
- Premium integration: A placeholder for premium legal API is provided; replace with a real integration endpoint and authentication.

```mermaid
flowchart TD
Start(["consultarProcesso(numero, user)"]) --> TryFree["Try DataJud"]
TryFree --> FoundFree{"Found?"}
FoundFree --> |Yes| ReturnFree["Return free data"]
FoundFree --> |No| CheckMode{"Has api_key and mode != 'gratis'?"}
CheckMode --> |Yes| TryPaid["Call premium API"]
TryPaid --> ReturnPaid["Return premium data"]
CheckMode --> |No| ReturnNull["Return null"]
```

**Diagram sources**
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)
- [services/datajud.js:3-29](file://services/datajud.js#L3-L29)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)

**Section sources**
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)
- [services/datajud.js:3-29](file://services/datajud.js#L3-L29)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)

### Authentication and Authorization
- JWT-based authentication: Tokens are generated with expiration and verified on protected routes.
- Password hashing: Bcrypt is used for secure password storage.
- Admin middleware: Restricts administrative endpoints to users with admin type.

```mermaid
sequenceDiagram
participant C as "Client"
participant S as "server.js"
participant AU as "auth.js"
participant DB as "db.js"
C->>S : "POST /auth/login {email, senha}"
S->>DB : "SELECT user by email"
DB-->>S : "user"
S->>AU : "verificarSenha(senha, hash)"
AU-->>S : "bool"
alt "valid credentials"
S->>AU : "gerarToken(user)"
AU-->>S : "token"
S-->>C : "{success, token, user}"
else "invalid"
S-->>C : "{error : unauthorized}"
end
```

**Diagram sources**
- [server.js:39-68](file://server.js#L39-L68)
- [auth.js:8-31](file://auth.js#L8-L31)
- [db.js:1-11](file://db.js#L1-L11)

**Section sources**
- [auth.js:8-31](file://auth.js#L8-L31)
- [auth.js:34-39](file://auth.js#L34-L39)
- [server.js:39-68](file://server.js#L39-L68)

### Database Schema and Data Model
- Users table stores authentication credentials, Telegram identifiers, bot token, API key, and mode.
- Processes table tracks monitored process numbers, links to users, last known status, and timestamps.

```mermaid
erDiagram
USUARIOS {
serial id PK
varchar nome
varchar email UK
text senha
varchar tipo
bigint telegram_id
text bot_token
text api_key
varchar modo
timestamp criado_em
}
PROCESSOS {
serial id PK
varchar numero
int usuario_id FK
text ultimo_status
timestamp atualizado_em
}
USUARIOS ||--o{ PROCESSOS : "monitors"
```

**Diagram sources**
- [database.sql:5-24](file://database.sql#L5-L24)

**Section sources**
- [database.sql:5-24](file://database.sql#L5-L24)

## Dependency Analysis
External libraries and their roles:
- Express: Web server and routing
- node-telegram-bot-api: Telegram bot client for message handling and notifications
- axios: HTTP client for legal API calls
- jsonwebtoken: JWT token generation and verification
- bcryptjs: Password hashing
- pg: PostgreSQL client for database operations

```mermaid
graph LR
EX["express"] --> S["server.js"]
NT["node-telegram-bot-api"] --> BM["botManager.js"]
AX["axios"] --> DJ["services/datajud.js"]
AX --> PR["services/premium.js"]
JWT["jsonwebtoken"] --> AU["auth.js"]
BC["bcryptjs"] --> AU
PG["pg"] --> DB["db.js"]
S --> BM
S --> AR["apiRouter.js"]
S --> AU
S --> DB
BM --> DB
BM --> AR
AR --> DJ
AR --> PR
W["worker.js"] --> AR
W --> DB
```

**Diagram sources**
- [package.json:11-19](file://package.json#L11-L19)
- [server.js:1-10](file://server.js#L1-L10)
- [botManager.js:1](file://botManager.js#L1)
- [services/datajud.js:1](file://services/datajud.js#L1)
- [services/premium.js:1](file://services/premium.js#L1)
- [auth.js:1-3](file://auth.js#L1-L3)
- [db.js:1-10](file://db.js#L1-L10)
- [worker.js:1-4](file://worker.js#L1-L4)

**Section sources**
- [package.json:11-19](file://package.json#L11-L19)

## Performance Considerations
- Bot instance caching: Prevents recreation overhead by storing Telegram bot instances keyed by token.
- User cache in worker: Reduces repeated database queries by caching user records per user ID during a loop cycle.
- Polling interval: The worker runs every 5 minutes; adjust based on acceptable latency and API quotas.
- Database batching: Group operations where possible to reduce round trips.
- Rate limiting: Consider adding throttling around Telegram API calls to avoid rate limits.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common bot-related issues and resolutions:
- Webhook vs polling: The current implementation uses polling. If you switch to webhooks, configure the Telegram bot to use webhook URLs and disable polling.
- Message rate limits: Telegram may throttle frequent messages. Implement backoff and batching in bot responses.
- Missing credentials: Ensure users have both bot_token and telegram_id set; otherwise, notifications cannot be sent.
- API timeouts: Add retry logic and circuit breaker patterns for legal API calls.
- Database connectivity: Verify PostgreSQL connection parameters and network access.
- Token invalidation: If a user revokes bot permissions, remove bot_token and telegram_id from the user record.

**Section sources**
- [botManager.js:44-50](file://botManager.js#L44-L50)
- [worker.js:39-43](file://worker.js#L39-L43)
- [db.js:4-10](file://db.js#L4-L10)

## Conclusion
The Telegram bot integration provides a robust foundation for multi-user judicial process monitoring. It dynamically creates per-user bots, validates and parses process numbers, integrates with free and paid legal APIs, persists data, and notifies users of updates. The worker daemon ensures continuous monitoring with caching and efficient database access. By following the configuration steps and addressing common issues, you can deploy a scalable and reliable solution.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Bot Configuration and Setup
- Create a Telegram bot via BotFather and note the bot token.
- Obtain your Telegram user ID via a bot like @userinfobot.
- Register or create a user with the bot token and Telegram ID, and set the desired mode (gratis, híbrido, pago).
- Start the server and worker processes as described in the README.

**Section sources**
- [README.md:49-56](file://README.md#L49-L56)
- [server.js:12-36](file://server.js#L12-L36)
- [server.js:70-92](file://server.js#L70-L92)

### Message Processing Logic Example
- User sends a process number to the Telegram bot.
- The bot extracts the text, looks up the user, queries legal APIs (free first, then paid if configured), inserts the process into the database, and replies with formatted information.

**Section sources**
- [botManager.js:13-39](file://botManager.js#L13-L39)
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)

### Worker Monitoring Workflow Example
- The worker selects all monitored processes, groups by user, checks legal APIs for updates, updates the database when status changes, and sends Telegram notifications.

**Section sources**
- [worker.js:17-61](file://worker.js#L17-L61)

### Integration with External Legal APIs
- Free integration: DataJud CNJ via HTTP POST with a match query on the process number.
- Paid integration: Replace the premium service placeholder with a real legal API endpoint and authentication.

**Section sources**
- [services/datajud.js:3-29](file://services/datajud.js#L3-L29)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)
- [apiRouter.js:10-13](file://apiRouter.js#L10-L13)