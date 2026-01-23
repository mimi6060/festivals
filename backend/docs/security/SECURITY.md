# Security Policy

## Overview

This document outlines the security measures implemented in the Festivals backend application, based on the OWASP Top 10 security risks.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. Email security@festivals.io with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes
3. You will receive a response within 48 hours
4. We will work with you to understand and resolve the issue

## OWASP Top 10 Protection

### A01:2021 - Broken Access Control

**Protections Implemented:**
- Role-Based Access Control (RBAC) with hierarchical permissions
- Festival-scoped and stand-scoped access controls
- JWT token validation with audience and issuer checks
- Session management with fixation protection
- Privilege escalation detection and prevention

**Files:**
- `internal/middleware/roles.go`
- `internal/middleware/auth.go`
- `internal/domain/auth/rbac_repository.go`

### A02:2021 - Cryptographic Failures

**Protections Implemented:**
- AES-256-GCM encryption for data at rest
- ChaCha20-Poly1305 as alternative encryption
- Argon2id for password hashing (replacing bcrypt)
- Secure key derivation functions
- Key rotation support
- TLS 1.3 enforced for all connections

**Files:**
- `internal/pkg/security/encryption.go`

**Configuration:**
```go
// Password hashing defaults
Argon2Time:    3
Argon2Memory:  64 * 1024  // 64MB
Argon2Threads: 4
Argon2KeyLen:  32
```

### A03:2021 - Injection

**Protections Implemented:**
- SQL injection detection and blocking
- NoSQL injection prevention (MongoDB operators)
- Command injection prevention
- LDAP injection prevention
- XXE (XML External Entity) prevention
- Path traversal prevention

**Files:**
- `internal/middleware/injection.go`
- `internal/pkg/security/sanitizer.go`
- `internal/pkg/security/validator.go`

**Patterns Blocked:**
- SQL keywords in suspicious contexts (UNION, SELECT, etc.)
- MongoDB operators ($where, $gt, $ne, etc.)
- Shell metacharacters and command substitution
- XML DOCTYPE and ENTITY declarations
- Path traversal sequences (../, %2e%2e, etc.)

### A04:2021 - Insecure Design

**Protections Implemented:**
- Defense in depth with multiple security layers
- Fail-secure defaults
- Security by design principles
- Comprehensive input validation
- Output encoding

### A05:2021 - Security Misconfiguration

**Protections Implemented:**
- Security headers middleware
- Secure default configurations
- Environment-based configuration
- Disabled debug endpoints in production
- Proper error handling without information leakage

**Security Headers:**
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### A06:2021 - Vulnerable and Outdated Components

**Protections Implemented:**
- Automated dependency scanning via GitHub Actions
- Regular dependency updates
- Go vulnerability database checks
- SBOM (Software Bill of Materials) generation

**Tools Used:**
- `govulncheck` for Go vulnerability scanning
- `gosec` for static analysis
- Dependabot for automated updates

### A07:2021 - Identification and Authentication Failures

**Protections Implemented:**
- Brute force protection with progressive lockout
- Session fixation protection
- JWT token rotation
- Refresh token revocation
- Multi-factor authentication support
- Secure password requirements

**Files:**
- `internal/middleware/auth.go`

**Brute Force Configuration:**
```go
MaxAttempts:        5
LockoutDuration:    15 * time.Minute
AttemptWindow:      15 * time.Minute
ProgressiveLockout: true  // Doubles lockout time on each violation
```

**Password Requirements:**
- Minimum 12 characters
- Uppercase letter required
- Lowercase letter required
- Digit required
- Special character required
- Common password blocking

### A08:2021 - Software and Data Integrity Failures

**Protections Implemented:**
- Code signing verification
- Secure CI/CD pipeline
- Dependency integrity verification
- CSRF protection

**Files:**
- `internal/middleware/security.go`

### A09:2021 - Security Logging and Monitoring Failures

**Protections Implemented:**
- Comprehensive security event logging
- Real-time alerting for security events
- Audit trail for sensitive operations
- Log integrity protection

**Files:**
- `internal/pkg/security/audit.go`
- `internal/middleware/audit.go`

**Logged Events:**
- Authentication success/failure
- Authorization failures
- Attack detection (SQL injection, XSS, etc.)
- Session events
- Data access and modification
- System configuration changes

### A10:2021 - Server-Side Request Forgery (SSRF)

**Protections Implemented:**
- URL validation with domain allowlists
- Internal IP address blocking
- DNS rebinding protection
- URL scheme restrictions

**Blocked Addresses:**
- localhost, 127.0.0.1, 0.0.0.0
- Private IP ranges (10.x, 172.16-31.x, 192.168.x)
- Link-local addresses (169.254.x)

## Security Controls Summary

### Input Validation
- All user input is validated and sanitized
- Type checking and length limits enforced
- Regular expression patterns for format validation

### Output Encoding
- HTML encoding for web output
- JSON encoding for API responses
- SQL parameterized queries only

### Rate Limiting
```go
DefaultRequestsPerMinute: 60
AdminRequestsPerMinute:   300
IPRequestsPerMinute:      30
```

### Request Size Limits
```go
MaxRequestBodySize: 10MB
MaxFormMemory:      5MB
MaxMultipartMemory: 32MB
MaxURLLength:       2048
```

## Security Testing

### Automated Tests
- `tests/security/injection_test.go` - Injection attack tests
- `tests/security/xss_test.go` - XSS attack tests
- `tests/security/auth_test.go` - Authentication tests
- `tests/security/rate_limit_test.go` - Rate limiting tests

### Manual Testing
- Penetration testing recommended quarterly
- Security code review for new features
- Dependency audit monthly

## Incident Response

See [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md) for the complete incident response plan.

## Compliance

This application is designed to comply with:
- GDPR (General Data Protection Regulation)
- PCI DSS (Payment Card Industry Data Security Standard)
- SOC 2 Type II requirements

## Contact

- Security Team: security@festivals.io
- Bug Bounty Program: https://festivals.io/security/bounty
- Security Updates: https://festivals.io/security/advisories
