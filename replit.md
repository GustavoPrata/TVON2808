# TV ON Sistema de Gestão

## Overview
TV ON is a comprehensive management system for TV/streaming services, designed to streamline operations, enhance customer interaction, and provide robust management tools for service providers. It focuses on real-time communication, sophisticated media processing, intelligent WhatsApp-like interactions, and efficient multimedia content handling. The project aims to provide a robust platform for managing client interactions, payments, and service provisioning in the TV/streaming sector.

## User Preferences
- **UI Simplification**: Remove unnecessary buttons from chat interface (no mute notifications or contact info buttons)
- **Modern Tab Interface**: Use elegant tabbed layouts with gradient colors and icons for menu organization (similar to bot-config page style)
- **Data Management**: Systems data must come from local database, not external API

## Recent Changes
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
    - **Referral System ("Indique e Ganhe")**: Clients earn free months via phone number-based referral codes with automatic validation and WhatsApp notifications.
    - **Ticket Management System**: Automatically pins conversations with open tickets, visual indicators, and mode switching (human/bot).
    - **Bot Test Feature**: Allows sending test messages as if from the client to evaluate bot responses, accessible above PIX billing in chat sidebar.
    - **Quick Messages System**: Management and dynamic display of categorized quick messages.
    - **Expired Client Management**: Automatic detection and special menu for expired clients, including trust unlock and configurable notifications.
    - **Pricing Structure**: Configurable monthly, quarterly, semi-annual, and annual plans with progressive discounts.
    - **OnlineOffice IPTV Automation**: Advanced humanized automation using ghost-cursor, iframe integration, automatic credential generation, and manual fallback.
    - **IPTV Auto-Renewal System**: Comprehensive automatic renewal system with configurable advance time, individual system toggle, credential generation via Chrome extension, database field mapping, sequential queue processing, and integration with a task management system. Includes real-time queue visualization and extensive logging.

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