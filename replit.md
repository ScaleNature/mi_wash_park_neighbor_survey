# Molin Nature Area Neighborhood Support

## Overview

The Molin Nature Area Neighborhood Support application is a civic engagement platform designed to facilitate community participation in invasive species removal and native habitat restoration. It enables property owners near the Molin Nature Area in Southeast Michigan to indicate support for park stewardship through a survey system. Key features include an interactive map displaying property parcels with color-coded status, an educational resource section on invasive species, and a secure admin panel for managing parcel data and survey responses. Access to the survey is controlled via unique nature-themed code phrases assigned to each property.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite.

**Routing**: Wouter handles client-side routing across map view, survey, educational resources, and admin dashboard.

**UI Component Library**: Radix UI primitives and shadcn/ui components, styled with Tailwind CSS. The design system is nature-inspired, featuring forest green and deep teal, custom typography (Inter for UI, Merriweather for content), and supports both light and dark modes.

**State Management**: TanStack Query (React Query) manages server state.

**Map Visualization**: Leaflet with React-Leaflet provides interactive parcel mapping, displaying property boundaries as color-coded polygons.

### Backend Architecture

**Runtime**: Node.js with Express.

**Session Management**: Express-session with MemoryStore for admin authentication, using HTTP-only cookies.

**Development Setup**: Custom Vite integration middleware provides hot module replacement.

**Authentication**: Session-based admin authentication uses bcrypt for password hashing (SALT_ROUNDS: 10).

**Storage Layer**: Currently uses in-memory storage (MemStorage class) adhering to an IStorage interface for future database migration.

### Data Architecture

**Schema Design**: Drizzle ORM with a PostgreSQL dialect, utilizing UUID primary keys. Zod schemas provide runtime validation.

**Survey Logic**: A three-question survey determines property owner support:
- Q1: Permission for invasive species removal.
- Q2: Interest in assistance for property-based removal.
- Q3: Willingness to share a compost bin.
Parcel status is color-coded based on Q1 and Q2 responses.

**Parcel Management**: Each parcel has a unique ID, address, GeoJSON coordinates, a nature-themed code phrase for access control, and tracks survey status and responses, including an optional compost availability flag. The system handles a full dataset of 126,639 parcels, converting State Plane Michigan South (EPSG:2898) coordinates to WGS84 (lat/lng) using proj4. Server-side parcel filtering is implemented for performance.

### System Design Choices

The application supports multiple nature areas, with parcel selection based on a center point and radius. Areas are created empty, and parcels are manually added by admins. The admin map displays all parcels within a display radius, with leaf markers indicating parcels within the selected area. Survey access is restricted to parcels belonging to an area.

## External Dependencies

**Database**: PostgreSQL via Neon serverless driver (`@neondatabase/serverless`).

**Mapping Services**:
- Leaflet v1.9.4 with React-Leaflet.
- OpenStreetMap tiles.
- Washtenaw County GIS WMS parcel overlay.
- Proj4 library for coordinate system conversions.

**UI Framework**: Radix UI component primitives and Tailwind CSS.

**Authentication**: bcrypt v6.0.0.

**Form Handling**: React Hook Form with `@hookform/resolvers`.

**Development Tools**: TypeScript, ESBuild, Drizzle Kit.

**Fonts**: Google Fonts (Inter, Merriweather).

**Session Storage**: `memorystore` (for development, to be replaced with `connect-pg-simple` for production).