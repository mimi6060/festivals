package security

import (
	"encoding/json"
	"fmt"
	"net"
	"net/mail"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"
)

// ValidationResult represents the result of a validation
type ValidationResult struct {
	Valid   bool     `json:"valid"`
	Errors  []string `json:"errors,omitempty"`
	Cleaned string   `json:"cleaned,omitempty"`
}

// Validator provides secure input validation methods
type Validator struct {
	// Configuration options
	MaxStringLength     int
	MaxArrayLength      int
	MaxObjectDepth      int
	AllowedSchemes      []string
	AllowedDomains      []string
	BlockedDomains      []string
	AllowedFileTypes    []string
	BlockedFileTypes    []string
	PasswordMinLength   int
	PasswordMaxLength   int
	PasswordRequireUpper bool
	PasswordRequireLower bool
	PasswordRequireDigit bool
	PasswordRequireSpecial bool
}

// DefaultValidator returns a validator with secure defaults
func DefaultValidator() *Validator {
	return &Validator{
		MaxStringLength:      10000,
		MaxArrayLength:       1000,
		MaxObjectDepth:       10,
		AllowedSchemes:       []string{"http", "https"},
		AllowedDomains:       nil, // nil means all domains allowed
		BlockedDomains:       []string{"localhost", "127.0.0.1", "0.0.0.0"},
		AllowedFileTypes:     []string{".jpg", ".jpeg", ".png", ".gif", ".pdf", ".doc", ".docx"},
		BlockedFileTypes:     []string{".exe", ".dll", ".bat", ".cmd", ".sh", ".ps1", ".php", ".jsp"},
		PasswordMinLength:    12,
		PasswordMaxLength:    128,
		PasswordRequireUpper: true,
		PasswordRequireLower: true,
		PasswordRequireDigit: true,
		PasswordRequireSpecial: true,
	}
}

// ValidateEmail validates an email address
func (v *Validator) ValidateEmail(email string) ValidationResult {
	result := ValidationResult{Valid: true}

	if email == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "email is required")
		return result
	}

	// Check length
	if len(email) > 254 {
		result.Valid = false
		result.Errors = append(result.Errors, "email exceeds maximum length of 254 characters")
		return result
	}

	// Parse email
	addr, err := mail.ParseAddress(email)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid email format")
		return result
	}

	// Additional validation
	parts := strings.Split(addr.Address, "@")
	if len(parts) != 2 {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid email format")
		return result
	}

	local, domain := parts[0], parts[1]

	// Validate local part length
	if len(local) > 64 {
		result.Valid = false
		result.Errors = append(result.Errors, "email local part exceeds maximum length of 64 characters")
	}

	// Validate domain
	if len(domain) > 255 {
		result.Valid = false
		result.Errors = append(result.Errors, "email domain exceeds maximum length of 255 characters")
	}

	// Check for dangerous patterns
	if strings.Contains(email, "..") || strings.Contains(email, "--") {
		result.Valid = false
		result.Errors = append(result.Errors, "email contains invalid character sequences")
	}

	result.Cleaned = addr.Address
	return result
}

// ValidateURL validates a URL
func (v *Validator) ValidateURL(rawURL string) ValidationResult {
	result := ValidationResult{Valid: true}

	if rawURL == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "URL is required")
		return result
	}

	// Check length
	if len(rawURL) > 2048 {
		result.Valid = false
		result.Errors = append(result.Errors, "URL exceeds maximum length of 2048 characters")
		return result
	}

	// Parse URL
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid URL format")
		return result
	}

	// Validate scheme
	if len(v.AllowedSchemes) > 0 {
		schemeAllowed := false
		for _, scheme := range v.AllowedSchemes {
			if parsedURL.Scheme == scheme {
				schemeAllowed = true
				break
			}
		}
		if !schemeAllowed {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("URL scheme '%s' not allowed", parsedURL.Scheme))
		}
	}

	// Check for blocked domains
	for _, blocked := range v.BlockedDomains {
		if strings.EqualFold(parsedURL.Hostname(), blocked) {
			result.Valid = false
			result.Errors = append(result.Errors, "URL domain not allowed")
			break
		}
	}

	// Check allowed domains if specified
	if len(v.AllowedDomains) > 0 {
		domainAllowed := false
		for _, allowed := range v.AllowedDomains {
			if strings.EqualFold(parsedURL.Hostname(), allowed) ||
				strings.HasSuffix(parsedURL.Hostname(), "."+allowed) {
				domainAllowed = true
				break
			}
		}
		if !domainAllowed {
			result.Valid = false
			result.Errors = append(result.Errors, "URL domain not allowed")
		}
	}

	// Check for SSRF-like patterns
	if isSSRFRisk(parsedURL.Hostname()) {
		result.Valid = false
		result.Errors = append(result.Errors, "URL appears to target internal resources")
	}

	result.Cleaned = parsedURL.String()
	return result
}

// isSSRFRisk checks if a hostname could be used for SSRF
func isSSRFRisk(hostname string) bool {
	// Check for localhost variations
	localPatterns := []string{
		"localhost",
		"127.",
		"0.0.0.0",
		"::1",
		"0:0:0:0:0:0:0:1",
		"169.254.", // Link-local
		"10.",      // Private Class A
		"172.16.",  // Private Class B start
		"172.17.",
		"172.18.",
		"172.19.",
		"172.20.",
		"172.21.",
		"172.22.",
		"172.23.",
		"172.24.",
		"172.25.",
		"172.26.",
		"172.27.",
		"172.28.",
		"172.29.",
		"172.30.",
		"172.31.", // Private Class B end
		"192.168.", // Private Class C
	}

	lowerHost := strings.ToLower(hostname)
	for _, pattern := range localPatterns {
		if strings.HasPrefix(lowerHost, pattern) {
			return true
		}
	}

	// Try to resolve and check IP
	ips, err := net.LookupIP(hostname)
	if err == nil {
		for _, ip := range ips {
			if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() {
				return true
			}
		}
	}

	return false
}

// ValidateUUID validates a UUID string
func (v *Validator) ValidateUUID(id string) ValidationResult {
	result := ValidationResult{Valid: true}

	if id == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "UUID is required")
		return result
	}

	parsed, err := uuid.Parse(id)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid UUID format")
		return result
	}

	result.Cleaned = parsed.String()
	return result
}

// ValidatePhone validates a phone number
func (v *Validator) ValidatePhone(phone string) ValidationResult {
	result := ValidationResult{Valid: true}

	if phone == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "phone number is required")
		return result
	}

	// Remove common formatting characters
	cleaned := strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) || r == '+' {
			return r
		}
		return -1
	}, phone)

	// Basic validation
	if len(cleaned) < 10 || len(cleaned) > 15 {
		result.Valid = false
		result.Errors = append(result.Errors, "phone number must be between 10 and 15 digits")
		return result
	}

	// Check format
	phoneRegex := regexp.MustCompile(`^\+?[1-9]\d{9,14}$`)
	if !phoneRegex.MatchString(cleaned) {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid phone number format")
		return result
	}

	result.Cleaned = cleaned
	return result
}

// ValidatePassword validates password strength
func (v *Validator) ValidatePassword(password string) ValidationResult {
	result := ValidationResult{Valid: true}

	if password == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "password is required")
		return result
	}

	// Length checks
	if len(password) < v.PasswordMinLength {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("password must be at least %d characters", v.PasswordMinLength))
	}

	if len(password) > v.PasswordMaxLength {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("password must not exceed %d characters", v.PasswordMaxLength))
	}

	// Character class checks
	var hasUpper, hasLower, hasDigit, hasSpecial bool
	for _, char := range password {
		switch {
		case unicode.IsUpper(char):
			hasUpper = true
		case unicode.IsLower(char):
			hasLower = true
		case unicode.IsDigit(char):
			hasDigit = true
		case unicode.IsPunct(char) || unicode.IsSymbol(char):
			hasSpecial = true
		}
	}

	if v.PasswordRequireUpper && !hasUpper {
		result.Valid = false
		result.Errors = append(result.Errors, "password must contain at least one uppercase letter")
	}

	if v.PasswordRequireLower && !hasLower {
		result.Valid = false
		result.Errors = append(result.Errors, "password must contain at least one lowercase letter")
	}

	if v.PasswordRequireDigit && !hasDigit {
		result.Valid = false
		result.Errors = append(result.Errors, "password must contain at least one digit")
	}

	if v.PasswordRequireSpecial && !hasSpecial {
		result.Valid = false
		result.Errors = append(result.Errors, "password must contain at least one special character")
	}

	// Check for common passwords (basic check)
	commonPasswords := []string{
		"password", "123456", "12345678", "qwerty", "abc123",
		"monkey", "1234567", "letmein", "trustno1", "dragon",
		"baseball", "iloveyou", "master", "sunshine", "ashley",
		"passw0rd", "shadow", "123123", "654321", "superman",
	}
	lowerPassword := strings.ToLower(password)
	for _, common := range commonPasswords {
		if strings.Contains(lowerPassword, common) {
			result.Valid = false
			result.Errors = append(result.Errors, "password contains common patterns")
			break
		}
	}

	return result
}

// ValidateString validates a generic string input
func (v *Validator) ValidateString(input string, minLen, maxLen int, allowHTML bool) ValidationResult {
	result := ValidationResult{Valid: true}

	// Check UTF-8 validity
	if !utf8.ValidString(input) {
		result.Valid = false
		result.Errors = append(result.Errors, "input contains invalid UTF-8 characters")
		return result
	}

	// Length checks
	runeCount := utf8.RuneCountInString(input)
	if runeCount < minLen {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("input must be at least %d characters", minLen))
	}

	if maxLen > 0 && runeCount > maxLen {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("input must not exceed %d characters", maxLen))
	}

	// Null byte check
	if strings.Contains(input, "\x00") {
		result.Valid = false
		result.Errors = append(result.Errors, "input contains null bytes")
	}

	// Control character check (except common whitespace)
	for _, r := range input {
		if unicode.IsControl(r) && r != '\n' && r != '\r' && r != '\t' {
			result.Valid = false
			result.Errors = append(result.Errors, "input contains invalid control characters")
			break
		}
	}

	if !allowHTML {
		// Check for HTML tags
		htmlRegex := regexp.MustCompile(`<[^>]+>`)
		if htmlRegex.MatchString(input) {
			result.Valid = false
			result.Errors = append(result.Errors, "HTML tags are not allowed")
		}
	}

	result.Cleaned = strings.TrimSpace(input)
	return result
}

// ValidateNumber validates a numeric string
func (v *Validator) ValidateNumber(input string, min, max float64) ValidationResult {
	result := ValidationResult{Valid: true}

	if input == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "number is required")
		return result
	}

	num, err := strconv.ParseFloat(input, 64)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid number format")
		return result
	}

	if num < min {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("number must be at least %f", min))
	}

	if num > max {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("number must not exceed %f", max))
	}

	result.Cleaned = strconv.FormatFloat(num, 'f', -1, 64)
	return result
}

// ValidateInteger validates an integer string
func (v *Validator) ValidateInteger(input string, min, max int64) ValidationResult {
	result := ValidationResult{Valid: true}

	if input == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "integer is required")
		return result
	}

	num, err := strconv.ParseInt(input, 10, 64)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid integer format")
		return result
	}

	if num < min {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("integer must be at least %d", min))
	}

	if num > max {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("integer must not exceed %d", max))
	}

	result.Cleaned = strconv.FormatInt(num, 10)
	return result
}

// ValidateDate validates a date string
func (v *Validator) ValidateDate(input, format string) ValidationResult {
	result := ValidationResult{Valid: true}

	if input == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "date is required")
		return result
	}

	if format == "" {
		format = time.RFC3339
	}

	parsed, err := time.Parse(format, input)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, fmt.Sprintf("invalid date format, expected %s", format))
		return result
	}

	result.Cleaned = parsed.Format(format)
	return result
}

// ValidateJSON validates JSON structure
func (v *Validator) ValidateJSON(input string, maxDepth int) ValidationResult {
	result := ValidationResult{Valid: true}

	if input == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "JSON is required")
		return result
	}

	// Check if valid JSON
	var js interface{}
	if err := json.Unmarshal([]byte(input), &js); err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid JSON format")
		return result
	}

	// Check depth
	if maxDepth > 0 {
		depth := getJSONDepth(js)
		if depth > maxDepth {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("JSON exceeds maximum depth of %d", maxDepth))
		}
	}

	// Re-marshal to clean JSON
	cleanJSON, _ := json.Marshal(js)
	result.Cleaned = string(cleanJSON)
	return result
}

// getJSONDepth calculates the depth of a JSON structure
func getJSONDepth(v interface{}) int {
	switch val := v.(type) {
	case map[string]interface{}:
		maxDepth := 0
		for _, value := range val {
			depth := getJSONDepth(value)
			if depth > maxDepth {
				maxDepth = depth
			}
		}
		return maxDepth + 1
	case []interface{}:
		maxDepth := 0
		for _, value := range val {
			depth := getJSONDepth(value)
			if depth > maxDepth {
				maxDepth = depth
			}
		}
		return maxDepth + 1
	default:
		return 1
	}
}

// ValidateFilename validates a filename
func (v *Validator) ValidateFilename(filename string) ValidationResult {
	result := ValidationResult{Valid: true}

	if filename == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "filename is required")
		return result
	}

	// Check length
	if len(filename) > 255 {
		result.Valid = false
		result.Errors = append(result.Errors, "filename exceeds maximum length of 255 characters")
	}

	// Check for path traversal
	if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
		result.Valid = false
		result.Errors = append(result.Errors, "filename contains invalid characters")
	}

	// Check for null bytes
	if strings.Contains(filename, "\x00") {
		result.Valid = false
		result.Errors = append(result.Errors, "filename contains null bytes")
	}

	// Check file extension
	ext := strings.ToLower(getFileExtension(filename))

	// Check blocked extensions
	for _, blocked := range v.BlockedFileTypes {
		if ext == strings.ToLower(blocked) {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("file type '%s' is not allowed", ext))
			break
		}
	}

	// Check allowed extensions if specified
	if len(v.AllowedFileTypes) > 0 {
		extAllowed := false
		for _, allowed := range v.AllowedFileTypes {
			if ext == strings.ToLower(allowed) {
				extAllowed = true
				break
			}
		}
		if !extAllowed {
			result.Valid = false
			result.Errors = append(result.Errors, fmt.Sprintf("file type '%s' is not allowed", ext))
		}
	}

	// Sanitize filename
	cleaned := sanitizeFilename(filename)
	result.Cleaned = cleaned

	return result
}

// getFileExtension extracts the file extension
func getFileExtension(filename string) string {
	if idx := strings.LastIndex(filename, "."); idx != -1 {
		return filename[idx:]
	}
	return ""
}

// sanitizeFilename removes dangerous characters from filename
func sanitizeFilename(filename string) string {
	// Remove path separators and dangerous characters
	dangerous := []string{"/", "\\", "..", "\x00", ":", "*", "?", "\"", "<", ">", "|"}
	result := filename
	for _, d := range dangerous {
		result = strings.ReplaceAll(result, d, "")
	}
	return strings.TrimSpace(result)
}

// ValidateIPAddress validates an IP address
func (v *Validator) ValidateIPAddress(ip string) ValidationResult {
	result := ValidationResult{Valid: true}

	if ip == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "IP address is required")
		return result
	}

	parsed := net.ParseIP(ip)
	if parsed == nil {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid IP address format")
		return result
	}

	result.Cleaned = parsed.String()
	return result
}

// ValidateCIDR validates a CIDR notation
func (v *Validator) ValidateCIDR(cidr string) ValidationResult {
	result := ValidationResult{Valid: true}

	if cidr == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "CIDR is required")
		return result
	}

	_, _, err := net.ParseCIDR(cidr)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid CIDR format")
		return result
	}

	result.Cleaned = cidr
	return result
}

// ValidateSlug validates a URL slug
func (v *Validator) ValidateSlug(slug string) ValidationResult {
	result := ValidationResult{Valid: true}

	if slug == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "slug is required")
		return result
	}

	// Check length
	if len(slug) > 100 {
		result.Valid = false
		result.Errors = append(result.Errors, "slug exceeds maximum length of 100 characters")
	}

	// Check format (lowercase alphanumeric and hyphens only)
	slugRegex := regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
	if !slugRegex.MatchString(slug) {
		result.Valid = false
		result.Errors = append(result.Errors, "slug must contain only lowercase letters, numbers, and hyphens")
	}

	result.Cleaned = slug
	return result
}

// ValidateCreditCard performs basic credit card validation (Luhn algorithm)
func (v *Validator) ValidateCreditCard(number string) ValidationResult {
	result := ValidationResult{Valid: true}

	// Remove spaces and hyphens
	cleaned := strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) {
			return r
		}
		return -1
	}, number)

	if cleaned == "" {
		result.Valid = false
		result.Errors = append(result.Errors, "credit card number is required")
		return result
	}

	// Check length
	if len(cleaned) < 13 || len(cleaned) > 19 {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid credit card number length")
		return result
	}

	// Luhn algorithm
	if !luhnCheck(cleaned) {
		result.Valid = false
		result.Errors = append(result.Errors, "invalid credit card number")
		return result
	}

	// Mask the card number for storage
	masked := strings.Repeat("*", len(cleaned)-4) + cleaned[len(cleaned)-4:]
	result.Cleaned = masked

	return result
}

// luhnCheck performs the Luhn algorithm check
func luhnCheck(number string) bool {
	sum := 0
	alternate := false

	for i := len(number) - 1; i >= 0; i-- {
		n, _ := strconv.Atoi(string(number[i]))

		if alternate {
			n *= 2
			if n > 9 {
				n -= 9
			}
		}

		sum += n
		alternate = !alternate
	}

	return sum%10 == 0
}
