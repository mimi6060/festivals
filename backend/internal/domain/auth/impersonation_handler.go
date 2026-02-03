package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// ImpersonationHandler handles impersonation HTTP requests
type ImpersonationHandler struct {
	service     ImpersonationService
	rbacService RBACService
}

// NewImpersonationHandler creates a new impersonation handler
func NewImpersonationHandler(service ImpersonationService, rbacService RBACService) *ImpersonationHandler {
	return &ImpersonationHandler{
		service:     service,
		rbacService: rbacService,
	}
}

// RegisterRoutes registers impersonation routes
func (h *ImpersonationHandler) RegisterRoutes(rg *gin.RouterGroup) {
	admin := rg.Group("/admin")
	{
		// POST /admin/impersonate/:userId - start impersonation
		admin.POST("/impersonate/:userId", h.StartImpersonation)

		// DELETE /admin/impersonate - end impersonation
		admin.DELETE("/impersonate", h.EndImpersonation)

		// GET /admin/impersonation/active - list active sessions
		admin.GET("/impersonation/active", h.ListActiveSessions)

		// GET /admin/impersonation/current - get current session for admin
		admin.GET("/impersonation/current", h.GetCurrentSession)
	}
}

// StartImpersonation godoc
// @Summary Start impersonating a user
// @Description Allows super admins to impersonate another user for debugging purposes
// @Tags Impersonation
// @Accept json
// @Produce json
// @Param userId path string true "User ID to impersonate"
// @Param body body StartImpersonationRequest false "Optional reason for impersonation"
// @Success 200 {object} ImpersonationSessionResponse
// @Failure 400 {object} map[string]interface{} "Invalid user ID"
// @Failure 403 {object} map[string]interface{} "Not authorized to impersonate"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/admin/impersonate/{userId} [post]
// @Security BearerAuth
func (h *ImpersonationHandler) StartImpersonation(c *gin.Context) {
	// Get admin user ID
	adminIDStr := c.GetString("user_id")
	adminID, err := uuid.Parse(adminIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "Invalid user ID",
			},
		})
		return
	}

	// Parse target user ID from path
	targetUserIDStr := c.Param("userId")
	targetUserID, err := uuid.Parse(targetUserIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_USER_ID",
				"message": "Invalid target user ID format",
			},
		})
		return
	}

	// Parse optional request body for reason
	var req StartImpersonationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		// It's OK if body is empty, reason is optional
		req = StartImpersonationRequest{}
	}
	req.TargetUserID = targetUserID

	// Start impersonation
	session, err := h.service.StartImpersonation(
		c.Request.Context(),
		adminID,
		req,
		c.ClientIP(),
		c.Request.UserAgent(),
	)
	if err != nil {
		switch err {
		case ErrNotSuperAdmin:
			c.JSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"code":    "NOT_SUPER_ADMIN",
					"message": "Only super admins can impersonate users",
				},
			})
		case ErrCannotImpersonateSelf:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    "CANNOT_IMPERSONATE_SELF",
					"message": "You cannot impersonate yourself",
				},
			})
		case ErrCannotImpersonateSuperAdmin:
			c.JSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"code":    "CANNOT_IMPERSONATE_SUPER_ADMIN",
					"message": "Cannot impersonate other super admin users",
				},
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{
					"code":    "INTERNAL_ERROR",
					"message": err.Error(),
				},
			})
		}
		return
	}

	// Return session with token
	c.JSON(http.StatusOK, gin.H{"data": session.ToResponse(true)})
}

// EndImpersonation godoc
// @Summary End impersonation session
// @Description Ends the current impersonation session
// @Tags Impersonation
// @Produce json
// @Param X-Impersonation-Token header string true "Impersonation token"
// @Success 200 {object} map[string]interface{} "Session ended"
// @Failure 400 {object} map[string]interface{} "No active impersonation session"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/admin/impersonate [delete]
// @Security BearerAuth
func (h *ImpersonationHandler) EndImpersonation(c *gin.Context) {
	// Get impersonation token from header
	token := c.GetHeader("X-Impersonation-Token")
	if token == "" {
		// Try to get admin's current active session
		adminIDStr := c.GetString("user_id")
		adminID, err := uuid.Parse(adminIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    "NO_ACTIVE_SESSION",
					"message": "No impersonation token provided and could not find active session",
				},
			})
			return
		}

		session, err := h.service.GetActiveSession(c.Request.Context(), adminID)
		if err != nil || session == nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    "NO_ACTIVE_SESSION",
					"message": "No active impersonation session found",
				},
			})
			return
		}
		token = session.Token
	}

	if err := h.service.EndImpersonation(c.Request.Context(), token); err != nil {
		switch err {
		case ErrImpersonationNotFound:
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    "SESSION_NOT_FOUND",
					"message": "Impersonation session not found",
				},
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": gin.H{
					"code":    "INTERNAL_ERROR",
					"message": err.Error(),
				},
			})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"message": "Impersonation session ended successfully",
		},
	})
}

// ListActiveSessions godoc
// @Summary List all active impersonation sessions
// @Description Returns a list of all currently active impersonation sessions (super admin only)
// @Tags Impersonation
// @Produce json
// @Success 200 {array} ImpersonationSessionResponse
// @Failure 403 {object} map[string]interface{} "Not authorized"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/admin/impersonation/active [get]
// @Security BearerAuth
func (h *ImpersonationHandler) ListActiveSessions(c *gin.Context) {
	// Verify caller is super admin
	adminIDStr := c.GetString("user_id")
	adminID, err := uuid.Parse(adminIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "Invalid user ID",
			},
		})
		return
	}

	if !h.rbacService.IsSuperAdmin(c.Request.Context(), adminID) {
		c.JSON(http.StatusForbidden, gin.H{
			"error": gin.H{
				"code":    "NOT_SUPER_ADMIN",
				"message": "Only super admins can view active impersonation sessions",
			},
		})
		return
	}

	sessions, err := h.service.ListActiveSessions(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	// Convert to response (without tokens for security)
	responses := make([]ImpersonationSessionResponse, len(sessions))
	for i, session := range sessions {
		responses[i] = session.ToResponse(false)
	}

	c.JSON(http.StatusOK, gin.H{"data": responses})
}

// GetCurrentSession godoc
// @Summary Get current impersonation session
// @Description Returns the current active impersonation session for the authenticated admin
// @Tags Impersonation
// @Produce json
// @Success 200 {object} ImpersonationSessionResponse
// @Failure 404 {object} map[string]interface{} "No active session"
// @Failure 500 {object} map[string]interface{} "Internal server error"
// @Router /api/v1/admin/impersonation/current [get]
// @Security BearerAuth
func (h *ImpersonationHandler) GetCurrentSession(c *gin.Context) {
	adminIDStr := c.GetString("user_id")
	adminID, err := uuid.Parse(adminIDStr)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "Invalid user ID",
			},
		})
		return
	}

	session, err := h.service.GetActiveSession(c.Request.Context(), adminID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	if session == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": gin.H{
				"code":    "NO_ACTIVE_SESSION",
				"message": "No active impersonation session found",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": session.ToResponse(true)})
}
