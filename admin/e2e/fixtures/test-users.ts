/**
 * Test user fixtures for E2E tests
 * Contains different user profiles with various roles and permissions
 */

export interface TestUser {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  roles: string[];
  festivalId?: string;
  permissions?: string[];
  phone?: string;
  avatar?: string;
}

/**
 * Admin user with super admin privileges
 * Can access all features and manage all festivals
 */
export const adminUser: TestUser = {
  id: 'test-admin-001',
  email: 'admin@festivals.test',
  name: 'Admin User',
  firstName: 'Admin',
  lastName: 'User',
  roles: ['SUPER_ADMIN'],
  permissions: ['*'],
  phone: '+33612345678',
};

/**
 * Festival manager user
 * Can manage a specific festival's settings, staff, and operations
 */
export const festivalManagerUser: TestUser = {
  id: 'test-manager-001',
  email: 'manager@festivals.test',
  name: 'Festival Manager',
  firstName: 'Festival',
  lastName: 'Manager',
  roles: ['FESTIVAL_MANAGER'],
  festivalId: 'test-festival-001',
  permissions: [
    'festival:read',
    'festival:update',
    'staff:manage',
    'stands:manage',
    'tickets:manage',
    'reports:read',
    'refunds:manage',
  ],
  phone: '+33623456789',
};

/**
 * Staff member user
 * Can operate stands, process payments, and scan tickets
 */
export const staffUser: TestUser = {
  id: 'test-staff-001',
  email: 'staff@festivals.test',
  name: 'Staff Member',
  firstName: 'Staff',
  lastName: 'Member',
  roles: ['STAFF'],
  festivalId: 'test-festival-001',
  permissions: [
    'stand:operate',
    'payments:process',
    'tickets:scan',
  ],
  phone: '+33634567890',
};

/**
 * Cashier user
 * Can process top-ups and basic payments
 */
export const cashierUser: TestUser = {
  id: 'test-cashier-001',
  email: 'cashier@festivals.test',
  name: 'Cashier User',
  firstName: 'Cashier',
  lastName: 'User',
  roles: ['CASHIER'],
  festivalId: 'test-festival-001',
  permissions: [
    'topup:process',
    'payments:process',
  ],
  phone: '+33645678901',
};

/**
 * Regular attendee user
 * Can purchase tickets, view wallet, and request refunds
 */
export const attendeeUser: TestUser = {
  id: 'test-attendee-001',
  email: 'attendee@festivals.test',
  name: 'Test Attendee',
  firstName: 'Test',
  lastName: 'Attendee',
  roles: ['ATTENDEE'],
  permissions: [
    'tickets:purchase',
    'wallet:view',
    'wallet:topup',
    'refund:request',
  ],
  phone: '+33656789012',
};

/**
 * Secondary attendee for transfer tests
 */
export const secondAttendeeUser: TestUser = {
  id: 'test-attendee-002',
  email: 'attendee2@festivals.test',
  name: 'Second Attendee',
  firstName: 'Second',
  lastName: 'Attendee',
  roles: ['ATTENDEE'],
  permissions: [
    'tickets:purchase',
    'wallet:view',
    'wallet:topup',
    'refund:request',
  ],
  phone: '+33667890123',
};

/**
 * Read-only user for testing permission restrictions
 */
export const readOnlyUser: TestUser = {
  id: 'test-readonly-001',
  email: 'readonly@festivals.test',
  name: 'Read Only',
  firstName: 'Read',
  lastName: 'Only',
  roles: ['VIEWER'],
  festivalId: 'test-festival-001',
  permissions: [
    'festival:read',
    'reports:read',
  ],
};

/**
 * All test users grouped by role type
 */
export const testUsers = {
  admin: adminUser,
  festivalManager: festivalManagerUser,
  staff: staffUser,
  cashier: cashierUser,
  attendee: attendeeUser,
  secondAttendee: secondAttendeeUser,
  readOnly: readOnlyUser,
};

/**
 * User credentials for authentication
 */
export const testCredentials = {
  admin: { email: adminUser.email, password: 'TestAdmin123!' },
  festivalManager: { email: festivalManagerUser.email, password: 'TestManager123!' },
  staff: { email: staffUser.email, password: 'TestStaff123!' },
  cashier: { email: cashierUser.email, password: 'TestCashier123!' },
  attendee: { email: attendeeUser.email, password: 'TestAttendee123!' },
  secondAttendee: { email: secondAttendeeUser.email, password: 'TestAttendee123!' },
  readOnly: { email: readOnlyUser.email, password: 'TestReadOnly123!' },
};

export type UserType = keyof typeof testUsers;
