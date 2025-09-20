# TV ON Sistema de Gestão

## Overview
TV ON is a comprehensive management system for TV/streaming services, focusing on real-time communication and sophisticated media processing. Its purpose is to streamline operations, enhance customer interaction, and provide robust management tools for service providers, including intelligent, WhatsApp-like interactions and efficient multimedia content handling.

## User Preferences
- **UI Simplification**: Remove unnecessary buttons from chat interface (no mute notifications or contact info buttons)
- **Modern Tab Interface**: Use elegant tabbed layouts with gradient colors and icons for menu organization (similar to bot-config page style)
- **Data Management**: Systems data must come from local database, not external API

## System Architecture

### Frontend
- **Framework**: React.js
- **Styling**: Tailwind CSS for responsive and modern UI.
- **UI Components**: Shadcn/UI.
- **State Management**: React Query and Context API.
- **Routing**: Wouter.
- **Design Philosophy**: Professional design with gradient backgrounds, modern icons, and color-coded sections for visual hierarchy and consistent user experience.

### Backend
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.
- **Real-time Communication**: WebSocket.
- **WhatsApp Integration**: Baileys library for WhatsApp Web API.
- **Core Modules**:
    - **WhatsApp Bot System**: Intelligent keyword detection, text-based visual menus, dynamic variables, and robust error handling for various client types.
    - **PIX Payment Management**: Comprehensive system for managing PIX payments, including configuration, test payment generation, transaction records, webhooks, and user-configurable expiration times.
    - **Customer & Test Management**: Tools for client and test account management, including status tracking, duration management, streamlined workflows, and soft delete.
    - **Chat Interface**: Real-time WhatsApp chat integration with media message display, clickable phone numbers, and conversation creation upon first message. Global WebSocket connection for cross-application message processing and notifications. Conversation deduplication and mutex protection for concurrent message handling.
    - **API Configuration**: Manages external API systems and redirect URLs.
    - **System Management**: Manages individual "pontos" (service points) for revenue tracking. Systems data now sourced from local database instead of external API.
    - **Recurring Expiration Notifications**: Configurable system for recurring notifications to expired clients, with customizable intervals (1-7 days), notification limits, and automatic tracking of sent messages.
    - **Applications Management (APPs)**: Comprehensive interface for viewing registered applications with MAC addresses, app names, expiration dates, and advanced filtering capabilities.
    - **Referral System ("Indique e Ganhe")**: Clients earn free months via phone number-based referral codes, with automatic validation, admin UI, and WhatsApp notifications.
    - **Ticket Management System**: Automatically pins conversations with open tickets, visual indicators, automatic mode switching (human/bot), and direct navigation from tickets to chat.
    - **Quick Messages System**: Management and dynamic display of categorized quick messages (text/image) for customer support.
    - **Expired Client Management**: Automatic detection and special menu for expired clients offering trust unlock (one-time extension), payment, or support. Includes configurable recurring notifications with intervals from 1-7 days after expiration.
    - **Pricing Structure**: Configurable monthly, quarterly, semi-annual, and annual plans with progressive discounts.
    - **OnlineOffice IPTV Automation**: Advanced humanized automation system using ghost-cursor for natural mouse movements, random delays, and anti-detection measures. Features iframe integration, automatic credential generation with human-like behavior patterns, and manual fallback option.
    - **IPTV Auto-Renewal System**: Comprehensive automatic renewal system for IPTV services with configurable advance time (minutes before expiration), individual system toggle, automatic credential generation via Chrome extension, database field mapping (snake_case to camelCase), sequential queue processing (one system at a time), and complete integration with task management system. Only processes truly expired systems or those approaching expiration with autoRenewal enabled. Tracks renewal count, last renewal date, system status, and sistemaId in generated credentials. Updates system expiration to 6 hours after renewal. Chrome extension now edits system in OnlineOffice with generated credentials before reporting success. Features real-time queue visualization, comprehensive logging system for Chrome extension with localStorage persistence (1000 log limit), log viewer with filtering/search/export, and endpoints for monitoring renewal queue status.

### Key Technical Decisions
- **API Integration**: Direct integration with WhatsApp API and Woovi API.
- **Modular Design**: Separation of concerns.
- **Data Normalization**: Consistent phone number normalization.
- **Error Handling**: Comprehensive error handling with user-friendly messages.
- **Field Mapping**: Automatic mapping between database snake_case and frontend camelCase conventions.
- **Local Data Priority**: Systems management endpoints now fetch data from local database instead of external API for better control and consistency.

## External Dependencies
- **WhatsApp API**: For real-time messaging and bot interactions (via Baileys library).
- **Woovi API**: For PIX payment generation, status updates, and webhook processing.
- **PostgreSQL**: Relational database for persistent data storage.

## Recent Updates (September 2025)
- **Systems Management Refactored** - Changed `/api/external-api/systems` endpoints to fetch data directly from local database instead of external API
- **Enhanced Data Control** - All system CRUD operations (GET, POST, PUT, DELETE) now work exclusively with local database, providing full control over systems data
- **Authentication Required** - All system management endpoints now require authentication via checkAuth middleware
- **Bug Crítico de Renovação Corrigido** - Resolvido problema onde lastRenewalAt era atualizado prematuramente na criação de tasks, não na conclusão
- **Endpoint de Reset de Renovação** - Criado /api/sistemas/reset-renewal/:id para resetar sistemas travados em estado de renovação
- **Limpeza de Estado Aprimorada** - Sistema agora limpa corretamente estado in-memory quando tasks são deletadas
- **Sistema de Logs Unificados Completo** - Implementado visualização centralizada de todos os logs (aplicação + extensão Chrome) em tempo real no painel-office
- **Endpoints de Logs Expandidos** - Criado GET /api/all-logs para buscar logs unificados com filtros por fonte, nível e busca
- **Melhorias na Interface de Logs** - Nova seção "Central de Logs Unificados" com estatísticas em tempo real, filtros avançados e download

## Recent Updates (September 2025 - Previous)
- **Fixed AutoRenewalService identification issue** - Service was working correctly but needed systems with autoRenewal enabled and no recent renewals
- **Validated automatic renewal workflow** - Successfully creates tasks in queue for Chrome extension processing when systems expire
- **Confirmed Drizzle ORM field mapping** - Properly handles camelCase (TypeScript) to snake_case (PostgreSQL) conversion automatically
- Fixed automatic renewal system to only process expired systems or those approaching expiration
- Implemented sequential queue processing for system renewals (one at a time)
- Corrected sistemaId passing throughout renewal flow (extension -> backend -> credentials)
- Updated system expiration to 6 hours after credential generation (instead of 30 days)
- Added real-time renewal queue visualization in painel-office
- Implemented comprehensive logging system for Chrome extension using chrome.storage.local (Manifest V3 compatible)
- Added extension log viewer with filtering, search and export capabilities
- Created endpoints for renewal queue monitoring and extension log management
- Fixed Chrome extension to edit system in OnlineOffice after generating credentials
- Added editSystem() function to ensure systems are updated with new credentials
- Fixed localStorage error in service worker by migrating to chrome.storage.local API
- Fixed field mapping between snake_case (database) and camelCase (frontend)
- Added renewal configuration fields to sistemas table (expiracao, autoRenewalEnabled, renewalAdvanceTime, lastRenewalAt, renewalCount, status)
- Integrated renewal task handling in Chrome extension background.js