# Design Patterns and Architectural Principles

<cite>
**Referenced Files in This Document**
- [server.js](file://server.js)
- [botManager.js](file://botManager.js)
- [worker.js](file://worker.js)
- [db.js](file://db.js)
- [auth.js](file://auth.js)
- [apiRouter.js](file://apiRouter.js)
- [services/datajud.js](file://services/datajud.js)
- [services/premium.js](file://services/premium.js)
- [database.sql](file://database.sql)
- [package.json](file://package.json)
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

## Introduction
This document analyzes the design patterns and architectural principles implemented in the Legal Process Monitoring System. The system monitors legal process updates through Telegram bots, integrates with external APIs, and manages user authentication and authorization. The analysis focuses on how the system separates concerns using MVC-like patterns, implements observer and event-driven architectures, and applies factory, middleware, plugin, singleton, and observer patterns to achieve scalability, maintainability, and extensibility.

## Project Structure
The project follows a modular structure with clear separation of concerns:
- Server entry point and routing logic
- Bot management and Telegram integration
- Background worker for periodic monitoring
- Authentication and authorization middleware
- Database abstraction and connection pooling
- API service integration with plugin-style composition
- PostgreSQL schema for persistent storage

```mermaid
graph TB
subgraph "Server Layer"
S["server.js<br/>Express server"]
A["auth.js<br/>JWT & middleware"]
AR["apiRouter.js<br/>API orchestration"]
end
subgraph "Integration Layer"
BM["botManager.js<br/>Telegram bot manager"]
W["worker.js<br/>Background monitor"]
DB["db.js<br/>PostgreSQL pool"]
end
subgraph "Service Layer"
DJ["services/datajud.js<br/>Free API client"]
PR["services/premium.js<br/>Premium API client"]
end
subgraph "Persistence"
SQL["database.sql<br/>Schema definition"]
end
S --> A
S --> AR
S --> BM
S --> DB
AR --> DJ
AR --> PR
BM --> DB
W --> DB
W --> AR
DB --> SQL
```

**Diagram sources**
- [server.js:1-162](file://server.js#L1-L162)
- [botManager.js:1-53](file://botManager.js#L1-L53)
- [worker.js:1-70](file://worker.js#L1-L70)
- [db.js:1-11](file://db.js#L1-L11)
- [auth.js:1-59](file://auth.js#L1-L59)
- [apiRouter.js:1-19](file://apiRouter.js#L1-L19)
- [services/datajud.js:1-32](file://services/datajud.js#L1-L32)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)
- [database.sql:1-25](file://database.sql#L1-L25)

**Section sources**
- [package.json:1-21](file://package.json#L1-L21)
- [server.js:1-162](file://server.js#L1-L162)

## Core Components
The system comprises several core components that implement distinct design patterns:

### Server Component (MVC Controller)
The Express server acts as the primary controller, handling HTTP requests and coordinating between authentication, database operations, and bot management. It implements:
- Request routing and response handling
- Authentication middleware integration
- Business logic coordination
- Error handling and validation

### Bot Manager Component (Factory Pattern)
The bot manager implements a factory pattern for dynamic bot creation and management:
- Creates Telegram bot instances on demand
- Manages bot lifecycle and caching
- Handles message processing and user interactions
- Supports multiple concurrent bot instances

### Worker Component (Observer Pattern)
The background worker implements an observer pattern for continuous monitoring:
- Periodically polls process statuses
- Observes changes in legal process data
- Notifies users via Telegram when updates occur
- Implements caching strategies for performance

### Authentication Component (Middleware Pattern)
The authentication module implements middleware pattern for security:
- JWT token generation and verification
- Request authentication middleware
- Role-based authorization middleware
- Password hashing and verification

### API Router Component (Plugin Pattern)
The API router implements a plugin pattern for service integration:
- Composes multiple API services
- Provides fallback mechanisms
- Supports extensible service architecture
- Enables easy addition of new API providers

**Section sources**
- [server.js:11-135](file://server.js#L11-L135)
- [botManager.js:7-42](file://botManager.js#L7-L42)
- [worker.js:9-67](file://worker.js#L9-L67)
- [auth.js:8-39](file://auth.js#L8-L39)
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)

## Architecture Overview
The system follows an event-driven architecture with clear separation of concerns:

```mermaid
sequenceDiagram
participant Client as "Client Application"
participant Server as "Express Server"
participant Auth as "Authentication"
participant Bot as "Telegram Bot"
participant Worker as "Background Worker"
participant API as "API Router"
participant DB as "Database"
Client->>Server : HTTP Request
Server->>Auth : Verify Token
Auth-->>Server : Authenticated User
Server->>DB : Query Data
DB-->>Server : Results
Server-->>Client : Response
Note over Bot,Worker : Event-Driven Processing
Bot->>API : Process Message
API->>DB : Store Process
API-->>Bot : Response
Worker->>DB : Poll Processes
Worker->>API : Check Updates
API-->>Worker : New Status
Worker->>Bot : Send Notification
```

**Diagram sources**
- [server.js:12-68](file://server.js#L12-L68)
- [botManager.js:13-39](file://botManager.js#L13-L39)
- [worker.js:17-60](file://worker.js#L17-L60)
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)

## Detailed Component Analysis

### MVC Pattern Implementation

#### Model Layer (Database Models)
The database layer implements data models through PostgreSQL tables with clear relationships:

```mermaid
erDiagram
USUARIOS {
serial id PK
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
integer usuario_id FK
text ultimo_status
timestamp atualizado_em
}
USUARIOS ||--o{ PROCESSOS : "owns"
```

**Diagram sources**
- [database.sql:5-24](file://database.sql#L5-L24)

#### View Layer (Client Interface)
The client-side interface consists of static HTML pages with JavaScript for user interaction:
- Login page for authentication
- Dashboard for process monitoring
- Real-time updates via Telegram integration

#### Controller Layer (Server.js)
The server implements controller responsibilities through route handlers:
- Authentication routes (/auth/*)
- User management routes (/usuario)
- Process management routes (/processos)
- Profile routes (/auth/me)

**Section sources**
- [database.sql:5-24](file://database.sql#L5-L24)
- [server.js:12-135](file://server.js#L12-L135)

### Observer Pattern Implementation

#### Background Worker Observer
The worker implements an observer pattern for continuous monitoring:

```mermaid
sequenceDiagram
participant Timer as "Interval Timer"
participant Worker as "Worker Loop"
participant DB as "Database"
participant API as "API Service"
participant Bot as "Telegram Bot"
Timer->>Worker : Every 5 minutes
Worker->>DB : SELECT processos
DB-->>Worker : Process List
loop For each process
Worker->>API : consultarProcesso()
API-->>Worker : Status Data
alt Status Changed
Worker->>DB : UPDATE processos
Worker->>Bot : sendMessage()
else No Change
Worker->>Worker : Continue
end
end
```

**Diagram sources**
- [worker.js:17-60](file://worker.js#L17-L60)
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)

Key observer characteristics:
- Event-driven polling mechanism
- Automatic detection of state changes
- Decoupled notification system
- Caching strategies for performance optimization

**Section sources**
- [worker.js:17-67](file://worker.js#L17-L67)

### Factory Pattern Implementation

#### Dynamic Bot Creation
The bot manager implements a factory pattern for dynamic bot instantiation:

```mermaid
classDiagram
class BotFactory {
+iniciarBot(token, userId) TelegramBot
+carregarBots() void
-bots Map~String,TelegramBot~
}
class TelegramBot {
+on(event, callback) void
+sendMessage(chatId, text) Promise
}
class BotManager {
+iniciarBot(token, userId) Promise
+carregarBots() Promise
}
BotFactory --> TelegramBot : "creates"
BotManager --> BotFactory : "uses"
```

**Diagram sources**
- [botManager.js:5-42](file://botManager.js#L5-L42)

Benefits of factory pattern:
- Centralized bot creation and management
- Prevents duplicate bot instances
- Supports dynamic bot scaling
- Encapsulates Telegram API complexity

**Section sources**
- [botManager.js:7-42](file://botManager.js#L7-L42)

### Middleware Pattern Implementation

#### Authentication and Authorization
The authentication module implements middleware pattern for security:

```mermaid
flowchart TD
Start([HTTP Request]) --> CheckAuth["Check Authorization Header"]
CheckAuth --> HasToken{"Token Present?"}
HasToken --> |No| Unauthorized["401 Unauthorized"]
HasToken --> |Yes| VerifyToken["Verify JWT Token"]
VerifyToken --> TokenValid{"Token Valid?"}
TokenValid --> |No| InvalidToken["401 Invalid Token"]
TokenValid --> |Yes| CheckRole["Check User Role"]
CheckRole --> IsAdmin{"Is Admin?"}
IsAdmin --> |Required| AdminAccess{"User Type == admin?"}
AdminAccess --> |No| Forbidden["403 Forbidden"]
AdminAccess --> |Yes| Next["Call Next Handler"]
IsAdmin --> |Not Required| Next
Next --> End([Response Sent])
Unauthorized --> End
InvalidToken --> End
Forbidden --> End
```

**Diagram sources**
- [auth.js:17-39](file://auth.js#L17-L39)

Middleware characteristics:
- Modular security enforcement
- Reusable across multiple routes
- Clear separation of concerns
- Extensible role-based access control

**Section sources**
- [auth.js:8-39](file://auth.js#L8-L39)
- [server.js:71-92](file://server.js#L71-L92)

### Plugin Pattern Implementation

#### API Service Integration
The API router implements a plugin pattern for service integration:

```mermaid
classDiagram
class APIService {
<<interface>>
+consultarProcesso(numero, user) Promise
}
class DataJudService {
+consultarDataJud(numero) Promise
}
class PremiumService {
+consultarPremium(numero, apiKey) Promise
}
class APIRouter {
+consultarProcesso(numero, user) Promise
-freeService APIService
-premiumService APIService
}
APIService <|.. DataJudService
APIService <|.. PremiumService
APIRouter --> APIService : "composes"
APIRouter --> DataJudService : "uses free"
APIRouter --> PremiumService : "uses paid"
```

**Diagram sources**
- [apiRouter.js:1-19](file://apiRouter.js#L1-L19)
- [services/datajud.js:3-29](file://services/datajud.js#L3-L29)
- [services/premium.js:1-12](file://services/premium.js#L1-L12)

Plugin pattern benefits:
- Easy addition of new API services
- Fallback mechanism implementation
- Service abstraction layer
- Configurable service selection

**Section sources**
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)

### Singleton Pattern Implementation

#### Bot Instance Management
The bot manager implements a singleton pattern for bot instance management:

```mermaid
sequenceDiagram
participant Client as "Client"
participant BotManager as "Bot Manager"
participant Cache as "Bot Cache"
participant Telegram as "Telegram API"
Client->>BotManager : iniciarBot(token, userId)
BotManager->>Cache : Check token exists
Cache-->>BotManager : Exists?
alt Bot exists
BotManager-->>Client : Existing Bot Instance
else No bot
BotManager->>Telegram : Create new bot
Telegram-->>BotManager : Bot Instance
BotManager->>Cache : Store bot instance
BotManager-->>Client : New Bot Instance
end
```

**Diagram sources**
- [botManager.js:7-42](file://botManager.js#L7-L42)

Singleton characteristics:
- Single instance per bot token
- Centralized bot lifecycle management
- Memory efficiency
- Thread-safe access patterns

**Section sources**
- [botManager.js:5-42](file://botManager.js#L5-L42)

### Event-Driven Architecture

#### Telegram Message Processing
The system implements event-driven architecture for Telegram integration:

```mermaid
sequenceDiagram
participant Telegram as "Telegram Platform"
participant Bot as "Telegram Bot"
participant Handler as "Message Handler"
participant API as "API Router"
participant DB as "Database"
Telegram->>Bot : message event
Bot->>Handler : on('message')
Handler->>Handler : Parse message text
Handler->>API : consultarProcesso(numero, user)
API->>DB : INSERT processos
DB-->>API : Success
API-->>Handler : Process data
Handler->>DB : Store process
Handler->>Bot : sendMessage()
Bot-->>Telegram : Reply message
```

**Diagram sources**
- [botManager.js:13-39](file://botManager.js#L13-L39)
- [apiRouter.js:4-16](file://apiRouter.js#L4-L16)

Event-driven benefits:
- Asynchronous message processing
- Non-blocking operation handling
- Scalable message throughput
- Decoupled component communication

**Section sources**
- [botManager.js:13-39](file://botManager.js#L13-L39)

## Dependency Analysis

```mermaid
graph TB
subgraph "Runtime Dependencies"
EX["express"]
PG["pg"]
JWT["jsonwebtoken"]
BC["bcryptjs"]
AX["axios"]
TG["node-telegram-bot-api"]
DV["dotenv"]
end
subgraph "Application Modules"
SRV["server.js"]
BOT["botManager.js"]
WRK["worker.js"]
AUT["auth.js"]
DBJ["db.js"]
API["apiRouter.js"]
DJD["services/datajud.js"]
PRM["services/premium.js"]
end
SRV --> EX
SRV --> AUT
SRV --> BOT
SRV --> DBJ
BOT --> TG
BOT --> DBJ
WRK --> PG
WRK --> API
WRK --> TG
AUT --> JWT
AUT --> BC
API --> DJD
API --> PRM
DBJ --> PG
DJD --> AX
```

**Diagram sources**
- [package.json:11-19](file://package.json#L11-L19)
- [server.js:1-6](file://server.js#L1-L6)
- [botManager.js:1-3](file://botManager.js#L1-L3)
- [worker.js:1-4](file://worker.js#L1-L4)
- [auth.js:1-3](file://auth.js#L1-L3)
- [apiRouter.js:1-2](file://apiRouter.js#L1-L2)

**Section sources**
- [package.json:11-19](file://package.json#L11-L19)

## Performance Considerations
The system implements several performance optimization strategies:

### Caching Strategies
- Bot instance caching to prevent recreation overhead
- User data caching to reduce database queries
- API response caching for frequently accessed data

### Database Optimization
- Connection pooling for efficient database connections
- Prepared statements for repeated queries
- Index-friendly query patterns

### Asynchronous Processing
- Non-blocking API calls
- Event-driven message handling
- Background worker for periodic tasks

## Troubleshooting Guide

### Common Issues and Solutions

#### Authentication Problems
- **Issue**: 401 Unauthorized token errors
- **Cause**: Missing or invalid JWT tokens
- **Solution**: Verify token presence and validity in authorization header

#### Bot Registration Issues
- **Issue**: Duplicate bot instances
- **Cause**: Multiple registrations for same bot token
- **Solution**: Check existing bot cache before creating new instances

#### API Integration Failures
- **Issue**: Process lookup failures
- **Cause**: External API unavailability or rate limiting
- **Solution**: Implement fallback mechanisms and retry logic

#### Database Connection Problems
- **Issue**: Connection pool exhaustion
- **Cause**: High concurrent request volume
- **Solution**: Monitor connection pool usage and adjust pool size

**Section sources**
- [auth.js:17-31](file://auth.js#L17-L31)
- [botManager.js:9-42](file://botManager.js#L9-L42)
- [worker.js:17-60](file://worker.js#L17-L60)

## Conclusion
The Legal Process Monitoring System demonstrates a well-architected application that successfully implements multiple design patterns to achieve scalability, maintainability, and extensibility. The MVC separation ensures clear responsibility distribution, while the Observer pattern enables efficient background monitoring. The Factory, Middleware, Plugin, Singleton, and Event-Driven patterns work together to create a robust, scalable system capable of handling legal process monitoring with Telegram integration. The modular architecture allows for easy extension and maintenance, making it suitable for production deployment and future enhancements.