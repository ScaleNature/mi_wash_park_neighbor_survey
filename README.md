# Park Neighbor Support

A civic engagement platform for facilitating community participation in invasive species removal and native habitat restoration. Property owners can indicate support for park stewardship through an interactive survey system, with administrators managing areas and tracking community engagement through parcel assignments.

## Features

- **Interactive Map**: Leaflet-based map displaying property parcels with color-coded survey status
  - Green parcels: Community members supporting invasive species removal
  - Gray parcels: No response or not supporting
  - Real-time visualization of community engagement
  
- **Survey System**: 
  - Secure access via unique nature-themed code phrases per property
  - Three-question survey about invasive species removal support
  - Privacy model: Yes/No responses are public, comments are admin-only
  
- **Area Management**: 
  - Support for multiple nature area locations
  - Radius-based parcel assignment
  - Full CRUD operations for area definitions
  
- **Admin Dashboard**:
  - Parcel assignment and management
  - Survey response tracking
  - Area statistics and reporting
  - Secure session-based authentication

- **Educational Resources**: Information about invasive species and restoration efforts

## Prerequisites

- **Node.js**: v20 or higher
- **PostgreSQL**: v14 or higher (via Neon or local instance)
- **npm**: v9 or higher

## Installation

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Database Setup

The application uses PostgreSQL for data persistence. You need:

1. A PostgreSQL database (Replit provides Neon integration)
2. Database URL connection string

```bash
# Create database tables
npm run db:push
```

This will create the required tables:
- `parcels` - Parcel data and survey responses
- `session` - Session storage for admin authentication
- `app_settings` - Application configuration

### 3. Environment Variables

Create a `.env` file with the following variables:

```env
# Database (required)
DATABASE_URL=postgresql://user:password@host:5432/database

# Session Security (required for production)
SESSION_SECRET=your-random-secret-key-here

# Environment
NODE_ENV=development

# Auto-provided by Replit (you don't need to set these)
PGHOST=
PGPORT=
PGDATABASE=
PGUSER=
PGPASSWORD=
```

**Important Security Notes**:
- `SESSION_SECRET` should be a long, random string (at least 32 characters)
- In production, the app requires `trust proxy` setting for secure cookies behind reverse proxies
- Never commit `.env` files to version control

### 4. Initial Data Setup

The application will automatically:
- Load parcel data from `attached_assets/washtenaw_parcels_full.geojson` on first startup
- Create default app settings
- Initialize area definitions from `data/areas.json`

**Default Admin Credentials** (change immediately):
- Email: admin@example.com
- Password: admin123

## Running Locally

### Development Mode

```bash
npm run dev
```

This starts:
- Express API server on port 5000
- Vite dev server with HMR (Hot Module Replacement)
- Single unified server serving both frontend and backend

Access the application at: `http://localhost:5000`

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   │   ├── ui/        # shadcn/ui components
│   │   │   ├── ParcelMap.tsx      # Leaflet map component
│   │   │   ├── SurveyForm.tsx     # Survey interface
│   │   │   └── AdminTable.tsx     # Admin data table
│   │   ├── pages/         # Page components (wouter routing)
│   │   │   ├── MapPage.tsx        # Public map view
│   │   │   ├── SurveyPage.tsx     # Survey submission
│   │   │   ├── EducationPage.tsx  # Educational content
│   │   │   └── AdminPage.tsx      # Admin dashboard
│   │   ├── lib/           # Utilities and configuration
│   │   └── hooks/         # Custom React hooks
│   └── index.html         # HTML entry point
│
├── server/                # Backend Node.js/Express
│   ├── index.ts          # Server entry point
│   ├── routes.ts         # API route definitions
│   ├── dbStorage.ts      # Database storage layer
│   ├── geomUtils.ts      # Geometry utilities (coordinate conversion)
│   └── vite.ts           # Vite integration
│
├── shared/               # Shared code (frontend + backend)
│   └── schema.ts         # Drizzle ORM schema + Zod validation
│
├── data/                 # File-based data storage
│   └── areas.json        # Area definitions (manageable via admin UI)
│
├── attached_assets/      # Static assets
│   └── washtenaw_parcels_full.geojson  # Source parcel data (126K parcels)
│
├── dist/                 # Production build output (generated)
│
└── Documentation
    ├── README.md         # This file
    ├── API.md           # API endpoint documentation
    ├── DEPLOYMENT.md    # Deployment and operations guide
    ├── replit.md        # Architecture and design decisions
    └── design_guidelines.md  # UI/UX design system
```

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling and HMR
- **Wouter** for client-side routing
- **TanStack Query (React Query)** for server state management
- **Leaflet + React-Leaflet** for interactive maps
- **shadcn/ui** component library with Radix UI primitives
- **Tailwind CSS** for styling

### Backend
- **Node.js** with Express
- **PostgreSQL** via Neon serverless driver
- **Drizzle ORM** for database access
- **express-session** with connect-pg-simple for session management
- **bcrypt** for password hashing
- **Zod** for runtime validation

### GIS/Mapping
- **Leaflet** for map rendering
- **Proj4** for coordinate system transformations (WGS84 ↔ State Plane Michigan EPSG:2898)
- **OpenStreetMap** tiles
- **Washtenaw County GIS** WMS overlay for parcel boundaries

## Key Concepts

### Coordinate Systems
The application handles **mixed coordinate systems** in source data:
- Some parcels use WGS84 (standard lat/lng)
- Others use State Plane Michigan South EPSG:2898
- Automatic detection and conversion via proj4
- GeoJSON format: `[longitude, latitude]`
- Leaflet format: `[latitude, longitude]`

### Map Modes
The application has **two distinct map views**:

1. **Public Map** (`/`):
   - Shows colored parcels based on survey status
   - Green = support for invasive species removal
   - When admin is logged in: colors remain, popup gains admin controls

2. **Admin Dashboard Map** (`/admin`):
   - Shows uniform gray parcels (no color distraction)
   - Focus on area management and parcel assignment
   - Includes leaf markers for assigned parcels

### Survey Privacy Model
- **Public Data**: Yes/No responses visible on public map with color coding
- **Private Data**: Text comments only visible to administrators
- Survey access controlled by unique code phrases per parcel

### Area Management
- Areas define nature area locations with center point and display radius
- Parcels can be assigned to multiple areas
- Area definitions stored in `/data/areas.json` (fully manageable via admin UI)
- Survey responses persist independently of area changes

## Common Tasks

### Changing Admin Password

1. Log into admin dashboard at `/admin`
2. Navigate to "Application Settings" card
3. Update "Admin Password" field
4. Click "Save Changes"

### Adding a New Area

1. Log into admin dashboard
2. Navigate to "Area Management" section
3. Click "Create New Area"
4. Enter area name, center coordinates, zoom level, and display radius
5. Click "Create Area"
6. Assign parcels using the map interface

### Exporting Survey Data

Currently handled manually via database queries. See `API.md` for endpoint documentation.

### Updating Parcel Data

Parcel data is loaded from `attached_assets/washtenaw_parcels_full.geojson`:
1. Replace the GeoJSON file with updated data
2. Clear the `parcels` table in database
3. Restart server - parcels will reload automatically

**Warning**: This will preserve survey responses but may orphan responses if parcel IDs change.

## Troubleshooting

### Sessions Not Persisting
- Ensure `DATABASE_URL` is correctly set
- Check that `session` table exists in database
- In production, verify `app.set('trust proxy', 1)` is enabled

### Map Not Loading Parcels
- Check browser console for CORS or coordinate transformation errors
- Verify database contains parcel data (run `SELECT COUNT(*) FROM parcels`)
- Check that area definitions exist in `data/areas.json`

### Admin Login Failing
- Verify credentials in database `app_settings` table
- Check session configuration in server logs
- Ensure cookies are enabled in browser

### Performance Issues with Large Datasets
- Application handles 126K parcels using bounding box filtering
- Server-side parcel filtering by radius for admin map
- Client-side caching via TanStack Query

## Documentation

- **[API.md](./API.md)** - Complete API endpoint documentation
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide
- **[replit.md](./replit.md)** - Architecture and technical decisions
- **[design_guidelines.md](./design_guidelines.md)** - UI/UX design system

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- Follow existing patterns in codebase
- Use shadcn/ui components for consistency
- Detailed prop documentation in complex components

### Adding New Routes
1. Define route in `server/routes.ts`
2. Create page component in `client/src/pages/`
3. Register in `client/src/App.tsx` router
4. Update navigation in `client/src/components/Header.tsx`

### Database Migrations
Never write manual SQL migrations. Use Drizzle Kit:
```bash
# After updating shared/schema.ts
npm run db:push
```

For production with data loss warnings:
```bash
npm run db:push -- --force
```

## License

MIT

## Support

For questions, issues, or feature requests, contact: molin.nature.area.care@gmail.com
