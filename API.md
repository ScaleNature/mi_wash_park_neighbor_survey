# API Documentation

Complete REST API documentation for the Park Neighbor Support application.

## Base URL

- **Development**: `http://localhost:5000/api`
- **Production**: `https://your-app.replit.app/api`

## Authentication

The API uses **session-based authentication** for admin endpoints:
- Login creates a session with HTTP-only cookies
- Session data stored in PostgreSQL
- Cookies are secure in production (HTTPS only)
- Session timeout: 24 hours

### Authentication Flow

1. POST to `/api/admin/login` with credentials
2. Server sets HTTP-only session cookie
3. Include cookie in subsequent requests (automatic in browsers)
4. Check auth status via `/api/admin/session`

## Response Format

All endpoints return JSON responses.

**Success Response**:
```json
{
  "data": { ... },
  "success": true
}
```

**Error Response**:
```json
{
  "message": "Error description",
  "errors": [ ... ]  // Optional validation errors
}
```

## Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Authentication required or failed
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

---

## Endpoints

### Settings

#### Get Application Settings
Retrieves public application settings (admin password excluded).

```http
GET /api/settings
```

**Authentication**: None (public)

**Response**:
```json
{
  "id": "uuid",
  "appName": "Park Neighbor Support",
  "adminEmail": "admin@example.com"
}
```

---

#### Update Application Settings
Updates application configuration (admin only).

```http
PATCH /api/admin/settings
```

**Authentication**: Required (admin)

**Request Body**:
```json
{
  "appName": "New App Name",           // Optional
  "adminEmail": "new@example.com",     // Optional
  "adminPassword": "newpassword123"    // Optional
}
```

**Response**:
```json
{
  "id": "uuid",
  "appName": "New App Name",
  "adminEmail": "new@example.com"
}
```

**Notes**:
- At least one field must be provided
- Password is hashed before storage
- Password not returned in response

---

### Authentication

#### Login
Authenticates admin user and creates session.

```http
POST /api/admin/login
```

**Authentication**: None

**Request Body**:
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response**:
```json
{
  "success": true
}
```

**Error Responses**:
- `400` - Email or password missing
- `401` - Invalid credentials
- `500` - Session save failed

---

#### Logout
Destroys admin session.

```http
POST /api/admin/logout
```

**Authentication**: None (but requires existing session)

**Response**:
```json
{
  "success": true
}
```

---

#### Check Session
Verifies if current user is authenticated as admin.

```http
GET /api/admin/session
```

**Authentication**: None

**Response**:
```json
{
  "isAdmin": true
}
```

**Notes**:
- Returns `false` if not authenticated
- Used by frontend to determine UI state

---

### Areas

#### Get All Areas
Retrieves all nature area definitions.

```http
GET /api/areas
```

**Authentication**: None (public)

**Response**:
```json
[
  {
    "id": "uuid",
    "name": "Molin Nature Area",
    "centerLat": 42.2808,
    "centerLng": -83.7430,
    "defaultZoom": 16,
    "displayRadiusMeters": 500,
    "parcelIds": ["id1", "id2", ...]
  }
]
```

---

#### Create Area
Creates a new nature area.

```http
POST /api/areas
```

**Authentication**: Required (admin)

**Request Body**:
```json
{
  "name": "New Nature Area",
  "centerLat": 42.2808,
  "centerLng": -83.7430,
  "defaultZoom": 16,
  "displayRadiusMeters": 500
}
```

**Response**:
```json
{
  "id": "uuid",
  "name": "New Nature Area",
  "centerLat": 42.2808,
  "centerLng": -83.7430,
  "defaultZoom": 16,
  "displayRadiusMeters": 500,
  "parcelIds": []
}
```

**Validation**:
- `name`: Required, 1-200 characters
- `centerLat`: Required, number between -90 and 90
- `centerLng`: Required, number between -180 and 180
- `defaultZoom`: Required, integer 1-22
- `displayRadiusMeters`: Required, positive number

---

#### Update Area
Updates an existing area's properties.

```http
PATCH /api/areas/:areaId
```

**Authentication**: Required (admin)

**Request Body** (all fields optional):
```json
{
  "name": "Updated Name",
  "centerLat": 42.2900,
  "centerLng": -83.7500,
  "defaultZoom": 17,
  "displayRadiusMeters": 600
}
```

**Response**: Updated area object

**Notes**:
- At least one field must be provided
- Cannot modify `parcelIds` directly (use toggle endpoint)

---

#### Delete Area
Permanently deletes an area definition.

```http
DELETE /api/areas/:areaId
```

**Authentication**: Required (admin)

**Response**:
```json
{
  "success": true
}
```

**Important**:
- Deleting an area does NOT delete parcel survey data
- Survey responses persist on parcels independently
- Historical data is preserved

---

#### Get Area Parcel IDs
Retrieves list of parcel IDs assigned to a specific area.

```http
GET /api/areas/:areaId/parcels
```

**Authentication**: None (public)

**Response**:
```json
["parcel-id-1", "parcel-id-2", ...]
```

---

#### Get Area Statistics
Retrieves survey response statistics for an area.

```http
GET /api/areas/:areaId/statistics
```

**Authentication**: None (public)

**Response**:
```json
{
  "totalParcels": 150,
  "responsesCount": 45,
  "q1YesCount": 38,
  "q2YesCount": 22,
  "q3YesCount": 15,
  "responseRate": 0.30
}
```

---

### Parcels

#### Get All Parcels (Admin)
Retrieves complete parcel dataset with survey responses.

```http
GET /api/parcels
```

**Authentication**: Required (admin)

**Response**:
```json
[
  {
    "id": "42.238885,-83.722680-34346",
    "shortCode": "AB1234",
    "codePhrase": "dancing-oak-whispers",
    "address": "123 Main St",
    "coordinates": { "type": "Polygon", "coordinates": [[...]] },
    "surveyCompleted": true,
    "q1Response": true,
    "q1Comment": "Happy to help!",
    "q2Response": false,
    "q2Comment": null,
    "q3Response": true,
    "q3Comment": null,
    "responseDate": "2024-10-20T15:30:00Z"
  }
]
```

**Notes**:
- Returns all 126K+ parcels (use with caution)
- Includes private comment data (admin only)
- Large response size (~64MB with full dataset)

---

#### Get Survey Parcels (Public)
Retrieves parcels assigned to any area (for public map display).

```http
GET /api/survey/parcels
```

**Authentication**: None (public)

**Response**: Array of parcel objects (same structure as above, but comments excluded)

**Notes**:
- Only includes parcels assigned to at least one area
- Comments are excluded for privacy
- Optimized for public map rendering

---

#### Get Map Parcels for Area (Admin)
Retrieves parcels for admin map display using bounding box filtering.

```http
GET /api/admin/areas/:areaId/map-parcels
```

**Authentication**: Required (admin)

**Response**:
```json
[
  {
    "id": "parcel-id",
    "address": "123 Main St",
    "coordinates": { ... },
    "selected": true,  // Assigned to this area
    "q1Response": true,
    "q2Response": false,
    "q3Response": true,
    // ... other fields
  }
]
```

**Notes**:
- Uses efficient bounding box filtering by parcel ID prefix
- Includes both assigned and optional parcels within display radius
- `selected: true` indicates parcel is assigned to the area
- Optimized to avoid Neon 64MB response limit

---

#### Toggle Parcel Area Assignment
Assigns or unassigns a parcel to/from an area.

```http
POST /api/admin/parcel/:parcelId/toggle-area
```

**Authentication**: Required (admin)

**Request Body**:
```json
{
  "areaId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "action": "added"  // or "removed"
}
```

**Notes**:
- If parcel is already in area: removes it
- If parcel is not in area: adds it
- Parcels can belong to multiple areas

---

### Survey

#### Get Survey by Code
Retrieves parcel data for survey submission using code phrase.

```http
GET /api/survey?code=AB1234&phrase=dancing-oak-whispers
```

**Authentication**: None (public, but requires valid code phrase)

**Query Parameters**:
- `code`: Short code (e.g., "AB1234")
- `phrase`: Nature-themed code phrase (e.g., "dancing-oak-whispers")

**Response**:
```json
{
  "id": "parcel-id",
  "address": "123 Main St",
  "q1Response": null,
  "q1Comment": null,
  "q2Response": null,
  "q2Comment": null,
  "q3Response": null,
  "q3Comment": null
}
```

**Error Responses**:
- `400` - Code or phrase missing
- `404` - Invalid code phrase combination

**Notes**:
- Used to pre-fill survey form with existing responses
- Comments included (user can see their own comments)
- Privacy: code phrases act as authentication

---

#### Submit Survey Response
Submits or updates survey responses for a parcel.

```http
POST /api/survey
```

**Authentication**: None (public, but requires valid code phrase)

**Request Body**:
```json
{
  "code": "AB1234",
  "phrase": "dancing-oak-whispers",
  "address": "123 Main St",           // Optional
  "question1": "yes",                 // Optional: "yes" | "no"
  "question1Comment": "Happy to help!", // Optional
  "question2": "no",                  // Optional: "yes" | "no"
  "question2Comment": null,           // Optional
  "question3": "yes",                 // Optional: "yes" | "no"
  "question3Comment": null            // Optional
}
```

**Response**:
```json
{
  "success": true,
  "parcelId": "parcel-id"
}
```

**Validation**:
- Code and phrase are required
- At least one response field should be provided
- Comments are optional
- All questions are optional (partial responses allowed)

**Notes**:
- Existing responses are updated, not replaced
- If question is omitted, existing value is preserved
- Sets `surveyCompleted = true` and `responseDate` timestamp

---

## Rate Limiting

Currently no rate limiting is implemented. Consider adding:
- Login endpoint: 5 attempts per 15 minutes per IP
- Survey submission: 10 submissions per hour per code phrase
- Area creation: 20 per hour per admin session

## CORS

CORS is not explicitly configured. The application serves frontend and API from the same origin, so CORS is not needed. If adding external API consumers:

```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:5000',
  credentials: true
}));
```

## WebSocket Support

Not currently implemented. If adding real-time features:
- Use Socket.io for admin dashboard live updates
- Emit events on survey submissions
- Real-time parcel assignment updates

## Pagination

Large dataset endpoints (`/api/parcels`) do not currently support pagination. Recommended implementation:

```http
GET /api/parcels?page=1&limit=100&sortBy=address&order=asc
```

## Data Export

No built-in export endpoints. For CSV/Excel export:

```http
GET /api/admin/export/parcels?format=csv&areaId=uuid
```

Would return survey responses in CSV format.

## Error Codes Reference

| Code | Meaning | Common Causes |
|------|---------|---------------|
| 400 | Bad Request | Missing required fields, invalid data format |
| 401 | Unauthorized | Not logged in, session expired |
| 404 | Not Found | Invalid parcel ID, area ID, or code phrase |
| 500 | Internal Server Error | Database connection issues, unhandled exceptions |

## Testing

Use curl or Postman for API testing:

```bash
# Login
curl -X POST http://localhost:5000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  -c cookies.txt

# Authenticated request
curl http://localhost:5000/api/parcels \
  -b cookies.txt

# Submit survey
curl -X POST http://localhost:5000/api/survey \
  -H "Content-Type: application/json" \
  -d '{
    "code": "AB1234",
    "phrase": "dancing-oak-whispers",
    "question1": "yes",
    "question1Comment": "Happy to help!"
  }'
```

## Security Considerations

1. **Session Security**
   - Use strong `SESSION_SECRET` in production
   - Enable `secure` cookies in production (HTTPS only)
   - Set `trust proxy` for apps behind reverse proxies

2. **Input Validation**
   - All inputs validated with Zod schemas
   - SQL injection prevented by Drizzle ORM parameterization
   - XSS prevention via React's built-in escaping

3. **Authentication**
   - Passwords hashed with bcrypt (10 rounds)
   - Session timeout: 24 hours
   - No password in API responses

4. **Privacy**
   - Survey comments never exposed in public endpoints
   - Code phrases required for survey access
   - Admin endpoints protected by session middleware

## Future Enhancements

- GraphQL endpoint for flexible querying
- Webhook support for survey submissions
- Bulk import/export APIs
- API versioning (e.g., `/api/v1/...`)
- Request logging and analytics
