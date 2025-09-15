# TV ON Sistema de Gestão

## Overview
TV ON is a comprehensive management system for TV/streaming services, focusing on real-time communication and sophisticated media processing. Its purpose is to streamline operations, enhance customer interaction, and provide robust management tools for service providers, including intelligent, WhatsApp-like interactions and efficient multimedia content handling.

## User Preferences
- **UI Simplification**: Remove unnecessary buttons from chat interface (no mute notifications or contact info buttons)
- **Modern Tab Interface**: Use elegant tabbed layouts with gradient colors and icons for menu organization (similar to bot-config page style)

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
    - **System Management**: Manages individual "pontos" (service points) for revenue tracking.
    - **Recurring Expiration Notifications**: Configurable system for recurring notifications to expired clients, with customizable intervals (1-7 days), notification limits, and automatic tracking of sent messages.
    - **Applications Management (APPs)**: Comprehensive interface for viewing registered applications with MAC addresses, app names, expiration dates, and advanced filtering capabilities.
    - **Referral System ("Indique e Ganhe")**: Clients earn free months via phone number-based referral codes, with automatic validation, admin UI, and WhatsApp notifications.
    - **Ticket Management System**: Automatically pins conversations with open tickets, visual indicators, automatic mode switching (human/bot), and direct navigation from tickets to chat.
    - **Quick Messages System**: Management and dynamic display of categorized quick messages (text/image) for customer support.
    - **Expired Client Management**: Automatic detection and special menu for expired clients offering trust unlock (one-time extension), payment, or support. Includes configurable recurring notifications with intervals from 1-7 days after expiration.
    - **Pricing Structure**: Configurable monthly, quarterly, semi-annual, and annual plans with progressive discounts.
    - **OnlineOffice IPTV Automation**: Three-tier system for generating IPTV credentials - Client-Side automation (using user's browser to bypass blocks), Server-Side (Puppeteer with anti-bot measures), and Manual extraction. Features secure postMessage communication, credential validation, and automatic saving.

### Key Technical Decisions
- **API Integration**: Direct integration with WhatsApp API and Woovi API.
- **Modular Design**: Separation of concerns.
- **Data Normalization**: Consistent phone number normalization.
- **Error Handling**: Comprehensive error handling with user-friendly messages.

## External Dependencies
- **WhatsApp API**: For real-time messaging and bot interactions (via Baileys library).
- **Woovi API**: For PIX payment generation, status updates, and webhook processing.
- **PostgreSQL**: Relational database for persistent data storage.