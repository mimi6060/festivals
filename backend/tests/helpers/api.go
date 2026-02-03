package helpers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// TestClient provides HTTP testing utilities
type TestClient struct {
	Router  *gin.Engine
	Server  *httptest.Server
	T       *testing.T
	Headers map[string]string
}

// NewTestClient creates a new test HTTP client
func NewTestClient(t *testing.T, router *gin.Engine) *TestClient {
	t.Helper()
	return &TestClient{
		Router:  router,
		Server:  httptest.NewServer(router),
		T:       t,
		Headers: make(map[string]string),
	}
}

// Close closes the test server
func (c *TestClient) Close() {
	if c.Server != nil {
		c.Server.Close()
	}
}

// SetHeader sets a default header for all requests
func (c *TestClient) SetHeader(key, value string) *TestClient {
	c.Headers[key] = value
	return c
}

// SetUser sets the test user ID header
func (c *TestClient) SetUser(userID uuid.UUID) *TestClient {
	c.Headers["X-Test-User-ID"] = userID.String()
	return c
}

// SetStaff sets the test staff ID header
func (c *TestClient) SetStaff(staffID uuid.UUID) *TestClient {
	c.Headers["X-Test-Staff-ID"] = staffID.String()
	return c
}

// SetRoles sets the test roles header
func (c *TestClient) SetRoles(roles string) *TestClient {
	c.Headers["X-Test-Roles"] = roles
	return c
}

// SetFestival sets the test festival ID header
func (c *TestClient) SetFestival(festivalID uuid.UUID) *TestClient {
	c.Headers["X-Test-Festival-ID"] = festivalID.String()
	return c
}

// SetWallet sets the test wallet ID header
func (c *TestClient) SetWallet(walletID uuid.UUID) *TestClient {
	c.Headers["X-Test-Wallet-ID"] = walletID.String()
	return c
}

// SetAuth sets a Bearer token
func (c *TestClient) SetAuth(token string) *TestClient {
	c.Headers["Authorization"] = "Bearer " + token
	return c
}

// ClearHeaders clears all default headers
func (c *TestClient) ClearHeaders() *TestClient {
	c.Headers = make(map[string]string)
	return c
}

// TestResponse wraps an HTTP response with helper methods
type TestResponse struct {
	*httptest.ResponseRecorder
	T *testing.T
}

// StatusCode returns the response status code
func (r *TestResponse) StatusCode() int {
	return r.Code
}

// BodyString returns the response body as a string
func (r *TestResponse) BodyString() string {
	return r.Body.String()
}

// BodyBytes returns the response body as bytes
func (r *TestResponse) BodyBytes() []byte {
	return r.Body.Bytes()
}

// Unmarshal unmarshals the response body into the given interface
func (r *TestResponse) Unmarshal(v interface{}) error {
	return json.Unmarshal(r.Body.Bytes(), v)
}

// AssertStatus asserts the response status code
func (r *TestResponse) AssertStatus(expected int) *TestResponse {
	require.Equal(r.T, expected, r.Code, "Expected status %d but got %d: %s", expected, r.Code, r.Body.String())
	return r
}

// AssertOK asserts a 200 OK response
func (r *TestResponse) AssertOK() *TestResponse {
	return r.AssertStatus(http.StatusOK)
}

// AssertCreated asserts a 201 Created response
func (r *TestResponse) AssertCreated() *TestResponse {
	return r.AssertStatus(http.StatusCreated)
}

// AssertNoContent asserts a 204 No Content response
func (r *TestResponse) AssertNoContent() *TestResponse {
	return r.AssertStatus(http.StatusNoContent)
}

// AssertBadRequest asserts a 400 Bad Request response
func (r *TestResponse) AssertBadRequest() *TestResponse {
	return r.AssertStatus(http.StatusBadRequest)
}

// AssertUnauthorized asserts a 401 Unauthorized response
func (r *TestResponse) AssertUnauthorized() *TestResponse {
	return r.AssertStatus(http.StatusUnauthorized)
}

// AssertForbidden asserts a 403 Forbidden response
func (r *TestResponse) AssertForbidden() *TestResponse {
	return r.AssertStatus(http.StatusForbidden)
}

// AssertNotFound asserts a 404 Not Found response
func (r *TestResponse) AssertNotFound() *TestResponse {
	return r.AssertStatus(http.StatusNotFound)
}

// AssertInternalError asserts a 500 Internal Server Error response
func (r *TestResponse) AssertInternalError() *TestResponse {
	return r.AssertStatus(http.StatusInternalServerError)
}

// Data extracts the data field from a standard API response
func (r *TestResponse) Data() interface{} {
	var resp map[string]interface{}
	if err := r.Unmarshal(&resp); err != nil {
		r.T.Fatalf("Failed to unmarshal response: %v", err)
	}
	return resp["data"]
}

// DataMap extracts the data field as a map
func (r *TestResponse) DataMap() map[string]interface{} {
	data := r.Data()
	if data == nil {
		return nil
	}
	result, ok := data.(map[string]interface{})
	if !ok {
		r.T.Fatalf("Data is not a map: %T", data)
	}
	return result
}

// DataList extracts the data field as a list
func (r *TestResponse) DataList() []interface{} {
	data := r.Data()
	if data == nil {
		return nil
	}
	result, ok := data.([]interface{})
	if !ok {
		r.T.Fatalf("Data is not a list: %T", data)
	}
	return result
}

// Error extracts the error field from an error response
func (r *TestResponse) Error() map[string]interface{} {
	var resp map[string]interface{}
	if err := r.Unmarshal(&resp); err != nil {
		r.T.Fatalf("Failed to unmarshal response: %v", err)
	}
	errField, ok := resp["error"].(map[string]interface{})
	if !ok {
		return nil
	}
	return errField
}

// ErrorCode extracts the error code from an error response
func (r *TestResponse) ErrorCode() string {
	errField := r.Error()
	if errField == nil {
		return ""
	}
	code, _ := errField["code"].(string)
	return code
}

// Meta extracts the meta field from a paginated response
func (r *TestResponse) Meta() map[string]interface{} {
	var resp map[string]interface{}
	if err := r.Unmarshal(&resp); err != nil {
		r.T.Fatalf("Failed to unmarshal response: %v", err)
	}
	meta, ok := resp["meta"].(map[string]interface{})
	if !ok {
		return nil
	}
	return meta
}

// ============================================================================
// HTTP request methods
// ============================================================================

// buildRequest creates an HTTP request with the client's default headers
func (c *TestClient) buildRequest(method, path string, body interface{}) *http.Request {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		require.NoError(c.T, err)
		bodyReader = bytes.NewBuffer(jsonBody)
	}

	req := httptest.NewRequest(method, path, bodyReader)

	// Set content type for requests with body
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	// Set default headers
	for key, value := range c.Headers {
		req.Header.Set(key, value)
	}

	return req
}

// doRequest performs an HTTP request and returns the response
func (c *TestClient) doRequest(method, path string, body interface{}) *TestResponse {
	req := c.buildRequest(method, path, body)
	w := httptest.NewRecorder()
	c.Router.ServeHTTP(w, req)
	return &TestResponse{ResponseRecorder: w, T: c.T}
}

// GET performs a GET request
func (c *TestClient) GET(path string) *TestResponse {
	return c.doRequest(http.MethodGet, path, nil)
}

// POST performs a POST request
func (c *TestClient) POST(path string, body interface{}) *TestResponse {
	return c.doRequest(http.MethodPost, path, body)
}

// PUT performs a PUT request
func (c *TestClient) PUT(path string, body interface{}) *TestResponse {
	return c.doRequest(http.MethodPut, path, body)
}

// PATCH performs a PATCH request
func (c *TestClient) PATCH(path string, body interface{}) *TestResponse {
	return c.doRequest(http.MethodPatch, path, body)
}

// DELETE performs a DELETE request
func (c *TestClient) DELETE(path string) *TestResponse {
	return c.doRequest(http.MethodDelete, path, nil)
}

// DELETEWithBody performs a DELETE request with a body
func (c *TestClient) DELETEWithBody(path string, body interface{}) *TestResponse {
	return c.doRequest(http.MethodDelete, path, body)
}

// ============================================================================
// Request builders for more complex scenarios
// ============================================================================

// Request represents a configurable HTTP request
type Request struct {
	client  *TestClient
	method  string
	path    string
	body    interface{}
	headers map[string]string
	query   map[string]string
}

// NewRequest creates a new request builder
func (c *TestClient) NewRequest(method, path string) *Request {
	return &Request{
		client:  c,
		method:  method,
		path:    path,
		headers: make(map[string]string),
		query:   make(map[string]string),
	}
}

// WithBody sets the request body
func (r *Request) WithBody(body interface{}) *Request {
	r.body = body
	return r
}

// WithHeader adds a header to the request
func (r *Request) WithHeader(key, value string) *Request {
	r.headers[key] = value
	return r
}

// WithQuery adds a query parameter
func (r *Request) WithQuery(key, value string) *Request {
	r.query[key] = value
	return r
}

// WithUser sets the user ID for the request
func (r *Request) WithUser(userID uuid.UUID) *Request {
	r.headers["X-Test-User-ID"] = userID.String()
	return r
}

// WithStaff sets the staff ID for the request
func (r *Request) WithStaff(staffID uuid.UUID) *Request {
	r.headers["X-Test-Staff-ID"] = staffID.String()
	return r
}

// Do executes the request
func (r *Request) Do() *TestResponse {
	// Build path with query parameters
	path := r.path
	if len(r.query) > 0 {
		path += "?"
		first := true
		for key, value := range r.query {
			if !first {
				path += "&"
			}
			path += key + "=" + value
			first = false
		}
	}

	req := r.client.buildRequest(r.method, path, r.body)

	// Add request-specific headers
	for key, value := range r.headers {
		req.Header.Set(key, value)
	}

	w := httptest.NewRecorder()
	r.client.Router.ServeHTTP(w, req)
	return &TestResponse{ResponseRecorder: w, T: r.client.T}
}

// ============================================================================
// Utility functions
// ============================================================================

// ParseUUID parses a UUID from an interface (usually from JSON)
func ParseUUID(t *testing.T, v interface{}) uuid.UUID {
	t.Helper()
	str, ok := v.(string)
	if !ok {
		t.Fatalf("Expected string UUID, got %T", v)
	}
	id, err := uuid.Parse(str)
	require.NoError(t, err, "Failed to parse UUID: %s", str)
	return id
}

// JSONEncode encodes an interface to JSON
func JSONEncode(t *testing.T, v interface{}) []byte {
	t.Helper()
	data, err := json.Marshal(v)
	require.NoError(t, err)
	return data
}

// JSONDecode decodes JSON into an interface
func JSONDecode(t *testing.T, data []byte, v interface{}) {
	t.Helper()
	err := json.Unmarshal(data, v)
	require.NoError(t, err)
}
