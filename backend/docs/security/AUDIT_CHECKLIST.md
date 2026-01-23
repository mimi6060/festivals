# Security Audit Checklist

## Pre-Deployment Security Checklist

Use this checklist before deploying to production or during security audits.

---

## 1. Authentication & Authorization

### 1.1 Authentication
- [ ] JWT tokens are validated (signature, expiration, issuer, audience)
- [ ] Tokens have appropriate expiration times (access: 15min, refresh: 7 days)
- [ ] Refresh token rotation is enabled
- [ ] Old refresh tokens are revoked on rotation
- [ ] Token reuse detection is active
- [ ] Development mode is disabled in production

### 1.2 Password Security
- [ ] Passwords are hashed using Argon2id (not bcrypt/MD5/SHA1)
- [ ] Password requirements enforced (12+ chars, mixed case, digits, special)
- [ ] Common password list checked
- [ ] Password reset tokens are single-use and time-limited
- [ ] Old password hashes are migrated on login

### 1.3 Session Management
- [ ] Sessions have secure, random identifiers
- [ ] Session fixation protection is enabled
- [ ] Sessions are bound to user fingerprint (IP + User-Agent)
- [ ] Maximum concurrent sessions enforced
- [ ] Sessions are invalidated on logout
- [ ] Session timeout is configured

### 1.4 Brute Force Protection
- [ ] Failed login attempts are tracked
- [ ] Account lockout after 5 failed attempts
- [ ] Progressive lockout is enabled
- [ ] IP-based blocking is enabled
- [ ] Lockout notifications are sent

### 1.5 Authorization
- [ ] Role-based access control (RBAC) is implemented
- [ ] Permissions are checked on every protected endpoint
- [ ] Admin bypass is not available for sensitive operations
- [ ] Festival/tenant isolation is enforced
- [ ] Privilege escalation is prevented

---

## 2. Injection Prevention

### 2.1 SQL Injection
- [ ] All queries use parameterized statements
- [ ] No string concatenation in queries
- [ ] SQL injection patterns are blocked
- [ ] Database user has minimal privileges
- [ ] Prepared statements are used for dynamic queries

### 2.2 NoSQL Injection
- [ ] MongoDB operators are validated
- [ ] $where queries are blocked
- [ ] Input is sanitized before database operations
- [ ] JSON structure is validated

### 2.3 Command Injection
- [ ] Shell commands are avoided
- [ ] Input is validated before command execution
- [ ] Command injection patterns are blocked
- [ ] Safe alternatives are used (libraries vs. shell commands)

### 2.4 XSS Prevention
- [ ] All output is HTML encoded
- [ ] Content-Security-Policy header is set
- [ ] X-XSS-Protection header is set
- [ ] Script tags are blocked in input
- [ ] Event handlers are blocked in input
- [ ] Rich text is sanitized with allowlist

### 2.5 XXE Prevention
- [ ] XML external entities are disabled
- [ ] DOCTYPE declarations are blocked
- [ ] XML parsers are securely configured

---

## 3. Data Protection

### 3.1 Encryption
- [ ] Data at rest is encrypted (AES-256-GCM)
- [ ] TLS 1.3 is enforced for data in transit
- [ ] Encryption keys are securely stored
- [ ] Key rotation is implemented
- [ ] Old keys are securely destroyed

### 3.2 Sensitive Data
- [ ] PII is identified and protected
- [ ] Payment data complies with PCI DSS
- [ ] Passwords are never logged
- [ ] Tokens are not stored in logs
- [ ] Error messages don't leak sensitive data

### 3.3 Data Validation
- [ ] All input is validated on server-side
- [ ] Type checking is enforced
- [ ] Length limits are enforced
- [ ] Format validation (email, phone, etc.)
- [ ] File upload validation (type, size, content)

---

## 4. Security Headers

### 4.1 Required Headers
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] `Content-Security-Policy` is configured
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy` is configured

### 4.2 CORS
- [ ] CORS is properly configured
- [ ] Allowed origins are explicitly listed
- [ ] Credentials are only allowed for trusted origins
- [ ] Preflight caching is appropriate

---

## 5. Rate Limiting & DoS Protection

### 5.1 Rate Limiting
- [ ] Global rate limiting is enabled
- [ ] Per-user rate limiting is configured
- [ ] Per-IP rate limiting for unauthenticated requests
- [ ] Sensitive endpoints have lower limits
- [ ] Rate limit headers are returned
- [ ] Retry-After header on rate limit

### 5.2 Request Limits
- [ ] Maximum request body size is set (10MB)
- [ ] Maximum URL length is enforced (2048)
- [ ] Maximum header size is limited
- [ ] Timeout is configured for long-running requests

---

## 6. Logging & Monitoring

### 6.1 Security Logging
- [ ] Authentication events are logged
- [ ] Authorization failures are logged
- [ ] Attack attempts are logged
- [ ] Data access is audited
- [ ] Admin actions are logged

### 6.2 Log Security
- [ ] Logs don't contain sensitive data
- [ ] Logs are protected from tampering
- [ ] Log retention is configured
- [ ] Logs are centralized
- [ ] Log access is restricted

### 6.3 Alerting
- [ ] Brute force alerts are configured
- [ ] Attack detection alerts are active
- [ ] Error rate alerts are configured
- [ ] Anomaly detection is enabled

---

## 7. Infrastructure Security

### 7.1 Network
- [ ] Firewall rules are configured
- [ ] Internal services are not exposed
- [ ] VPN/private network for internal communication
- [ ] DDoS protection is enabled

### 7.2 Database
- [ ] Database is not publicly accessible
- [ ] Database credentials are rotated
- [ ] Backups are encrypted
- [ ] Database connections use TLS

### 7.3 Secrets Management
- [ ] Secrets are not in code
- [ ] Environment variables are used
- [ ] Secrets manager is used (HashiCorp Vault, AWS Secrets Manager)
- [ ] Secrets are rotated regularly

---

## 8. Code Security

### 8.1 Static Analysis
- [ ] gosec is run in CI/CD
- [ ] No critical findings
- [ ] All findings are reviewed

### 8.2 Dependency Security
- [ ] Dependencies are up to date
- [ ] No known vulnerabilities (govulncheck)
- [ ] Dependabot is enabled
- [ ] License compliance checked

### 8.3 Code Review
- [ ] Security-focused code review process
- [ ] Two-person review for security changes
- [ ] No hardcoded credentials

---

## 9. API Security

### 9.1 API Design
- [ ] REST best practices followed
- [ ] Consistent error responses
- [ ] Pagination implemented
- [ ] Field filtering implemented

### 9.2 API Authentication
- [ ] API keys are used for external integrations
- [ ] API keys can be revoked
- [ ] API key permissions are granular
- [ ] Rate limiting per API key

### 9.3 Input/Output
- [ ] Request validation is comprehensive
- [ ] Response doesn't leak internal details
- [ ] Error messages are generic

---

## 10. Testing

### 10.1 Security Tests
- [ ] Injection tests pass
- [ ] XSS tests pass
- [ ] Authentication tests pass
- [ ] Authorization tests pass
- [ ] Rate limiting tests pass

### 10.2 Penetration Testing
- [ ] Last penetration test date: ___________
- [ ] All critical findings resolved
- [ ] Retest completed

### 10.3 Vulnerability Scanning
- [ ] DAST scanning configured
- [ ] Container scanning enabled
- [ ] Regular vulnerability assessments

---

## Audit Sign-Off

| Item | Auditor | Date | Status |
|------|---------|------|--------|
| Authentication | | | |
| Authorization | | | |
| Injection Prevention | | | |
| Data Protection | | | |
| Security Headers | | | |
| Rate Limiting | | | |
| Logging | | | |
| Infrastructure | | | |
| Code Security | | | |
| API Security | | | |
| Testing | | | |

**Overall Status:** [ ] PASS  [ ] FAIL  [ ] CONDITIONAL

**Auditor Signature:** _____________________

**Date:** _____________________

**Next Audit Due:** _____________________
