# Auth0 Setup Guide for Festivals Platform

This guide walks you through setting up Auth0 authentication for the Festivals platform. Auth0 handles user authentication, authorization, and social login integration for the Admin dashboard, Mobile app, and API backend.

## Table of Contents

1. [Create Auth0 Account](#part-1-create-auth0-account)
2. [Create Applications](#part-2-create-applications)
3. [Create API](#part-3-create-api)
4. [Configure Roles](#part-4-configure-roles)
5. [Social Connections](#part-5-social-connections-optional)
6. [Customize](#part-6-customize)
7. [Get Credentials](#part-7-get-credentials)
8. [Actions & Rules](#part-8-actions--rules)
9. [Testing](#part-9-testing)
10. [Troubleshooting](#troubleshooting)

---

## Part 1: Create Auth0 Account

### 1.1 Sign Up

1. Go to [auth0.com](https://auth0.com)
2. Click **"Sign Up"**
3. Choose your signup method (email, Google, or GitHub)
4. Verify your email if prompted

> **Screenshot Reference**: You should see the Auth0 signup page with options for email, Google, and GitHub registration.

### 1.2 Create a Tenant

1. After signup, you'll be prompted to create a tenant
2. Enter your tenant name: `festivals` (or your preferred name)
3. Select your region:
   - **EU (Ireland)** - Recommended for European users
   - **US (Virginia)** - For US-based users
   - **AU (Sydney)** - For Asia-Pacific users
4. Click **"Create Tenant"**

Your tenant URL will be: `https://festivals.eu.auth0.com` (or your region)

> **Screenshot Reference**: The tenant creation screen shows a text field for tenant name and region selector dropdown.

### 1.3 Free Tier Limits

Auth0's free tier includes:
- **7,500 monthly active users**
- **2 social identity providers**
- **Unlimited logins**
- **3 Actions** (formerly Rules)
- **Community support**

This is sufficient for development and small-scale production use.

---

## Part 2: Create Applications

You need to create three applications in Auth0:

| Application | Type | Purpose |
|-------------|------|---------|
| Festivals API | Machine to Machine | Backend API authentication |
| Festivals Admin | Single Page Application | Admin dashboard |
| Festivals Mobile | Native | Mobile app (iOS/Android) |

### 2.1 Festivals API (Machine to Machine)

1. Go to **Applications > Applications** in the Auth0 dashboard
2. Click **"+ Create Application"**
3. Configure:
   - **Name**: `Festivals API`
   - **Type**: Select **"Machine to Machine Applications"**
4. Click **"Create"**
5. Select the API to authorize (you'll create this in Part 3)
6. Go to the **Settings** tab and configure:

```
Application Properties:
- Name: Festivals API
- Application Type: Machine to Machine

Credentials:
- Token Endpoint Authentication Method: Post
- Application is First-Party: Yes
```

> **Screenshot Reference**: The application creation modal shows radio buttons for different application types with Machine to Machine selected.

### 2.2 Festivals Admin (Single Page Application)

1. Click **"+ Create Application"**
2. Configure:
   - **Name**: `Festivals Admin`
   - **Type**: Select **"Single Page Web Applications"**
3. Click **"Create"**
4. Go to the **Settings** tab and configure:

```
Basic Information:
- Name: Festivals Admin
- Domain: (auto-generated)
- Client ID: (auto-generated, copy this)
- Client Secret: (auto-generated, copy this)

Application URIs:

Allowed Callback URLs:
http://localhost:3000/api/auth/callback/auth0,
https://admin.festivals.app/api/auth/callback/auth0,
https://staging-admin.festivals.app/api/auth/callback/auth0

Allowed Logout URLs:
http://localhost:3000,
https://admin.festivals.app,
https://staging-admin.festivals.app

Allowed Web Origins:
http://localhost:3000,
https://admin.festivals.app,
https://staging-admin.festivals.app

Allowed Origins (CORS):
http://localhost:3000,
https://admin.festivals.app,
https://staging-admin.festivals.app
```

5. Under **Advanced Settings > Grant Types**, ensure these are enabled:
   - Authorization Code
   - Refresh Token
   - Implicit (for compatibility)

6. Under **Advanced Settings > OAuth**:
   - **OIDC Conformant**: Enabled
   - **JSON Web Token (JWT) Signature Algorithm**: RS256

> **Screenshot Reference**: The application settings page shows collapsible sections for Basic Information, Application URIs, and Advanced Settings.

### 2.3 Festivals Mobile (Native Application)

1. Click **"+ Create Application"**
2. Configure:
   - **Name**: `Festivals Mobile`
   - **Type**: Select **"Native"**
3. Click **"Create"**
4. Go to the **Settings** tab and configure:

```
Basic Information:
- Name: Festivals Mobile
- Domain: (auto-generated)
- Client ID: (auto-generated, copy this)

Application URIs:

Allowed Callback URLs:
festivals://auth/callback,
exp://localhost:8081/--/auth/callback,
exp://192.168.*.*/--/auth/callback,
https://auth.expo.io/@your-username/festivals

Allowed Logout URLs:
festivals://auth/logout,
exp://localhost:8081,
https://auth.expo.io/@your-username/festivals

Allowed Origins (CORS):
exp://localhost:8081,
exp://192.168.*.*
```

5. Under **Advanced Settings > Grant Types**, ensure these are enabled:
   - Authorization Code
   - Refresh Token

6. Under **Advanced Settings > OAuth**:
   - **OIDC Conformant**: Enabled
   - **JSON Web Token (JWT) Signature Algorithm**: RS256

> **Note**: Replace `@your-username` with your Expo username.

> **Screenshot Reference**: The Native application settings show specific fields for mobile callback URLs with deep linking schemes.

---

## Part 3: Create API

### 3.1 Create the API

1. Go to **Applications > APIs** in the Auth0 dashboard
2. Click **"+ Create API"**
3. Configure:

```
Name: Festivals API
Identifier (Audience): https://api.festivals.app
Signing Algorithm: RS256
```

4. Click **"Create"**

> **Important**: The Identifier is used as the `audience` in your configuration. Use a URL format even though it doesn't need to be a real endpoint.

> **Screenshot Reference**: The API creation form shows fields for Name, Identifier, and Signing Algorithm dropdown.

### 3.2 Configure Permissions/Scopes

1. Go to the **Permissions** tab of your API
2. Add the following permissions:

| Permission | Description |
|------------|-------------|
| `read:festivals` | Read festival information |
| `write:festivals` | Create and update festivals |
| `delete:festivals` | Delete festivals |
| `read:stands` | Read stand information |
| `write:stands` | Create and update stands |
| `delete:stands` | Delete stands |
| `read:products` | Read product information |
| `write:products` | Create and update products |
| `delete:products` | Delete products |
| `read:orders` | Read order information |
| `write:orders` | Create and update orders |
| `process:orders` | Process orders and payments |
| `read:wallets` | Read wallet information |
| `write:wallets` | Create and update wallets |
| `topup:wallets` | Add funds to wallets |
| `refund:wallets` | Process wallet refunds |
| `read:tickets` | Read ticket information |
| `write:tickets` | Create and update tickets |
| `scan:tickets` | Scan and validate tickets |
| `read:staff` | Read staff information |
| `write:staff` | Create and update staff |
| `manage:staff` | Full staff management |
| `read:reports` | Read reports and analytics |
| `export:reports` | Export report data |
| `read:settings` | Read settings |
| `write:settings` | Update settings |
| `manage:roles` | Manage roles and permissions |
| `read:audit` | Read audit logs |
| `send:notifications` | Send push notifications |
| `manage:nfc` | Manage NFC wristbands |
| `manage:api` | Manage API keys and webhooks |

> **Screenshot Reference**: The Permissions tab shows a table with Permission and Description columns, with an "Add" button.

### 3.3 Configure API Settings

1. Go to the **Settings** tab
2. Configure:

```
Token Settings:
- Token Expiration (Seconds): 3600 (1 hour)
- Token Expiration For Browser Flows (Seconds): 7200 (2 hours)

Access Settings:
- Allow Skipping User Consent: Enabled (for first-party apps)
- Allow Offline Access: Enabled (for refresh tokens)
```

---

## Part 4: Configure Roles

### 4.1 Enable RBAC

1. Go to your API settings
2. Under **RBAC Settings**:
   - Enable **"Enable RBAC"**
   - Enable **"Add Permissions in the Access Token"**

> **Screenshot Reference**: RBAC Settings shows two toggle switches for enabling RBAC and adding permissions to tokens.

### 4.2 Create Roles

1. Go to **User Management > Roles**
2. Create the following roles:

#### Super Admin
```
Name: SUPER_ADMIN
Description: Full platform access - can manage all festivals and system settings
```

Permissions:
- All permissions from the API

#### Festival Owner
```
Name: FESTIVAL_OWNER
Description: Owner of a festival - full access to their festival
```

Permissions:
- `read:festivals`, `write:festivals`
- `read:stands`, `write:stands`, `delete:stands`
- `read:products`, `write:products`, `delete:products`
- `read:orders`, `write:orders`, `process:orders`
- `read:wallets`, `write:wallets`, `topup:wallets`, `refund:wallets`
- `read:tickets`, `write:tickets`, `scan:tickets`
- `read:staff`, `write:staff`, `manage:staff`
- `read:reports`, `export:reports`
- `read:settings`, `write:settings`
- `manage:roles`
- `read:audit`
- `send:notifications`
- `manage:nfc`
- `manage:api`

#### Festival Admin
```
Name: FESTIVAL_ADMIN
Description: Administrator for a festival - almost full access
```

Permissions:
- Same as Festival Owner except:
  - No `delete:festivals`
  - No `manage:roles` (at top level)

#### Finance Manager
```
Name: FINANCE_MANAGER
Description: Manages finances, transactions, refunds, and reports
```

Permissions:
- `read:festivals`
- `read:orders`, `process:orders`
- `read:wallets`, `refund:wallets`
- `read:reports`, `export:reports`
- `read:audit`

#### Lineup Manager
```
Name: LINEUP_MANAGER
Description: Manages festival lineup and scheduling
```

Permissions:
- `read:festivals`
- `read:lineup`, `write:lineup`
- `read:artists`, `write:artists`
- `send:notifications` (for lineup announcements)

#### Security Manager
```
Name: SECURITY_MANAGER
Description: Manages security, access control, and scanning
```

Permissions:
- `read:festivals`
- `read:tickets`, `scan:tickets`
- `read:staff`, `write:staff`, `manage:staff`
- `read:security`, `write:security`
- `read:audit`

#### Cashier
```
Name: CASHIER
Description: Can process sales and view basic information
```

Permissions:
- `read:festivals`
- `read:products`
- `read:orders`, `write:orders`, `process:orders`
- `read:wallets`

#### Scanner
```
Name: SCANNER
Description: Can scan tickets and check entries
```

Permissions:
- `read:festivals`
- `read:tickets`, `scan:tickets`
- `read:security`

#### Viewer
```
Name: VIEWER
Description: Read-only access to festival information
```

Permissions:
- `read:festivals`
- `read:stands`
- `read:products`
- `read:orders`
- `read:tickets`
- `read:reports`

> **Screenshot Reference**: The Roles page shows a list of roles with their names and descriptions, with a "Create Role" button.

---

## Part 5: Social Connections (Optional)

### 5.1 Google Login

1. Go to **Authentication > Social**
2. Find **Google** and click to enable
3. You'll need Google OAuth credentials:

#### Get Google Credentials:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Go to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth Client ID**
5. Configure:
   - Application type: **Web application**
   - Name: `Festivals Auth0`
   - Authorized JavaScript origins:
     ```
     https://festivals.eu.auth0.com
     ```
   - Authorized redirect URIs:
     ```
     https://festivals.eu.auth0.com/login/callback
     ```
6. Copy the **Client ID** and **Client Secret**

#### Configure in Auth0:
```
Client ID: (from Google)
Client Secret: (from Google)
Allowed Mobile Client IDs: (optional, for mobile)

Attributes:
- Basic Profile: Enabled
- Email: Enabled
```

> **Screenshot Reference**: The Google connection settings show fields for Client ID, Client Secret, and checkboxes for attributes.

### 5.2 Apple Login

1. Go to **Authentication > Social**
2. Find **Apple** and click to enable
3. You'll need Apple Developer credentials:

#### Get Apple Credentials:
1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Go to **Certificates, Identifiers & Profiles**
3. Create a new **Service ID**:
   - Description: `Festivals Login`
   - Identifier: `app.festivals.signin`
4. Enable **Sign in with Apple**
5. Configure domains and return URLs:
   - Domains: `festivals.eu.auth0.com`
   - Return URLs: `https://festivals.eu.auth0.com/login/callback`
6. Create a **Key** for Sign in with Apple
7. Download the key file (`.p8`)

#### Configure in Auth0:
```
Apple Team ID: (from Apple Developer account)
Service ID: app.festivals.signin
Key ID: (from the key you created)
Private Key: (contents of .p8 file)

Attributes:
- Name: Enabled
- Email: Enabled
```

> **Note**: Apple requires apps distributed on App Store to support Sign in with Apple if they support any third-party login.

> **Screenshot Reference**: The Apple connection settings show fields for Team ID, Service ID, Key ID, and a text area for the private key.

---

## Part 6: Customize

### 6.1 Branding

1. Go to **Branding > Universal Login**
2. Enable the **New Universal Login Experience**
3. Configure:

#### Colors
```
Primary Color: #6366F1 (Indigo - matches Festivals brand)
Page Background Color: #0F172A (Dark slate)
```

#### Logo
1. Click on **Logo**
2. Upload your festival logo
   - Recommended size: 150x150px
   - Format: PNG with transparency
   - Max file size: 500KB

> **Screenshot Reference**: The Universal Login customization page shows a live preview of the login page with color pickers and logo upload.

### 6.2 Email Templates

1. Go to **Branding > Email Templates**
2. Customize each template:

#### Verification Email
```
Subject: Verify your Festivals account
From: noreply@festivals.app

Body:
- Use your brand colors
- Include your logo
- Clear call-to-action button
```

#### Welcome Email
```
Subject: Welcome to Festivals!
From: hello@festivals.app

Body:
- Welcome message
- Quick start guide links
- Support contact
```

#### Password Reset
```
Subject: Reset your Festivals password
From: noreply@festivals.app

Body:
- Clear instructions
- Expiration notice (24 hours)
- Security tips
```

> **Screenshot Reference**: The Email Templates page shows a list of template types with preview and edit options.

### 6.3 Universal Login Page

1. Go to **Branding > Universal Login > Advanced Options**
2. For advanced customization, you can use the **Classic Universal Login** with custom HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sign In - Festivals</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Add your custom styles */
  </style>
</head>
<body>
  <div id="auth0-login-container"></div>
  <script src="https://cdn.auth0.com/js/lock/12.0/lock.min.js"></script>
  <!-- Auth0 Lock configuration -->
</body>
</html>
```

> **Note**: The New Universal Login Experience is recommended as it's more secure and easier to maintain.

---

## Part 7: Get Credentials

### 7.1 Environment Variables

After completing the setup, collect the following credentials for your `.env` files:

#### Backend (.env)

```bash
# Auth0 Configuration
AUTH0_DOMAIN=festivals.eu.auth0.com
AUTH0_AUDIENCE=https://api.festivals.app
AUTH0_CLIENT_ID=<from-api-application>
AUTH0_CLIENT_SECRET=<from-api-application>

# Optional: For M2M token generation
AUTH0_M2M_CLIENT_ID=<from-m2m-application>
AUTH0_M2M_CLIENT_SECRET=<from-m2m-application>
```

#### Admin Frontend (.env.local)

```bash
# Auth0 Configuration
AUTH0_SECRET=<generate-a-32-byte-random-string>
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://festivals.eu.auth0.com
AUTH0_CLIENT_ID=<from-admin-spa-application>
AUTH0_CLIENT_SECRET=<from-admin-spa-application>
AUTH0_AUDIENCE=https://api.festivals.app

# For production
# AUTH0_BASE_URL=https://admin.festivals.app
```

#### Mobile App (.env)

```bash
# Auth0 Configuration
EXPO_PUBLIC_AUTH0_DOMAIN=festivals.eu.auth0.com
EXPO_PUBLIC_AUTH0_CLIENT_ID=<from-mobile-native-application>
EXPO_PUBLIC_AUTH0_AUDIENCE=https://api.festivals.app
```

### 7.2 Where to Find Each Value

| Value | Location in Auth0 Dashboard |
|-------|---------------------------|
| `AUTH0_DOMAIN` | Settings > General (Tenant Settings) > Domain |
| `AUTH0_AUDIENCE` | Applications > APIs > Your API > Identifier |
| `AUTH0_CLIENT_ID` | Applications > Your App > Settings > Client ID |
| `AUTH0_CLIENT_SECRET` | Applications > Your App > Settings > Client Secret |
| `AUTH0_SECRET` | Generate yourself: `openssl rand -hex 32` |

### 7.3 Generate AUTH0_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -hex 32
```

Or using Node.js:

```javascript
require('crypto').randomBytes(32).toString('hex')
```

> **Screenshot Reference**: The Application Settings page shows Basic Information section with Domain, Client ID, and Client Secret (with copy buttons).

---

## Part 8: Actions & Rules

### 8.1 Add Custom Claims to Token

1. Go to **Actions > Flows**
2. Select **Login**
3. Click **+ Add Action > Build from Scratch**
4. Create:

```javascript
// Name: Add Custom Claims
// Trigger: Login / Post Login

exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://festivals.app';

  // Add custom claims
  api.accessToken.setCustomClaim(`${namespace}/roles`, event.authorization?.roles || []);
  api.accessToken.setCustomClaim(`${namespace}/email`, event.user.email);
  api.accessToken.setCustomClaim(`${namespace}/email_verified`, event.user.email_verified);

  // Add user metadata if available
  if (event.user.user_metadata) {
    if (event.user.user_metadata.festival_id) {
      api.accessToken.setCustomClaim(`${namespace}/festival_id`, event.user.user_metadata.festival_id);
    }
    if (event.user.user_metadata.stand_ids) {
      api.accessToken.setCustomClaim(`${namespace}/stand_ids`, event.user.user_metadata.stand_ids);
    }
  }

  // Add app metadata (organizer info)
  if (event.user.app_metadata) {
    if (event.user.app_metadata.organizer_for) {
      api.accessToken.setCustomClaim(`${namespace}/organizer_for`, event.user.app_metadata.organizer_for);
    }
  }
};
```

5. Click **Deploy**
6. Drag the action to the Login flow

> **Screenshot Reference**: The Actions editor shows a code editor with the action code and a Deploy button.

### 8.2 Sync User to Backend

1. Create another action:

```javascript
// Name: Sync User to Backend
// Trigger: Login / Post Login

exports.onExecutePostLogin = async (event, api) => {
  const axios = require('axios');

  // Only sync on first login or if user data changed
  const isFirstLogin = event.stats.logins_count === 1;
  const userChanged = event.user.updated_at !== event.user.last_login;

  if (isFirstLogin || userChanged) {
    try {
      await axios.post('https://api.festivals.app/v1/auth/sync', {
        auth0_id: event.user.user_id,
        email: event.user.email,
        name: event.user.name,
        picture: event.user.picture,
        email_verified: event.user.email_verified,
        created_at: event.user.created_at,
        updated_at: event.user.updated_at
      }, {
        headers: {
          'X-Sync-Secret': event.secrets.SYNC_SECRET
        },
        timeout: 5000
      });
    } catch (error) {
      // Log but don't block login
      console.error('Failed to sync user:', error.message);
    }
  }
};
```

2. Add secret `SYNC_SECRET` in the action settings

---

## Part 9: Testing

### 9.1 Test Login Flow

1. Go to **Getting Started** in the dashboard
2. Click **"Try your Login box"**
3. Test:
   - Email/password registration
   - Email/password login
   - Social login (if configured)
   - Password reset flow

### 9.2 Test API Access

Use curl to test token generation:

```bash
# Get M2M token
curl --request POST \
  --url 'https://festivals.eu.auth0.com/oauth/token' \
  --header 'content-type: application/json' \
  --data '{
    "client_id": "YOUR_M2M_CLIENT_ID",
    "client_secret": "YOUR_M2M_CLIENT_SECRET",
    "audience": "https://api.festivals.app",
    "grant_type": "client_credentials"
  }'
```

### 9.3 Decode and Verify Token

1. Go to [jwt.io](https://jwt.io)
2. Paste your access token
3. Verify:
   - `iss` matches your Auth0 domain
   - `aud` matches your API identifier
   - `permissions` array contains expected permissions
   - Custom claims are present

### 9.4 Test with Postman

Import the Auth0 collection:
1. Create a new request
2. Go to **Authorization** tab
3. Type: **OAuth 2.0**
4. Configure:
   - Grant Type: Authorization Code (PKCE)
   - Callback URL: `https://oauth.pstmn.io/v1/callback`
   - Auth URL: `https://festivals.eu.auth0.com/authorize`
   - Access Token URL: `https://festivals.eu.auth0.com/oauth/token`
   - Client ID: Your Admin SPA Client ID
   - Scope: `openid profile email`
   - Audience: `https://api.festivals.app`

---

## Troubleshooting

### Common Issues

#### "Unauthorized" Error
- **Cause**: Token expired or invalid
- **Solution**:
  - Check token expiration
  - Verify the audience matches
  - Ensure JWKS endpoint is accessible

#### "Invalid Audience" Error
- **Cause**: Token audience doesn't match API configuration
- **Solution**:
  - Verify `AUTH0_AUDIENCE` in your `.env`
  - Check API identifier in Auth0 dashboard

#### CORS Errors
- **Cause**: Origin not in allowed list
- **Solution**:
  - Add origin to "Allowed Web Origins" in app settings
  - Include all development URLs (localhost, etc.)

#### "Callback URL Mismatch" Error
- **Cause**: Redirect URI not in allowed callbacks
- **Solution**:
  - Add exact callback URL to "Allowed Callback URLs"
  - Check for trailing slashes
  - Verify protocol (http vs https)

#### Mobile Deep Link Not Working
- **Cause**: Custom scheme not registered
- **Solution**:
  - Verify scheme in app.json (Expo)
  - Add scheme to Info.plist (iOS) / AndroidManifest.xml (Android)
  - Check callback URL format: `festivals://auth/callback`

#### Social Login Not Working
- **Cause**: OAuth app configuration issue
- **Solution**:
  - Verify OAuth app credentials
  - Check authorized domains/redirect URIs
  - Ensure social connection is enabled for your Auth0 app

#### "Login Required" Loop
- **Cause**: Session not persisting
- **Solution**:
  - Check AUTH0_SECRET is set correctly
  - Verify cookies are not blocked
  - Check AUTH0_BASE_URL matches actual URL

#### Token Missing Custom Claims
- **Cause**: Action not running or misconfigured
- **Solution**:
  - Verify Action is deployed
  - Check Action is in the Login flow
  - Review Action logs for errors

### Debug Logging

Enable debug logging in your application:

```javascript
// Next.js Admin
// In your auth configuration
export const authOptions = {
  debug: process.env.NODE_ENV === 'development',
  // ... rest of config
};
```

```go
// Go Backend
// Set log level to debug
log.Debug().Str("token", token[:20]+"...").Msg("Validating token")
```

### Auth0 Logs

1. Go to **Monitoring > Logs** in Auth0 dashboard
2. Filter by:
   - **Type**: Success/Failure
   - **Event**: Login, Signup, etc.
3. Click on any log entry for details

### Support Resources

- [Auth0 Documentation](https://auth0.com/docs)
- [Auth0 Community](https://community.auth0.com)
- [Auth0 Status Page](https://status.auth0.com)

---

## Security Checklist

Before going to production, verify:

- [ ] HTTPS enabled on all callback URLs
- [ ] AUTH0_SECRET is unique and secure
- [ ] Unnecessary grant types are disabled
- [ ] RBAC is enabled for the API
- [ ] Brute force protection is enabled
- [ ] Anomaly detection is enabled
- [ ] MFA is configured (optional but recommended)
- [ ] Token expiration times are appropriate
- [ ] Refresh token rotation is enabled
- [ ] Allowed callback URLs don't include development URLs
- [ ] Social connections have production credentials

---

## Next Steps

1. [Configure Backend Auth Middleware](../api/authentication.md)
2. [Set Up Admin Dashboard Auth](../../admin/README.md)
3. [Configure Mobile App Auth](../sdk/MOBILE.md)
4. [Review Security Documentation](../../backend/docs/security/SECURITY.md)
