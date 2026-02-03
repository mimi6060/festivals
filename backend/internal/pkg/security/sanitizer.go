package security

import (
	"html"
	"regexp"
	"strings"
	"unicode"
)

// Sanitizer provides methods for sanitizing user input
type Sanitizer struct {
	// Configuration
	AllowedHTMLTags       []string
	AllowedHTMLAttributes []string
	MaxLength             int
	StripNullBytes        bool
	NormalizeWhitespace   bool
}

// DefaultSanitizer returns a sanitizer with secure defaults
func DefaultSanitizer() *Sanitizer {
	return &Sanitizer{
		AllowedHTMLTags:       []string{}, // No HTML by default
		AllowedHTMLAttributes: []string{},
		MaxLength:             10000,
		StripNullBytes:        true,
		NormalizeWhitespace:   true,
	}
}

// RichTextSanitizer returns a sanitizer that allows basic rich text HTML
func RichTextSanitizer() *Sanitizer {
	return &Sanitizer{
		AllowedHTMLTags: []string{
			"p", "br", "b", "i", "u", "strong", "em",
			"h1", "h2", "h3", "h4", "h5", "h6",
			"ul", "ol", "li",
			"a", "blockquote", "code", "pre",
		},
		AllowedHTMLAttributes: []string{
			"href", "title", "class",
		},
		MaxLength:           50000,
		StripNullBytes:      true,
		NormalizeWhitespace: false,
	}
}

// SanitizeString performs comprehensive string sanitization
func (s *Sanitizer) SanitizeString(input string) string {
	if input == "" {
		return ""
	}

	result := input

	// Strip null bytes
	if s.StripNullBytes {
		result = strings.ReplaceAll(result, "\x00", "")
	}

	// Remove control characters except whitespace
	result = removeControlCharacters(result)

	// HTML encode
	result = html.EscapeString(result)

	// Normalize whitespace
	if s.NormalizeWhitespace {
		result = normalizeWhitespace(result)
	}

	// Enforce max length
	if s.MaxLength > 0 && len(result) > s.MaxLength {
		result = result[:s.MaxLength]
	}

	return strings.TrimSpace(result)
}

// SanitizeHTML sanitizes HTML while preserving allowed tags
func (s *Sanitizer) SanitizeHTML(input string) string {
	if input == "" {
		return ""
	}

	// If no HTML tags are allowed, escape everything
	if len(s.AllowedHTMLTags) == 0 {
		return s.SanitizeString(input)
	}

	result := input

	// Strip null bytes
	if s.StripNullBytes {
		result = strings.ReplaceAll(result, "\x00", "")
	}

	// Remove script and style tags completely (including content)
	result = removeScriptTags(result)
	result = removeStyleTags(result)

	// Remove event handlers
	result = removeEventHandlers(result)

	// Remove javascript: and data: URLs
	result = removeJavaScriptURLs(result)

	// Strip disallowed tags while keeping content
	result = stripDisallowedTags(result, s.AllowedHTMLTags)

	// Strip disallowed attributes
	result = stripDisallowedAttributes(result, s.AllowedHTMLAttributes)

	// Final cleanup
	result = strings.TrimSpace(result)

	// Enforce max length
	if s.MaxLength > 0 && len(result) > s.MaxLength {
		result = truncateHTML(result, s.MaxLength)
	}

	return result
}

// SanitizeSQL sanitizes input for use in SQL queries
// Note: This should be used in addition to parameterized queries, not as a replacement
func (s *Sanitizer) SanitizeSQL(input string) string {
	if input == "" {
		return ""
	}

	result := input

	// Remove null bytes
	result = strings.ReplaceAll(result, "\x00", "")

	// Escape single quotes (double them)
	result = strings.ReplaceAll(result, "'", "''")

	// Remove SQL comments
	result = removeSQLComments(result)

	// Remove common SQL injection patterns
	result = removeSQLInjectionPatterns(result)

	return result
}

// SanitizeFilename sanitizes a filename
func (s *Sanitizer) SanitizeFilename(filename string) string {
	if filename == "" {
		return ""
	}

	// Remove path separators
	result := strings.ReplaceAll(filename, "/", "")
	result = strings.ReplaceAll(result, "\\", "")

	// Remove null bytes
	result = strings.ReplaceAll(result, "\x00", "")

	// Remove other dangerous characters
	dangerous := []string{":", "*", "?", "\"", "<", ">", "|", "..", "~"}
	for _, d := range dangerous {
		result = strings.ReplaceAll(result, d, "")
	}

	// Remove control characters
	result = removeControlCharacters(result)

	// Limit length
	if len(result) > 255 {
		// Try to preserve extension
		ext := ""
		if idx := strings.LastIndex(result, "."); idx > 0 {
			ext = result[idx:]
			result = result[:idx]
		}
		maxBase := 255 - len(ext)
		if len(result) > maxBase {
			result = result[:maxBase]
		}
		result = result + ext
	}

	return strings.TrimSpace(result)
}

// SanitizePath sanitizes a file path
func (s *Sanitizer) SanitizePath(path string) string {
	if path == "" {
		return ""
	}

	// Remove null bytes
	result := strings.ReplaceAll(path, "\x00", "")

	// Remove path traversal sequences
	result = strings.ReplaceAll(result, "..", "")
	result = strings.ReplaceAll(result, "..\\", "")
	result = strings.ReplaceAll(result, "../", "")

	// Remove encoded path traversal
	result = strings.ReplaceAll(result, "%2e%2e", "")
	result = strings.ReplaceAll(result, "%2e%2e%2f", "")
	result = strings.ReplaceAll(result, "%2e%2e/", "")
	result = strings.ReplaceAll(result, "..%2f", "")
	result = strings.ReplaceAll(result, "%2e%2e%5c", "")

	// Normalize path separators
	result = strings.ReplaceAll(result, "\\", "/")

	// Remove duplicate slashes
	for strings.Contains(result, "//") {
		result = strings.ReplaceAll(result, "//", "/")
	}

	return result
}

// SanitizeURL sanitizes a URL
func (s *Sanitizer) SanitizeURL(input string) string {
	if input == "" {
		return ""
	}

	result := strings.TrimSpace(input)

	// Remove null bytes
	result = strings.ReplaceAll(result, "\x00", "")

	// Check for dangerous schemes
	lowerResult := strings.ToLower(result)
	dangerousSchemes := []string{
		"javascript:", "vbscript:", "data:text/html",
		"data:application/javascript", "data:text/javascript",
	}
	for _, scheme := range dangerousSchemes {
		if strings.HasPrefix(lowerResult, scheme) {
			return ""
		}
	}

	// Remove control characters
	result = removeControlCharacters(result)

	return result
}

// SanitizeJSON sanitizes a JSON string
func (s *Sanitizer) SanitizeJSON(input string) string {
	if input == "" {
		return ""
	}

	// Remove null bytes
	result := strings.ReplaceAll(input, "\x00", "")

	// Remove control characters except those valid in JSON
	result = removeJSONInvalidCharacters(result)

	return result
}

// SanitizeXML sanitizes an XML string
func (s *Sanitizer) SanitizeXML(input string) string {
	if input == "" {
		return ""
	}

	result := input

	// Remove null bytes
	result = strings.ReplaceAll(result, "\x00", "")

	// Remove external entity references (XXE prevention)
	result = removeXXEPatterns(result)

	// Remove processing instructions
	result = removeXMLProcessingInstructions(result)

	return result
}

// Helper functions

func removeControlCharacters(input string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsControl(r) && r != '\n' && r != '\r' && r != '\t' {
			return -1
		}
		return r
	}, input)
}

func normalizeWhitespace(input string) string {
	// Replace multiple whitespace with single space
	re := regexp.MustCompile(`\s+`)
	return re.ReplaceAllString(input, " ")
}

func removeScriptTags(input string) string {
	re := regexp.MustCompile(`(?i)<script[^>]*>[\s\S]*?</script>`)
	return re.ReplaceAllString(input, "")
}

func removeStyleTags(input string) string {
	re := regexp.MustCompile(`(?i)<style[^>]*>[\s\S]*?</style>`)
	return re.ReplaceAllString(input, "")
}

func removeEventHandlers(input string) string {
	// Remove on* event handlers
	re := regexp.MustCompile(`(?i)\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)`)
	return re.ReplaceAllString(input, "")
}

func removeJavaScriptURLs(input string) string {
	// Remove javascript: URLs
	re := regexp.MustCompile(`(?i)javascript\s*:`)
	result := re.ReplaceAllString(input, "")

	// Remove vbscript: URLs
	re = regexp.MustCompile(`(?i)vbscript\s*:`)
	result = re.ReplaceAllString(result, "")

	// Remove data: URLs with HTML/JavaScript content
	re = regexp.MustCompile(`(?i)data\s*:\s*(text/html|application/javascript|text/javascript)`)
	result = re.ReplaceAllString(result, "")

	return result
}

func stripDisallowedTags(input string, allowedTags []string) string {
	if len(allowedTags) == 0 {
		// Remove all tags
		re := regexp.MustCompile(`<[^>]+>`)
		return re.ReplaceAllString(input, "")
	}

	// Build regex for allowed tags
	allowedPattern := strings.Join(allowedTags, "|")

	// Remove disallowed opening tags
	disallowedOpen := regexp.MustCompile(`(?i)<(?!/?(?:` + allowedPattern + `)(?:\s|>|/))[^>]*>`)
	result := disallowedOpen.ReplaceAllString(input, "")

	return result
}

func stripDisallowedAttributes(input string, allowedAttrs []string) string {
	if len(allowedAttrs) == 0 {
		// Remove all attributes except basic ones
		re := regexp.MustCompile(`(?i)(<\w+)\s+[^>]*?(>)`)
		return re.ReplaceAllString(input, "$1$2")
	}

	// Build pattern for disallowed attributes
	allowedPattern := strings.Join(allowedAttrs, "|")

	// Remove attributes not in allowed list
	re := regexp.MustCompile(`(?i)\s+(?!(?:` + allowedPattern + `)\s*=)[a-z-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)`)
	return re.ReplaceAllString(input, "")
}

func truncateHTML(input string, maxLen int) string {
	if len(input) <= maxLen {
		return input
	}

	// Simple truncation - doesn't handle tag closing perfectly
	// For production, consider using a proper HTML parser
	result := input[:maxLen]

	// Try to close any open tags
	openTags := findOpenTags(result)
	for i := len(openTags) - 1; i >= 0; i-- {
		result += "</" + openTags[i] + ">"
	}

	return result
}

func findOpenTags(html string) []string {
	var openTags []string

	openRe := regexp.MustCompile(`<(\w+)(?:\s[^>]*)?>`)
	closeRe := regexp.MustCompile(`</(\w+)>`)

	opens := openRe.FindAllStringSubmatch(html, -1)
	closes := closeRe.FindAllStringSubmatch(html, -1)

	closeCount := make(map[string]int)
	for _, match := range closes {
		closeCount[strings.ToLower(match[1])]++
	}

	for _, match := range opens {
		tag := strings.ToLower(match[1])
		// Skip self-closing tags
		if isSelfClosingTag(tag) {
			continue
		}
		if closeCount[tag] > 0 {
			closeCount[tag]--
		} else {
			openTags = append(openTags, tag)
		}
	}

	return openTags
}

func isSelfClosingTag(tag string) bool {
	selfClosing := map[string]bool{
		"br": true, "hr": true, "img": true, "input": true,
		"meta": true, "link": true, "area": true, "base": true,
		"col": true, "embed": true, "param": true, "source": true,
		"track": true, "wbr": true,
	}
	return selfClosing[strings.ToLower(tag)]
}

func removeSQLComments(input string) string {
	// Remove single-line comments
	re := regexp.MustCompile(`--.*$`)
	result := re.ReplaceAllString(input, "")

	// Remove multi-line comments
	re = regexp.MustCompile(`/\*[\s\S]*?\*/`)
	result = re.ReplaceAllString(result, "")

	// Remove hash comments
	re = regexp.MustCompile(`#.*$`)
	result = re.ReplaceAllString(result, "")

	return result
}

func removeSQLInjectionPatterns(input string) string {
	// Common SQL injection patterns to neutralize
	patterns := []struct {
		pattern     *regexp.Regexp
		replacement string
	}{
		// UNION-based injection
		{regexp.MustCompile(`(?i)\bUNION\b`), ""},
		// Time-based injection
		{regexp.MustCompile(`(?i)WAITFOR\s+DELAY`), ""},
		{regexp.MustCompile(`(?i)BENCHMARK\s*\(`), ""},
		{regexp.MustCompile(`(?i)SLEEP\s*\(`), ""},
		// Stacked queries
		{regexp.MustCompile(`;\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE)`), ""},
	}

	result := input
	for _, p := range patterns {
		result = p.pattern.ReplaceAllString(result, p.replacement)
	}

	return result
}

func removeJSONInvalidCharacters(input string) string {
	return strings.Map(func(r rune) rune {
		// Allow valid JSON characters
		if r == '\n' || r == '\r' || r == '\t' {
			return r
		}
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, input)
}

func removeXXEPatterns(input string) string {
	// Remove DOCTYPE declarations
	re := regexp.MustCompile(`(?i)<!DOCTYPE[^>]*>`)
	result := re.ReplaceAllString(input, "")

	// Remove ENTITY declarations
	re = regexp.MustCompile(`(?i)<!ENTITY[^>]*>`)
	result = re.ReplaceAllString(result, "")

	// Remove SYSTEM references
	re = regexp.MustCompile(`(?i)SYSTEM\s+"[^"]*"`)
	result = re.ReplaceAllString(result, "")

	// Remove PUBLIC references
	re = regexp.MustCompile(`(?i)PUBLIC\s+"[^"]*"\s+"[^"]*"`)
	result = re.ReplaceAllString(result, "")

	return result
}

func removeXMLProcessingInstructions(input string) string {
	re := regexp.MustCompile(`<\?[^?]*\?>`)
	return re.ReplaceAllString(input, "")
}

// StripAllTags removes all HTML/XML tags from input
func StripAllTags(input string) string {
	re := regexp.MustCompile(`<[^>]+>`)
	return re.ReplaceAllString(input, "")
}

// EscapeHTML escapes HTML special characters
func EscapeHTML(input string) string {
	return html.EscapeString(input)
}

// UnescapeHTML unescapes HTML special characters
func UnescapeHTML(input string) string {
	return html.UnescapeString(input)
}

// NormalizeNewlines converts all newline variations to \n
func NormalizeNewlines(input string) string {
	// Convert \r\n to \n
	result := strings.ReplaceAll(input, "\r\n", "\n")
	// Convert remaining \r to \n
	result = strings.ReplaceAll(result, "\r", "\n")
	return result
}

// TrimMultipleSpaces reduces multiple consecutive spaces to single space
func TrimMultipleSpaces(input string) string {
	re := regexp.MustCompile(`[ \t]+`)
	return re.ReplaceAllString(input, " ")
}

// RemoveNonPrintable removes non-printable characters except common whitespace
func RemoveNonPrintable(input string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsPrint(r) || r == '\n' || r == '\r' || r == '\t' {
			return r
		}
		return -1
	}, input)
}
