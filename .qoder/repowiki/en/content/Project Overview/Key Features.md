# Key Features

<cite>
**Referenced Files in This Document**
- [server.js](file://server.js)
- [botManager.js](file://botManager.js)
- [apiRouter.js](file://apiRouter.js)
- [auth.js](file://auth.js)
- [worker.js](file://worker.js)
- [services/datajud.js](file://services/datajud.js)
- [services/premium.js](file://services/premium.js)
- [db.js](file://db.js)
- [database.sql](file://database.sql)
- [public/painel.html](file://public/painel.html)
- [public/painel.js](file://public/painel.js)
- [public/app.js](file://public/app.js)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Multi-User Architecture with Individual Telegram Bots](#multi-user-architecture-with-individual-telegram-bots)
3. [Dual-Tier API Approach: Free DataJud Integration and Premium Fallback](#dual-tier-api-approach-free-datajud-integration-and-premium-fallback)
4. [Web Administration Panel and Real-Time Process Monitoring](#web-administration-panel-and-real-time-process-monitoring)
5. [Automatic Update Detection and Instant Telegram Notifications](#automatic-update-detection-and-instant-telegram-notifications)
6. [User Registration, Authentication, Role-Based Access Control, and Administrative Management](#user-registration-authentication-role-based-access-control-and-administrative-management)
7. [Feature Workflows and Benefits by User Type](#feature-workflows-and-benefits-by-user-type)
8. [Conclusion](#conclusion)

## Introduction
This document outlines the key features of the Legal Process Monitoring System, focusing on its multi-user architecture with individual Telegram bots per user, dual-tier API approach integrating free DataJud and optional premium services, the web administration panel, real-time process monitoring, automatic update detection, instant notifications, and robust user registration and role-based access control.

## Multi-User Architecture with Individual Telegram Bots
The system supports multiple users, each with their own Telegram bot instance. Each user’s bot is isolated and runs independently, enabling:
- Scalability: New users can be onboarded without affecting existing users.
- Isolation: Each user’s bot operates separately, reducing cross-user interference.
- Personalization: Users can configure Telegram IDs, bot tokens, and API keys per account.

Key implementation highlights:
- Per-user bot initialization and persistence in the database.
- On-demand bot startup when a user registers or when the server restarts.
- Message handling routes incoming Telegram messages to the appropriate user context.

```mermaid
sequenceDiagram
participant User as "Telegram User"
participant Bot as "User Bot Instance"
participant API as "API Router"
participant DataJud as "DataJud Service"
participant Premium as "Premium Service"
participant DB as "PostgreSQL"
User->>Bot : "Send process number"
Bot->>DB : "Lookup user by token"
Bot->>API : "consultarProcesso(numero, user)"
API->>DataJud : "consultarDataJud(numero)"
DataJud-->>API : "Free result or null"
alt "Free result found"
API-->>Bot : "Return free data"
else "Fallback to premium"
API->>Premium : "consultarPremium(numero, apiKey)"
Premium-->>API : "Premium result"
API-->>Bot : "Return premium data"
end
Bot->>DB : "Insert process record"
Bot-->>User : "Send formatted process info"
```

**Diagram sources**
- [botManager.js:13-39](file://botManager.js#L13-L39)
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)
- [services/datajud.js:3-29](file://services/datajud.js#L3-L29)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)

**Section sources**
- [botManager.js:7-42](file://botManager.js#L7-L42)
- [server.js:12-36](file://server.js#L12-L36)
- [database.sql:5-24](file://database.sql#L5-L24)

## Dual-Tier API Approach: Free DataJud Integration and Premium Fallback
The system integrates a two-tier API strategy:
- Free tier: Uses DataJud CNJ public API to retrieve initial process data.
- Premium fallback: If free data is unavailable and the user has a valid API key and mode set to non-free, the system attempts a premium service.

Benefits:
- Cost-effective for basic usage.
- Extensible for advanced users requiring richer data.

```mermaid
flowchart TD
Start(["Consult Process"]) --> TryFree["Call DataJud"]
TryFree --> FoundFree{"Free data found?"}
FoundFree --> |Yes| ReturnFree["Return free data"]
FoundFree --> |No| CheckPremium["Check user API key and mode"]
CheckPremium --> CanTryPremium{"Has API key and not 'gratis'?"}
CanTryPremium --> |Yes| CallPremium["Call Premium Service"]
CallPremium --> ReturnPremium["Return premium data"]
CanTryPremium --> |No| ReturnNull["Return null"]
ReturnFree --> End(["Done"])
ReturnPremium --> End
ReturnNull --> End
```

**Diagram sources**
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)
- [services/datajud.js:3-29](file://services/datajud.js#L3-L29)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)

**Section sources**
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)
- [services/datajud.js:3-29](file://services/datajud.js#L3-L29)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)

## Web Administration Panel and Real-Time Process Monitoring
The web administration panel provides:
- Role-based navigation: Admin menu includes user management and process listings; client menu focuses on personal processes and configuration.
- Real-time updates: Automatic refresh of process lists and user lists at short intervals.
- Administrative capabilities: Create users, assign roles, configure modes (free, hybrid, paid), and manage Telegram and API integrations.

```mermaid
sequenceDiagram
participant Admin as "Admin User"
participant Panel as "Admin Panel"
participant Server as "Express Server"
participant DB as "PostgreSQL"
Admin->>Panel : "Open /painel.html"
Panel->>Server : "GET /processos (with Bearer token)"
Server->>DB : "Query processos (admin sees all)"
DB-->>Server : "Rows"
Server-->>Panel : "JSON rows"
Panel-->>Admin : "Render table with all processes"
Admin->>Panel : "Switch to Users tab"
Panel->>Server : "GET /usuarios (admin only)"
Server->>DB : "Query usuarios"
DB-->>Server : "Rows"
Server-->>Panel : "JSON rows"
Panel-->>Admin : "Render user table"
```

**Diagram sources**
- [public/painel.html:19-31](file://public/painel.html#L19-L31)
- [public/painel.js:37-62](file://public/painel.js#L37-L62)
- [public/painel.js:64-89](file://public/painel.js#L64-L89)
- [server.js:94-122](file://server.js#L94-L122)

**Section sources**
- [public/painel.html:19-31](file://public/painel.html#L19-L31)
- [public/painel.js:37-62](file://public/painel.js#L37-L62)
- [public/painel.js:64-89](file://public/painel.js#L64-L89)
- [server.js:94-122](file://server.js#L94-L122)

## Automatic Update Detection and Instant Telegram Notifications
The worker periodically checks for process updates and sends instant Telegram notifications:
- Periodic polling: Runs every 5 minutes with immediate startup.
- Grouping and caching: Groups processes by user to minimize repeated queries and caches user records.
- Notification delivery: Sends alerts when a process status changes.

```mermaid
sequenceDiagram
participant Worker as "Worker Process"
participant DB as "PostgreSQL"
participant API as "API Router"
participant DataJud as "DataJud Service"
participant Premium as "Premium Service"
participant Bot as "Telegram Bot"
Worker->>DB : "SELECT * FROM processos"
DB-->>Worker : "Rows"
loop "For each process"
Worker->>DB : "SELECT * FROM usuarios WHERE id=usuario_id"
DB-->>Worker : "User row"
Worker->>API : "consultarProcesso(numero, user)"
API->>DataJud : "consultarDataJud(numero)"
DataJud-->>API : "Result or null"
alt "Premium fallback"
API->>Premium : "consultarPremium(numero, apiKey)"
Premium-->>API : "Result"
end
API-->>Worker : "Latest status"
alt "Status changed"
Worker->>DB : "UPDATE processos SET ultimo_status, atualizado_em"
Worker->>Bot : "sendMessage(telegram_id, message)"
else "No change"
Worker-->>Worker : "Continue"
end
end
```

**Diagram sources**
- [worker.js:17-61](file://worker.js#L17-L61)
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)
- [services/datajud.js:3-29](file://services/datajud.js#L3-L29)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)

**Section sources**
- [worker.js:17-61](file://worker.js#L17-L61)
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)

## User Registration, Authentication, Role-Based Access Control, and Administrative Management
The system provides secure user lifecycle management:
- Registration: New users can register via the web interface or admin endpoint. Passwords are hashed, and optional Telegram bot configuration is supported.
- Authentication: JWT-based authentication with middleware enforcing token verification.
- Authorization: Role-based access control differentiates admins from clients; admin-only endpoints are protected.
- Administrative management: Admins can create users, assign roles, and configure modes and integrations.

```mermaid
sequenceDiagram
participant Client as "Client"
participant Server as "Express Server"
participant Auth as "Auth Module"
participant DB as "PostgreSQL"
Client->>Server : "POST /auth/registro (email, senha, telegram_id, bot_token, api_key, modo)"
Server->>Auth : "hashSenha(senha)"
Auth-->>Server : "Hashed password"
Server->>DB : "INSERT INTO usuarios"
DB-->>Server : "New user id"
alt "bot_token provided"
Server->>Server : "iniciarBot(bot_token, userId)"
end
Server-->>Client : "Success response"
Client->>Server : "POST /auth/login (email, senha)"
Server->>DB : "SELECT * FROM usuarios WHERE email"
DB-->>Server : "User row"
Server->>Auth : "verificarSenha(senha, hash)"
Auth-->>Server : "Match?"
alt "Credentials valid"
Server->>Auth : "gerarToken(user)"
Auth-->>Server : "JWT"
Server-->>Client : "{token, user}"
else "Invalid credentials"
Server-->>Client : "401 error"
end
```

**Diagram sources**
- [server.js:12-36](file://server.js#L12-L36)
- [server.js:39-68](file://server.js#L39-L68)
- [auth.js:8-31](file://auth.js#L8-L31)
- [auth.js:42-49](file://auth.js#L42-L49)

**Section sources**
- [server.js:12-36](file://server.js#L12-L36)
- [server.js:39-68](file://server.js#L39-L68)
- [auth.js:8-31](file://auth.js#L8-L31)
- [auth.js:33-39](file://auth.js#L33-L39)

## Feature Workflows and Benefits by User Type
Below are concrete workflows and benefits tailored to different user types.

### Client User Workflow
- Registration and Setup:
  - Register via the web interface or admin endpoint with Telegram ID, bot token, and API key if desired.
  - Receive a JWT token upon login for authenticated access.
- Process Monitoring:
  - Send a process number to the Telegram bot.
  - Receive formatted process details instantly.
  - View monitored processes in the client section of the admin panel.
- Benefits:
  - Quick access to legal process information via Telegram.
  - Real-time updates delivered automatically without manual checks.

```mermaid
sequenceDiagram
participant Client as "Client User"
participant Panel as "Client Panel"
participant Server as "Express Server"
participant Bot as "Telegram Bot"
participant DB as "PostgreSQL"
Client->>Panel : "Login and open panel"
Panel->>Server : "GET /auth/me (Bearer token)"
Server->>DB : "SELECT * FROM usuarios WHERE id"
DB-->>Server : "User profile"
Server-->>Panel : "User data"
Panel-->>Client : "Display profile and menus"
Client->>Bot : "Send process number"
Bot->>DB : "Lookup user by token"
Bot-->>Client : "Send formatted process info"
```

**Diagram sources**
- [public/painel.js:91-108](file://public/painel.js#L91-L108)
- [botManager.js:13-39](file://botManager.js#L13-L39)
- [server.js:124-135](file://server.js#L124-L135)

**Section sources**
- [public/painel.js:91-108](file://public/painel.js#L91-L108)
- [botManager.js:13-39](file://botManager.js#L13-L39)
- [server.js:124-135](file://server.js#L124-L135)

### Admin User Workflow
- User Management:
  - Create new users with roles, Telegram IDs, bot tokens, API keys, and modes.
  - View all users and their configurations.
- Process Oversight:
  - Access all monitored processes across users.
  - Verify system behavior and troubleshoot issues.
- Benefits:
  - Centralized control over users and processes.
  - Efficient onboarding and operational oversight.

```mermaid
sequenceDiagram
participant Admin as "Admin User"
participant Panel as "Admin Panel"
participant Server as "Express Server"
participant DB as "PostgreSQL"
Admin->>Panel : "Open Users tab"
Panel->>Server : "GET /usuarios (admin only)"
Server->>DB : "SELECT * FROM usuarios"
DB-->>Server : "Users list"
Server-->>Panel : "JSON users"
Panel-->>Admin : "Render user table"
Admin->>Panel : "Open Processes tab"
Panel->>Server : "GET /processos (admin)"
Server->>DB : "SELECT * FROM processos JOIN usuarios"
DB-->>Server : "Processes list"
Server-->>Panel : "JSON processes"
Panel-->>Admin : "Render processes table"
```

**Diagram sources**
- [public/painel.js:64-89](file://public/painel.js#L64-L89)
- [public/painel.js:37-62](file://public/painel.js#L37-L62)
- [server.js:113-122](file://server.js#L113-L122)
- [server.js:94-110](file://server.js#L94-L110)

**Section sources**
- [public/painel.js:64-89](file://public/painel.js#L64-L89)
- [public/painel.js:37-62](file://public/painel.js#L37-L62)
- [server.js:113-122](file://server.js#L113-L122)
- [server.js:94-110](file://server.js#L94-L110)

## Conclusion
The Legal Process Monitoring System delivers a scalable, secure, and efficient solution for legal process tracking. Its multi-user architecture with individual Telegram bots ensures isolation and growth potential. The dual-tier API approach balances cost and capability, while the web administration panel and real-time monitoring provide transparency and automation. Robust authentication and role-based access control enable safe and flexible management, benefiting both individual clients and administrators.