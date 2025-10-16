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

**Storage Layer**: Hybrid architecture combining file-based area storage with PostgreSQL database for survey responses.
- Area definitions stored in `/data/areas.json` (read-only in production, editable in development)
- Survey responses stored in PostgreSQL database
- Parcels loaded from GeoJSON file on startup and cached in database for query performance

### Data Architecture

**Schema Design**: Drizzle ORM with PostgreSQL dialect, utilizing varchar primary keys with UUID defaults. Zod schemas provide runtime validation.

**File-Based Area Storage**: 
- Area definitions stored in `/data/areas.json` as an array of area objects
- Each area contains: id, name, centerLat, centerLng, defaultZoom, displayRadiusMeters
- Areas can only be created/edited in development (controlled via `import.meta.env.DEV` check)
- In production, areas are read-only and deployed with the application code
- API routes enforce environment-based write protection

**Database Schema**:
- `parcels` table stores parcel data and survey responses
- Columns: id (varchar UUID), address, coordinates (jsonb GeoJSON), naturePhrase, surveyCompleted, q1_response, q2_response, q3_response
- No area-related tables - area membership is determined by distance calculation at runtime
- Survey responses persist independently of area definitions/changes

**Survey Logic**: A three-question survey determines property owner support:
- Q1: Permission for invasive species removal (boolean)
- Q2: Interest in assistance for property-based removal (boolean)
- Q3: Willingness to share a compost bin (boolean)
- Parcel status is color-coded based on Q1 and Q2 responses
- Q3 response tracked separately for compost bin coordination

**Parcel Management**: 
- Each parcel has a unique ID, address, GeoJSON coordinates, and a nature-themed code phrase for access control
- System handles full dataset of 126,639 parcels from locked `washtenaw_parcels_full.geojson` file
- Parcels auto-load from GeoJSON on server startup and stored in database
- Coordinates converted from State Plane Michigan South (EPSG:2898) to WGS84 (lat/lng) using proj4
- Server-side parcel filtering by radius for performance
- Survey data stored directly on parcel records (q1_response, q2_response, q3_response)

### System Design Choices

**Area Management**:
- Areas support multiple nature area locations with center point and display radius
- Admin map displays all parcels within display radius from area center
- Leaf markers indicate parcels within selected area radius
- Survey access restricted to parcels matching area's nature phrase pattern
- Areas are environment-aware: editable in development, read-only in production

**Deployment Architecture**:
- Area definitions deployed as static configuration with application code
- Survey responses remain in database, independent of area definitions
- This allows area boundary changes without losing historical survey data
- Production deployments include pre-configured area definitions from `/data/areas.json`

**Environment-Based Features**:
- `import.meta.env.DEV` (frontend) and `process.env.NODE_ENV === 'development'` (backend) control area editing
- Admin UI conditionally renders area creation/editing forms based on environment
- API routes validate environment before allowing area modifications
- Provides clear separation between development configuration and production operation

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

## Key Files

- `/data/areas.json` - Area definitions (editable in dev only)
- `server/dbStorage.ts` - Database storage implementation with file-based area loading
- `server/routes.ts` - API routes with environment-based area write protection
- `shared/schema.ts` - Simplified schema with only parcels table
- `client/src/pages/AdminPage.tsx` - Admin interface with environment-aware area management
- `attached_assets/washtenaw_parcels_full.geojson` - Locked parcel reference data (126,639 parcels)
