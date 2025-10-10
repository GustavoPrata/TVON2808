# TV ON Sistema de Gestão

## Overview
TV ON is a comprehensive management system for TV/streaming services, designed to streamline operations, enhance customer interaction, and provide robust management tools for service providers. It focuses on real-time communication, sophisticated media processing, intelligent WhatsApp-like interactions, and efficient multimedia content handling. The project aims to provide a robust platform for managing client interactions, payments, and service provisioning in the TV/streaming sector.

## User Preferences
- **UI Simplification**: Remove unnecessary buttons from chat interface (no mute notifications or contact info buttons)
- **Modern Tab Interface**: Use elegant tabbed layouts with gradient colors and icons for menu organization (similar to bot-config page style)
- **Data Management**: Systems data must come from local database, not external API

## Recent Changes
- **10/10/2025 (v3)**: Implemented persistent login sessions with PostgreSQL. Added connect-pg-simple for session storage, remember-me tokens with bcrypt hashing, auto-login on app reload, and critical security fix requiring SESSION_SECRET environment variable. Sessions and remember tokens now persist across server restarts.
- **10/10/2025**: Added M3U file upload functionality to config-tv page. Features include "Atualizar M3U" button in header that opens external att.php page in new tab, drag-and-drop area for uploading M3U files directly, backend proxy at `/api/m3u/upload` to handle CORS issues, and proper file input reset functionality allowing re-selection of same file.
- **08/10/2025**: Added manual task generation for Chrome extension offline scenarios. New endpoint `/api/office/automation/manual-task` and "Gerar Manual" button in painel-office allow users to add credential generation tasks manually when extension is not running. Tasks are queued in database and processed when extension reconnects.
- **26/09/2025**: Fixed critical bug where fixed systems (ID >= 1000) weren't appearing in distribution modal. Issue was caused by backend returning `systemId` (camelCase) while frontend expected `system_id` (snake_case). Solution: Added fallback support for both formats throughout the frontend.
- **25/09/2025 (v2)**: Refactored fixed systems to be REAL systems saved in database and API. Fixed systems now require username/password, use IDs >= 1000, and points are automatically calculated (total_points / num_systems). Removed manual point editing.
- **25/09/2025**: Added test message simulation feature in chat - allows sending messages as if from the client to test bot responses. Located above PIX billing option in chat sidebar.
- **24/09/2025**: Reversed synchronization direction - now pushes local database data TO the external API instead of pulling from it. The `/api/sync/systems` endpoint now sends local systems to the API, creating/updating/deleting as needed to make the API match the local database state.

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
    - **WhatsApp Bot System**: Intelligent keyword detection, text-based visual menus, dynamic variables.
    - **PIX Payment Management**: Comprehensive system for managing PIX payments, including configuration, test payment generation, transaction records, webhooks, and user-configurable expiration times.
    - **Customer & Test Management**: Tools for client and test account management, including status tracking and duration management.
    - **Chat Interface**: Real-time WhatsApp chat integration with media display and conversation management. Global WebSocket for cross-application messaging.
    - **API Configuration**: Manages external API systems and redirect URLs.
    - **System Management**: Manages individual service points ("pontos") and overall system data from a local database.
    - **Recurring Expiration Notifications**: Configurable system for notifying expired clients.
    - **Applications Management (APPs)**: Interface for viewing registered applications with filtering capabilities.
    - **Editable Campaign Templates**: Complete system for managing promotional message templates with full CRUD operations, icon selection from lucide-react library, live WhatsApp preview with iPhone-style interface, variable substitution system, and usage analytics tracking. Accessible via /template-editor route.
    - **Referral System ("Indique e Ganhe")**: Clients earn free months via phone number-based referral codes with automatic validation and WhatsApp notifications.
    - **Ticket Management System**: Automatically pins conversations with open tickets, visual indicators, and mode switching (human/bot).
    - **Bot Test Feature**: Allows sending test messages as if from the client to evaluate bot responses, accessible above PIX billing in chat sidebar.
    - **Quick Messages System**: Management and dynamic display of categorized quick messages.
    - **Expired Client Management**: Automatic detection and special menu for expired clients, including trust unlock and configurable notifications.
    - **Pricing Structure**: Configurable monthly, quarterly, semi-annual, and annual plans with progressive discounts.
    - **OnlineOffice IPTV Automation**: Advanced humanized automation using ghost-cursor, iframe integration, automatic credential generation, and manual fallback.
    - **IPTV Auto-Renewal System**: Comprehensive automatic renewal system with configurable advance time, individual system toggle, credential generation via Chrome extension, database field mapping, sequential queue processing, and integration with a task management system. Includes real-time queue visualization and extensive logging.
    - **Chrome Extension Management**: Browser extension for automated credential generation from OnlineOffice. Features polling system for task fetching, automatic status updates, and manual task generation fallback when extension is offline. Extension must be manually installed in Chrome and kept running for automation to work.
    - **Promotional Mass Messaging System**: Complete bulk WhatsApp messaging system with customizable templates, advanced filtering by client status (active, expired, new), variable replacement system for personalized messages, real-time sending progress tracking, and manual client selection/deselection capabilities.

### Key Technical Decisions
- **API Integration**: Direct integration with WhatsApp API and Woovi API.
- **Modular Design**: Separation of concerns.
- **Data Normalization**: Consistent phone number normalization.
- **Error Handling**: Comprehensive error handling.
- **Field Mapping**: Automatic mapping between database snake_case and frontend camelCase.
- **Local Data Priority**: Systems management endpoints fetch data from local database.
- **Point Distribution System**: Intelligent distribution of service points (pontos) across systems with two modes: One-system-per-point and Fixed-points-per-system, including real-time preview and automatic system creation via external API.
- **System ID Format**: All system IDs use numeric format only (1, 2, 3...) without prefixes. Legacy "sistema" prefixed IDs are normalized to numeric on read.

## External Dependencies
- **WhatsApp API**: For real-time messaging and bot interactions (via Baileys library).
- **Woovi API**: For PIX payment generation, status updates, and webhook processing.
- **PostgreSQL**: Relational database for persistent data storage.