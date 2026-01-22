import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Complete the browser auth session for web
WebBrowser.maybeCompleteAuthSession();

// Auth0 configuration - replace with your actual values
const AUTH0_DOMAIN = process.env.EXPO_PUBLIC_AUTH0_DOMAIN || 'your-tenant.auth0.com';
const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID || 'your-client-id';
const AUTH0_AUDIENCE = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE || 'https://api.festivals.app';

// Secure storage keys
const TOKEN_KEY = 'auth_tokens';
const REFRESH_TOKEN_KEY = 'refresh_token';

// Types
export interface AuthTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface Auth0User {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  nickname?: string;
  picture?: string;
  updated_at?: string;
}

// Get redirect URI based on platform
const getRedirectUri = () => {
  return AuthSession.makeRedirectUri({
    scheme: 'festivals',
    path: 'auth/callback',
  });
};

// Auth0 discovery document
const discovery = {
  authorizationEndpoint: `https://${AUTH0_DOMAIN}/authorize`,
  tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
  revocationEndpoint: `https://${AUTH0_DOMAIN}/oauth/revoke`,
  userInfoEndpoint: `https://${AUTH0_DOMAIN}/userinfo`,
};

/**
 * Login with Auth0 using social provider
 */
export async function loginWithAuth0(
  provider?: 'google' | 'apple' | 'facebook'
): Promise<AuthTokens> {
  const redirectUri = getRedirectUri();

  const request = new AuthSession.AuthRequest({
    clientId: AUTH0_CLIENT_ID,
    redirectUri,
    scopes: ['openid', 'profile', 'email', 'offline_access'],
    responseType: AuthSession.ResponseType.Code,
    extraParams: {
      audience: AUTH0_AUDIENCE,
      ...(provider && { connection: getConnectionName(provider) }),
    },
    usePKCE: true,
  });

  const result = await request.promptAsync(discovery);

  if (result.type === 'success' && result.params.code) {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(
      result.params.code,
      request.codeVerifier!,
      redirectUri
    );

    await storeTokens(tokens);
    return tokens;
  } else if (result.type === 'error') {
    throw new Error(result.params.error_description || 'Echec de l\'authentification');
  } else if (result.type === 'cancel' || result.type === 'dismiss') {
    throw new Error('Authentification annulee');
  }

  throw new Error('Echec de l\'authentification');
}

/**
 * Get connection name for Auth0 social providers
 */
function getConnectionName(provider: 'google' | 'apple' | 'facebook'): string {
  const connections: Record<string, string> = {
    google: 'google-oauth2',
    apple: 'apple',
    facebook: 'facebook',
  };
  return connections[provider];
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<AuthTokens> {
  const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: AUTH0_CLIENT_ID,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      audience: AUTH0_AUDIENCE,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Echec de l\'echange de tokens');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshToken(): Promise<AuthTokens | null> {
  try {
    const storedRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

    if (!storedRefreshToken) {
      return null;
    }

    const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: AUTH0_CLIENT_ID,
        refresh_token: storedRefreshToken,
        audience: AUTH0_AUDIENCE,
      }),
    });

    if (!response.ok) {
      // Refresh token is invalid, clear stored tokens
      await clearTokens();
      return null;
    }

    const data = await response.json();

    const tokens: AuthTokens = {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token || storedRefreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    await storeTokens(tokens);
    return tokens;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

/**
 * Get current access token, refreshing if necessary
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const tokensJson = await SecureStore.getItemAsync(TOKEN_KEY);

    if (!tokensJson) {
      return null;
    }

    const tokens: AuthTokens = JSON.parse(tokensJson);

    // Check if token is expired or will expire in the next 5 minutes
    const isExpiringSoon = tokens.expiresAt - Date.now() < 5 * 60 * 1000;

    if (isExpiringSoon) {
      const refreshedTokens = await refreshToken();
      return refreshedTokens?.accessToken || null;
    }

    return tokens.accessToken;
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

/**
 * Get user info from Auth0
 */
export async function getUserInfo(): Promise<Auth0User | null> {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return null;
    }

    const response = await fetch(`https://${AUTH0_DOMAIN}/userinfo`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to get user info:', error);
    return null;
  }
}

/**
 * Logout - revoke tokens and clear storage
 */
export async function logout(): Promise<void> {
  try {
    const tokensJson = await SecureStore.getItemAsync(TOKEN_KEY);

    if (tokensJson) {
      const tokens: AuthTokens = JSON.parse(tokensJson);

      // Revoke refresh token if available
      if (tokens.refreshToken) {
        await fetch(`https://${AUTH0_DOMAIN}/oauth/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            client_id: AUTH0_CLIENT_ID,
            token: tokens.refreshToken,
          }),
        }).catch(() => {
          // Ignore errors during revocation
        });
      }
    }

    // Clear local tokens
    await clearTokens();

    // Open Auth0 logout URL to clear Auth0 session
    const redirectUri = getRedirectUri();
    const logoutUrl = `https://${AUTH0_DOMAIN}/v2/logout?client_id=${AUTH0_CLIENT_ID}&returnTo=${encodeURIComponent(redirectUri)}`;

    if (Platform.OS !== 'web') {
      await WebBrowser.openAuthSessionAsync(logoutUrl, redirectUri);
    }
  } catch (error) {
    console.error('Logout failed:', error);
    // Still clear local tokens even if remote logout fails
    await clearTokens();
  }
}

/**
 * Store tokens securely
 */
async function storeTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));

  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

/**
 * Clear stored tokens
 */
async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}

/**
 * Login with email and password (Resource Owner Password Grant)
 * Note: This requires enabling the grant in Auth0 dashboard
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<AuthTokens> {
  const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'password',
      client_id: AUTH0_CLIENT_ID,
      username: email,
      password,
      audience: AUTH0_AUDIENCE,
      scope: 'openid profile email offline_access',
    }),
  });

  if (!response.ok) {
    const error = await response.json();

    if (error.error === 'invalid_grant') {
      throw new Error('Email ou mot de passe incorrect');
    }

    throw new Error(error.error_description || 'Echec de la connexion');
  }

  const data = await response.json();

  const tokens: AuthTokens = {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  await storeTokens(tokens);
  return tokens;
}

/**
 * Register a new user with email and password
 * Note: This uses Auth0 Management API signup endpoint
 */
export async function registerWithEmail(
  name: string,
  email: string,
  password: string
): Promise<AuthTokens> {
  // First, create the user
  const signupResponse = await fetch(`https://${AUTH0_DOMAIN}/dbconnections/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: AUTH0_CLIENT_ID,
      email,
      password,
      connection: 'Username-Password-Authentication',
      name,
    }),
  });

  if (!signupResponse.ok) {
    const error = await signupResponse.json();

    if (error.code === 'user_exists') {
      throw new Error('Un compte avec cet email existe deja');
    }

    if (error.code === 'password_strength_error') {
      throw new Error('Le mot de passe n\'est pas assez fort');
    }

    throw new Error(error.description || 'Echec de l\'inscription');
  }

  // Then, login the user
  return loginWithEmail(email, password);
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch(`https://${AUTH0_DOMAIN}/dbconnections/change_password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: AUTH0_CLIENT_ID,
      email,
      connection: 'Username-Password-Authentication',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || 'Echec de l\'envoi');
  }
}

/**
 * Decode JWT token to get payload (without verification)
 */
export function decodeIdToken(idToken: string): Auth0User | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    console.error('Failed to decode ID token:', error);
    return null;
  }
}
