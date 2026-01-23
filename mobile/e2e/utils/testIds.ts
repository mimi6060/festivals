/**
 * Test ID Constants for E2E Tests
 *
 * Centralized test IDs for element identification in Detox tests.
 * These IDs should match the testID props in React Native components.
 */

export const TestIds = {
  // ==========================================================================
  // Authentication
  // ==========================================================================
  auth: {
    // Login screen
    emailInput: 'login-email-input',
    passwordInput: 'login-password-input',
    loginButton: 'login-submit-button',
    togglePasswordVisibility: 'toggle-password-visibility',
    forgotPasswordLink: 'forgot-password-link',
    registerLink: 'register-link',
    biometricLoginButton: 'biometric-login-button',

    // Registration screen
    registerNameInput: 'register-name-input',
    registerEmailInput: 'register-email-input',
    registerPasswordInput: 'register-password-input',
    registerConfirmPasswordInput: 'register-confirm-password-input',
    registerSubmitButton: 'register-submit-button',
    termsCheckbox: 'terms-checkbox',
    backToLoginLink: 'back-to-login-link',

    // Forgot password screen
    forgotPasswordEmailInput: 'forgot-password-email-input',
    forgotPasswordSubmitButton: 'forgot-password-submit-button',
    backToLoginButton: 'back-to-login-button',

    // Profile / Logout
    logoutButton: 'logout-button',
    profileAvatar: 'profile-avatar',
    profileScrollView: 'profile-scroll-view',
  },

  // ==========================================================================
  // Wallet
  // ==========================================================================
  wallet: {
    // Balance display
    balance: 'wallet-balance',
    eurEquivalent: 'wallet-eur-equivalent',
    scrollView: 'wallet-scroll-view',

    // QR Code
    qrCode: 'wallet-qr-code',
    qrCodeTimer: 'qr-code-timer',
    qrCodeFullscreen: 'qr-code-fullscreen',

    // Top up
    topupButton: 'topup-button',
    topupCustomAmount: 'topup-custom-amount',
    topupSubmitButton: 'topup-submit-button',
    topupScrollView: 'topup-scroll-view',

    // Transactions
    transactionList: 'transaction-list',
    transactionFilter: 'transaction-filter',
    transactionItem: 'transaction-item',
  },

  // ==========================================================================
  // Tickets
  // ==========================================================================
  tickets: {
    list: 'ticket-list',
    item: 'ticket-item',
    qrCode: 'ticket-qr-code',
    transferButton: 'transfer-button',
    scrollView: 'ticket-scroll-view',
  },

  // ==========================================================================
  // Program
  // ==========================================================================
  program: {
    list: 'program-list',
    scrollView: 'program-scroll-view',
    dayFilter: 'day-filter',
    stageFilter: 'stage-filter',
    searchInput: 'program-search-input',
    clearSearchButton: 'clear-search-button',
    artistCard: 'artist-card',
    artistImage: 'artist-image',
    favoritesBadge: 'favorites-badge',
    detailFavoriteButton: 'detail-favorite-button',
    detailFavoriteButtonFilled: 'detail-favorite-button-filled',
  },

  // ==========================================================================
  // Map
  // ==========================================================================
  map: {
    view: 'map-view',
    searchBar: 'map-search-bar',
    categoryFilter: 'category-filter',
    poiMarker: 'poi-marker',
    userLocation: 'user-location',
    directionsSheet: 'directions-sheet',
  },

  // ==========================================================================
  // Staff Mode
  // ==========================================================================
  staff: {
    // Common
    roleIndicator: 'staff-role-indicator',
    offlineModeBadge: 'offline-mode-badge',
    pendingBadge: 'pending-badge',

    // Payment
    amountInput: 'amount-input',
    clearAmountButton: 'clear-amount-button',
    confirmPaymentButton: 'confirm-payment-button',
    paymentSuccessIcon: 'payment-success-icon',
    offlineReceipt: 'offline-receipt',
    transactionList: 'staff-transaction-list',
    transactionDateFilter: 'transaction-date-filter',
    paymentScrollView: 'payment-scroll-view',
  },

  // ==========================================================================
  // Scanner
  // ==========================================================================
  scanner: {
    view: 'scanner-view',
    frame: 'scan-frame',
    flashlightButton: 'flashlight-button',
    flashlightButtonActive: 'flashlight-button-active',
    manualInput: 'manual-ticket-input',
    successIcon: 'scan-success-icon',
    errorIcon: 'scan-error-icon',
    historyFilter: 'scan-history-filter',
    offlineModeBadge: 'scanner-offline-mode-badge',
  },

  // ==========================================================================
  // Common
  // ==========================================================================
  common: {
    // Navigation
    tabBar: 'tab-bar',
    backButton: 'back-button',

    // Loading and states
    loadingIndicator: 'loading-indicator',
    refreshControl: 'refresh-control',
    offlineIndicator: 'offline-indicator',
    syncIndicator: 'sync-indicator',

    // Modals
    modalContainer: 'modal-container',
    modalCloseButton: 'modal-close-button',
    cancelButton: 'cancel-button',

    // Errors
    errorMessage: 'error-message',
    retryButton: 'retry-button',
  },

  // ==========================================================================
  // Notifications
  // ==========================================================================
  notifications: {
    list: 'notification-list',
    item: 'notification-item',
    badge: 'notification-badge',
    markAllRead: 'mark-all-read-button',
  },

  // ==========================================================================
  // Settings
  // ==========================================================================
  settings: {
    screen: 'settings-screen',
    notificationToggle: 'notification-toggle',
    themeToggle: 'theme-toggle',
    languageSelector: 'language-selector',
    biometricToggle: 'biometric-toggle',
    deleteAccountButton: 'delete-account-button',
  },

  // ==========================================================================
  // Social / Friends
  // ==========================================================================
  social: {
    friendsList: 'friends-list',
    friendCard: 'friend-card',
    addFriendButton: 'add-friend-button',
    shareLocationToggle: 'share-location-toggle',
    sendMoneyButton: 'send-money-button',
    qrShareButton: 'qr-share-button',
  },

  // ==========================================================================
  // Orders
  // ==========================================================================
  orders: {
    list: 'orders-list',
    item: 'order-item',
    receiptButton: 'receipt-button',
  },

  // ==========================================================================
  // Memories / Gallery
  // ==========================================================================
  memories: {
    grid: 'photo-grid',
    uploadButton: 'upload-button',
    viewer: 'photo-viewer',
    album: 'album-view',
  },

  // ==========================================================================
  // NFC / Bracelet
  // ==========================================================================
  nfc: {
    reader: 'nfc-reader',
    braceletInfo: 'bracelet-info',
    linkButton: 'link-bracelet-button',
    activateButton: 'activate-bracelet-button',
  },
} as const;

// Type for accessing test IDs
export type TestIdKey = typeof TestIds;

/**
 * Helper function to get a dynamic test ID
 * @param base Base test ID
 * @param index Index for list items
 */
export function getIndexedTestId(base: string, index: number): string {
  return `${base}-${index}`;
}

/**
 * Helper function to get favorite button ID
 * @param index Item index
 * @param filled Whether the button is in filled state
 */
export function getFavoriteButtonId(index: number, filled: boolean = false): string {
  return filled ? `favorite-button-${index}-filled` : `favorite-button-${index}`;
}

/**
 * Helper function to get transaction item ID
 * @param index Item index
 */
export function getTransactionItemId(index: number): string {
  return `transaction-item-${index}`;
}

/**
 * Helper function to get program slot ID
 * @param index Slot index
 */
export function getProgramSlotId(index: number): string {
  return `program-slot-${index}`;
}

/**
 * Helper function to get quick amount button ID
 * @param amount Amount value
 */
export function getQuickAmountId(amount: number): string {
  return `quick-amount-${amount}`;
}

/**
 * Helper function to get top up amount button ID
 * @param amount Amount value
 * @param selected Whether the button is selected
 */
export function getTopupAmountId(amount: number, selected: boolean = false): string {
  return selected ? `topup-amount-${amount}-selected` : `topup-amount-${amount}`;
}
