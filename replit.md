# Molin Nature Area Neighborhood Support

## Overview

The Molin Nature Area Neighborhood Support application is a civic engagement platform designed to facilitate community participation in invasive species removal and native habitat restoration. The application enables property owners near Molin Nature Area in Southeast Michigan to indicate their support for park stewardship activities through a survey system. 

The platform features an interactive map displaying property parcels with color-coded status indicators, an educational resource section about invasive species, and a secure admin panel for managing parcel data and survey responses. Access to the survey is controlled through unique nature-themed code phrases assigned to each property parcel.

## Recent Changes

### October 15, 2025
- **Admin Settings Redesign**: Replaced 4 separate bounding box fields with cleaner UI:
  - Mode selector: "Center + Radius" OR "Bounding Box"
  - Center mode: Shows radius input in meters
  - Bounding box mode: Shows two CSV input fields (top-left, bottom-right)
- **WMS Parcel Overlay**: Added toggleable Washtenaw County GIS parcel boundaries on map
- **Click-to-Copy Coordinates**: Map click copies lat/lng to clipboard for area definition
- **Parcel Loading Infrastructure**: Complete backend/frontend for loading parcels from ArcGIS
  - Nature-themed password generation (e.g., "Ancient Oak Grove", "Luminous Maple Path")
  - Admin UI with "Load Parcels from GIS" button
  - **BLOCKER**: Washtenaw County ArcGIS REST API requires authentication token
    - FeatureServer endpoint: `https://services1.arcgis.com/4ezfu5dIwH83BUNL/ArcGIS/rest/services/tax_parcels/FeatureServer/0/query` returns "Token Required" (code 499)
    - Alternative solutions: obtain API token from Washtenaw County, use downloadable shapefile, or implement manual CSV parcel import

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool and development server

**Routing**: Wouter for client-side routing with four main pages:
- Map view (home page)
- Survey participation page
- Educational resources page
- Admin dashboard

**UI Component Library**: Radix UI primitives with shadcn/ui components styled using Tailwind CSS with a custom nature-inspired design system featuring:
- Forest green primary color (142 45% 35%)
- Deep teal secondary color (158 55% 25%)
- Custom typography using Inter for UI elements and Merriweather for educational content
- Both light and dark mode support with HSL color variables

**State Management**: TanStack Query (React Query) for server state management with custom query client configuration

**Map Visualization**: Leaflet with React-Leaflet for interactive parcel mapping, displaying property boundaries as polygons with color-coded status indicators (none, light-green for Q1 support, forest-green for full support)

### Backend Architecture

**Runtime**: Node.js with Express server framework

**Session Management**: Express-session with MemoryStore for admin authentication, using HTTP-only cookies

**Development Setup**: Custom Vite integration middleware for hot module replacement during development, with separate static file serving in production

**Authentication**: Admin access protected by session-based authentication with bcrypt password hashing (SALT_ROUNDS: 10)

**Storage Layer**: Currently using in-memory storage (MemStorage class) with interface designed for easy migration to database persistence (IStorage interface defines CRUD contracts)

### Data Architecture

**Schema Design** (Drizzle ORM with PostgreSQL dialect):
- Users table: Basic authentication with username/password
- App Settings table: Configurable application parameters including admin credentials, map center coordinates, and default zoom level
- Uses UUID primary keys with PostgreSQL's gen_random_uuid()
- Zod schemas for runtime validation

**Survey Logic**: Three-question survey with specific business rules:
- Q1: Permission to remove invasive species near property
- Q2: Interest in assistance for property-based removal
- Q3: Willingness to share compost bin
- Status calculation: Q1 Yes only = light-green, Q1 Yes + Q2 Yes = forest-green

**Parcel Management**: Each parcel has:
- Unique ID and address
- GeoJSON coordinate arrays for polygon rendering
- Nature-themed code phrase for access control
- Survey status and response tracking
- Optional compost availability flag

### External Dependencies

**Database**: PostgreSQL via Neon serverless driver (@neondatabase/serverless v0.10.4) - configured but currently using in-memory storage implementation

**Mapping Services**: 
- Leaflet v1.9.4 for map rendering with React-Leaflet
- OpenStreetMap tiles via unpkg.com CDN
- Washtenaw County GIS WMS parcel overlay (services3.arcgis.com/mRwarx73j5FhfOkR) with toggle control
- Click-to-copy lat/lng coordinates feature for area definition

**UI Framework**: 
- Radix UI component primitives (v1.x - accordion, dialog, dropdown, etc.)
- Tailwind CSS for styling with PostCSS processing

**Authentication**: bcrypt v6.0.0 for password hashing

**Form Handling**: React Hook Form with @hookform/resolvers for validation integration

**Development Tools**:
- TypeScript for type safety
- ESBuild for production bundling
- Drizzle Kit for database migrations
- Replit-specific plugins (runtime error overlay, cartographer, dev banner)

**Fonts**: Google Fonts (Inter, Merriweather) loaded via CDN

**Session Storage**: memorystore package for development (designed to be replaced with connect-pg-simple for production PostgreSQL session storage)