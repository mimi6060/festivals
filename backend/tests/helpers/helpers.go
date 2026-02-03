// Package helpers provides test utilities and fixtures for integration testing.
// This file maintains backward compatibility with existing tests.
// For new tests, prefer using the functions directly from fixtures.go.
package helpers

// This file is kept for backward compatibility.
// All helper functions have been moved to:
// - db.go: Database setup utilities with testcontainers
// - fixtures.go: Test data factories for all domain entities
// - api.go: HTTP test client utilities
//
// The FestivalOptions type and CreateTestFestival function are defined in fixtures.go.
// The StringPtr, Float64Ptr, TimePtr helper functions are also in fixtures.go.
// All existing code that imports helpers will continue to work.
