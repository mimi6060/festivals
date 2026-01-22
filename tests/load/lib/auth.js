import http from 'k6/http';
import { check } from 'k6';

/**
 * Authentication helpers for k6 load tests
 */

const AUTH_ENDPOINT = '/api/v1/auth';

/**
 * Login with email and password
 * @param {string} baseUrl - Base API URL
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {object} Authentication tokens and user info
 */
export function login(baseUrl, email, password) {
  const payload = JSON.stringify({
    email: email,
    password: password,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'login' },
  };

  const response = http.post(`${baseUrl}${AUTH_ENDPOINT}/login`, payload, params);

  const success = check(response, {
    'login successful': (r) => r.status === 200,
    'login has access token': (r) => r.json('data.accessToken') !== undefined,
    'login has refresh token': (r) => r.json('data.refreshToken') !== undefined,
  });

  if (!success) {
    console.error(`Login failed: ${response.status} - ${response.body}`);
    return null;
  }

  const data = response.json('data');
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };
}

/**
 * Register a new user
 * @param {string} baseUrl - Base API URL
 * @param {object} userData - User registration data
 * @returns {object} Authentication tokens and user info
 */
export function register(baseUrl, userData) {
  const payload = JSON.stringify(userData);

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'register' },
  };

  const response = http.post(`${baseUrl}${AUTH_ENDPOINT}/register`, payload, params);

  const success = check(response, {
    'registration successful': (r) => r.status === 201,
    'registration has access token': (r) => r.json('data.accessToken') !== undefined,
  });

  if (!success) {
    console.error(`Registration failed: ${response.status} - ${response.body}`);
    return null;
  }

  const data = response.json('data');
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  };
}

/**
 * Refresh access token
 * @param {string} baseUrl - Base API URL
 * @param {string} refreshToken - Refresh token
 * @returns {object} New tokens
 */
export function refreshToken(baseUrl, refreshToken) {
  const payload = JSON.stringify({
    refreshToken: refreshToken,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'refresh_token' },
  };

  const response = http.post(`${baseUrl}${AUTH_ENDPOINT}/refresh`, payload, params);

  const success = check(response, {
    'refresh successful': (r) => r.status === 200,
    'refresh has new access token': (r) => r.json('data.accessToken') !== undefined,
  });

  if (!success) {
    return null;
  }

  const data = response.json('data');
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

/**
 * Logout user
 * @param {string} baseUrl - Base API URL
 * @param {string} accessToken - Access token
 */
export function logout(baseUrl, accessToken) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    tags: { name: 'logout' },
  };

  const response = http.post(`${baseUrl}${AUTH_ENDPOINT}/logout`, null, params);

  check(response, {
    'logout successful': (r) => r.status === 200 || r.status === 204,
  });
}

/**
 * Create authorized headers
 * @param {string} accessToken - Access token
 * @returns {object} Headers object with authorization
 */
export function authHeaders(accessToken) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };
}

/**
 * Get test user credentials
 * @param {number} index - User index for generating unique credentials
 * @returns {object} User credentials
 */
export function getTestUserCredentials(index) {
  return {
    email: `loadtest_user_${index}@test.festivals.app`,
    password: 'LoadTest123!',
  };
}

/**
 * Get test user registration data
 * @param {number} index - User index for generating unique data
 * @returns {object} User registration data
 */
export function getTestUserData(index) {
  return {
    email: `loadtest_user_${index}_${Date.now()}@test.festivals.app`,
    password: 'LoadTest123!',
    firstName: `LoadTest`,
    lastName: `User${index}`,
    phone: `+1555${String(index).padStart(7, '0')}`,
  };
}
