package middleware

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/mimi6060/festivals/backend/internal/infrastructure/database"
	"gorm.io/gorm"
)

func Tenant(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Try to get festival ID from URL param first
		festivalID := c.Param("festivalId")

		// If not in URL, try from JWT claims
		if festivalID == "" {
			festivalID = c.GetString("festival_id")
		}

		if festivalID == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Festival ID required"})
			return
		}

		// Validate festival ID format (UUID)
		if len(festivalID) != 36 {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "Invalid festival ID format"})
			return
		}

		// Set the tenant schema
		tenantDB := database.SetTenantSchema(db, festivalID)

		// Check if schema exists
		var exists bool
		schemaName := fmt.Sprintf("festival_%s", festivalID)
		err := db.Raw("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = ?)", schemaName).Scan(&exists).Error
		if err != nil || !exists {
			c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "Festival not found"})
			return
		}

		// Store tenant DB in context
		c.Set("db", tenantDB)
		c.Set("festival_id", festivalID)

		c.Next()
	}
}

// GetTenantDB extracts the tenant-scoped database from context
func GetTenantDB(c *gin.Context) *gorm.DB {
	if db, exists := c.Get("db"); exists {
		return db.(*gorm.DB)
	}
	return nil
}
