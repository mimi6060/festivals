package search

import (
	"time"

	"github.com/google/uuid"
)

// SearchType represents the type of entity being searched
type SearchType string

const (
	SearchTypeAll     SearchType = "all"
	SearchTypeArtist  SearchType = "artist"
	SearchTypeStage   SearchType = "stage"
	SearchTypeStand   SearchType = "stand"
	SearchTypeProduct SearchType = "product"
)

// IsValid checks if the search type is valid
func (t SearchType) IsValid() bool {
	switch t {
	case SearchTypeAll, SearchTypeArtist, SearchTypeStage, SearchTypeStand, SearchTypeProduct:
		return true
	}
	return false
}

// SearchFilters contains the filters for a search query
type SearchFilters struct {
	Query      string     `json:"query" form:"q"`
	Type       SearchType `json:"type" form:"type"`
	FestivalID *uuid.UUID `json:"festivalId,omitempty" form:"festival_id"`
	Category   string     `json:"category,omitempty" form:"category"`
	Page       int        `json:"page" form:"page"`
	PerPage    int        `json:"perPage" form:"per_page"`
}

// Normalize sets default values for filters
func (f *SearchFilters) Normalize() {
	if f.Type == "" {
		f.Type = SearchTypeAll
	}
	if f.Page < 1 {
		f.Page = 1
	}
	if f.PerPage < 1 || f.PerPage > 100 {
		f.PerPage = 20
	}
}

// Offset returns the offset for pagination
func (f *SearchFilters) Offset() int {
	return (f.Page - 1) * f.PerPage
}

// CacheKey generates a unique cache key for the search filters
func (f *SearchFilters) CacheKey() string {
	festivalPart := "global"
	if f.FestivalID != nil {
		festivalPart = f.FestivalID.String()
	}
	return festivalPart + ":" + string(f.Type) + ":" + f.Query + ":" + f.Category
}

// SearchResult represents a single search result
type SearchResult struct {
	ID          uuid.UUID  `json:"id"`
	Type        SearchType `json:"type"`
	Name        string     `json:"name"`
	Description string     `json:"description,omitempty"`
	ImageURL    string     `json:"imageUrl,omitempty"`
	Score       float64    `json:"score"`
	Highlights  []string   `json:"highlights,omitempty"`
	Metadata    ResultMeta `json:"metadata,omitempty"`
}

// ResultMeta contains type-specific metadata for search results
type ResultMeta struct {
	// Artist-specific fields
	Genre string `json:"genre,omitempty"`

	// Stage-specific fields
	Location string `json:"location,omitempty"`
	Capacity int    `json:"capacity,omitempty"`

	// Stand-specific fields
	StandCategory string `json:"standCategory,omitempty"`
	StandStatus   string `json:"standStatus,omitempty"`

	// Product-specific fields
	ProductCategory string `json:"productCategory,omitempty"`
	Price           int64  `json:"price,omitempty"`
	PriceDisplay    string `json:"priceDisplay,omitempty"`
	StandID         string `json:"standId,omitempty"`
	StandName       string `json:"standName,omitempty"`

	// Common fields
	FestivalID   string `json:"festivalId,omitempty"`
	FestivalName string `json:"festivalName,omitempty"`
}

// SearchResponse represents the paginated search response
type SearchResponse struct {
	Query      string         `json:"query"`
	Type       SearchType     `json:"type"`
	Results    []SearchResult `json:"results"`
	Total      int64          `json:"total"`
	Page       int            `json:"page"`
	PerPage    int            `json:"perPage"`
	TotalPages int            `json:"totalPages"`
	Took       int64          `json:"took"` // Time taken in milliseconds
}

// NewSearchResponse creates a new search response
func NewSearchResponse(filters *SearchFilters, results []SearchResult, total int64, took time.Duration) *SearchResponse {
	totalPages := int(total) / filters.PerPage
	if int(total)%filters.PerPage > 0 {
		totalPages++
	}

	return &SearchResponse{
		Query:      filters.Query,
		Type:       filters.Type,
		Results:    results,
		Total:      total,
		Page:       filters.Page,
		PerPage:    filters.PerPage,
		TotalPages: totalPages,
		Took:       took.Milliseconds(),
	}
}

// SearchRequest represents the API request for searching
type SearchRequest struct {
	Query      string `form:"q" binding:"required,min=1,max=100"`
	Type       string `form:"type"`
	FestivalID string `form:"festival_id"`
	Category   string `form:"category"`
	Page       int    `form:"page"`
	PerPage    int    `form:"per_page"`
}

// ToFilters converts the request to SearchFilters
func (r *SearchRequest) ToFilters() (*SearchFilters, error) {
	filters := &SearchFilters{
		Query:    r.Query,
		Type:     SearchType(r.Type),
		Category: r.Category,
		Page:     r.Page,
		PerPage:  r.PerPage,
	}

	if r.FestivalID != "" {
		id, err := uuid.Parse(r.FestivalID)
		if err != nil {
			return nil, err
		}
		filters.FestivalID = &id
	}

	filters.Normalize()

	if !filters.Type.IsValid() {
		filters.Type = SearchTypeAll
	}

	return filters, nil
}

// SearchSuggestion represents a search autocomplete suggestion
type SearchSuggestion struct {
	Text  string     `json:"text"`
	Type  SearchType `json:"type"`
	Count int        `json:"count,omitempty"`
}

// SuggestionsResponse represents the autocomplete suggestions response
type SuggestionsResponse struct {
	Query       string             `json:"query"`
	Suggestions []SearchSuggestion `json:"suggestions"`
}
