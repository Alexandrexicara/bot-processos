# Premium Paid Service Integration

<cite>
**Referenced Files in This Document**
- [escavador.js](file://services/escavador.js)
- [premium.js](file://services/premium.js)
- [jusbrasil.js](file://services/jusbrasil.js)
- [digesto.js](file://services/digesto.js)
- [custom.js](file://services/custom.js)
- [datajud.js](file://services/datajud.js)
- [apiRouter.js](file://apiRouter.js)
- [auth.js](file://auth.js)
- [server.js](file://server.js)
- [worker.js](file://worker.js)
- [botManager.js](file://botManager.js)
- [db.js](file://db.js)
- [database.sql](file://database.sql)
- [package.json](file://package.json)
- [README.md](file://README.md)
</cite>

## Update Summary
**Changes Made**
- Updated Jusbrasil service from placeholder to fully functional integration with sophisticated OAB monitoring capabilities
- Added comprehensive documentation for the three-phase OAB workflow: checking monitoring status, registering new OAB associations, and retrieving linked processes
- Enhanced premium service architecture to include Jusbrasil as a first-tier premium provider
- Updated service priority hierarchy to reflect Jusbrasil's advanced capabilities
- Added detailed error handling and timeout configurations for premium services
- Documented comprehensive Bearer token authentication across all premium services

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Premium Service Integration](#premium-service-integration)
7. [Enhanced Jusbrasil Service](#enhanced-jusbrasil-service)
8. [Premium Service Configuration](#premium-service-configuration)
9. [API Key Authentication](#api-key-authentication)
10. [Response Standardization](#response-standardization)
11. [Dependency Analysis](#dependency-analysis)
12. [Performance Considerations](#performance-considerations)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Conclusion](#conclusion)
15. [Appendices](#appendices)

## Introduction
This document describes the premium paid service integration for the judicial process monitoring SaaS. The system provides:
- Free tier using CNJ's DataJud API
- Premium tier with enhanced data retrieval through multiple service providers
- Advanced OAB (Brazilian Bar Association) integration with specialized endpoints
- Telegram bot integration for user interaction
- Admin panel for managing users and configurations
- Automated monitoring of process updates

The premium service acts as an optional enhancement to the free DataJud integration, enabling richer data when the free tier does not return results. The system now supports multiple premium service providers including Jusbrasil, Escavador, and custom integrations. Jusbrasil has been transformed from a placeholder to a fully functional integration with sophisticated OAB monitoring capabilities.

## Project Structure
The project follows a modular Node.js architecture with clear separation of concerns:
- Services: Data access and external API integrations (including premium services)
- Authentication: JWT-based user authentication and authorization
- Web server: Express-based API endpoints and static file serving
- Background workers: Automated monitoring and Telegram bot management
- Database: PostgreSQL schema for user and process data

```mermaid
graph TB
subgraph "Web Layer"
Server["Express Server<br/>server.js"]
Auth["Authentication<br/>auth.js"]
Router["API Router<br/>apiRouter.js"]
end
subgraph "Premium Services"
Jusbrasil["Jusbrasil Service<br/>services/jusbrasil.js"]
Escavador["Escavador Service<br/>services/escavador.js"]
DataJud["DataJud Service<br/>services/datajud.js"]
Digesto["Digesto Service<br/>services/digesto.js"]
Custom["Custom Service<br/>services/custom.js"]
Premium["Premium Placeholder<br/>services/premium.js"]
end
subgraph "Background Workers"
Worker["Monitor Worker<br/>worker.js"]
BotMgr["Bot Manager<br/>botManager.js"]
end
subgraph "Data Layer"
DB["PostgreSQL<br/>database.sql"]
Pool["Connection Pool<br/>db.js"]
end
Server --> Auth
Server --> Router
Router --> Jusbrasil
Router --> Escavador
Router --> DataJud
Router --> Digesto
Router --> Custom
Router --> Premium
Worker --> Router
BotMgr --> Router
Router --> DB
Worker --> DB
BotMgr --> DB
DB --> Pool
```

**Diagram sources**
- [server.js:1-326](file://server.js#L1-L326)
- [apiRouter.js:1-55](file://apiRouter.js#L1-L55)
- [jusbrasil.js:1-197](file://services/jusbrasil.js#L1-L197)
- [escavador.js:1-108](file://services/escavador.js#L1-L108)
- [datajud.js:1-305](file://services/datajud.js#L1-L305)
- [digesto.js:1-25](file://services/digesto.js#L1-L25)
- [custom.js:1-26](file://services/custom.js#L1-L26)
- [premium.js:1-12](file://services/premium.js#L1-L12)
- [worker.js:1-74](file://worker.js#L1-74)
- [botManager.js:1-53](file://botManager.js#L1-L53)
- [database.sql:1-25](file://database.sql#L1-L25)
- [db.js:1-11](file://db.js#L1-L11)

**Section sources**
- [README.md:1-56](file://README.md#L1-L56)
- [package.json:1-21](file://package.json#L1-L21)

## Core Components
The premium service integration consists of several key components working together:

### Premium Service Providers
The system now supports multiple premium service providers with standardized interfaces:
- **Jusbrasil**: Advanced OAB monitoring with asynchronous collection and three-phase workflow
- **Escavador**: Direct process number and OAB searches with Bearer token authentication
- **DataJud**: CNJ-based searches with sophisticated tribunal detection and rate limiting
- **Digesto**: Custom API integration framework (placeholder)
- **Custom**: Generic tribunal API integration framework (placeholder)

### Enhanced API Router Logic
The router implements a sophisticated tiered approach:
1. **OAB Priority**: Jusbrasil → Escavador → DataJud (in order of priority)
2. **Mode-based Strategy**: Different fallback behaviors based on user mode
3. **Premium Service Chain**: Multiple premium services with automatic failover

### Authentication and Authorization
The system uses JWT tokens for user authentication and role-based access control for administrative functions.

### Database Schema
The schema supports user profiles, Telegram integration, and premium configuration through dedicated fields.

**Section sources**
- [apiRouter.js:14-37](file://apiRouter.js#L14-L37)
- [apiRouter.js:39-52](file://apiRouter.js#L39-L52)
- [auth.js:16-39](file://auth.js#L16-L39)
- [database.sql:5-24](file://database.sql#L5-L24)

## Architecture Overview
The premium service architecture implements a hybrid approach combining free and paid tiers with multiple service providers:

```mermaid
sequenceDiagram
participant Client as "Telegram Client"
participant Bot as "Telegram Bot"
participant Server as "Express Server"
participant Router as "API Router"
participant Jusbrasil as "Jusbrasil Service"
participant Escavador as "Escavador Service"
participant DataJud as "DataJud Service"
participant Premium as "Premium Services"
participant DB as "PostgreSQL"
Client->>Bot : Send process number/OAB
Bot->>Server : Message event
Server->>Router : consultarProcesso(query, user)
alt OAB Search
Router->>Jusbrasil : consultarPorOAB(uf, numero)
Jusbrasil-->>Router : OAB results or null
alt Jusbrasil Success
Router-->>Server : Process data
Server-->>Bot : Send formatted response
else Jusbrasil Failed
Router->>Escavador : consultarPorOAB(uf, numero)
Escavador-->>Router : OAB results or []
else Direct Process Search
Router->>DataJud : consultarProcesso(numero)
DataJud-->>Router : Free result or []
end
alt Mode == 'pago' or 'hibrido'
Router->>Premium : buscarPagas(query)
Premium-->>Router : Premium result or null
end
Router-->>Server : Process data
Server-->>Bot : Send formatted response
Note over Router,DB : Background monitoring updates process status
```

**Diagram sources**
- [botManager.js:13-39](file://botManager.js#L13-L39)
- [apiRouter.js:14-37](file://apiRouter.js#L14-L37)
- [jusbrasil.js:31-68](file://services/jusbrasil.js#L31-L68)
- [escavador.js:29-66](file://services/escavador.js#L29-L66)
- [datajud.js:151-189](file://services/datajud.js#L151-L189)

## Detailed Component Analysis

### Premium Service Provider Architecture
The premium service architecture supports multiple providers with standardized interfaces:

```mermaid
classDiagram
class PremiumServiceProvider {
+consultar(query) Promise~Object[]~
+nome string
+gratuito boolean
}
class JusbrasilService {
+consultarPorOAB(uf, numero) Promise~Object[]~
+buscarOABMonitorada(uf, numero) Promise~Object~
+cadastrarOAB(uf, numero) Promise~Object~
+listarProcessosPorOAB(oabId) Promise~Object[]~
+consultarPorProcesso(numero) Promise~Object[]~
}
class EscavadorService {
+consultarPorOAB(uf, numeroOAB) Promise~Object[]~
+consultarPorProcesso(numero) Promise~Object[]~
}
class DataJudService {
+consultarOAB(uf, numeroOAB) Promise~Object[]~
+consultarProcesso(numero) Promise~Object[]~
}
class DigestoService {
+consultar(query) Promise~Object[]~
}
class CustomService {
+consultar(query) Promise~Object[]~
}
PremiumServiceProvider <|-- JusbrasilService
PremiumServiceProvider <|-- EscavadorService
PremiumServiceProvider <|-- DataJudService
PremiumServiceProvider <|-- DigestoService
PremiumServiceProvider <|-- CustomService
```

**Diagram sources**
- [jusbrasil.js:10-25](file://services/jusbrasil.js#L10-L25)
- [escavador.js:10-25](file://services/escavador.js#L10-L25)
- [datajud.js:191-278](file://services/datajud.js#L191-L278)
- [digesto.js:5-18](file://services/digesto.js#L5-L18)
- [custom.js:7-18](file://services/custom.js#L7-L18)

### API Router Logic Flow
The router implements sophisticated fallback logic with premium service integration:

```mermaid
flowchart TD
Start([Process Request]) --> CheckType{"Query Type?"}
CheckType --> |OAB| CheckJusbrasil["Try Jusbrasil OAB"]
CheckJusbrasil --> JusbrasilSuccess{"Jusbrasil<br/>Success?"}
JusbrasilSuccess --> |Yes| ReturnJusbrasil["Return Jusbrasil Data"]
JusbrasilSuccess --> |No| CheckEscavador["Try Escavador OAB"]
CheckEscavador --> EscavadorSuccess{"Escavador<br/>Success?"}
EscavadorSuccess --> |Yes| ReturnEscavador["Return Escavador Data"]
EscavadorSuccess --> |No| CheckDataJud["Try DataJud OAB"]
CheckDataJud --> DataJudSuccess{"DataJud<br/>Success?"}
DataJudSuccess --> |Yes| ReturnDataJud["Return DataJud Data"]
DataJudSuccess --> |No| CheckMode["Check User Mode"]
CheckMode --> ModePaid{"Mode == 'pago' or 'hibrido'?"}
ModePaid --> |Yes| TryPremium["Try Premium Services"]
TryPremium --> PremiumSuccess{"Premium<br/>Success?"}
PremiumSuccess --> |Yes| ReturnPremium["Return Premium Data"]
PremiumSuccess --> |No| ReturnNull["Return Null"]
ModePaid --> |No| ReturnNull
CheckType --> |Process| CheckMode2{"User Mode?"}
CheckMode2 --> ModePago{"Mode == 'pago'?"}
ModePago --> |Yes| TryPremium2["Try Premium Services"]
TryPremium2 --> PremiumSuccess2{"Premium<br/>Success?"}
PremiumSuccess2 --> |Yes| ReturnPremium2["Return Premium Data"]
PremiumSuccess2 --> |No| CheckDataJud2["Try DataJud"]
CheckDataJud2 --> DataJudSuccess2{"DataJud<br/>Success?"}
DataJudSuccess2 --> |Yes| ReturnDataJud2["Return DataJud Data"]
DataJudSuccess2 --> |No| ReturnNull
ModePago --> |No| CheckDataJud2
CheckMode2 --> ModeHibrido{"Mode == 'hibrido'?"}
ModeHibrido --> |Yes| CheckDataJud3["Try DataJud First"]
CheckDataJud3 --> DataJudSuccess3{"DataJud<br/>Success?"}
DataJudSuccess3 --> |Yes| ReturnDataJud3["Return DataJud Data"]
DataJudSuccess3 --> |No| TryPremium3["Try Premium Services"]
TryPremium3 --> PremiumSuccess3{"Premium<br/>Success?"}
PremiumSuccess3 --> |Yes| ReturnPremium3["Return Premium Data"]
PremiumSuccess3 --> |No| ReturnNull
ModeHibrido --> |No| CheckDataJud3
ReturnJusbrasil --> End([End])
ReturnEscavador --> End
ReturnDataJud --> End
ReturnPremium --> End
ReturnDataJud2 --> End
ReturnPremium2 --> End
ReturnDataJud3 --> End
ReturnPremium3 --> End
ReturnNull --> End
```

**Diagram sources**
- [apiRouter.js:14-37](file://apiRouter.js#L14-L37)

**Section sources**
- [apiRouter.js:14-37](file://apiRouter.js#L14-L37)

### Authentication and Authorization System
The authentication system provides comprehensive security:

```mermaid
classDiagram
class AuthSystem {
+gerarToken(user) string
+authMiddleware(req, res, next) void
+adminMiddleware(req, res, next) void
+hashSenha(senha) string
+verificarSenha(senha, hash) boolean
-JWT_SECRET string
}
class User {
+number id
+string email
+string tipo
+string api_key
+string modo
}
class TokenPayload {
+number id
+string email
+string tipo
+datetime expiresIn
}
AuthSystem --> User : "manages"
AuthSystem --> TokenPayload : "creates"
```

**Diagram sources**
- [auth.js:8-58](file://auth.js#L8-L58)

**Section sources**
- [auth.js:16-39](file://auth.js#L16-L39)

### Database Schema Design
The database schema supports the premium service integration:

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
USUARIOS ||--o{ PROCESSOS : "has_many"
```

**Diagram sources**
- [database.sql:5-24](file://database.sql#L5-L24)

**Section sources**
- [database.sql:5-24](file://database.sql#L5-L24)

### Background Monitoring System
The worker system provides automated process monitoring:

```mermaid
sequenceDiagram
participant Timer as "Interval Timer"
participant Worker as "Worker Loop"
participant DB as "Database"
participant Router as "API Router"
participant Telegram as "Telegram Bot"
Timer->>Worker : Every 5 minutes
Worker->>DB : SELECT * FROM processos
Worker->>DB : SELECT * FROM usuarios WHERE id=$1
Worker->>Router : consultarProcesso(numero, user)
Router-->>Worker : Process data
alt Status changed
Worker->>DB : UPDATE processos SET ultimo_status=$1
Worker->>Telegram : Send notification
else No change
Worker->>Worker : Continue
end
```

**Diagram sources**
- [worker.js:17-61](file://worker.js#L17-L61)

**Section sources**
- [worker.js:17-61](file://worker.js#L17-L61)

## Premium Service Integration

### Service Provider Hierarchy
The premium service integration establishes a clear hierarchy of service providers:

```mermaid
graph TD
subgraph "Premium Service Providers"
Jusbrasil["Jusbrasil<br/>• Advanced OAB Monitoring<br/>• Three-phase Workflow<br/>• Asynchronous Collection<br/>• Sophisticated Error Handling"]
Escavador["Escavador<br/>• Direct Process Search<br/>• OAB Endpoint<br/>• Bearer Auth"]
DataJud["DataJud (CNJ)<br/>• CNJ-based Searches<br/>• Tribunal Detection<br/>• Rate Limiting"]
Digesto["Digesto<br/>• Custom API Framework<br/>• Placeholder"]
Custom["Custom<br/>• Generic Tribunal API<br/>• Placeholder"]
Premium["Premium Placeholder<br/>• Legacy Support<br/>• Testing"]
end
subgraph "Configuration"
EnvVars["Environment Variables<br/>• JUSBRASIL_API_KEY<br/>• ESCAVADOR_API_KEY<br/>• DATAJUD_API_KEY<br/>• DIGESTO_API_KEY<br/>• TJ_API_KEY"]
UserConfig["User Configuration<br/>• api_key field<br/>• modo field<br/>• tipo field"]
end
Jusbrasil --> EnvVars
Escavador --> EnvVars
DataJud --> EnvVars
Digesto --> EnvVars
Custom --> EnvVars
Premium --> UserConfig
```

**Diagram sources**
- [jusbrasil.js:3-7](file://services/jusbrasil.js#L3-L7)
- [escavador.js:3-5](file://services/escavador.js#L3-L5)
- [datajud.js:3-5](file://services/datajud.js#L3-L5)
- [digesto.js:1-3](file://services/digesto.js#L1-L3)
- [custom.js:3-4](file://services/custom.js#L3-L4)

### Service Registration and Discovery
The system automatically discovers and registers premium services:

```mermaid
flowchart LR
subgraph "Service Discovery"
Services["Premium Services Array<br/>• services/jusbrasil.js<br/>• services/datajud.js<br/>• services/digesto.js<br/>• services/custom.js"]
Register["Module Registration<br/>• require() services<br/>• Extract { nome, gratuito, consultar }"]
Filter["Auto-filter Disabled Services<br/>• Check API_KEY env var<br/>• Skip if not configured"]
end
subgraph "Runtime Execution"
Execute["Service Execution<br/>• Loop through services<br/>• Execute consultar(query)<br/>• Handle results<br/>• Return on first success"]
end
Services --> Register --> Filter --> Execute
```

**Diagram sources**
- [apiRouter.js:6-11](file://apiRouter.js#L6-L11)
- [apiRouter.js:39-52](file://apiRouter.js#L39-L52)

**Section sources**
- [apiRouter.js:6-11](file://apiRouter.js#L6-L11)
- [apiRouter.js:39-52](file://apiRouter.js#L39-L52)

## Enhanced Jusbrasil Service

### Three-Phase OAB Workflow
The Jusbrasil service implements a sophisticated three-phase workflow for OAB monitoring:

```mermaid
sequenceDiagram
participant Client as "Client"
participant Router as "API Router"
participant Jusbrasil as "Jusbrasil Service"
participant MonitorAPI as "Monitor API"
participant ProcessAPI as "Process API"
Client->>Router : consultarPorOAB(uf, numero)
Router->>Jusbrasil : consultarPorOAB(uf, numero)
Jusbrasil->>MonitorAPI : GET /api/monitoramento/oab/acompanhamento/{UF}/{NUMERO}
MonitorAPI-->>Jusbrasil : OAB Status (exists/not found)
alt OAB Already Monitored
Jusbrasil->>ProcessAPI : GET /api/monitoramento/oab/vinculos/processos/oab
ProcessAPI-->>Jusbrasil : Linked Processes
Jusbrasil-->>Router : Process Results
else OAB Not Monitored
Jusbrasil->>MonitorAPI : POST /api/monitoramento/oab/acompanhamento/
MonitorAPI-->>Jusbrasil : New OAB Registration
Jusbrasil->>ProcessAPI : GET /api/monitoramento/oab/vinculos/processos/oab
ProcessAPI-->>Jusbrasil : Process Results (if available)
Jusbrasil-->>Router : Process Results or Empty Array
end
```

**Diagram sources**
- [jusbrasil.js:31-68](file://services/jusbrasil.js#L31-L68)
- [jusbrasil.js:71-124](file://services/jusbrasil.js#L71-L124)
- [jusbrasil.js:127-158](file://services/jusbrasil.js#L127-L158)

### Advanced OAB Monitoring Capabilities
The Jusbrasil service provides comprehensive OAB monitoring with sophisticated features:

```mermaid
flowchart TD
subgraph "OAB Monitoring Workflow"
Phase1["Phase 1: Check OAB Status<br/>• GET /acompanhamento/{UF}/{NUMERO}<br/>• 15s timeout<br/>• 404 = Not Monitored"]
Phase2["Phase 2: Register New OAB<br/>• POST /acompanhamento/<br/>• 409 Conflict = Already Exists<br/>• Auto-retry on success"]
Phase3["Phase 3: Retrieve Linked Processes<br/>• GET /vinculos/processos/oab<br/>• 30s timeout<br/>• 50 results max per page"]
end
subgraph "Asynchronous Collection"
AsyncCollection["Asynchronous Data Collection<br/>• Immediate results may be empty<br/>• Processed data arrives later<br/>• Graceful handling of async state"]
end
Phase1 --> Phase2 --> Phase3
Phase3 --> AsyncCollection
```

**Diagram sources**
- [jusbrasil.js:31-68](file://services/jusbrasil.js#L31-L68)
- [jusbrasil.js:71-124](file://services/jusbrasil.js#L71-L124)
- [jusbrasil.js:127-158](file://services/jusbrasil.js#L127-L158)

### Sophisticated Error Handling
The Jusbrasil service implements comprehensive error handling with timeout configurations:

```mermaid
flowchart TD
Start([API Request]) --> CheckAPIKey{"API Key<br/>Configured?"}
CheckAPIKey --> |No| SkipService["Skip Service<br/>Log Warning"]
CheckAPIKey --> |Yes| ExecutePhase["Execute OAB Workflow"]
ExecutePhase --> Phase1["Phase 1: Check Status<br/>• 15s timeout<br/>• Handle 404 gracefully"]
Phase1 --> Phase2{"OAB<br/>Exists?"}
Phase2 --> |Yes| Phase3["Phase 3: Get Processes<br/>• 30s timeout<br/>• Convert to internal format"]
Phase2 --> |No| Phase4["Phase 2: Register OAB<br/>• 15s timeout<br/>• Handle 409 conflict"]
Phase4 --> Phase3
Phase3 --> HandleResult{"Results<br/>Available?"}
HandleResult --> |Yes| ReturnResults["Return Process List"]
HandleResult --> |No| ReturnEmpty["Return Empty Array"]
SkipService --> End([End])
ReturnResults --> End
ReturnEmpty --> End
```

**Diagram sources**
- [jusbrasil.js:10-25](file://services/jusbrasil.js#L10-L25)
- [jusbrasil.js:31-68](file://services/jusbrasil.js#L31-L68)
- [jusbrasil.js:71-124](file://services/jusbrasil.js#L71-L124)

### Response Standardization
The Jusbrasil service provides standardized response formatting:

```mermaid
classDiagram
class JusbrasilResponse {
+string cnj
+string created_at
+number id
}
class InternalFormat {
+string numero
+string tribunal
+string classe
+string data
+string grau
+string orgaoJulgador
+null _score
}
JusbrasilResponse --> InternalFormat : "standardized"
note for InternalFormat "Fields mapped from Jusbrasil response"
```

**Diagram sources**
- [jusbrasil.js:144-152](file://services/jusbrasil.js#L144-L152)

**Section sources**
- [jusbrasil.js:10-25](file://services/jusbrasil.js#L10-L25)
- [jusbrasil.js:31-68](file://services/jusbrasil.js#L31-L68)
- [jusbrasil.js:71-124](file://services/jusbrasil.js#L71-L124)
- [jusbrasil.js:127-158](file://services/jusbrasil.js#L127-L158)
- [jusbrasil.js:160-190](file://services/jusbrasil.js#L160-L190)

## Premium Service Configuration

### Environment Variable Setup
Premium services require specific environment variables for authentication:

| Service | Environment Variable | Purpose |
|---------|---------------------|---------|
| Jusbrasil | `JUSBRASIL_API_KEY` | Primary premium service authentication |
| Escavador | `ESCAVADOR_API_KEY` | Secondary premium service authentication |
| DataJud | `DATAJUD_API_KEY` | CNJ API authentication (server-level) |
| Digesto | `DIGESTO_API_KEY` | Custom API integration authentication |
| TJ API | `TJ_API_KEY` | Generic tribunal API authentication |

### User Configuration Fields
Users can configure premium access through database fields:

```mermaid
classDiagram
class UserConfiguration {
+string api_key
+string modo
+string tipo
+string telegram_id
+string bot_token
}
class ModeOptions {
<<enumeration>>
'gratis' : "Free only"
'hibrido' : "Hybrid (Free + Premium)"
'pago' : "Premium only"
}
class TypeOptions {
<<enumeration>>
'cliente' : "Regular user"
'admin' : "Administrator"
}
UserConfiguration --> ModeOptions : "configures"
UserConfiguration --> TypeOptions : "has role"
```

**Diagram sources**
- [database.sql:13-14](file://database.sql#L13-L14)

### Service Priority and Fallback
The system implements intelligent service priority and fallback mechanisms:

```mermaid
flowchart TD
subgraph "Service Priority"
Priority1["Jusbrasil OAB<br/>• Highest Priority<br/>• Advanced Features<br/>• Three-phase Workflow<br/>• Asynchronous Collection"]
Priority2["Escavador OAB<br/>• Second Priority<br/>• Direct OAB Endpoint<br/>• Bearer Auth"]
Priority3["DataJud OAB<br/>• Third Priority<br/>• CNJ-based Searches<br/>• Tribunal Detection"]
Priority4["DataJud Process<br/>• Fourth Priority<br/>• Free Service<br/>• Limited Coverage"]
Priority5["Premium Services<br/>• Fifth Priority<br/>• Legacy Support<br/>• Testing"]
end
subgraph "Mode-based Selection"
ModeGratis["Mode 'gratis'<br/>• Only DataJud<br/>• No Premium Services"]
ModeHibrido["Mode 'hibrido'<br/>• Try DataJud First<br/>• Then Premium Services"]
ModePago["Mode 'pago'<br/>• Try Premium Services First<br/>• Then DataJud"]
end
Priority1 --> ModeHibrido
Priority2 --> ModeHibrido
Priority3 --> ModeHibrido
Priority4 --> ModeHibrido
Priority5 --> ModeHibrido
Priority1 --> ModePago
Priority2 --> ModePago
Priority3 --> ModePago
Priority4 --> ModePago
Priority5 --> ModePago
```

**Diagram sources**
- [apiRouter.js:21-37](file://apiRouter.js#L21-L37)
- [apiRouter.js:39-52](file://apiRouter.js#L39-L52)

**Section sources**
- [database.sql:13-14](file://database.sql#L13-L14)
- [apiRouter.js:21-37](file://apiRouter.js#L21-L37)
- [apiRouter.js:39-52](file://apiRouter.js#L39-L52)

## API Key Authentication

### Bearer Token Implementation
All premium services use Bearer token authentication with standardized headers:

```mermaid
sequenceDiagram
participant Client as "Client"
participant Service as "Premium Service"
participant ExternalAPI as "External API"
Client->>Service : Request with Query
Service->>Service : Check API Key Environment Variable
Service->>ExternalAPI : HTTP Request with Bearer Header
ExternalAPI-->>Service : HTTP Response
Service-->>Client : Processed Results
Note over Service : Authorization : Bearer {API_KEY}
```

**Diagram sources**
- [jusbrasil.js:76](file://services/jusbrasil.js#L76)
- [jusbrasil.js:105](file://services/jusbrasil.js#L105)
- [jusbrasil.js:134](file://services/jusbrasil.js#L134)
- [jusbrasil.js:168](file://services/jusbrasil.js#L168)
- [escavador.js:38](file://services/escavador.js#L38)
- [escavador.js:74](file://services/escavador.js#L74)

### Authentication Error Handling
The system implements comprehensive error handling for authentication failures:

```mermaid
flowchart TD
AuthStart([Authentication Attempt]) --> CheckKey{"API Key<br/>Available?"}
CheckKey --> |No| SkipService["Skip Service<br/>Log: API Key not configured"]
CheckKey --> |Yes| MakeRequest["Make API Request<br/>with Bearer Token"]
MakeRequest --> CheckStatus{"HTTP Status"}
CheckStatus --> |200| Success["Authentication<br/>Success"]
CheckStatus --> |401| AuthError["Authentication<br/>Failed"]
CheckStatus --> |403| Forbidden["Access<br/>Denied"]
CheckStatus --> |Other| OtherError["Other<br/>Error"]
AuthError --> LogError["Log Error Details<br/>Return null"]
Forbidden --> LogError
OtherError --> LogError
Success --> ProcessResponse["Process Response<br/>Return Results"]
SkipService --> End([End])
ProcessResponse --> End
LogError --> End
```

**Diagram sources**
- [jusbrasil.js:11](file://services/jusbrasil.js#L11-L14)
- [jusbrasil.js:62-67](file://services/jusbrasil.js#L62-L67)
- [escavador.js:11](file://services/escavador.js#L11-L14)
- [escavador.js:60-65](file://services/escavador.js#L60-L65)

### Security Best Practices
Premium services follow security best practices:

- **Environment Variable Storage**: API keys stored in environment variables, not in code
- **Bearer Token Usage**: Standardized Bearer token authentication across all services
- **Timeout Configuration**: Configured timeouts to prevent hanging requests
- **Error Logging**: Structured error logging without exposing sensitive information
- **Graceful Degradation**: Services gracefully skip when API keys are not configured

**Section sources**
- [jusbrasil.js:3-7](file://services/jusbrasil.js#L3-L7)
- [escavador.js:3-5](file://services/escavador.js#L3-L5)
- [jusbrasil.js:76](file://services/jusbrasil.js#L76)
- [jusbrasil.js:105](file://services/jusbrasil.js#L105)
- [jusbrasil.js:134](file://services/jusbrasil.js#L134)
- [jusbrasil.js:168](file://services/jusbrasil.js#L168)
- [escavador.js:38](file://services/escavador.js#L38)
- [escavador.js:74](file://services/escavador.js#L74)

## Response Standardization

### Unified Response Format
All premium services return standardized responses compatible with the internal format:

```mermaid
classDiagram
class StandardResponse {
+string numero
+string tribunal
+string classe
+string data
+string grau
+string orgaoJulgador
+number _score
}
class JusbrasilResponse {
+string cnj
+string created_at
}
class EscavadorResponse {
+string numero_cnj
+string tribunal
+string classe
+string data_inicio
}
class DataJudResponse {
+string numeroProcesso
+string tribunal
+string classeProcessual
+string dataHoraUltimaAtualizacao
}
StandardResponse <|-- JusbrasilResponse : "mapped"
StandardResponse <|-- EscavadorResponse : "mapped"
StandardResponse <|-- DataJudResponse : "native"
```

**Diagram sources**
- [jusbrasil.js:144-152](file://services/jusbrasil.js#L144-L152)
- [escavador.js:48-58](file://services/escavador.js#L48-L58)
- [datajud.js:286-294](file://services/datajud.js#L286-L294)

### Field Mapping Strategy
The system implements consistent field mapping across different service providers:

| Field | Jusbrasil | Escavador | DataJud | Internal Format |
|-------|-----------|-----------|---------|-----------------|
| Process Number | `cnj` | `numero_cnj` | `numeroProcesso` | `numero` |
| Court | `''` | `tribunal` | `tribunal` | `tribunal` |
| Class | `''` | `classe` | `classeProcessual` | `classe` |
| Date | `created_at` | `data_inicio` | `dataHoraUltimaAtualizacao` | `data` |
| Degree | `''` | `grau` | `grau` | `grau` |
| Court Body | `''` | `orgao` | `orgaoJulgador` | `orgaoJulgador` |
| Score | `null` | `null` | `_score` | `_score` |

### Error Response Handling
The system handles various error scenarios consistently:

```mermaid
flowchart TD
ErrorStart([Error Occurrence]) --> CheckService{"Service Type?"}
CheckService --> JusbrasilError["Jusbrasil Error<br/>• Log detailed error<br/>• Return null"]
CheckService --> EscavadorError["Escavador Error<br/>• Log status/message<br/>• Return null"]
CheckService --> DataJudError["DataJud Error<br/>• Return null"]
CheckService --> PremiumError["Premium Error<br/>• Log error<br/>• Return null"]
JusbrasilError --> NextService["Try Next Service"]
EscavadorError --> NextService
DataJudError --> NextService
PremiumError --> NextService
NextService --> CheckFallback{"More Services<br/>Available?"}
CheckFallback --> |Yes| ExecuteNext["Execute Next Service"]
CheckFallback --> |No| ReturnNull["Return null"]
ExecuteNext --> CheckSuccess{"Results<br/>Found?"}
CheckSuccess --> |Yes| ReturnResults["Return Results"]
CheckSuccess --> |No| NextService
ReturnResults --> End([End])
ReturnNull --> End
```

**Diagram sources**
- [apiRouter.js:47](file://apiRouter.js#L47)
- [jusbrasil.js:62-67](file://services/jusbrasil.js#L62-L67)
- [escavador.js:60-65](file://services/escavador.js#L60-L65)
- [datajud.js:114](file://services/datajud.js#L114)

**Section sources**
- [jusbrasil.js:144-152](file://services/jusbrasil.js#L144-L152)
- [escavador.js:48-58](file://services/escavador.js#L48-L58)
- [datajud.js:286-294](file://services/datajud.js#L286-L294)
- [apiRouter.js:47](file://apiRouter.js#L47)

## Dependency Analysis
The system exhibits clean dependency management with clear separation of concerns:

```mermaid
graph LR
subgraph "External Dependencies"
Axios["axios ^1.6.0"]
JWT["jsonwebtoken ^9.0.3"]
BCrypt["bcryptjs ^2.4.3"]
PG["pg ^8.11.0"]
Telegram["node-telegram-bot-api ^0.63.0"]
Dotenv["dotenv ^16.0.0"]
end
subgraph "Internal Modules"
Server["server.js"]
Auth["auth.js"]
Router["apiRouter.js"]
Jusbrasil["services/jusbrasil.js"]
Escavador["services/escavador.js"]
DataJud["services/datajud.js"]
Digesto["services/digesto.js"]
Custom["services/custom.js"]
Worker["worker.js"]
BotMgr["botManager.js"]
DB["db.js"]
end
Server --> Auth
Server --> Router
Router --> Jusbrasil
Router --> Escavador
Router --> DataJud
Router --> Digesto
Router --> Custom
Worker --> Router
BotMgr --> Router
Server --> DB
Worker --> DB
BotMgr --> DB
Jusbrasil -.-> Axios
Escavador -.-> Axios
DataJud -.-> Axios
Digesto -.-> Axios
Custom -.-> Axios
Server -.-> JWT
Server -.-> BCrypt
DB -.-> PG
BotMgr -.-> Telegram
Server -.-> Dotenv
```

**Diagram sources**
- [package.json:11-19](file://package.json#L11-L19)
- [server.js:1-10](file://server.js#L1-L10)
- [jusbrasil.js:1](file://services/jusbrasil.js#L1)
- [escavador.js:1](file://services/escavador.js#L1)
- [datajud.js:1](file://services/datajud.js#L1)

**Section sources**
- [package.json:11-19](file://package.json#L11-L19)

## Performance Considerations
The premium service integration includes several performance optimizations:

### Caching Strategies
- **Bot instances caching**: Prevents recreation of Telegram bot instances
- **User data caching**: Reduces repeated database queries in worker loops
- **Connection pooling**: Efficient database connection management
- **Service discovery caching**: Avoids repeated module loading

### Asynchronous Processing
- Non-blocking API calls using async/await
- Parallel processing where safe (avoiding concurrent database operations)
- Background processing for monitoring tasks
- Timeout configuration for external API calls

### Resource Management
- Connection limits and timeouts for external API calls
- Graceful degradation when premium services are unavailable
- Efficient database queries with proper indexing
- Service auto-discovery with environment variable checks

### Premium Service Optimization
- **Service prioritization**: Most capable services first (Jusbrasil, then Escavador, then DataJud)
- **Automatic service skipping**: Services without API keys are skipped automatically
- **Error handling**: Comprehensive error handling prevents cascading failures
- **Response standardization**: Consistent response format reduces processing overhead
- **Three-phase OAB workflow**: Optimized for minimal API calls and maximum efficiency

## Troubleshooting Guide

### Common Issues and Solutions

#### Authentication Problems
- **Symptom**: 401 Token inválido
- **Cause**: Expired or malformed JWT token
- **Solution**: Regenerate token using login endpoint

#### Premium Service Access Issues
- **Symptom**: Premium fallback not triggered
- **Cause**: Missing API key or incorrect mode configuration
- **Solution**: Verify user.api_key and user.modo fields in database

#### Jusbrasil Service Issues
- **Symptom**: "API Key not configured" logs
- **Cause**: JUSBRASIL_API_KEY environment variable not set
- **Solution**: Set JUSBRASIL_API_KEY environment variable

- **Symptom**: OAB searches failing with 409 conflicts
- **Cause**: OAB already registered in system
- **Solution**: Check OAB status and handle 409 responses

- **Symptom**: Asynchronous collection delays
- **Cause**: New OAB registrations take time to process
- **Solution**: Wait for async collection completion or check later

#### Escavador Service Issues
- **Symptom**: "API Key not configured" logs
- **Cause**: ESCAVADOR_API_KEY environment variable not set
- **Solution**: Set ESCAVADOR_API_KEY environment variable

- **Symptom**: OAB searches failing
- **Cause**: Invalid OAB format or unauthorized access
- **Solution**: Verify OAB format (UF/Numero) and API key permissions

#### DataJud Service Issues
- **Symptom**: Rate limit errors (429)
- **Cause**: Too many requests in short period
- **Solution**: Wait for rate limit reset or reduce request frequency

- **Symptom**: 401 authentication errors
- **Cause**: Missing or invalid DATAJUD_API_KEY
- **Solution**: Set DATAJUD_API_KEY environment variable

#### Database Connectivity
- **Symptom**: Connection pool errors
- **Cause**: Incorrect database credentials or network issues
- **Solution**: Check environment variables and database availability

#### Telegram Integration
- **Symptom**: Bot not responding to messages
- **Cause**: Invalid bot token or missing Telegram ID
- **Solution**: Verify bot configuration in admin panel

#### Premium Service Configuration
- **Symptom**: Premium services not appearing
- **Cause**: API keys not configured or services not properly exported
- **Solution**: Check environment variables and service exports

**Section sources**
- [auth.js:20-30](file://auth.js#L20-L30)
- [apiRouter.js:11](file://apiRouter.js#L11)
- [db.js:4-10](file://db.js#L4-L10)
- [jusbrasil.js:11](file://services/jusbrasil.js#L11)
- [jusbrasil.js:118](file://services/jusbrasil.js#L118)
- [escavador.js:11](file://services/escavador.js#L11)
- [datajud.js:115](file://services/datajud.js#L115)

## Conclusion
The premium paid service integration provides a robust foundation for extending the free DataJud service with enhanced capabilities. The modular architecture ensures scalability, maintainability, and clear separation of concerns. Key strengths include:

- **Multi-provider premium architecture** enabling seamless fallback between Jusbrasil, Escavador, DataJud, and other services
- **Advanced OAB integration** with sophisticated three-phase workflow and asynchronous collection
- **Comprehensive authentication system** supporting Bearer token authentication across all premium services
- **Standardized response formatting** ensuring consistent data across different service providers
- **Intelligent service prioritization** optimizing for the best user experience
- **Robust error handling** preventing cascading failures and providing graceful degradation
- **Secure API key management** through environment variables and proper authentication
- **Efficient background processing** for automated monitoring and notifications
- **Scalable database design** supporting user growth and feature expansion

The implementation demonstrates best practices in API integration, error handling, performance optimization, and security while maintaining flexibility for future premium service additions. The transformation of Jusbrasil from placeholder to fully functional integration represents a significant enhancement to the system's capabilities.

## Appendices

### API Endpoint Reference
- **POST /auth/registro**: User registration with premium configuration
- **POST /auth/login**: User authentication and token generation
- **GET /auth/me**: Current user profile information
- **GET /processos**: Process monitoring list (with role-based filtering)
- **GET /usuarios**: Admin-only user management

### Premium Configuration Fields
- **api_key**: Premium service authentication token
- **modo**: Access mode ('gratis', 'hibrido', 'pago')
- **tipo**: User role ('cliente', 'admin')

### Environment Variables
- **JWT_SECRET**: Secret key for JWT token generation
- **ESCAVADOR_API_KEY**: Escavador service authentication
- **JUSBRASIL_API_KEY**: Jusbrasil service authentication
- **DATAJUD_API_KEY**: DataJud service authentication (server-level)
- **DIGESTO_API_KEY**: Digesto service authentication
- **TJ_API_KEY**: Generic tribunal API authentication
- **DB_HOST**, **DB_USER**, **DB_PASSWORD**, **DB_NAME**, **DB_PORT**: Database connection details

### Premium Service Providers
- **Jusbrasil**: Advanced OAB monitoring with three-phase workflow and asynchronous collection
- **Escavador**: Direct process number and OAB searches with Bearer token authentication
- **DataJud**: CNJ-based searches with sophisticated tribunal detection and rate limiting
- **Digesto**: Custom API integration framework (placeholder)
- **Custom**: Generic tribunal API integration framework (placeholder)

### Service Priority Order
1. **Jusbrasil** (highest priority) - Advanced OAB monitoring with three-phase workflow
2. **Escavador** (second priority) - Direct process number and OAB searches
3. **DataJud** (third priority) - CNJ-based searches with tribunal detection
4. **Digesto** (fourth priority) - Third-party integrations
5. **Custom** (fifth priority) - Generic tribunal APIs

### Error Codes and Handling
- **200**: Success - Process found
- **401**: Unauthorized - Invalid or missing API key
- **403**: Forbidden - Access denied
- **404**: Not Found - Process not found
- **409**: Conflict - OAB already registered
- **429**: Too Many Requests - Rate limit exceeded
- **Other**: Service-specific errors handled gracefully

### Three-Phase OAB Workflow Details
- **Phase 1**: Check OAB monitoring status with 15-second timeout
- **Phase 2**: Register new OAB if not monitored with 15-second timeout
- **Phase 3**: Retrieve linked processes with 30-second timeout
- **Asynchronous Collection**: Processed data may arrive later for new registrations