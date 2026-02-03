/**
 * Test Data Fixtures for E2E Tests
 *
 * Contains all test data, mock users, and constants used across E2E tests
 */

// ============================================================================
// Test Users
// ============================================================================

export const TEST_USERS = {
  /** Standard festival attendee */
  standard: {
    email: 'test@festivals.app',
    password: 'TestPassword123!',
    name: 'Test User',
    phone: '+33600000001',
  },

  /** Staff member */
  staff: {
    email: 'staff@festivals.app',
    password: 'StaffPassword123!',
    name: 'Staff Member',
    phone: '+33600000002',
    role: 'staff',
    standId: 'stand-central-bar',
  },

  /** Admin user */
  admin: {
    email: 'admin@festivals.app',
    password: 'AdminPassword123!',
    name: 'Admin User',
    phone: '+33600000003',
    role: 'admin',
  },

  /** VIP attendee */
  vip: {
    email: 'vip@festivals.app',
    password: 'VipPassword123!',
    name: 'VIP User',
    phone: '+33600000004',
    ticketType: 'vip',
  },

  /** New user (for registration tests) */
  newUser: {
    name: 'New Test User',
    password: 'NewPassword123!',
    // Email is generated dynamically
  },

  /** User with empty wallet */
  emptyWallet: {
    email: 'empty-wallet@festivals.app',
    password: 'EmptyWallet123!',
    name: 'Empty Wallet User',
    phone: '+33600000005',
  },

  /** User with no tickets */
  noTickets: {
    email: 'no-tickets@festivals.app',
    password: 'NoTickets123!',
    name: 'No Tickets User',
    phone: '+33600000006',
  },
} as const;

// ============================================================================
// Festival Configuration
// ============================================================================

export const FESTIVAL_CONFIG = {
  /** Festival name */
  name: 'Festival des Musiques 2024',

  /** Currency configuration */
  currency: {
    name: 'Griffons',
    symbol: 'G',
    eurRate: 1.0, // 1 Griffon = 1 EUR
  },

  /** Dates */
  dates: {
    start: '2024-07-15',
    end: '2024-07-17',
    days: ['Vendredi', 'Samedi', 'Dimanche'],
  },

  /** Location */
  location: {
    name: 'Parc des Expositions',
    latitude: 48.8566,
    longitude: 2.3522,
    address: '1 Place de la Porte de Versailles, 75015 Paris',
  },
} as const;

// ============================================================================
// Wallet Test Data
// ============================================================================

export const WALLET_TEST_DATA = {
  /** Standard balance for tests */
  standardBalance: 150,

  /** High balance for VIP tests */
  highBalance: 500,

  /** Low balance for warning tests */
  lowBalance: 5,

  /** Zero balance */
  zeroBalance: 0,

  /** Top-up amounts */
  topupAmounts: [10, 20, 50, 100],

  /** Minimum top-up amount */
  minTopup: 5,

  /** Maximum top-up amount */
  maxTopup: 500,

  /** Sample transaction */
  sampleTransaction: {
    id: 'txn-sample-001',
    type: 'payment',
    amount: -15,
    description: 'Achat au stand',
    standName: 'Bar Central',
    timestamp: '2024-07-15T14:30:00Z',
  },
} as const;

// ============================================================================
// Ticket Test Data
// ============================================================================

export const TICKET_TEST_DATA = {
  /** Ticket types */
  types: {
    standard: {
      id: 'standard',
      name: 'Pass Jour',
      price: 45,
      transferable: true,
    },
    vip: {
      id: 'vip',
      name: 'Pass VIP',
      price: 120,
      transferable: false,
    },
    weekend: {
      id: 'weekend',
      name: 'Pass Weekend',
      price: 80,
      transferable: true,
    },
  },

  /** Sample ticket */
  sampleTicket: {
    id: 'ticket-sample-001',
    code: 'TKT-ABC12345',
    type: 'standard',
    name: 'Pass Jour',
    status: 'active',
    eventDate: '2024-07-15',
    holderName: 'Test User',
  },

  /** Invalid ticket code */
  invalidCode: 'TKT-INVALID00',

  /** Already scanned ticket */
  scannedTicketCode: 'TKT-SCANNED01',
} as const;

// ============================================================================
// Program Test Data
// ============================================================================

export const PROGRAM_TEST_DATA = {
  /** Stages */
  stages: [
    { id: 'main-stage', name: 'Main Stage', capacity: 10000 },
    { id: 'electronic-stage', name: 'Electronic Stage', capacity: 5000 },
    { id: 'acoustic-stage', name: 'Acoustic Stage', capacity: 2000 },
    { id: 'discovery-stage', name: 'Discovery Stage', capacity: 1000 },
  ],

  /** Sample artists */
  artists: [
    {
      id: 'artist-001',
      name: 'The Test Band',
      genre: 'Rock',
      country: 'France',
    },
    {
      id: 'artist-002',
      name: 'DJ Electronic',
      genre: 'Electronic',
      country: 'Germany',
    },
    {
      id: 'artist-003',
      name: 'Acoustic Duo',
      genre: 'Folk',
      country: 'UK',
    },
  ],

  /** Sample program slot */
  sampleSlot: {
    id: 'slot-001',
    artistId: 'artist-001',
    stageId: 'main-stage',
    startTime: '20:00',
    endTime: '21:30',
    day: 'Samedi',
  },
} as const;

// ============================================================================
// Map Test Data
// ============================================================================

export const MAP_TEST_DATA = {
  /** Point of interest types */
  poiTypes: ['stage', 'food', 'bar', 'toilet', 'exit', 'info', 'first-aid', 'parking'],

  /** Sample points of interest */
  samplePOIs: [
    {
      id: 'poi-main-stage',
      type: 'stage',
      name: 'Main Stage',
      latitude: 48.8566,
      longitude: 2.3522,
    },
    {
      id: 'poi-bar-central',
      type: 'bar',
      name: 'Bar Central',
      latitude: 48.8570,
      longitude: 2.3530,
    },
    {
      id: 'poi-toilets-north',
      type: 'toilet',
      name: 'Toilettes Nord',
      latitude: 48.8575,
      longitude: 2.3525,
    },
    {
      id: 'poi-exit-main',
      type: 'exit',
      name: 'Sortie Principale',
      latitude: 48.8560,
      longitude: 2.3515,
    },
  ],

  /** User location (for tests) */
  userLocation: {
    latitude: 48.8568,
    longitude: 2.3525,
  },
} as const;

// ============================================================================
// Staff Test Data
// ============================================================================

export const STAFF_TEST_DATA = {
  /** Stand types */
  standTypes: ['bar', 'food', 'merchandise', 'info'],

  /** Sample stands */
  stands: [
    {
      id: 'stand-central-bar',
      name: 'Bar Central',
      type: 'bar',
      location: 'Zone A',
    },
    {
      id: 'stand-pizza',
      name: 'Pizza Corner',
      type: 'food',
      location: 'Zone B',
    },
    {
      id: 'stand-merch',
      name: 'Merchandise Official',
      type: 'merchandise',
      location: 'Zone C',
    },
  ],

  /** Sample payment amounts */
  paymentAmounts: [5, 8, 12, 15, 20, 25],

  /** Sample QR code for payment */
  samplePaymentQR: 'PAY-USER123-TOKEN456',

  /** Invalid QR code */
  invalidPaymentQR: 'INVALID-QR-CODE',
} as const;

// ============================================================================
// Error Messages (French)
// ============================================================================

export const ERROR_MESSAGES = {
  // Authentication
  invalidCredentials: 'Email ou mot de passe incorrect',
  emptyEmail: 'Veuillez entrer votre email',
  invalidEmail: 'Format email invalide',
  emptyPassword: 'Veuillez entrer votre mot de passe',
  weakPassword: 'Le mot de passe doit contenir au moins 8 caracteres',
  passwordMismatch: 'Les mots de passe ne correspondent pas',
  emailInUse: 'Cet email est deja utilise',
  termsNotAccepted: 'Veuillez accepter les conditions',

  // Network
  networkError: 'Erreur de connexion',
  serverError: 'Erreur serveur, veuillez reessayer',
  offline: 'Vous etes hors ligne',

  // Wallet
  insufficientBalance: 'Solde insuffisant',
  minTopup: 'Montant minimum: 5 EUR',
  maxTopup: 'Montant maximum: 500 EUR',
  paymentFailed: 'Paiement echoue',

  // Tickets
  ticketNotFound: 'Billet non trouve',
  ticketAlreadyUsed: 'Ce billet a deja ete utilise',
  ticketExpired: 'Ce billet a expire',
  transferFailed: 'Transfert echoue',

  // General
  genericError: 'Une erreur est survenue',
  sessionExpired: 'Session expiree',
  accessDenied: 'Acces refuse',
} as const;

// ============================================================================
// Success Messages (French)
// ============================================================================

export const SUCCESS_MESSAGES = {
  // Authentication
  loginSuccess: 'Connexion reussie',
  logoutSuccess: 'Deconnexion reussie',
  registerSuccess: 'Compte cree avec succes',
  passwordResetSent: 'Email envoye',

  // Wallet
  topupSuccess: 'Rechargement effectue',
  paymentSuccess: 'Paiement effectue',

  // Tickets
  ticketTransferred: 'Billet transfere avec succes',
  ticketActivated: 'Billet active',

  // Staff
  scanSuccess: 'Scan valide',
  paymentProcessed: 'Paiement traite',
} as const;

// ============================================================================
// Test IDs (for element selection)
// ============================================================================

export const TEST_IDS = {
  // Login screen
  loginEmailInput: 'login-email-input',
  loginPasswordInput: 'login-password-input',
  loginSubmitButton: 'login-submit-button',
  biometricLoginButton: 'biometric-login-button',
  forgotPasswordLink: 'forgot-password-link',
  registerLink: 'register-link',

  // Registration screen
  registerNameInput: 'register-name-input',
  registerEmailInput: 'register-email-input',
  registerPasswordInput: 'register-password-input',
  registerConfirmPasswordInput: 'register-confirm-password-input',
  registerSubmitButton: 'register-submit-button',
  termsCheckbox: 'terms-checkbox',

  // Wallet screen
  walletBalance: 'wallet-balance',
  walletQrCode: 'wallet-qr-code',
  topupButton: 'topup-button',
  transactionList: 'transaction-list',

  // Tickets screen
  ticketList: 'ticket-list',
  ticketItem: 'ticket-item',
  ticketQrCode: 'ticket-qr-code',
  transferButton: 'transfer-button',

  // Program screen
  programList: 'program-list',
  stageFilter: 'stage-filter',
  dayFilter: 'day-filter',
  artistCard: 'artist-card',

  // Map screen
  mapView: 'map-view',
  poiMarker: 'poi-marker',
  searchBar: 'map-search-bar',
  categoryFilter: 'category-filter',

  // Profile screen
  profileAvatar: 'profile-avatar',
  logoutButton: 'logout-button',
  settingsButton: 'settings-button',

  // Staff screens
  scannerView: 'scanner-view',
  amountInput: 'amount-input',
  confirmPaymentButton: 'confirm-payment-button',
  cancelButton: 'cancel-button',

  // Common
  loadingIndicator: 'loading-indicator',
  errorMessage: 'error-message',
  refreshControl: 'refresh-control',
  backButton: 'back-button',
  modalContainer: 'modal-container',
  modalCloseButton: 'modal-close-button',
} as const;

// ============================================================================
// Navigation Routes
// ============================================================================

export const ROUTES = {
  // Auth
  login: '/(auth)/login',
  register: '/(auth)/register',
  forgotPassword: '/(auth)/forgot-password',

  // Main tabs
  home: '/(tabs)/',
  tickets: '/(tabs)/tickets',
  wallet: '/(tabs)/wallet',
  program: '/(tabs)/program',
  map: '/(tabs)/map',
  profile: '/(tabs)/profile',

  // Staff
  staffPayment: '/(staff)/payment',
  staffScan: '/(staff)/scan',
  staffDashboard: '/(staff)/dashboard',

  // Details
  ticketDetail: '/ticket/[id]',
  artistDetail: '/artist/[id]',
  transactionDetail: '/transaction/[id]',
} as const;

// ============================================================================
// Regex Patterns
// ============================================================================

export const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+33[0-9]{9}$/,
  ticketCode: /^TKT-[A-Z0-9]{8}$/,
  transactionId: /^txn-[a-z0-9-]+$/,
  qrCode: /^(PAY|TKT)-[A-Z0-9-]+$/,
  amount: /^[0-9]+(\.[0-9]{1,2})?$/,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique test email
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `test-${timestamp}-${random}@festivals.app`;
}

/**
 * Generate unique ticket code
 */
export function generateTicketCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'TKT-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generate unique transaction ID
 */
export function generateTransactionId(): string {
  return `txn-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Get random item from array
 */
export function getRandomItem<T>(array: readonly T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate random amount within range
 */
export function generateRandomAmount(min: number = 5, max: number = 100): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
