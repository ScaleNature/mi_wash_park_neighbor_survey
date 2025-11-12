# Deployment Guide

Complete guide for deploying and operating the Park Neighbor Support application in production.

## Table of Contents

1. [Replit Deployment](#replit-deployment)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Session Management](#session-management)
5. [Critical Production Settings](#critical-production-settings)
6. [Initial Setup](#initial-setup)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)
9. [Backup and Recovery](#backup-and-recovery)
10. [Performance Optimization](#performance-optimization)

---

## Replit Deployment

### Publishing Your Application

The application is designed to run on Replit with built-in deployment support.

**Steps to Publish**:

1. Ensure all environment variables are set (see [Environment Configuration](#environment-configuration))
2. Test thoroughly in development mode
3. Click the **Publish** button in Replit
4. Your app will be available at `https://your-repl-name.replit.app`

**Build Process**:
```bash
npm run build    # Builds both frontend (Vite) and backend (esbuild)
npm start        # Runs production server
```

**What Happens**:
- Frontend assets compiled and optimized by Vite
- Backend bundled by esbuild with external packages
- Static files served from `dist/` directory
- Server listens on port 5000 (or `PORT` environment variable)

**Deployment Checklist**:
- [ ] All environment variables configured
- [ ] Database migrations applied (`npm run db:push`)
- [ ] Parcel data loaded (automatic on first startup)
- [ ] Admin password changed from default
- [ ] Session secret is strong and unique
- [ ] Trust proxy enabled for secure cookies
- [ ] Test login and survey submission

---

## Environment Configuration

### Required Environment Variables

Set these in Replit Secrets or `.env` file:

```env
# Database Connection (REQUIRED)
DATABASE_URL=postgresql://user:password@host:5432/database

# Session Security (REQUIRED in production)
SESSION_SECRET=your-very-long-random-string-here-at-least-32-chars

# Environment Mode
NODE_ENV=production

# Server Port (auto-set by Replit)
PORT=5000
```

### Auto-Provided Variables (Replit)

These are automatically set by Replit's PostgreSQL integration:

```env
PGHOST=
PGPORT=
PGDATABASE=
PGUSER=
PGPASSWORD=
```

**Do not manually set these** - they're managed by Replit.

### Generating SESSION_SECRET

Use a cryptographically secure random string:

```bash
# Generate secure secret (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use OpenSSL
openssl rand -hex 32
```

**Best Practices**:
- At least 32 characters long
- Use letters, numbers, and special characters
- Never commit to version control
- Rotate periodically (requires re-login for all admins)

---

## Database Setup

### Using Replit's PostgreSQL (Recommended)

Replit provides Neon PostgreSQL integration:

1. Click **+ New** → **PostgreSQL Database**
2. Database credentials auto-populate in environment
3. Run migrations: `npm run db:push`

### Manual PostgreSQL Setup

If using external PostgreSQL:

```bash
# Set DATABASE_URL
DATABASE_URL=postgresql://username:password@hostname:5432/database_name

# Apply schema
npm run db:push
```

### Database Schema

The application creates these tables:

**`parcels`** - Parcel data and survey responses
- `id` (varchar, primary key)
- `short_code` (varchar)
- `code_phrase` (varchar)
- `address` (varchar)
- `coordinates` (jsonb) - GeoJSON geometry
- `survey_completed` (boolean)
- `q1_response`, `q2_response`, `q3_response` (boolean, nullable)
- `q1_comment`, `q2_comment`, `q3_comment` (text, nullable)
- `response_date` (timestamp, nullable)

**`session`** - Session storage (created automatically)
- `sid` (varchar, primary key)
- `sess` (json)
- `expire` (timestamp)

**`app_settings`** - Application configuration
- `id` (varchar, primary key)
- `app_name` (varchar)
- `admin_email` (varchar)
- `admin_password` (varchar) - bcrypt hashed

### Initial Data Load

On first startup, the application automatically:

1. **Loads Parcels**: Reads `attached_assets/washtenaw_parcels_full.geojson`
   - 126,639 parcels total
   - Handles mixed coordinate systems (WGS84 and State Plane EPSG:2898)
   - Stores as GeoJSON in database

2. **Creates Settings**: Initializes with defaults
   - App name: "Park Neighbor Support"
   - Admin email: "admin@example.com"
   - Admin password: "admin123" (hashed)

3. **Loads Areas**: Reads `data/areas.json`
   - Area definitions with center points and radius
   - Parcel assignments

**⚠️ Important**: Change the default admin password immediately after deployment!

---

## Session Management

### Production Session Store

The application uses **connect-pg-simple** for PostgreSQL-backed sessions in production:

```typescript
// server/routes.ts
const PgSession = connectPgSimple(session);
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(session({
  secret: process.env.SESSION_SECRET,
  store: new PgSession({
    pool: pgPool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  cookie: {
    httpOnly: true,
    secure: true,  // HTTPS only in production
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,  // 24 hours
  }
}));
```

### Session Configuration

**Session Duration**: 24 hours (configurable via `maxAge`)

**Session Cleanup**: Expired sessions automatically deleted by connect-pg-simple

**Scaling**: PostgreSQL store supports multiple server instances sharing session state

### Session Debugging

Enable session debugging in development:

```typescript
// Already enabled in routes.ts for /api/admin paths
console.log(`[session] Session ID: ${req.sessionID}`);
console.log(`[session] isAdmin: ${req.session?.isAdmin}`);
console.log(`[session] Cookie: ${req.headers.cookie ? 'present' : 'missing'}`);
```

---

## Critical Production Settings

### Trust Proxy Configuration

**CRITICAL FOR SECURE COOKIES**: The application runs behind Replit's reverse proxy. Without trust proxy, secure cookies won't work:

```typescript
// server/index.ts
app.set('trust proxy', 1);
```

**Why This Matters**:
- Replit uses a reverse proxy (nginx) in front of your app
- Without `trust proxy`, Express sees HTTP instead of HTTPS
- Secure cookies (`secure: true`) only work over HTTPS
- Sessions fail without this setting in production

**Symptoms of Missing Trust Proxy**:
- Login appears to work but session doesn't persist
- Admin session immediately shows `isAdmin: false` after login
- Cookie is set but not recognized on subsequent requests

### Cookie Security

```typescript
cookie: {
  httpOnly: true,      // Prevents JavaScript access (XSS protection)
  secure: true,        // HTTPS only in production
  sameSite: 'lax',     // CSRF protection
  maxAge: 86400000,    // 24 hours
}
```

**Production Requirements**:
- `secure: true` requires HTTPS (Replit provides this automatically)
- `httpOnly: true` prevents XSS attacks
- `sameSite: 'lax'` allows navigation from external sites while blocking CSRF

---

## Initial Setup

### Post-Deployment Steps

1. **Access Admin Dashboard**
   ```
   https://your-app.replit.app/admin
   ```

2. **Login with Default Credentials**
   - Email: `admin@example.com`
   - Password: `admin123`

3. **Change Admin Password Immediately**
   - Navigate to "Application Settings"
   - Update "Admin Password" field
   - Click "Save Changes"

4. **Update Application Settings**
   - Change "App Name" to your organization/area name
   - Update "Admin Email" to your contact email

5. **Configure Areas**
   - Review existing areas in "Area Management"
   - Create new areas as needed with center coordinates
   - Set appropriate display radius for each area

6. **Verify Parcel Data**
   - Check that parcels are loading on the map
   - Verify coordinate transformations are working
   - Test survey submission with a sample code phrase

7. **Test Survey Flow**
   - Navigate to `/survey` (now `/participate`)
   - Enter a valid code phrase
   - Submit test survey responses
   - Verify responses appear on public map

### Area Setup Example

```json
{
  "name": "Molin Nature Area",
  "centerLat": 42.2808,
  "centerLng": -83.7430,
  "defaultZoom": 16,
  "displayRadiusMeters": 500
}
```

**Finding Center Coordinates**:
1. Open [OpenStreetMap](https://www.openstreetmap.org/)
2. Navigate to your nature area
3. Right-click → "Show address"
4. Coordinates displayed as "Lat: XX.XXXX, Lon: YY.YYYY"

---

## Monitoring

### Application Logs

**Replit Console**: View real-time logs in the Replit console

**Key Log Patterns**:
```
serving on port 5000                    # Server started
✓ Parcels already loaded in database   # Data initialization
✓ Loaded 4 areas from file             # Area data loaded
[session] GET /api/admin/session       # Session check
[session] isAdmin: true                # Admin authenticated
```

### Health Checks

Create a simple health check endpoint:

```typescript
// server/routes.ts
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: 'connected'  // Add actual DB check
  });
});
```

**Monitor**:
- Response time < 200ms
- Database connectivity
- Session store accessibility

### Error Monitoring

**Common Errors to Watch**:

```
Session save error:           # Database connection issue
Failed to fetch parcels:      # Database query timeout
Coordinate transformation:    # Invalid geometry in data
404 on /api/survey:          # Invalid code phrase
```

**Recommended Tools**:
- Replit built-in monitoring
- External: Sentry, LogRocket, Datadog
- Custom: Error aggregation in database

### Performance Metrics

**Key Metrics**:
- API response time: < 500ms
- Map parcel load time: < 2s
- Survey submission time: < 300ms
- Database query time: < 100ms

**Slow Query Detection**:
```typescript
// Add timing middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  next();
});
```

---

## Troubleshooting

### Session Persistence Issues

**Symptom**: Login succeeds but session doesn't persist

**Solutions**:
1. ✅ Verify `app.set('trust proxy', 1)` is enabled
2. ✅ Check `SESSION_SECRET` is set
3. ✅ Ensure database connection is stable
4. ✅ Verify `session` table exists
5. ✅ Check browser accepts cookies
6. ✅ Confirm HTTPS is working (Replit auto-provides)

**Test Session**:
```bash
# Login and save cookies
curl -X POST https://your-app.replit.app/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}' \
  -c cookies.txt -v

# Check session persists
curl https://your-app.replit.app/api/admin/session \
  -b cookies.txt
```

### Coordinate System Errors

**Symptom**: Parcels display in wrong location or not at all

**Causes**:
- Mixed coordinate systems in source data
- Incorrect coordinate order (lng/lat vs lat/lng)

**Solution**: The app handles this automatically via proj4:
```typescript
// server/dbStorage.ts
// Detects State Plane (coordinates > 1000) and converts to WGS84
if (Math.abs(x) > 1000 || Math.abs(y) > 1000) {
  [lng, lat] = proj4(statePlane, wgs84, [x, y]);
}
```

**Verify**:
- Check source GeoJSON coordinate ranges
- Ensure proj4 definitions are correct
- Test with known parcel coordinates

### Neon 64MB Response Limit

**Symptom**: API returns incomplete data or times out

**Cause**: Neon serverless has 64MB response size limit

**Solution**: Use bounding box filtering (already implemented)
```typescript
// server/routes.ts - map-parcels endpoint
// Filters by parcel ID prefix (lat/lng bounding box)
const boundingBox = calculateBoundingBox(area.centerLat, area.centerLng, radiusMeters);
```

**Alternative**: Implement pagination
```typescript
app.get('/api/parcels', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 100;
  const offset = (page - 1) * limit;
  
  const parcels = await storage.getParcels(limit, offset);
  res.json(parcels);
});
```

### Map Not Loading

**Symptom**: Map displays but no parcels visible

**Troubleshooting**:
1. Check browser console for errors
2. Verify `/api/survey/parcels` returns data
3. Check area definitions in `data/areas.json`
4. Ensure parcel IDs are assigned to areas
5. Verify coordinates are valid lat/lng

**Debug**:
```javascript
// Browser console
fetch('/api/survey/parcels')
  .then(r => r.json())
  .then(d => console.log('Parcels:', d.length));
```

### Performance Degradation

**Symptom**: Slow response times, high database usage

**Solutions**:
1. **Add Database Indexes**:
   ```sql
   CREATE INDEX idx_parcels_coordinates ON parcels USING GIST (coordinates);
   CREATE INDEX idx_parcels_survey ON parcels (survey_completed);
   ```

2. **Enable Query Caching**:
   ```typescript
   // TanStack Query already configured with caching
   const { data } = useQuery({
     queryKey: ['/api/survey/parcels'],
     staleTime: 5 * 60 * 1000,  // 5 minutes
   });
   ```

3. **Implement Response Compression**:
   ```typescript
   import compression from 'compression';
   app.use(compression());
   ```

4. **Optimize Parcel Queries**:
   - Use bounding box filtering
   - Limit response fields
   - Implement pagination

---

## Backup and Recovery

### Database Backups

**Replit Neon Databases**: Automatic backups included

**Manual Backup**:
```bash
# Export parcels table
psql $DATABASE_URL -c "COPY parcels TO STDOUT WITH CSV HEADER" > parcels_backup.csv

# Export all data
pg_dump $DATABASE_URL > database_backup.sql
```

**Backup Schedule**:
- Automatic: Daily (Neon)
- Manual: Before major changes
- Export survey data: Weekly

### Restore Procedures

**From SQL Dump**:
```bash
psql $DATABASE_URL < database_backup.sql
```

**From CSV**:
```bash
psql $DATABASE_URL -c "COPY parcels FROM STDIN WITH CSV HEADER" < parcels_backup.csv
```

### Replit Rollback

Use Replit's built-in rollback feature:
1. Access "History" tab in Replit
2. Select checkpoint before issue
3. Click "Restore"
4. Verify data integrity

**⚠️ Warning**: Rollback affects code AND database state

### Disaster Recovery Plan

1. **Immediate**: Switch to maintenance mode
2. **Assess**: Check data integrity
3. **Restore**: Use most recent backup
4. **Verify**: Test critical paths (login, survey, map)
5. **Communicate**: Notify users of downtime
6. **Post-mortem**: Document cause and prevention

---

## Performance Optimization

### Frontend Optimization

**Implemented**:
- ✅ React Query caching (5-minute stale time for parcels)
- ✅ Code splitting via Vite
- ✅ Lazy loading for map components
- ✅ Tailwind CSS purging in production

**Additional Optimizations**:
```typescript
// Lazy load heavy pages
const AdminPage = lazy(() => import('./pages/AdminPage'));
const MapPage = lazy(() => import('./pages/MapPage'));

// Use Suspense
<Suspense fallback={<LoadingSpinner />}>
  <AdminPage />
</Suspense>
```

### Backend Optimization

**Database Connection Pooling** (already configured):
```typescript
const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,  // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

**Response Caching**:
```typescript
import NodeCache from 'node-cache';
const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes

app.get('/api/areas', (req, res) => {
  const cached = cache.get('areas');
  if (cached) return res.json(cached);
  
  const areas = await storage.getAllAreas();
  cache.set('areas', areas);
  res.json(areas);
});
```

### Map Performance

**Leaflet Optimization**:
```typescript
// Reduce parcel rendering complexity
const simplifyPolygon = (coords) => {
  // Use Turf.js simplify for complex polygons
  return turf.simplify(coords, { tolerance: 0.00001 });
};

// Cluster markers for dense areas
import MarkerClusterGroup from 'react-leaflet-cluster';
```

### Monitoring Performance

**Web Vitals**:
- LCP (Largest Contentful Paint) < 2.5s
- FID (First Input Delay) < 100ms
- CLS (Cumulative Layout Shift) < 0.1

**Tools**:
- Lighthouse CI
- Chrome DevTools Performance tab
- Replit Analytics

---

## Security Hardening

### Additional Security Measures

**Rate Limiting**:
```typescript
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // 5 attempts
  message: 'Too many login attempts'
});

app.post('/api/admin/login', loginLimiter, ...);
```

**Helmet.js** (Security Headers):
```typescript
import helmet from 'helmet';
app.use(helmet());
```

**CSRF Protection** (if needed for non-session APIs):
```typescript
import csurf from 'csurf';
app.use(csurf({ cookie: true }));
```

### Audit Log

Track administrative actions:
```typescript
const auditLog = async (action, userId, details) => {
  await db.insert(auditLogs).values({
    action,
    userId,
    details,
    timestamp: new Date()
  });
};

// Usage
await auditLog('DELETE_AREA', req.session.userId, { areaId });
```

---

## Scaling Considerations

**Current Limits**:
- Single Replit instance
- PostgreSQL connection pool: 20
- Session storage: PostgreSQL

**Scaling Options**:
1. **Vertical**: Upgrade Replit plan for more resources
2. **Horizontal**: Deploy multiple instances (requires session synchronization)
3. **Database**: Use connection pooling service (PgBouncer)
4. **CDN**: Serve static assets via CDN
5. **Caching**: Redis for session and data caching

---

## Support and Maintenance

**Regular Maintenance**:
- Weekly: Review error logs
- Monthly: Database optimization (VACUUM, ANALYZE)
- Quarterly: Security updates
- Annually: Full backup test and disaster recovery drill

**Contact**:
For deployment issues or questions: molin.nature.area.care@gmail.com
