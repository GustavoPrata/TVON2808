# TVon Application

## Overview

TVon is a full-stack web application built with a React frontend and Node.js/Express backend. The application uses a modern tech stack including TypeScript, Vite for frontend bundling, Drizzle ORM for database operations, and shadcn/ui for the component library. The project is structured as a monorepo with shared code between client and server, featuring a PostgreSQL database for data persistence and TanStack Query for client-side state management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API with `/api` prefix for all routes
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Validation**: Zod schemas for runtime type validation
- **Session Management**: Built-in session handling capability
- **Development**: Hot reload with Vite integration for seamless development

### Data Storage
- **Primary Database**: PostgreSQL with Neon serverless driver
- **ORM**: Drizzle ORM with migrations support
- **Schema Management**: Shared schema definitions between client and server
- **Fallback Storage**: In-memory storage implementation for development/testing

### Authentication & Authorization
- **User Model**: Basic username/password authentication structure
- **Session Handling**: Express session management with PostgreSQL session store
- **Type Safety**: Zod validation schemas for user registration and authentication

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL hosting (`@neondatabase/serverless`)
- **Session Store**: PostgreSQL-based session storage (`connect-pg-simple`)

### UI & Component Libraries
- **Radix UI**: Comprehensive primitive component library for accessibility
- **Embla Carousel**: Carousel/slider functionality
- **Lucide React**: Icon library
- **cmdk**: Command palette and search functionality
- **date-fns**: Date manipulation and formatting

### Development Tools
- **Replit Integration**: Development environment plugins and error overlays
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Tailwind CSS
- **TypeScript**: Static type checking across the entire application

### Utility Libraries
- **class-variance-authority**: Utility for creating variant-based component APIs
- **clsx & tailwind-merge**: Conditional CSS class management
- **nanoid**: Unique ID generation
- **zod**: Schema validation and type inference