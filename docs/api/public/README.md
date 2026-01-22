# API Publique Festivals

Documentation de l'API publique pour les integrations tierces.

## Vue d'ensemble

L'API publique permet aux developpeurs tiers d'integrer les donnees de festivals dans leurs applications. Elle offre un acces en lecture aux informations publiques du festival, a la programmation et aux billets disponibles.

**URL de base**: `https://api.festivals.app/public/v1`

## Authentification

Toutes les requetes necessitent une cle API valide dans l'en-tete `X-API-Key`.

```bash
curl -X GET "https://api.festivals.app/public/v1/festivals/{id}" \
  -H "X-API-Key: pk_live_votre_cle_api"
```

### Types de cles

| Type | Prefixe | Description |
|------|---------|-------------|
| Sandbox | `pk_test_` | Pour le developpement et les tests |
| Production | `pk_live_` | Pour les applications en production |

### Permissions

| Permission | Description |
|------------|-------------|
| `festivals:read` | Acces aux informations du festival |
| `lineup:read` | Acces a la programmation et aux artistes |
| `tickets:read` | Acces aux types de billets |
| `tickets:write` | Creation et modification de billets |
| `wallets:read` | Acces aux informations wallet |
| `wallets:write` | Operations sur les wallets |
| `stats:read` | Acces aux statistiques |
| `webhooks:manage` | Gestion des webhooks |

## Rate Limiting

| Limite | Valeur |
|--------|--------|
| Par minute | 60 requetes |
| Par jour | 10,000 requetes |

En-tetes de reponse:
- `X-RateLimit-Limit`: Limite par minute
- `X-RateLimit-Remaining`: Requetes restantes
- `X-RateLimit-Reset`: Timestamp de reinitialisation

## Endpoints

### Festival

#### GET /festivals/:id

Recupere les informations publiques d'un festival.

**Reponse:**
```json
{
  "id": "uuid",
  "name": "Summer Fest 2026",
  "slug": "summer-fest-2026",
  "description": "Le plus grand festival d'ete de Belgique",
  "startDate": "2026-06-15",
  "endDate": "2026-06-17",
  "location": "Brussels, Belgium",
  "timezone": "Europe/Brussels",
  "currencyName": "Jetons",
  "status": "ACTIVE",
  "settings": {
    "logoUrl": "https://...",
    "primaryColor": "#FF5733",
    "secondaryColor": "#333333"
  }
}
```

### Lineup

#### GET /festivals/:id/lineup

Recupere la programmation complete du festival.

**Reponse:**
```json
{
  "festivalId": "uuid",
  "days": ["2026-06-15", "2026-06-16", "2026-06-17"],
  "stages": [
    {
      "id": "uuid",
      "name": "Main Stage",
      "location": "Zone A",
      "capacity": 5000
    }
  ],
  "schedule": {
    "2026-06-15": [
      {
        "stage": { "id": "uuid", "name": "Main Stage" },
        "performances": [
          {
            "id": "uuid",
            "artistId": "uuid",
            "startTime": "2026-06-15T18:00:00Z",
            "endTime": "2026-06-15T19:30:00Z",
            "artist": {
              "name": "Artist Name",
              "genre": "Electronic"
            }
          }
        ]
      }
    ]
  }
}
```

#### GET /festivals/:id/artists

Liste tous les artistes du festival.

**Parametres:**
- `page` (int, optionnel): Numero de page (defaut: 1)
- `per_page` (int, optionnel): Elements par page (defaut: 50, max: 100)

**Reponse:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Artist Name",
      "description": "Bio de l'artiste",
      "genre": "Electronic",
      "imageUrl": "https://...",
      "socialLinks": {
        "instagram": "https://instagram.com/artist",
        "spotify": "https://open.spotify.com/artist/..."
      }
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "perPage": 50
  }
}
```

#### GET /festivals/:id/stages

Liste toutes les scenes du festival.

**Reponse:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Main Stage",
      "location": "Zone A",
      "capacity": 5000,
      "settings": {
        "color": "#FF0000",
        "isIndoor": false
      }
    }
  ]
}
```

#### GET /festivals/:id/schedule

Recupere le programme d'un jour specifique.

**Parametres:**
- `day` (string, optionnel): Date au format YYYY-MM-DD

**Reponse:**
```json
{
  "day": "2026-06-15",
  "stages": [...],
  "performances": [
    {
      "id": "uuid",
      "artistId": "uuid",
      "stageId": "uuid",
      "startTime": "2026-06-15T18:00:00Z",
      "endTime": "2026-06-15T19:30:00Z",
      "status": "SCHEDULED",
      "artist": {...},
      "stage": {...}
    }
  ]
}
```

### Billets

#### GET /festivals/:id/tickets

Liste les types de billets disponibles.

**Parametres:**
- `status` (string, optionnel): Filtrer par statut (ACTIVE, SOLD_OUT)

**Reponse:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Pass 3 jours",
      "description": "Acces complet au festival",
      "price": 15000,
      "priceDisplay": "150.00 EUR",
      "available": 500,
      "validFrom": "2026-06-15T00:00:00Z",
      "validUntil": "2026-06-17T23:59:59Z",
      "benefits": ["Acces toutes scenes", "Zone VIP"],
      "status": "ACTIVE"
    }
  ]
}
```

#### GET /festivals/:id/tickets/:ticketTypeId

Recupere les details d'un type de billet.

#### GET /festivals/:id/tickets/:ticketTypeId/availability

Verifie la disponibilite des billets.

**Parametres:**
- `quantity` (int, optionnel): Quantite souhaitee (defaut: 1)

**Reponse:**
```json
{
  "ticketTypeId": "uuid",
  "name": "Pass 3 jours",
  "available": 500,
  "requested": 2,
  "canPurchase": true,
  "status": "ACTIVE",
  "message": "Tickets are available."
}
```

## Webhooks

### Configuration

Configurez des webhooks pour recevoir des notifications en temps reel.

### Evenements disponibles

| Evenement | Description |
|-----------|-------------|
| `ticket.sold` | Billet achete |
| `ticket.scanned` | Billet scanne a l'entree |
| `ticket.transferred` | Billet transfere |
| `wallet.topup` | Wallet recharge |
| `wallet.transaction` | Transaction effectuee |
| `refund.requested` | Remboursement demande |
| `refund.processed` | Remboursement traite |
| `festival.updated` | Informations festival modifiees |
| `lineup.changed` | Programmation modifiee |

### Format du payload

```json
{
  "id": "whd_123abc",
  "timestamp": "2026-01-23T10:30:00Z",
  "event": "ticket.sold",
  "festivalId": "uuid",
  "data": {
    "ticketId": "uuid",
    "ticketTypeId": "uuid",
    "holderEmail": "user@example.com",
    "price": 15000
  }
}
```

### Verification de signature

Chaque webhook inclut une signature HMAC-SHA256 dans l'en-tete `X-Webhook-Signature`.

**Python:**
```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    # Retirer le prefixe "whsec_" du secret
    key = secret.replace("whsec_", "")
    expected = hmac.new(
        key.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)
```

**JavaScript:**
```javascript
const crypto = require('crypto');

function verifySignature(payload, signature, secret) {
  // Retirer le prefixe "whsec_" du secret
  const key = secret.replace('whsec_', '');
  const expected = crypto
    .createHmac('sha256', key)
    .update(payload)
    .digest('hex');
  return signature === `sha256=${expected}`;
}
```

## Exemples d'integration

### cURL

```bash
# Recuperer les infos du festival
curl -X GET "https://api.festivals.app/public/v1/festivals/{festivalId}" \
  -H "X-API-Key: pk_live_xxxxx" \
  -H "Content-Type: application/json"

# Recuperer le lineup
curl -X GET "https://api.festivals.app/public/v1/festivals/{festivalId}/lineup" \
  -H "X-API-Key: pk_live_xxxxx"

# Verifier disponibilite billets
curl -X GET "https://api.festivals.app/public/v1/festivals/{festivalId}/tickets/{ticketTypeId}/availability?quantity=2" \
  -H "X-API-Key: pk_live_xxxxx"
```

### JavaScript / Node.js

```javascript
const API_KEY = process.env.FESTIVALS_API_KEY;
const BASE_URL = 'https://api.festivals.app/public/v1';

async function getFestival(festivalId) {
  const response = await fetch(`${BASE_URL}/festivals/${festivalId}`, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

async function getLineup(festivalId) {
  const response = await fetch(`${BASE_URL}/festivals/${festivalId}/lineup`, {
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  return response.json();
}

async function checkAvailability(festivalId, ticketTypeId, quantity = 1) {
  const url = new URL(`${BASE_URL}/festivals/${festivalId}/tickets/${ticketTypeId}/availability`);
  url.searchParams.set('quantity', quantity);

  const response = await fetch(url, {
    headers: {
      'X-API-Key': API_KEY
    }
  });

  return response.json();
}

// Utilisation
const festival = await getFestival('festival-uuid');
console.log(`Festival: ${festival.name}`);

const lineup = await getLineup('festival-uuid');
console.log(`${lineup.stages.length} scenes`);

const availability = await checkAvailability('festival-uuid', 'ticket-type-uuid', 2);
if (availability.canPurchase) {
  console.log('Billets disponibles!');
}
```

### Python

```python
import requests
import os

API_KEY = os.environ.get('FESTIVALS_API_KEY')
BASE_URL = 'https://api.festivals.app/public/v1'

headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
}

def get_festival(festival_id):
    response = requests.get(
        f'{BASE_URL}/festivals/{festival_id}',
        headers=headers
    )
    response.raise_for_status()
    return response.json()

def get_lineup(festival_id):
    response = requests.get(
        f'{BASE_URL}/festivals/{festival_id}/lineup',
        headers=headers
    )
    response.raise_for_status()
    return response.json()

def check_availability(festival_id, ticket_type_id, quantity=1):
    response = requests.get(
        f'{BASE_URL}/festivals/{festival_id}/tickets/{ticket_type_id}/availability',
        headers=headers,
        params={'quantity': quantity}
    )
    response.raise_for_status()
    return response.json()

# Utilisation
festival = get_festival('festival-uuid')
print(f"Festival: {festival['name']}")

lineup = get_lineup('festival-uuid')
print(f"{len(lineup['stages'])} scenes")

availability = check_availability('festival-uuid', 'ticket-type-uuid', 2)
if availability['canPurchase']:
    print("Billets disponibles!")
```

### PHP

```php
<?php

class FestivalsAPI {
    private $apiKey;
    private $baseUrl = 'https://api.festivals.app/public/v1';

    public function __construct($apiKey) {
        $this->apiKey = $apiKey;
    }

    private function request($endpoint, $params = []) {
        $url = $this->baseUrl . $endpoint;
        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'X-API-Key: ' . $this->apiKey,
            'Content-Type: application/json'
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 400) {
            throw new Exception("API error: $httpCode");
        }

        return json_decode($response, true);
    }

    public function getFestival($festivalId) {
        return $this->request("/festivals/$festivalId");
    }

    public function getLineup($festivalId) {
        return $this->request("/festivals/$festivalId/lineup");
    }

    public function checkAvailability($festivalId, $ticketTypeId, $quantity = 1) {
        return $this->request(
            "/festivals/$festivalId/tickets/$ticketTypeId/availability",
            ['quantity' => $quantity]
        );
    }
}

// Utilisation
$api = new FestivalsAPI($_ENV['FESTIVALS_API_KEY']);

$festival = $api->getFestival('festival-uuid');
echo "Festival: " . $festival['name'] . "\n";

$lineup = $api->getLineup('festival-uuid');
echo count($lineup['stages']) . " scenes\n";

$availability = $api->checkAvailability('festival-uuid', 'ticket-type-uuid', 2);
if ($availability['canPurchase']) {
    echo "Billets disponibles!\n";
}
```

## Codes d'erreur

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Requete invalide |
| 401 | Unauthorized | Cle API manquante ou invalide |
| 403 | Forbidden | Permission insuffisante |
| 404 | Not Found | Ressource non trouvee |
| 429 | Too Many Requests | Limite de taux depassee |
| 500 | Internal Server Error | Erreur serveur |

## Support

Pour toute question ou probleme:
- Documentation: https://docs.festivals.app
- Email: api-support@festivals.app
- Status: https://status.festivals.app
