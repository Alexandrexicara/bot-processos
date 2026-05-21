# Premium Paid Service Integration

<cite>
**Referenced Files in This Document**
- [escavador.js](file://services/escavador.js)
- [premium.js](file://services/premium.js)
- [jusbrasil.js](file://services/jusbrasil.js)
- [digesto.js](file://services/digesto.js)
- [custom.js](file://services/custom.js)
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
- Updated premium service integration to reflect enhanced Escavador service with proper OAB endpoint support
- Added comprehensive documentation for Bearer token authentication across premium services
- Documented standardized response formatting for premium service results
- Added support for both OAB and direct process number searches with different endpoint strategies
- Updated architecture diagrams to show the new premium service hierarchy
- Enhanced troubleshooting guide with premium service specific issues

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Premium Service Integration](#premium-service-integration)
7. [Enhanced Escavador Service](#enhanced-escavador-service)
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

The premium service acts as an optional enhancement to the free DataJud integration, enabling richer data when the free tier does not return results. The system now supports multiple premium service providers including Jusbrasil, Escavador, and custom integrations.

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
- [apiRouter.js:1-111](file://apiRouter.js#L1-L111)
- [jusbrasil.js:1-197](file://services/jusbrasil.js#L1-L197)
- [escavador.js:1-108](file://services/escavador.js#L1-L108)
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
- **Jusbrasil**: Advanced OAB monitoring with asynchronous collection
- **Escavador**: Direct process number and OAB searches with Bearer token authentication
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
- [apiRouter.js:10-14](file://apiRouter.js#L10-L14)
- [apiRouter.js:26-58](file://apiRouter.js#L26-L58)
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
- [apiRouter.js:17-93](file://apiRouter.js#L17-L93)
- [jusbrasil.js:31-68](file://services/jusbrasil.js#L31-L68)
- [escavador.js:28-66](file://services/escavador.js#L28-L66)
- [datajud.js:3-29](file://services/datajud.js#L3-L29)

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
class DigestoService {
+consultar(query) Promise~Object[]~
}
class CustomService {
+consultar(query) Promise~Object[]~
}
PremiumServiceProvider <|-- JusbrasilService
PremiumServiceProvider <|-- EscavadorService
PremiumServiceProvider <|-- DigestoService
PremiumServiceProvider <|-- CustomService
```

**Diagram sources**
- [jusbrasil.js:10-25](file://services/jusbrasil.js#L10-L25)
- [escavador.js:10-25](file://services/escavador.js#L10-L25)
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
- [apiRouter.js:17-93](file://apiRouter.js#L17-L93)

**Section sources**
- [apiRouter.js:17-93](file://apiRouter.js#L17-L93)

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
Jusbrasil["Jusbrasil<br/>• OAB Monitoring<br/>• Asynchronous Collection<br/>• Advanced Features"]
Escavador["Escavador<br/>• Direct Process Search<br/>• OAB Endpoint<br/>• Bearer Auth"]
Digesto["Digesto<br/>• Custom API Framework<br/>• Placeholder"]
Custom["Custom<br/>• Generic Tribunal API<br/>• Placeholder"]
Premium["Premium Placeholder<br/>• Legacy Support<br/>• Testing"]
end
subgraph "Configuration"
EnvVars["Environment Variables<br/>• JUSBRASIL_API_KEY<br/>• ESCAVADOR_API_KEY<br/>• DIGESTO_API_KEY<br/>• TJ_API_KEY"]
UserConfig["User Configuration<br/>• api_key field<br/>• modo field<br/>• tipo field"]
end
Jusbrasil --> EnvVars
Escavador --> EnvVars
Digesto --> EnvVars
Custom --> EnvVars
Premium --> UserConfig
```

**Diagram sources**
- [jusbrasil.js:3-7](file://services/jusbrasil.js#L3-L7)
- [escavador.js:3-5](file://services/escavador.js#L3-L5)
- [digesto.js:1-3](file://services/digesto.js#L1-L3)
- [custom.js:3-4](file://services/custom.js#L3-L4)

### Service Registration and Discovery
The system automatically discovers and registers premium services:

```mermaid
flowchart LR
subgraph "Service Discovery"
Services["Premium Services Array<br/>• services/jusbrasil.js<br/>• services/digesto.js<br/>• services/custom.js"]
Register["Module Registration<br/>• require() services<br/>• Extract { nome, gratuito, consultar }"]
Filter["Auto-filter Disabled Services<br/>• Check API_KEY env var<br/>• Skip if not configured"]
end
subgraph "Runtime Execution"
Execute["Service Execution<br/>• Loop through services<br/>• Execute consultar(query)<br/>• Handle results<br/>• Return on first success"]
end
Services --> Register --> Filter --> Execute
```

**Diagram sources**
- [apiRouter.js:10-14](file://apiRouter.js#L10-L14)
- [apiRouter.js:95-108](file://apiRouter.js#L95-L108)

**Section sources**
- [apiRouter.js:10-14](file://apiRouter.js#L10-L14)
- [apiRouter.js:95-108](file://apiRouter.js#L95-L108)

## Enhanced Escavador Service

### OAB Endpoint Integration
The Escavador service now provides comprehensive OAB (Brazilian Bar Association) integration:

```mermaid
sequenceDiagram
participant Client as "Client"
participant Router as "API Router"
participant Escavador as "Escavador Service"
participant EscavadorAPI as "Escavador API"
Client->>Router : consultarPorOAB(uf, numero)
Router->>Escavador : consultarPorOAB(uf, numero)
Escavador->>EscavadorAPI : GET /api/v2/envolvido/processos
EscavadorAPI-->>Escavador : Process List Response
Escavador->>Escavador : Standardize Response Format
Escavador-->>Router : [{numero, tribunal, classe, data, grau, orgaoJulgador}]
Router-->>Client : Process Results
```

**Diagram sources**
- [escavador.js:28-66](file://services/escavador.js#L28-L66)

### Bearer Token Authentication
The Escavador service implements secure Bearer token authentication:

```mermaid
flowchart TD
Start([API Request]) --> CheckAPIKey{"API Key<br/>Configured?"}
CheckAPIKey --> |No| SkipRequest["Skip Service<br/>Log Warning"]
CheckAPIKey --> |Yes| BuildHeaders["Build Headers<br/>Authorization: Bearer {API_KEY}"]
BuildHeaders --> MakeRequest["Make HTTP Request<br/>with Timeout"]
MakeRequest --> HandleResponse{"HTTP Status"}
HandleResponse --> |200| ParseResponse["Parse JSON Response<br/>Extract Items/Data"]
HandleResponse --> |404| ReturnEmpty["Return Empty Array"]
HandleResponse --> |Other Error| LogError["Log Error<br/>Return Null"]
ParseResponse --> Standardize["Standardize Response<br/>Map to Internal Format"]
Standardize --> ReturnResults["Return Process List"]
SkipRequest --> End([End])
ReturnEmpty --> End
LogError --> End
ReturnResults --> End
```

**Diagram sources**
- [escavador.js:32-66](file://services/escavador.js#L32-L66)

### Response Standardization
The Escavador service provides standardized response formatting:

```mermaid
classDiagram
class EscavadorResponse {
+string numero
+string tribunal
+string classe
+string data
+string grau
+string orgaoJulgador
+number _score
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
EscavadorResponse --> InternalFormat : "standardized"
```

**Diagram sources**
- [escavador.js:48-58](file://services/escavador.js#L48-L58)

**Section sources**
- [escavador.js:16-25](file://services/escavador.js#L16-L25)
- [escavador.js:28-66](file://services/escavador.js#L28-L66)
- [escavador.js:68-101](file://services/escavador.js#L68-L101)

## Premium Service Configuration

### Environment Variable Setup
Premium services require specific environment variables for authentication:

| Service | Environment Variable | Purpose |
|---------|---------------------|---------|
| Jusbrasil | `JUSBRASIL_API_KEY` | Primary premium service authentication |
| Escavador | `ESCAVADOR_API_KEY` | Secondary premium service authentication |
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
Priority1["Jusbrasil OAB<br/>• Highest Priority<br/>• Advanced Features<br/>• Asynchronous Collection"]
Priority2["Escavador OAB<br/>• Second Priority<br/>• Direct OAB Endpoint<br/>• Bearer Auth"]
Priority3["DataJud OAB<br/>• Lowest Priority<br/>• Free Service<br/>• Limited Coverage"]
end
subgraph "Mode-based Selection"
ModeGratis["Mode 'gratis'<br/>• Only DataJud<br/>• No Premium Services"]
ModeHibrido["Mode 'hibrido'<br/>• Try DataJud First<br/>• Then Premium Services"]
ModePago["Mode 'pago'<br/>• Try Premium Services First<br/>• Then DataJud"]
end
Priority1 --> ModeHibrido
Priority2 --> ModeHibrido
Priority3 --> ModeHibrido
Priority1 --> ModePago
Priority2 --> ModePago
Priority3 --> ModePago
```

**Diagram sources**
- [apiRouter.js:26-58](file://apiRouter.js#L26-L58)
- [apiRouter.js:62-90](file://apiRouter.js#L62-L90)

**Section sources**
- [database.sql:13-14](file://database.sql#L13-L14)
- [apiRouter.js:26-58](file://apiRouter.js#L26-L58)
- [apiRouter.js:62-90](file://apiRouter.js#L62-L90)

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
- [escavador.js:38](file://services/escavador.js#L38)

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
- [jusbrasil.js:62-67](file://services/jusbrasil.js#L62-L67)
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
- [escavador.js:38](file://services/escavador.js#L38)

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
+string numero
+string tribunal
+string classe
+string data
}
StandardResponse <|-- JusbrasilResponse : "mapped"
StandardResponse <|-- EscavadorResponse : "mapped"
StandardResponse <|-- DataJudResponse : "native"
```

**Diagram sources**
- [jusbrasil.js:144-152](file://services/jusbrasil.js#L144-L152)
- [escavador.js:48-58](file://services/escavador.js#L48-L58)

### Field Mapping Strategy
The system implements consistent field mapping across different service providers:

| Field | Jusbrasil | Escavador | DataJud | Internal Format |
|-------|-----------|-----------|---------|-----------------|
| Process Number | `cnj` | `numero_cnj` | `numero` | `numero` |
| Court | `''` | `tribunal` | `tribunal` | `tribunal` |
| Class | `''` | `classe` | `classe` | `classe` |
| Date | `created_at` | `data_inicio` | `data` | `data` |
| Degree | `''` | `grau` | `''` | `grau` |
| Court Body | `''` | `orgao` | `''` | `orgaoJulgador` |
| Score | `null` | `null` | `null` | `_score` |

### Error Response Handling
The system handles various error scenarios consistently:

```mermaid
flowchart TD
ErrorStart([Error Occurrence]) --> CheckService{"Service Type?"}
CheckService --> JusbrasilError["Jusbrasil Error<br/>• Log detailed error<br/>• Return null"]
CheckService --> EscavadorError["Escavador Error<br/>• Log status/message<br/>• Return null"]
CheckService --> DataJudError["DataJud Error<br/>• Return null"]
JusbrasilError --> NextService["Try Next Service"]
EscavadorError --> NextService
DataJudError --> NextService
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
- [apiRouter.js:103-107](file://apiRouter.js#L103-L107)
- [jusbrasil.js:62-67](file://services/jusbrasil.js#L62-L67)
- [escavador.js:60-65](file://services/escavador.js#L60-L65)

**Section sources**
- [jusbrasil.js:144-152](file://services/jusbrasil.js#L144-L152)
- [escavador.js:48-58](file://services/escavador.js#L48-L58)
- [apiRouter.js:103-107](file://apiRouter.js#L103-L107)

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
Router --> Digesto
Router --> Custom
Worker --> Router
BotMgr --> Router
Server --> DB
Worker --> DB
BotMgr --> DB
Jusbrasil -.-> Axios
Escavador -.-> Axios
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
- **Service prioritization**: Most capable services first (Jusbrasil, then Escavador)
- **Automatic service skipping**: Services without API keys are skipped automatically
- **Error handling**: Comprehensive error handling prevents cascading failures
- **Response standardization**: Consistent response format reduces processing overhead

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

#### Escavador Service Issues
- **Symptom**: "API Key not configured" logs
- **Cause**: ESCAVADOR_API_KEY environment variable not set
- **Solution**: Set ESCAVADOR_API_KEY environment variable

- **Symptom**: OAB searches failing
- **Cause**: Invalid OAB format or unauthorized access
- **Solution**: Verify OAB format (UF/Numero) and API key permissions

#### Jusbrasil Service Issues
- **Symptom**: OAB registration failures
- **Cause**: API key not configured or OAB already registered
- **Solution**: Check JUSBRASIL_API_KEY and verify OAB status

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
- [apiRouter.js:11-12](file://apiRouter.js#L11-L12)
- [db.js:4-10](file://db.js#L4-L10)
- [escavador.js:11-14](file://services/escavador.js#L11-L14)
- [jusbrasil.js:11-14](file://services/jusbrasil.js#L11-L14)

## Conclusion
The premium paid service integration provides a robust foundation for extending the free DataJud service with enhanced capabilities. The modular architecture ensures scalability, maintainability, and clear separation of concerns. Key strengths include:

- **Multi-provider premium architecture** enabling seamless fallback between Jusbrasil, Escavador, and other services
- **Advanced OAB integration** with specialized endpoints and asynchronous collection
- **Comprehensive authentication system** supporting Bearer token authentication across all premium services
- **Standardized response formatting** ensuring consistent data across different service providers
- **Intelligent service prioritization** optimizing for the best user experience
- **Robust error handling** preventing cascading failures and providing graceful degradation
- **Secure API key management** through environment variables and proper authentication
- **Efficient background processing** for automated monitoring and notifications
- **Scalable database design** supporting user growth and feature expansion

The implementation demonstrates best practices in API integration, error handling, performance optimization, and security while maintaining flexibility for future premium service additions.

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
- **DIGESTO_API_KEY**: Digesto service authentication
- **TJ_API_KEY**: Generic tribunal API authentication
- **DB_HOST**, **DB_USER**, **DB_PASSWORD**, **DB_NAME**, **DB_PORT**: Database connection details

### Premium Service Providers
- **Jusbrasil**: Advanced OAB monitoring with asynchronous collection
- **Escavador**: Direct process number and OAB searches with Bearer token authentication
- **Digesto**: Custom API integration framework (placeholder)
- **Custom**: Generic tribunal API integration framework (placeholder)

### Service Priority Order
1. **Jusbrasil** (highest priority)
2. **Escavador** (second priority)
3. **DataJud** (free fallback)
4. **Digesto** (third-party integrations)
5. **Custom** (generic tribunal APIs)

### Error Codes and Handling
- **200**: Success - Process found
- **401**: Unauthorized - Invalid or missing API key
- **403**: Forbidden - Access denied
- **404**: Not Found - Process not found
- **Other**: Service-specific errors handled gracefully