package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupTestRouter() *gin.Engine {
	router := gin.New()
	return router
}

// TestOK tests the OK response function
func TestOK(t *testing.T) {
	tests := []struct {
		name         string
		data         interface{}
		expectedCode int
	}{
		{
			name:         "simple data",
			data:         map[string]string{"message": "success"},
			expectedCode: http.StatusOK,
		},
		{
			name:         "nil data",
			data:         nil,
			expectedCode: http.StatusOK,
		},
		{
			name: "struct data",
			data: struct {
				ID   int    `json:"id"`
				Name string `json:"name"`
			}{ID: 1, Name: "test"},
			expectedCode: http.StatusOK,
		},
		{
			name:         "slice data",
			data:         []int{1, 2, 3},
			expectedCode: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupTestRouter()
			router.GET("/test", func(c *gin.Context) {
				OK(c, tt.data)
			})

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedCode, w.Code)

			var resp Response
			err := json.Unmarshal(w.Body.Bytes(), &resp)
			assert.NoError(t, err)
			assert.Nil(t, resp.Meta)
		})
	}
}

// TestOKWithMeta tests the OKWithMeta response function
func TestOKWithMeta(t *testing.T) {
	tests := []struct {
		name         string
		data         interface{}
		meta         *Meta
		expectedCode int
	}{
		{
			name: "with pagination meta",
			data: []string{"item1", "item2"},
			meta: &Meta{
				Total:   100,
				Page:    1,
				PerPage: 20,
			},
			expectedCode: http.StatusOK,
		},
		{
			name:         "with nil meta",
			data:         []string{"item1"},
			meta:         nil,
			expectedCode: http.StatusOK,
		},
		{
			name: "with partial meta",
			data: []string{"item1"},
			meta: &Meta{
				Total: 50,
			},
			expectedCode: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupTestRouter()
			router.GET("/test", func(c *gin.Context) {
				OKWithMeta(c, tt.data, tt.meta)
			})

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedCode, w.Code)

			var resp Response
			err := json.Unmarshal(w.Body.Bytes(), &resp)
			assert.NoError(t, err)

			if tt.meta != nil {
				assert.NotNil(t, resp.Meta)
				assert.Equal(t, tt.meta.Total, resp.Meta.Total)
				assert.Equal(t, tt.meta.Page, resp.Meta.Page)
				assert.Equal(t, tt.meta.PerPage, resp.Meta.PerPage)
			}
		})
	}
}

// TestCreated tests the Created response function
func TestCreated(t *testing.T) {
	router := setupTestRouter()
	router.POST("/test", func(c *gin.Context) {
		Created(c, map[string]interface{}{
			"id":   123,
			"name": "New Resource",
		})
	})

	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp Response
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.NotNil(t, resp.Data)
}

// TestNoContent tests the NoContent response function
func TestNoContent(t *testing.T) {
	router := setupTestRouter()
	router.DELETE("/test", func(c *gin.Context) {
		NoContent(c)
	})

	req := httptest.NewRequest(http.MethodDelete, "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNoContent, w.Code)
	assert.Empty(t, w.Body.String())
}

// TestBadRequest tests the BadRequest response function
func TestBadRequest(t *testing.T) {
	tests := []struct {
		name         string
		code         string
		message      string
		details      interface{}
		expectedCode int
	}{
		{
			name:         "validation error with details",
			code:         "VALIDATION_ERROR",
			message:      "Invalid input",
			details:      map[string]string{"field": "name", "error": "required"},
			expectedCode: http.StatusBadRequest,
		},
		{
			name:         "simple bad request",
			code:         "INVALID_REQUEST",
			message:      "Request could not be processed",
			details:      nil,
			expectedCode: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupTestRouter()
			router.POST("/test", func(c *gin.Context) {
				BadRequest(c, tt.code, tt.message, tt.details)
			})

			req := httptest.NewRequest(http.MethodPost, "/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedCode, w.Code)

			var resp ErrorResponse
			err := json.Unmarshal(w.Body.Bytes(), &resp)
			assert.NoError(t, err)
			assert.Equal(t, tt.code, resp.Error.Code)
			assert.Equal(t, tt.message, resp.Error.Message)
		})
	}
}

// TestUnauthorized tests the Unauthorized response function
func TestUnauthorized(t *testing.T) {
	router := setupTestRouter()
	router.GET("/test", func(c *gin.Context) {
		Unauthorized(c, "Authentication required")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Equal(t, "UNAUTHORIZED", resp.Error.Code)
	assert.Equal(t, "Authentication required", resp.Error.Message)
}

// TestForbidden tests the Forbidden response function
func TestForbidden(t *testing.T) {
	router := setupTestRouter()
	router.GET("/test", func(c *gin.Context) {
		Forbidden(c, "Access denied")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Equal(t, "FORBIDDEN", resp.Error.Code)
	assert.Equal(t, "Access denied", resp.Error.Message)
}

// TestNotFound tests the NotFound response function
func TestNotFound(t *testing.T) {
	router := setupTestRouter()
	router.GET("/test", func(c *gin.Context) {
		NotFound(c, "Resource not found")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Equal(t, "NOT_FOUND", resp.Error.Code)
	assert.Equal(t, "Resource not found", resp.Error.Message)
}

// TestConflict tests the Conflict response function
func TestConflict(t *testing.T) {
	router := setupTestRouter()
	router.POST("/test", func(c *gin.Context) {
		Conflict(c, "DUPLICATE_ENTRY", "Resource already exists")
	})

	req := httptest.NewRequest(http.MethodPost, "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusConflict, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Equal(t, "DUPLICATE_ENTRY", resp.Error.Code)
	assert.Equal(t, "Resource already exists", resp.Error.Message)
}

// TestInternalError tests the InternalError response function
func TestInternalError(t *testing.T) {
	router := setupTestRouter()
	router.GET("/test", func(c *gin.Context) {
		InternalError(c, "Something went wrong")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	var resp ErrorResponse
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	assert.NoError(t, err)
	assert.Equal(t, "INTERNAL_ERROR", resp.Error.Code)
	assert.Equal(t, "Something went wrong", resp.Error.Message)
}

// TestResponseStructSerialization tests that Response struct serializes correctly
func TestResponseStructSerialization(t *testing.T) {
	tests := []struct {
		name     string
		response Response
		wantJSON string
	}{
		{
			name: "response with data only",
			response: Response{
				Data: map[string]string{"key": "value"},
			},
			wantJSON: `{"data":{"key":"value"}}`,
		},
		{
			name: "response with data and meta",
			response: Response{
				Data: []int{1, 2, 3},
				Meta: &Meta{Total: 100, Page: 1, PerPage: 20},
			},
			wantJSON: `{"data":[1,2,3],"meta":{"total":100,"page":1,"per_page":20}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.response)
			assert.NoError(t, err)
			assert.JSONEq(t, tt.wantJSON, string(data))
		})
	}
}

// TestErrorResponseStructSerialization tests that ErrorResponse struct serializes correctly
func TestErrorResponseStructSerialization(t *testing.T) {
	tests := []struct {
		name     string
		response ErrorResponse
		wantJSON string
	}{
		{
			name: "error response without details",
			response: ErrorResponse{
				Error: ErrorDetail{
					Code:    "TEST_ERROR",
					Message: "Test error message",
				},
			},
			wantJSON: `{"error":{"code":"TEST_ERROR","message":"Test error message"}}`,
		},
		{
			name: "error response with details",
			response: ErrorResponse{
				Error: ErrorDetail{
					Code:    "VALIDATION_ERROR",
					Message: "Validation failed",
					Details: map[string]string{"field": "email", "error": "invalid format"},
				},
			},
			wantJSON: `{"error":{"code":"VALIDATION_ERROR","message":"Validation failed","details":{"field":"email","error":"invalid format"}}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			data, err := json.Marshal(tt.response)
			assert.NoError(t, err)
			assert.JSONEq(t, tt.wantJSON, string(data))
		})
	}
}

// TestMetaStruct tests Meta struct functionality
func TestMetaStruct(t *testing.T) {
	meta := Meta{
		Total:   1000,
		Page:    5,
		PerPage: 20,
	}

	data, err := json.Marshal(meta)
	assert.NoError(t, err)

	var parsed Meta
	err = json.Unmarshal(data, &parsed)
	assert.NoError(t, err)

	assert.Equal(t, meta.Total, parsed.Total)
	assert.Equal(t, meta.Page, parsed.Page)
	assert.Equal(t, meta.PerPage, parsed.PerPage)
}

// TestAllHTTPStatusCodes tests that all response functions return correct HTTP status codes
func TestAllHTTPStatusCodes(t *testing.T) {
	tests := []struct {
		name           string
		handler        func(c *gin.Context)
		expectedStatus int
	}{
		{
			name:           "OK returns 200",
			handler:        func(c *gin.Context) { OK(c, nil) },
			expectedStatus: http.StatusOK,
		},
		{
			name:           "OKWithMeta returns 200",
			handler:        func(c *gin.Context) { OKWithMeta(c, nil, nil) },
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Created returns 201",
			handler:        func(c *gin.Context) { Created(c, nil) },
			expectedStatus: http.StatusCreated,
		},
		{
			name:           "NoContent returns 204",
			handler:        func(c *gin.Context) { NoContent(c) },
			expectedStatus: http.StatusNoContent,
		},
		{
			name:           "BadRequest returns 400",
			handler:        func(c *gin.Context) { BadRequest(c, "ERR", "msg", nil) },
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Unauthorized returns 401",
			handler:        func(c *gin.Context) { Unauthorized(c, "msg") },
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Forbidden returns 403",
			handler:        func(c *gin.Context) { Forbidden(c, "msg") },
			expectedStatus: http.StatusForbidden,
		},
		{
			name:           "NotFound returns 404",
			handler:        func(c *gin.Context) { NotFound(c, "msg") },
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "Conflict returns 409",
			handler:        func(c *gin.Context) { Conflict(c, "ERR", "msg") },
			expectedStatus: http.StatusConflict,
		},
		{
			name:           "InternalError returns 500",
			handler:        func(c *gin.Context) { InternalError(c, "msg") },
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := setupTestRouter()
			router.GET("/test", tt.handler)

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			assert.Equal(t, tt.expectedStatus, w.Code)
		})
	}
}
