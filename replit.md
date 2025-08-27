# TV ON Sistema de Gestão

## Overview
TV ON is a comprehensive management system for TV/streaming services, designed for real-time communication and sophisticated media processing. It aims to streamline operations, enhance customer interaction, and provide robust management tools for service providers. The project focuses on intelligent, WhatsApp-like interactions and efficient handling of multimedia content.

## User Preferences
- **UI Simplification**: Remove unnecessary buttons from chat interface (no mute notifications or contact info buttons)

## System Architecture

### Frontend
- **Framework**: React.js
- **Styling**: Tailwind CSS for responsive and modern UI.
- **UI Components**: Utilizes Shadcn/UI for modular and consistent UI elements.
- **State Management**: React Query for efficient server state management, supplemented by Context API for local state.
- **Routing**: Wouter is used for client-side routing.
- **Design Philosophy**: Focus on professional design with gradient backgrounds, modern icons, and color-coded sections for enhanced visual hierarchy and user experience. Consistent design system applied across pages (e.g., matching styling for Woovi and Config. TV pages).

### Backend
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL, with Drizzle ORM for type-safe and efficient database interactions.
- **Real-time Communication**: WebSocket for bidirectional, real-time data exchange.
- **WhatsApp Integration**: Leverages the Baileys library for WhatsApp Web API integration.
- **Core Modules**:
    - **WhatsApp Bot System**: Intelligent keyword detection, enhanced visual menus (text-based due to WhatsApp button deprecation), improved response quality, and robust error handling. Supports multiple bot types (new clients, existing clients, test users) with dynamic variables.
    - **PIX Payment Management**: Comprehensive system for managing PIX payments, including configuration, test payment generation, transaction records, and webhook handling for payment confirmations and expirations. User-configurable PIX expiration times.
    - **Customer & Test Management**: Tools for managing clients and test accounts, including client status tracking, test duration management, and streamlined test creation/editing workflows with persistent system selection. Soft delete functionality for tests.
    - **Chat Interface**: Real-time WhatsApp chat integration with features like media message display (photos, videos, audio, documents, stickers), clickable phone numbers, and enhanced new chat functionality that creates conversations only upon first message sent.
    - **API Configuration**: Manages external API systems and redirect URLs, allowing unlimited system registrations.
    - **System Management**: Ability to manage individual "pontos" (service points) with associated values for total monthly revenue tracking.

### Key Technical Decisions
- **API Integration**: Direct integration with WhatsApp API for messaging and Woovi API for PIX payments.
- **Modular Design**: Separation of concerns with dedicated services for WhatsApp, PIX, and other functionalities.
- **Data Normalization**: Consistent phone number normalization for accurate client identification across the system.
- **Error Handling**: Comprehensive error handling mechanisms, including user-friendly error messages and graceful handling of API timeouts.

## External Dependencies
- **WhatsApp API**: For real-time messaging and bot interactions (via Baileys library).
- **Woovi API**: For PIX payment generation, status updates, and webhook processing. ✅ Successfully integrated and tested
- **PostgreSQL**: Relational database for persistent data storage.

## Recent Updates (22/08/2025)
- **Test Bot Navigation System Completely Fixed**:
  - ✅ Fixed critical navigation bug where test clients pressing 0 in submenus returned to clientes menu instead of test menu
  - ✅ Fixed crash when test clients accessed support (now handles null cliente records properly)
  - ✅ Test bot now has simplified 3-option menu: activate plan, technical support, talk to attendant
  - ✅ All navigation flows tested and working: main menu → support → solution → return to test menu
  - ✅ Dynamic status indicator (🟢 ATIVO, 🟡 EXPIRANDO, 🔴 EXPIRADO) based on remaining time
  - ✅ Real-time remaining time display in abbreviated format (2h, 10min)
  - ✅ Test bot successfully reuses existing bot logic while maintaining separate menu structure
  - ✅ All submenus properly detect test clients and route to correct menu

## Recent Updates (27/08/2025)
- **Critical Fix: Duplicate Conversations Prevention During WhatsApp Reconnection**:
  - ✅ Fixed critical bug where multiple duplicate conversations were created when WhatsApp reconnected after restart
  - ✅ Implemented conversation creation locks with mutex protection to prevent race conditions
  - ✅ Added `getOrCreateConversation` method with double-checking mechanism
  - ✅ Added message deduplication tracking to prevent processing same messages multiple times during startup
  - ✅ Created API endpoint `/api/conversas/clean-duplicates` for cleaning existing duplicates
  - ✅ Successfully removed 22 duplicate conversations from database
  - ✅ System now properly handles simultaneous messages during reconnection without creating duplicates
  - ✅ Added 100ms delay and double-check before creating new conversations

## Recent Updates (24/08/2025)
- **Quick Messages System for Customer Support**:
  - ✅ Comprehensive quick message management system implemented in "Ajuda" menu
  - ✅ Dynamic quick messages appear above input when tickets are open
  - ✅ Time-based greeting messages (Bom dia/Boa tarde/Boa noite) automatically adjusted
  - ✅ Support for text messages with optional image attachments
  - ✅ Categorized messages (saudação, instalação, suporte, etc.)
  - ✅ Full CRUD operations for managing quick messages
  - ✅ Visual indicators for message types and image attachments
  - ✅ Quick insertion of messages into chat input with single click
  - ✅ Active/inactive toggle for selective message display

## Recent Updates (23/08/2025)
- **Referral System Fixed and Fully Operational**:
  - ✅ Fixed phone number search bug in `getClienteByTelefone` method - was incorrectly treating single object as array
  - ✅ Automatic referral confirmation working when client is registered with referral code
  - ✅ WhatsApp notifications sent to referrers with personalized congratulations message
  - ✅ Referrer's vencimento automatically extended by 30 days
  - ✅ Proper tracking of referral statistics (mesesGratisAcumulados, totalIndicacoes, indicacoesConfirmadas)
  - ✅ All API endpoints returning correct referral data
  - ✅ Tested with multiple clients - system working flawlessly
- **Create Client Dialog Form Persistence**: 
  - Form data now persists when modal is closed and reopened
  - Users can partially fill the form, close it, and continue later
  - Phone number and referral code are automatically populated from conversation
  - Form only resets after successful client creation
  - Improves user experience by preventing data loss

## Recent Updates (22/08/2025)
- **Expired Client Management System Fully Implemented**: 
  - ✅ Detects expired clients automatically when they contact the bot
  - ✅ Shows special menu with 3 options: trust unlock, payment, and support
  - ✅ Trust unlock feature ("Desbloqueio de confiança") gives 2 days free extension once per month
  - ✅ Database field `ultimoDesbloqueioConfianca` tracks last unlock date
  - ✅ Automatic validation prevents multiple unlocks within 30 days
  - ✅ Payment option redirects to renewal flow with progressive discounts
  - ✅ Support option creates ticket and transfers to human attendant
  - ✅ Beautiful warning message shows days expired and vencimento date

## Previous Updates (22/08/2025)
- **New Menu Option Added to "Novo Jogador" Bot**:
  - Added option 8 "Já sou cliente" (I'm already a client) to the new player menu
  - When selected, it acknowledges the user is an existing client
  - Automatically calls the attendant with a specific ticket message
  - Creates ticket: "[Ticket] Cliente existente precisando de atendimento - Informou ser cliente atual"
  - Switches conversation to human mode and clears bot state

## Previous Updates (22/08/2025)
- **Critical Human Mode Bug COMPLETELY Fixed**: 
  - Bot now COMPLETELY stops responding when conversation is in "humano" mode
  - Added double-check system in processBot to prevent any bot responses in human mode
  - Bot state is automatically cleared when switching to human mode
  - Bot state is cleared when switching back to bot mode (ensuring fresh start)
  - Fixed simulateMessage method that was forcing bot mode for testing
  - simulateMessage now respects current conversation mode and never forces bot activation

## Previous Updates (21/08/2025)
- **Pricing Structure Updated**: 
  - Base monthly price changed from R$ 19,90 to R$ 29,90
  - Quarterly plan: R$ 79,90 (10% discount)
  - Semi-annual plan: R$ 139,90 (20% discount)
  - Annual plan: R$ 249,90 (30% discount)
  - Progressive discounts to incentivize longer commitments

## Previous Updates (21/08/2025)
- **Ticket Management System Enhanced**: 
  - Conversations with open tickets are now automatically pinned to the top of the conversation list
  - Beautiful visual indicator (amber badge) shows ticket number for conversations with open tickets
  - Automatic mode switching: When a ticket is closed, the conversation automatically switches from "humano" back to "bot" mode
  - Improved sorting: Conversations are sorted by open ticket status first, then by last message date
  - **Ticket-to-Chat Navigation**: Eye button in tickets page now navigates directly to the corresponding conversation in the chat page
  - URL parameter handling: Chat page now accepts `conversaId` parameter for direct conversation selection from tickets

## Previous Updates (20/08/2025)
- **Technical Support Menu Simplified**: Reduced from 7 to 3 options:
  - Option 1: App travando ou lento - instructs to restart modem and device/TV
  - Option 2: Fora do ar - instructs to restart device/TV and test internet
  - Option 3: Outros problemas - transfers directly to human support
- **Support Flow Improved**: After providing solutions, bot asks "Resolveu?" with options to confirm resolution or request human help
- **Menu Behavior Updated**: When problem is resolved, bot only sends confirmation message without automatically showing main menu again
- **Removed Unnecessary Text**: Eliminated greeting lines from support menu for cleaner interaction

## Previous Updates (08/08/2025)
- **Complete Referral System "Indique e Ganhe" Fully Implemented**: 
  - ✅ Phone numbers serve as referral codes
  - ✅ Clients earn cumulative free months for successful referrals
  - ✅ Automatic validation when new customers sign up via WhatsApp bot
  - ✅ Complete admin management UI at `/indicacoes` with tables for viewing, confirming, and managing all referrals
  - ✅ Dashboard integration showing referral stats (indicadoPor, mesesGratisAcumulados, totalIndicacoes, indicacoesConfirmadas)
  - ✅ Top indicadores leaderboard for gamification
  - ✅ Database schema fully integrated with proper tracking
  - ✅ Automatic referral creation when new clients are registered with indicadoPor field
  - ✅ WhatsApp bot integration: Option 5 "Ganhar um mês grátis" in client menu
  - ✅ Bot validates referral codes during signup and saves to conversation metadata
  - ✅ Navigation menu updated with "Indicações" option using UserPlus icon

## Previous Updates (10/08/2025)
- **Client Bot Menu Restructured**: Successfully reorganized menu options as requested:
  - Removed "segunda via" (second payment copy) option
  - Changed "upgrade" to "renovar plano" (renew plan) in position 2
  - Added "ver pontos" (view points) in position 3 with comprehensive submenu system
- **Points Management System**: New functionality allows clients to:
  - View current points with individual values and total
  - Add new points with device selection and immediate PIX payment generation
  - Request point removal through human attendant
- **All Menu Functionality Tested**: Renewal options, points management, and PIX integration confirmed working

## Previous Updates (08/08/2025)
- **Chat Message Display Fixed**: Resolved issues with long messages by adding text wrapping with max-width of 400px
- **Woovi PIX Integration Working**: Successfully configured API authorization with proper headers to bypass Cloudflare
- **Bot Renewal System Complete**: Client bot with multi-period options (1, 3, 6, 12 months) with progressive discounts
- **PIX Code Separation**: PIX copy-paste code now sent in clean separate message without emojis as requested