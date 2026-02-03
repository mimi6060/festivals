# Lineup Endpoints

Manage festival lineup including artists, stages, and performance schedules. The lineup system allows organizers to create a complete event schedule that attendees can browse.

## Endpoints Overview

### Artist Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/festivals/:festivalId/artists` | Create an artist | Yes (organizer) |
| GET | `/festivals/:festivalId/artists` | List artists | Yes |
| GET | `/festivals/:festivalId/artists/:id` | Get artist by ID | Yes |
| PATCH | `/festivals/:festivalId/artists/:id` | Update an artist | Yes (organizer) |
| DELETE | `/festivals/:festivalId/artists/:id` | Delete an artist | Yes (organizer) |

### Stage Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/festivals/:festivalId/stages` | Create a stage | Yes (organizer) |
| GET | `/festivals/:festivalId/stages` | List stages | Yes |
| GET | `/festivals/:festivalId/stages/:id` | Get stage by ID | Yes |
| PATCH | `/festivals/:festivalId/stages/:id` | Update a stage | Yes (organizer) |
| DELETE | `/festivals/:festivalId/stages/:id` | Delete a stage | Yes (organizer) |

### Performance Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/festivals/:festivalId/performances` | Create a performance | Yes (organizer) |
| GET | `/festivals/:festivalId/performances` | List performances | Yes |
| GET | `/festivals/:festivalId/performances/:id` | Get performance by ID | Yes |
| PATCH | `/festivals/:festivalId/performances/:id` | Update a performance | Yes (organizer) |
| DELETE | `/festivals/:festivalId/performances/:id` | Delete a performance | Yes (organizer) |
| GET | `/festivals/:festivalId/schedule` | Get full schedule | Public |

---

## Artist Object

```json
{
  "id": "artist123-e89b-12d3-a456-426614174000",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "The Electric Dreams",
  "bio": "Electronic music duo from Berlin known for their energetic live performances.",
  "genre": "Electronic",
  "country": "Germany",
  "imageUrl": "https://cdn.festivals.app/artists/electric-dreams.jpg",
  "socialLinks": {
    "website": "https://electricdreams.music",
    "spotify": "https://open.spotify.com/artist/xxxxx",
    "instagram": "https://instagram.com/electricdreams",
    "twitter": "https://twitter.com/electricdreams"
  },
  "isHeadliner": true,
  "sortOrder": 1,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Artist Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `festivalId` | uuid | Associated festival |
| `name` | string | Artist/band name |
| `bio` | string | Artist biography |
| `genre` | string | Music genre |
| `country` | string | Country of origin |
| `imageUrl` | string | Artist photo URL |
| `socialLinks` | object | Social media links |
| `isHeadliner` | boolean | Is a headlining act |
| `sortOrder` | integer | Display order |
| `createdAt` | string | Creation timestamp |
| `updatedAt` | string | Last update timestamp |

### Social Links Object

| Field | Type | Description |
|-------|------|-------------|
| `website` | string | Official website URL |
| `spotify` | string | Spotify artist URL |
| `instagram` | string | Instagram profile URL |
| `twitter` | string | Twitter/X profile URL |
| `youtube` | string | YouTube channel URL |
| `soundcloud` | string | SoundCloud URL |

---

## Stage Object

```json
{
  "id": "stage123-e89b-12d3-a456-426614174000",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Main Stage",
  "description": "The primary stage featuring headliners and major acts",
  "capacity": 50000,
  "location": "Central Field",
  "imageUrl": "https://cdn.festivals.app/stages/main-stage.jpg",
  "color": "#FF5733",
  "sortOrder": 1,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Stage Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `festivalId` | uuid | Associated festival |
| `name` | string | Stage name |
| `description` | string | Stage description |
| `capacity` | integer | Maximum capacity |
| `location` | string | Location within venue |
| `imageUrl` | string | Stage image URL |
| `color` | string | UI color (hex) |
| `sortOrder` | integer | Display order |
| `createdAt` | string | Creation timestamp |
| `updatedAt` | string | Last update timestamp |

---

## Performance Object

```json
{
  "id": "perf123-e89b-12d3-a456-426614174000",
  "festivalId": "123e4567-e89b-12d3-a456-426614174000",
  "artistId": "artist123-e89b-12d3-a456-426614174000",
  "stageId": "stage123-e89b-12d3-a456-426614174000",
  "startTime": "2024-07-15T22:00:00Z",
  "endTime": "2024-07-15T23:30:00Z",
  "day": 1,
  "isHeadliner": true,
  "artist": {
    "id": "artist123-e89b-12d3-a456-426614174000",
    "name": "The Electric Dreams",
    "genre": "Electronic",
    "imageUrl": "https://cdn.festivals.app/artists/electric-dreams.jpg"
  },
  "stage": {
    "id": "stage123-e89b-12d3-a456-426614174000",
    "name": "Main Stage",
    "color": "#FF5733"
  },
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Performance Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | uuid | Unique identifier |
| `festivalId` | uuid | Associated festival |
| `artistId` | uuid | Performing artist |
| `stageId` | uuid | Stage for performance |
| `startTime` | string | Start time (RFC3339) |
| `endTime` | string | End time (RFC3339) |
| `day` | integer | Festival day (1, 2, 3...) |
| `isHeadliner` | boolean | Is a headlining performance |
| `artist` | object | Embedded artist info |
| `stage` | object | Embedded stage info |
| `createdAt` | string | Creation timestamp |
| `updatedAt` | string | Last update timestamp |

---

## Artist Endpoints

### Create Artist

Create a new artist for a festival.

```
POST /api/v1/festivals/:festivalId/artists
```

#### Authentication

Requires authentication with `organizer` or `admin` role.

#### Request Body

```json
{
  "name": "The Electric Dreams",
  "bio": "Electronic music duo from Berlin known for their energetic live performances.",
  "genre": "Electronic",
  "country": "Germany",
  "imageUrl": "https://cdn.festivals.app/artists/electric-dreams.jpg",
  "socialLinks": {
    "website": "https://electricdreams.music",
    "spotify": "https://open.spotify.com/artist/xxxxx",
    "instagram": "https://instagram.com/electricdreams"
  },
  "isHeadliner": true,
  "sortOrder": 1
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Artist/band name |
| `bio` | string | No | Artist biography |
| `genre` | string | No | Music genre |
| `country` | string | No | Country of origin |
| `imageUrl` | string | No | Artist photo URL |
| `socialLinks` | object | No | Social media links |
| `isHeadliner` | boolean | No | Is a headlining act (default: false) |
| `sortOrder` | integer | No | Display order (default: 0) |

#### Response

**201 Created**

```json
{
  "data": {
    "id": "artist123-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "The Electric Dreams",
    "bio": "Electronic music duo from Berlin...",
    "genre": "Electronic",
    "country": "Germany",
    "imageUrl": "https://cdn.festivals.app/artists/electric-dreams.jpg",
    "socialLinks": {
      "website": "https://electricdreams.music",
      "spotify": "https://open.spotify.com/artist/xxxxx",
      "instagram": "https://instagram.com/electricdreams"
    },
    "isHeadliner": true,
    "sortOrder": 1,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/artists" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "The Electric Dreams",
    "bio": "Electronic music duo from Berlin",
    "genre": "Electronic",
    "country": "Germany",
    "isHeadliner": true
  }'
```

---

### List Artists

Get all artists for a festival.

```
GET /api/v1/festivals/:festivalId/artists
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `per_page` | integer | 50 | Items per page |
| `headliner` | boolean | - | Filter by headliner status |
| `genre` | string | - | Filter by genre |

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "artist123-e89b-12d3-a456-426614174000",
      "name": "The Electric Dreams",
      "genre": "Electronic",
      "country": "Germany",
      "imageUrl": "https://cdn.festivals.app/artists/electric-dreams.jpg",
      "isHeadliner": true,
      "sortOrder": 1
    },
    {
      "id": "artist456-e89b-12d3-a456-426614174000",
      "name": "Jazz Fusion Collective",
      "genre": "Jazz",
      "country": "USA",
      "isHeadliner": false,
      "sortOrder": 2
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "per_page": 50
  }
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/artists?headliner=true" \
  -H "Authorization: Bearer <token>"
```

---

### Get Artist by ID

Get a specific artist.

```
GET /api/v1/festivals/:festivalId/artists/:id
```

#### Response

**200 OK**

```json
{
  "data": {
    "id": "artist123-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "The Electric Dreams",
    "bio": "Electronic music duo from Berlin...",
    "genre": "Electronic",
    "country": "Germany",
    "imageUrl": "https://cdn.festivals.app/artists/electric-dreams.jpg",
    "socialLinks": {
      "website": "https://electricdreams.music",
      "spotify": "https://open.spotify.com/artist/xxxxx"
    },
    "isHeadliner": true,
    "sortOrder": 1,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Update Artist

Update an artist.

```
PATCH /api/v1/festivals/:festivalId/artists/:id
```

#### Request Body

All fields are optional.

```json
{
  "name": "Updated Artist Name",
  "bio": "Updated biography",
  "isHeadliner": false
}
```

#### Response

**200 OK**

---

### Delete Artist

Delete an artist.

```
DELETE /api/v1/festivals/:festivalId/artists/:id
```

#### Response

**204 No Content**

---

## Stage Endpoints

### Create Stage

Create a new stage for a festival.

```
POST /api/v1/festivals/:festivalId/stages
```

#### Authentication

Requires authentication with `organizer` or `admin` role.

#### Request Body

```json
{
  "name": "Main Stage",
  "description": "The primary stage featuring headliners",
  "capacity": 50000,
  "location": "Central Field",
  "imageUrl": "https://cdn.festivals.app/stages/main-stage.jpg",
  "color": "#FF5733",
  "sortOrder": 1
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Stage name |
| `description` | string | No | Stage description |
| `capacity` | integer | No | Maximum capacity |
| `location` | string | No | Location within venue |
| `imageUrl` | string | No | Stage image URL |
| `color` | string | No | UI color (hex) |
| `sortOrder` | integer | No | Display order |

#### Response

**201 Created**

```json
{
  "data": {
    "id": "stage123-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Main Stage",
    "description": "The primary stage featuring headliners",
    "capacity": 50000,
    "location": "Central Field",
    "imageUrl": "https://cdn.festivals.app/stages/main-stage.jpg",
    "color": "#FF5733",
    "sortOrder": 1,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/stages" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Stage",
    "description": "The primary stage featuring headliners",
    "capacity": 50000,
    "location": "Central Field",
    "color": "#FF5733"
  }'
```

---

### List Stages

Get all stages for a festival.

```
GET /api/v1/festivals/:festivalId/stages
```

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "stage123-e89b-12d3-a456-426614174000",
      "name": "Main Stage",
      "description": "The primary stage featuring headliners",
      "capacity": 50000,
      "location": "Central Field",
      "color": "#FF5733",
      "sortOrder": 1
    },
    {
      "id": "stage456-e89b-12d3-a456-426614174000",
      "name": "Electronic Tent",
      "description": "Indoor electronic music stage",
      "capacity": 5000,
      "color": "#00FF00",
      "sortOrder": 2
    }
  ]
}
```

---

### Get Stage by ID

```
GET /api/v1/festivals/:festivalId/stages/:id
```

---

### Update Stage

```
PATCH /api/v1/festivals/:festivalId/stages/:id
```

---

### Delete Stage

```
DELETE /api/v1/festivals/:festivalId/stages/:id
```

---

## Performance Endpoints

### Create Performance

Schedule an artist performance on a stage.

```
POST /api/v1/festivals/:festivalId/performances
```

#### Authentication

Requires authentication with `organizer` or `admin` role.

#### Request Body

```json
{
  "artistId": "artist123-e89b-12d3-a456-426614174000",
  "stageId": "stage123-e89b-12d3-a456-426614174000",
  "startTime": "2024-07-15T22:00:00Z",
  "endTime": "2024-07-15T23:30:00Z",
  "day": 1,
  "isHeadliner": true
}
```

#### Request Body Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `artistId` | uuid | Yes | Artist performing |
| `stageId` | uuid | Yes | Stage for performance |
| `startTime` | string | Yes | Start time (ISO 8601) |
| `endTime` | string | Yes | End time (ISO 8601) |
| `day` | integer | No | Festival day number |
| `isHeadliner` | boolean | No | Is a headlining slot |

#### Response

**201 Created**

```json
{
  "data": {
    "id": "perf123-e89b-12d3-a456-426614174000",
    "festivalId": "123e4567-e89b-12d3-a456-426614174000",
    "artistId": "artist123-e89b-12d3-a456-426614174000",
    "stageId": "stage123-e89b-12d3-a456-426614174000",
    "startTime": "2024-07-15T22:00:00Z",
    "endTime": "2024-07-15T23:30:00Z",
    "day": 1,
    "isHeadliner": true,
    "artist": {
      "id": "artist123-e89b-12d3-a456-426614174000",
      "name": "The Electric Dreams",
      "genre": "Electronic",
      "imageUrl": "https://cdn.festivals.app/artists/electric-dreams.jpg"
    },
    "stage": {
      "id": "stage123-e89b-12d3-a456-426614174000",
      "name": "Main Stage",
      "color": "#FF5733"
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

#### Example

```bash
curl -X POST "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/performances" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "artistId": "artist123-e89b-12d3-a456-426614174000",
    "stageId": "stage123-e89b-12d3-a456-426614174000",
    "startTime": "2024-07-15T22:00:00Z",
    "endTime": "2024-07-15T23:30:00Z",
    "day": 1,
    "isHeadliner": true
  }'
```

---

### List Performances

Get all performances for a festival.

```
GET /api/v1/festivals/:festivalId/performances
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `day` | integer | - | Filter by festival day |
| `stageId` | uuid | - | Filter by stage |
| `artistId` | uuid | - | Filter by artist |
| `date` | string | - | Filter by date (YYYY-MM-DD) |

#### Response

**200 OK**

```json
{
  "data": [
    {
      "id": "perf123-e89b-12d3-a456-426614174000",
      "artistId": "artist123-e89b-12d3-a456-426614174000",
      "stageId": "stage123-e89b-12d3-a456-426614174000",
      "startTime": "2024-07-15T22:00:00Z",
      "endTime": "2024-07-15T23:30:00Z",
      "day": 1,
      "isHeadliner": true,
      "artist": {
        "id": "artist123-e89b-12d3-a456-426614174000",
        "name": "The Electric Dreams",
        "genre": "Electronic"
      },
      "stage": {
        "id": "stage123-e89b-12d3-a456-426614174000",
        "name": "Main Stage",
        "color": "#FF5733"
      }
    }
  ],
  "meta": {
    "total": 120,
    "page": 1,
    "per_page": 50
  }
}
```

#### Example - Get Day 1 Performances

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/performances?day=1" \
  -H "Authorization: Bearer <token>"
```

#### Example - Get Performances for a Stage

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/performances?stageId=stage123-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

### Get Performance by ID

```
GET /api/v1/festivals/:festivalId/performances/:id
```

---

### Update Performance

```
PATCH /api/v1/festivals/:festivalId/performances/:id
```

#### Request Body

```json
{
  "startTime": "2024-07-15T22:30:00Z",
  "endTime": "2024-07-16T00:00:00Z",
  "stageId": "stage456-e89b-12d3-a456-426614174000"
}
```

---

### Delete Performance

```
DELETE /api/v1/festivals/:festivalId/performances/:id
```

---

## Schedule Endpoint

### Get Full Schedule

Get the complete festival schedule (public endpoint).

```
GET /api/v1/festivals/:festivalId/schedule
```

#### Authentication

No authentication required.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `day` | integer | Filter by festival day |

#### Response

**200 OK**

```json
{
  "data": {
    "festival": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Summer Music Festival 2024",
      "startDate": "2024-07-15",
      "endDate": "2024-07-17",
      "timezone": "Europe/Brussels"
    },
    "stages": [
      {
        "id": "stage123-e89b-12d3-a456-426614174000",
        "name": "Main Stage",
        "color": "#FF5733"
      },
      {
        "id": "stage456-e89b-12d3-a456-426614174000",
        "name": "Electronic Tent",
        "color": "#00FF00"
      }
    ],
    "days": [
      {
        "day": 1,
        "date": "2024-07-15",
        "performances": [
          {
            "id": "perf001-e89b-12d3-a456-426614174000",
            "startTime": "14:00",
            "endTime": "15:00",
            "artist": {
              "name": "Opening Act",
              "genre": "Rock"
            },
            "stage": {
              "id": "stage123-e89b-12d3-a456-426614174000",
              "name": "Main Stage"
            }
          },
          {
            "id": "perf123-e89b-12d3-a456-426614174000",
            "startTime": "22:00",
            "endTime": "23:30",
            "isHeadliner": true,
            "artist": {
              "name": "The Electric Dreams",
              "genre": "Electronic",
              "imageUrl": "https://cdn.festivals.app/artists/electric-dreams.jpg"
            },
            "stage": {
              "id": "stage123-e89b-12d3-a456-426614174000",
              "name": "Main Stage"
            }
          }
        ]
      },
      {
        "day": 2,
        "date": "2024-07-16",
        "performances": [...]
      }
    ]
  }
}
```

#### Example

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/schedule"
```

#### Example - Get Specific Day

```bash
curl -X GET "https://api.festivals.app/api/v1/festivals/123e4567-e89b-12d3-a456-426614174000/schedule?day=1"
```

---

## Error Responses

### Artist Not Found

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Artist not found"
  }
}
```

### Stage Not Found

**404 Not Found**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Stage not found"
  }
}
```

### Performance Conflict

**409 Conflict**

```json
{
  "error": {
    "code": "SCHEDULE_CONFLICT",
    "message": "Artist already has a performance scheduled at this time"
  }
}
```

### Invalid Time Range

**400 Bad Request**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "End time must be after start time"
  }
}
```
