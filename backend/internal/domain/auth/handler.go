package auth

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Handler handles RBAC HTTP requests
type Handler struct {
	service RBACService
}

// NewHandler creates a new RBAC handler
func NewHandler(service RBACService) *Handler {
	return &Handler{service: service}
}

// RegisterRoutes registers RBAC routes
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup) {
	rbac := rg.Group("/rbac")
	{
		// Permissions
		rbac.GET("/permissions", h.ListPermissions)
		rbac.GET("/permissions/:resource", h.ListPermissionsByResource)

		// Roles
		rbac.GET("/roles", h.ListRoles)
		rbac.GET("/roles/system", h.ListSystemRoles)
		rbac.GET("/roles/custom", h.ListCustomRoles)
		rbac.GET("/roles/:roleId", h.GetRole)
		rbac.POST("/roles", h.CreateRole)
		rbac.PATCH("/roles/:roleId", h.UpdateRole)
		rbac.DELETE("/roles/:roleId", h.DeleteRole)

		// Role Assignments
		rbac.POST("/role-assignments", h.AssignRole)
		rbac.DELETE("/role-assignments", h.RemoveRole)

		// User permissions
		rbac.GET("/users/:userId/roles", h.GetUserRoles)
		rbac.GET("/users/:userId/permissions", h.GetUserPermissions)
		rbac.GET("/users/:userId/permission-matrix", h.GetPermissionMatrix)
		rbac.POST("/check-permission", h.CheckPermission)

		// Audit logs
		rbac.GET("/audit-logs", h.ListAuditLogs)
	}

	// Festival-scoped role assignments
	festivals := rg.Group("/festivals/:festivalId")
	{
		festivals.GET("/role-assignments", h.ListFestivalRoleAssignments)
	}
}

// ============================================================================
// Permission Handlers
// ============================================================================

// ListPermissions godoc
// @Summary List all permissions
// @Tags RBAC
// @Produce json
// @Success 200 {array} PermissionResponse
// @Router /api/v1/rbac/permissions [get]
func (h *Handler) ListPermissions(c *gin.Context) {
	permissions, err := h.service.ListPermissions(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	responses := make([]PermissionResponse, len(permissions))
	for i, p := range permissions {
		responses[i] = p.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{"data": responses})
}

// ListPermissionsByResource godoc
// @Summary List permissions by resource
// @Tags RBAC
// @Produce json
// @Param resource path string true "Resource name"
// @Success 200 {array} PermissionResponse
// @Router /api/v1/rbac/permissions/{resource} [get]
func (h *Handler) ListPermissionsByResource(c *gin.Context) {
	resourceStr := c.Param("resource")
	resource := Resource(resourceStr)

	permissions, err := h.service.ListPermissionsByResource(c.Request.Context(), resource)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	responses := make([]PermissionResponse, len(permissions))
	for i, p := range permissions {
		responses[i] = p.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{"data": responses})
}

// ============================================================================
// Role Handlers
// ============================================================================

// ListRoles godoc
// @Summary List roles
// @Tags RBAC
// @Produce json
// @Param festivalId query string false "Festival ID for scoped roles"
// @Success 200 {array} RoleResponse
// @Router /api/v1/rbac/roles [get]
func (h *Handler) ListRoles(c *gin.Context) {
	var festivalID *uuid.UUID
	if fid := c.Query("festivalId"); fid != "" {
		id, err := uuid.Parse(fid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    "INVALID_FESTIVAL_ID",
					"message": "Invalid festival ID format",
				},
			})
			return
		}
		festivalID = &id
	}

	roles, err := h.service.ListRoles(c.Request.Context(), festivalID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	responses := make([]RoleResponse, len(roles))
	for i, r := range roles {
		responses[i] = r.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{"data": responses})
}

// ListSystemRoles godoc
// @Summary List system roles
// @Tags RBAC
// @Produce json
// @Success 200 {array} RoleResponse
// @Router /api/v1/rbac/roles/system [get]
func (h *Handler) ListSystemRoles(c *gin.Context) {
	roles, err := h.service.ListSystemRoles(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	responses := make([]RoleResponse, len(roles))
	for i, r := range roles {
		responses[i] = r.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{"data": responses})
}

// ListCustomRoles godoc
// @Summary List custom roles for a festival
// @Tags RBAC
// @Produce json
// @Param festivalId query string true "Festival ID"
// @Success 200 {array} RoleResponse
// @Router /api/v1/rbac/roles/custom [get]
func (h *Handler) ListCustomRoles(c *gin.Context) {
	fid := c.Query("festivalId")
	if fid == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "MISSING_FESTIVAL_ID",
				"message": "Festival ID is required",
			},
		})
		return
	}

	festivalID, err := uuid.Parse(fid)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_FESTIVAL_ID",
				"message": "Invalid festival ID format",
			},
		})
		return
	}

	roles, err := h.service.ListCustomRoles(c.Request.Context(), festivalID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	responses := make([]RoleResponse, len(roles))
	for i, r := range roles {
		responses[i] = r.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{"data": responses})
}

// GetRole godoc
// @Summary Get role by ID
// @Tags RBAC
// @Produce json
// @Param roleId path string true "Role ID"
// @Success 200 {object} RoleResponse
// @Router /api/v1/rbac/roles/{roleId} [get]
func (h *Handler) GetRole(c *gin.Context) {
	roleID, err := uuid.Parse(c.Param("roleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_ROLE_ID",
				"message": "Invalid role ID format",
			},
		})
		return
	}

	role, err := h.service.GetRole(c.Request.Context(), roleID)
	if err != nil {
		if err == ErrRoleNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    "ROLE_NOT_FOUND",
					"message": "Role not found",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": role.ToResponse()})
}

// CreateRole godoc
// @Summary Create a new role
// @Tags RBAC
// @Accept json
// @Produce json
// @Param role body CreateRoleRequest true "Role data"
// @Success 201 {object} RoleResponse
// @Router /api/v1/rbac/roles [post]
func (h *Handler) CreateRole(c *gin.Context) {
	var req CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": err.Error(),
			},
		})
		return
	}

	actorID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "Invalid user ID",
			},
		})
		return
	}

	role, err := h.service.CreateRole(c.Request.Context(), actorID, req)
	if err != nil {
		if err == ErrRoleAlreadyExists {
			c.JSON(http.StatusConflict, gin.H{
				"error": gin.H{
					"code":    "ROLE_EXISTS",
					"message": "Role with this name already exists",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": role.ToResponse()})
}

// UpdateRole godoc
// @Summary Update a role
// @Tags RBAC
// @Accept json
// @Produce json
// @Param roleId path string true "Role ID"
// @Param role body UpdateRoleRequest true "Role data"
// @Success 200 {object} RoleResponse
// @Router /api/v1/rbac/roles/{roleId} [patch]
func (h *Handler) UpdateRole(c *gin.Context) {
	roleID, err := uuid.Parse(c.Param("roleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_ROLE_ID",
				"message": "Invalid role ID format",
			},
		})
		return
	}

	var req UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": err.Error(),
			},
		})
		return
	}

	actorID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "Invalid user ID",
			},
		})
		return
	}

	role, err := h.service.UpdateRole(c.Request.Context(), actorID, roleID, req)
	if err != nil {
		switch err {
		case ErrRoleNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    "ROLE_NOT_FOUND",
					"message": "Role not found",
				},
			})
		case ErrCannotModifySystemRole:
			c.JSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"code":    "CANNOT_MODIFY_SYSTEM_ROLE",
					"message": "Cannot modify system role permissions",
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

	c.JSON(http.StatusOK, gin.H{"data": role.ToResponse()})
}

// DeleteRole godoc
// @Summary Delete a role
// @Tags RBAC
// @Param roleId path string true "Role ID"
// @Success 204
// @Router /api/v1/rbac/roles/{roleId} [delete]
func (h *Handler) DeleteRole(c *gin.Context) {
	roleID, err := uuid.Parse(c.Param("roleId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_ROLE_ID",
				"message": "Invalid role ID format",
			},
		})
		return
	}

	actorID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "Invalid user ID",
			},
		})
		return
	}

	err = h.service.DeleteRole(c.Request.Context(), actorID, roleID)
	if err != nil {
		switch err {
		case ErrRoleNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    "ROLE_NOT_FOUND",
					"message": "Role not found",
				},
			})
		case ErrCannotDeleteSystemRole:
			c.JSON(http.StatusForbidden, gin.H{
				"error": gin.H{
					"code":    "CANNOT_DELETE_SYSTEM_ROLE",
					"message": "Cannot delete system role",
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

	c.Status(http.StatusNoContent)
}

// ============================================================================
// Role Assignment Handlers
// ============================================================================

// AssignRole godoc
// @Summary Assign a role to a user
// @Tags RBAC
// @Accept json
// @Produce json
// @Param assignment body AssignRoleRequest true "Assignment data"
// @Success 201 {object} RoleAssignmentResponse
// @Router /api/v1/rbac/role-assignments [post]
func (h *Handler) AssignRole(c *gin.Context) {
	var req AssignRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": err.Error(),
			},
		})
		return
	}

	actorID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "Invalid user ID",
			},
		})
		return
	}

	assignment, err := h.service.AssignRole(c.Request.Context(), actorID, req)
	if err != nil {
		switch err {
		case ErrRoleNotFound:
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    "ROLE_NOT_FOUND",
					"message": "Role not found",
				},
			})
		case ErrAssignmentAlreadyExists:
			c.JSON(http.StatusConflict, gin.H{
				"error": gin.H{
					"code":    "ASSIGNMENT_EXISTS",
					"message": "User already has this role",
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

	c.JSON(http.StatusCreated, gin.H{"data": assignment.ToResponse()})
}

// RemoveRole godoc
// @Summary Remove a role from a user
// @Tags RBAC
// @Accept json
// @Param removal body RemoveRoleRequest true "Removal data"
// @Success 204
// @Router /api/v1/rbac/role-assignments [delete]
func (h *Handler) RemoveRole(c *gin.Context) {
	var req RemoveRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": err.Error(),
			},
		})
		return
	}

	actorID, err := uuid.Parse(c.GetString("user_id"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": gin.H{
				"code":    "UNAUTHORIZED",
				"message": "Invalid user ID",
			},
		})
		return
	}

	err = h.service.RemoveRole(c.Request.Context(), actorID, req)
	if err != nil {
		if err == ErrAssignmentNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": gin.H{
					"code":    "ASSIGNMENT_NOT_FOUND",
					"message": "Role assignment not found",
				},
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.Status(http.StatusNoContent)
}

// ListFestivalRoleAssignments godoc
// @Summary List role assignments for a festival
// @Tags RBAC
// @Produce json
// @Param festivalId path string true "Festival ID"
// @Success 200 {array} RoleAssignmentResponse
// @Router /api/v1/festivals/{festivalId}/role-assignments [get]
func (h *Handler) ListFestivalRoleAssignments(c *gin.Context) {
	festivalID, err := uuid.Parse(c.Param("festivalId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_FESTIVAL_ID",
				"message": "Invalid festival ID format",
			},
		})
		return
	}

	assignments, err := h.service.ListFestivalRoleAssignments(c.Request.Context(), festivalID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	responses := make([]RoleAssignmentResponse, len(assignments))
	for i, a := range assignments {
		responses[i] = a.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{"data": responses})
}

// ============================================================================
// User Permission Handlers
// ============================================================================

// GetUserRoles godoc
// @Summary Get user's roles
// @Tags RBAC
// @Produce json
// @Param userId path string true "User ID"
// @Param festivalId query string false "Festival ID for scoped roles"
// @Success 200 {array} RoleResponse
// @Router /api/v1/rbac/users/{userId}/roles [get]
func (h *Handler) GetUserRoles(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_USER_ID",
				"message": "Invalid user ID format",
			},
		})
		return
	}

	var festivalID *uuid.UUID
	if fid := c.Query("festivalId"); fid != "" {
		id, err := uuid.Parse(fid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    "INVALID_FESTIVAL_ID",
					"message": "Invalid festival ID format",
				},
			})
			return
		}
		festivalID = &id
	}

	roles, err := h.service.GetUserRoles(c.Request.Context(), userID, festivalID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	responses := make([]RoleResponse, len(roles))
	for i, r := range roles {
		responses[i] = r.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{"data": responses})
}

// GetUserPermissions godoc
// @Summary Get user's permissions
// @Tags RBAC
// @Produce json
// @Param userId path string true "User ID"
// @Param festivalId query string false "Festival ID for scoped permissions"
// @Success 200 {object} UserPermissionsResponse
// @Router /api/v1/rbac/users/{userId}/permissions [get]
func (h *Handler) GetUserPermissions(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_USER_ID",
				"message": "Invalid user ID format",
			},
		})
		return
	}

	var festivalID *uuid.UUID
	if fid := c.Query("festivalId"); fid != "" {
		id, err := uuid.Parse(fid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    "INVALID_FESTIVAL_ID",
					"message": "Invalid festival ID format",
				},
			})
			return
		}
		festivalID = &id
	}

	permissions, err := h.service.GetUserPermissions(c.Request.Context(), userID, festivalID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": permissions})
}

// GetPermissionMatrix godoc
// @Summary Get user's permission matrix
// @Tags RBAC
// @Produce json
// @Param userId path string true "User ID"
// @Param festivalId query string false "Festival ID for scoped permissions"
// @Success 200 {object} PermissionMatrixResponse
// @Router /api/v1/rbac/users/{userId}/permission-matrix [get]
func (h *Handler) GetPermissionMatrix(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_USER_ID",
				"message": "Invalid user ID format",
			},
		})
		return
	}

	var festivalID *uuid.UUID
	if fid := c.Query("festivalId"); fid != "" {
		id, err := uuid.Parse(fid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": gin.H{
					"code":    "INVALID_FESTIVAL_ID",
					"message": "Invalid festival ID format",
				},
			})
			return
		}
		festivalID = &id
	}

	matrix, err := h.service.GetPermissionMatrix(c.Request.Context(), userID, festivalID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": matrix})
}

// CheckPermission godoc
// @Summary Check if user has a specific permission
// @Tags RBAC
// @Accept json
// @Produce json
// @Param check body CheckPermissionRequest true "Permission check data"
// @Success 200 {object} map[string]bool
// @Router /api/v1/rbac/check-permission [post]
func (h *Handler) CheckPermission(c *gin.Context) {
	var req CheckPermissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": err.Error(),
			},
		})
		return
	}

	allowed := h.service.HasPermission(c.Request.Context(), req.UserID, req.Resource, req.Action, req.FestivalID)

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"allowed": allowed}})
}

// ============================================================================
// Audit Log Handlers
// ============================================================================

// ListAuditLogs godoc
// @Summary List RBAC audit logs
// @Tags RBAC
// @Produce json
// @Param festivalId query string false "Festival ID"
// @Param actorId query string false "Actor ID"
// @Param targetUserId query string false "Target User ID"
// @Param action query string false "Action type"
// @Param startDate query string false "Start date (RFC3339)"
// @Param endDate query string false "End date (RFC3339)"
// @Param offset query int false "Offset for pagination" default(0)
// @Param limit query int false "Limit for pagination" default(50)
// @Success 200 {object} map[string]interface{}
// @Router /api/v1/rbac/audit-logs [get]
func (h *Handler) ListAuditLogs(c *gin.Context) {
	var filter AuditLogFilter

	if fid := c.Query("festivalId"); fid != "" {
		id, _ := uuid.Parse(fid)
		filter.FestivalID = &id
	}
	if aid := c.Query("actorId"); aid != "" {
		id, _ := uuid.Parse(aid)
		filter.ActorID = &id
	}
	if tuid := c.Query("targetUserId"); tuid != "" {
		id, _ := uuid.Parse(tuid)
		filter.TargetUserID = &id
	}
	if action := c.Query("action"); action != "" {
		a := AuditAction(action)
		filter.Action = &a
	}

	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	logs, total, err := h.service.ListAuditLogs(c.Request.Context(), filter, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": err.Error(),
			},
		})
		return
	}

	responses := make([]AuditLogResponse, len(logs))
	for i, l := range logs {
		responses[i] = l.ToResponse()
	}

	c.JSON(http.StatusOK, gin.H{
		"data": gin.H{
			"logs":   responses,
			"total":  total,
			"offset": offset,
			"limit":  limit,
		},
	})
}
