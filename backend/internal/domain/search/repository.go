package search

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Repository defines the interface for search operations
type Repository interface {
	// SearchArtists searches artists using full-text search
	SearchArtists(ctx context.Context, query string, festivalID *uuid.UUID, offset, limit int) ([]SearchResult, int64, error)

	// SearchStages searches stages using full-text search
	SearchStages(ctx context.Context, query string, festivalID *uuid.UUID, offset, limit int) ([]SearchResult, int64, error)

	// SearchStands searches stands using full-text search
	SearchStands(ctx context.Context, query string, festivalID *uuid.UUID, category string, offset, limit int) ([]SearchResult, int64, error)

	// SearchProducts searches products using full-text search
	SearchProducts(ctx context.Context, query string, festivalID *uuid.UUID, category string, offset, limit int) ([]SearchResult, int64, error)

	// SearchAll performs a global search across all entity types
	SearchAll(ctx context.Context, query string, festivalID *uuid.UUID, offset, limit int) ([]SearchResult, int64, error)

	// GetSuggestions returns search suggestions based on partial query
	GetSuggestions(ctx context.Context, query string, festivalID *uuid.UUID, limit int) ([]SearchSuggestion, error)
}

type repository struct {
	db *gorm.DB
}

// NewRepository creates a new search repository
func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

// SearchArtists searches artists using PostgreSQL full-text search
func (r *repository) SearchArtists(ctx context.Context, query string, festivalID *uuid.UUID, offset, limit int) ([]SearchResult, int64, error) {
	var results []SearchResult
	var total int64

	// Build the base query with full-text search
	baseQuery := `
		SELECT
			a.id,
			a.name,
			COALESCE(a.bio, '') as description,
			COALESCE(a.image_url, '') as image_url,
			COALESCE(a.genre, '') as genre,
			ts_rank(
				setweight(to_tsvector('english', COALESCE(a.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(a.genre, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(a.bio, '')), 'C'),
				plainto_tsquery('english', ?)
			) as score
		FROM artists a
	`

	countQuery := `
		SELECT COUNT(*)
		FROM artists a
		WHERE (
			setweight(to_tsvector('english', COALESCE(a.name, '')), 'A') ||
			setweight(to_tsvector('english', COALESCE(a.genre, '')), 'B') ||
			setweight(to_tsvector('english', COALESCE(a.bio, '')), 'C')
		) @@ plainto_tsquery('english', ?)
	`

	whereClause := `
		WHERE (
			setweight(to_tsvector('english', COALESCE(a.name, '')), 'A') ||
			setweight(to_tsvector('english', COALESCE(a.genre, '')), 'B') ||
			setweight(to_tsvector('english', COALESCE(a.bio, '')), 'C')
		) @@ plainto_tsquery('english', ?)
	`

	// Add festival filter if provided (artists linked via performances)
	if festivalID != nil {
		whereClause += ` AND EXISTS (SELECT 1 FROM performances p WHERE p.artist_id = a.id AND p.festival_id = ?)`
		countQuery += ` AND EXISTS (SELECT 1 FROM performances p WHERE p.artist_id = a.id AND p.festival_id = ?)`
	}

	orderClause := ` ORDER BY score DESC, a.name ASC LIMIT ? OFFSET ?`

	// Execute count query
	args := []interface{}{query}
	if festivalID != nil {
		args = append(args, *festivalID)
	}
	if err := r.db.WithContext(ctx).Raw(countQuery, args...).Scan(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count artists: %w", err)
	}

	// Execute search query
	fullQuery := baseQuery + whereClause + orderClause
	args = []interface{}{query, query}
	if festivalID != nil {
		args = append(args, *festivalID)
	}
	args = append(args, limit, offset)

	rows, err := r.db.WithContext(ctx).Raw(fullQuery, args...).Rows()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search artists: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		var name, description, imageURL, genre string
		var score float64

		if err := rows.Scan(&id, &name, &description, &imageURL, &genre, &score); err != nil {
			return nil, 0, fmt.Errorf("failed to scan artist: %w", err)
		}

		results = append(results, SearchResult{
			ID:          id,
			Type:        SearchTypeArtist,
			Name:        name,
			Description: description,
			ImageURL:    imageURL,
			Score:       score,
			Metadata: ResultMeta{
				Genre: genre,
			},
		})
	}

	return results, total, nil
}

// SearchStages searches stages using PostgreSQL full-text search
func (r *repository) SearchStages(ctx context.Context, query string, festivalID *uuid.UUID, offset, limit int) ([]SearchResult, int64, error) {
	var results []SearchResult
	var total int64

	baseQuery := `
		SELECT
			s.id,
			s.name,
			COALESCE(s.description, '') as description,
			COALESCE(s.image_url, '') as image_url,
			COALESCE(s.location, '') as location,
			COALESCE(s.capacity, 0) as capacity,
			s.festival_id::text as festival_id,
			ts_rank(
				setweight(to_tsvector('english', COALESCE(s.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(s.description, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(s.location, '')), 'C'),
				plainto_tsquery('english', ?)
			) as score
		FROM stages s
	`

	whereClause := `
		WHERE s.status = 'ACTIVE' AND (
			setweight(to_tsvector('english', COALESCE(s.name, '')), 'A') ||
			setweight(to_tsvector('english', COALESCE(s.description, '')), 'B') ||
			setweight(to_tsvector('english', COALESCE(s.location, '')), 'C')
		) @@ plainto_tsquery('english', ?)
	`

	countQuery := `
		SELECT COUNT(*)
		FROM stages s
		WHERE s.status = 'ACTIVE' AND (
			setweight(to_tsvector('english', COALESCE(s.name, '')), 'A') ||
			setweight(to_tsvector('english', COALESCE(s.description, '')), 'B') ||
			setweight(to_tsvector('english', COALESCE(s.location, '')), 'C')
		) @@ plainto_tsquery('english', ?)
	`

	if festivalID != nil {
		whereClause += ` AND s.festival_id = ?`
		countQuery += ` AND s.festival_id = ?`
	}

	orderClause := ` ORDER BY score DESC, s.name ASC LIMIT ? OFFSET ?`

	// Execute count query
	args := []interface{}{query}
	if festivalID != nil {
		args = append(args, *festivalID)
	}
	if err := r.db.WithContext(ctx).Raw(countQuery, args...).Scan(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count stages: %w", err)
	}

	// Execute search query
	fullQuery := baseQuery + whereClause + orderClause
	args = []interface{}{query, query}
	if festivalID != nil {
		args = append(args, *festivalID)
	}
	args = append(args, limit, offset)

	rows, err := r.db.WithContext(ctx).Raw(fullQuery, args...).Rows()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search stages: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		var name, description, imageURL, location, festivalIDStr string
		var capacity int
		var score float64

		if err := rows.Scan(&id, &name, &description, &imageURL, &location, &capacity, &festivalIDStr, &score); err != nil {
			return nil, 0, fmt.Errorf("failed to scan stage: %w", err)
		}

		results = append(results, SearchResult{
			ID:          id,
			Type:        SearchTypeStage,
			Name:        name,
			Description: description,
			ImageURL:    imageURL,
			Score:       score,
			Metadata: ResultMeta{
				Location:   location,
				Capacity:   capacity,
				FestivalID: festivalIDStr,
			},
		})
	}

	return results, total, nil
}

// SearchStands searches stands using PostgreSQL full-text search
func (r *repository) SearchStands(ctx context.Context, query string, festivalID *uuid.UUID, category string, offset, limit int) ([]SearchResult, int64, error) {
	var results []SearchResult
	var total int64

	baseQuery := `
		SELECT
			s.id,
			s.name,
			COALESCE(s.description, '') as description,
			COALESCE(s.image_url, '') as image_url,
			COALESCE(s.location, '') as location,
			s.category,
			s.status,
			s.festival_id::text as festival_id,
			ts_rank(
				setweight(to_tsvector('english', COALESCE(s.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(s.description, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(s.location, '')), 'C') ||
				setweight(to_tsvector('english', COALESCE(s.category, '')), 'D'),
				plainto_tsquery('english', ?)
			) as score
		FROM stands s
	`

	whereClause := `
		WHERE s.status = 'ACTIVE' AND (
			setweight(to_tsvector('english', COALESCE(s.name, '')), 'A') ||
			setweight(to_tsvector('english', COALESCE(s.description, '')), 'B') ||
			setweight(to_tsvector('english', COALESCE(s.location, '')), 'C') ||
			setweight(to_tsvector('english', COALESCE(s.category, '')), 'D')
		) @@ plainto_tsquery('english', ?)
	`

	countQuery := `
		SELECT COUNT(*)
		FROM stands s
		WHERE s.status = 'ACTIVE' AND (
			setweight(to_tsvector('english', COALESCE(s.name, '')), 'A') ||
			setweight(to_tsvector('english', COALESCE(s.description, '')), 'B') ||
			setweight(to_tsvector('english', COALESCE(s.location, '')), 'C') ||
			setweight(to_tsvector('english', COALESCE(s.category, '')), 'D')
		) @@ plainto_tsquery('english', ?)
	`

	if festivalID != nil {
		whereClause += ` AND s.festival_id = ?`
		countQuery += ` AND s.festival_id = ?`
	}

	if category != "" {
		whereClause += ` AND s.category = ?`
		countQuery += ` AND s.category = ?`
	}

	orderClause := ` ORDER BY score DESC, s.name ASC LIMIT ? OFFSET ?`

	// Execute count query
	args := []interface{}{query}
	if festivalID != nil {
		args = append(args, *festivalID)
	}
	if category != "" {
		args = append(args, category)
	}
	if err := r.db.WithContext(ctx).Raw(countQuery, args...).Scan(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count stands: %w", err)
	}

	// Execute search query
	fullQuery := baseQuery + whereClause + orderClause
	args = []interface{}{query, query}
	if festivalID != nil {
		args = append(args, *festivalID)
	}
	if category != "" {
		args = append(args, category)
	}
	args = append(args, limit, offset)

	rows, err := r.db.WithContext(ctx).Raw(fullQuery, args...).Rows()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search stands: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		var name, description, imageURL, location, standCategory, status, festivalIDStr string
		var score float64

		if err := rows.Scan(&id, &name, &description, &imageURL, &location, &standCategory, &status, &festivalIDStr, &score); err != nil {
			return nil, 0, fmt.Errorf("failed to scan stand: %w", err)
		}

		results = append(results, SearchResult{
			ID:          id,
			Type:        SearchTypeStand,
			Name:        name,
			Description: description,
			ImageURL:    imageURL,
			Score:       score,
			Metadata: ResultMeta{
				Location:      location,
				StandCategory: standCategory,
				StandStatus:   status,
				FestivalID:    festivalIDStr,
			},
		})
	}

	return results, total, nil
}

// SearchProducts searches products using PostgreSQL full-text search
func (r *repository) SearchProducts(ctx context.Context, query string, festivalID *uuid.UUID, category string, offset, limit int) ([]SearchResult, int64, error) {
	var results []SearchResult
	var total int64

	baseQuery := `
		SELECT
			p.id,
			p.name,
			COALESCE(p.description, '') as description,
			COALESCE(p.image_url, '') as image_url,
			p.category,
			p.price,
			p.stand_id::text as stand_id,
			COALESCE(s.name, '') as stand_name,
			s.festival_id::text as festival_id,
			ts_rank(
				setweight(to_tsvector('english', COALESCE(p.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(p.description, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(p.category, '')), 'C'),
				plainto_tsquery('english', ?)
			) as score
		FROM products p
		INNER JOIN stands s ON p.stand_id = s.id
	`

	whereClause := `
		WHERE p.status = 'ACTIVE' AND s.status = 'ACTIVE' AND (
			setweight(to_tsvector('english', COALESCE(p.name, '')), 'A') ||
			setweight(to_tsvector('english', COALESCE(p.description, '')), 'B') ||
			setweight(to_tsvector('english', COALESCE(p.category, '')), 'C')
		) @@ plainto_tsquery('english', ?)
	`

	countQuery := `
		SELECT COUNT(*)
		FROM products p
		INNER JOIN stands s ON p.stand_id = s.id
		WHERE p.status = 'ACTIVE' AND s.status = 'ACTIVE' AND (
			setweight(to_tsvector('english', COALESCE(p.name, '')), 'A') ||
			setweight(to_tsvector('english', COALESCE(p.description, '')), 'B') ||
			setweight(to_tsvector('english', COALESCE(p.category, '')), 'C')
		) @@ plainto_tsquery('english', ?)
	`

	if festivalID != nil {
		whereClause += ` AND s.festival_id = ?`
		countQuery += ` AND s.festival_id = ?`
	}

	if category != "" {
		whereClause += ` AND p.category = ?`
		countQuery += ` AND p.category = ?`
	}

	orderClause := ` ORDER BY score DESC, p.name ASC LIMIT ? OFFSET ?`

	// Execute count query
	args := []interface{}{query}
	if festivalID != nil {
		args = append(args, *festivalID)
	}
	if category != "" {
		args = append(args, category)
	}
	if err := r.db.WithContext(ctx).Raw(countQuery, args...).Scan(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count products: %w", err)
	}

	// Execute search query
	fullQuery := baseQuery + whereClause + orderClause
	args = []interface{}{query, query}
	if festivalID != nil {
		args = append(args, *festivalID)
	}
	if category != "" {
		args = append(args, category)
	}
	args = append(args, limit, offset)

	rows, err := r.db.WithContext(ctx).Raw(fullQuery, args...).Rows()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search products: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		var name, description, imageURL, productCategory, standID, standName, festivalIDStr string
		var price int64
		var score float64

		if err := rows.Scan(&id, &name, &description, &imageURL, &productCategory, &price, &standID, &standName, &festivalIDStr, &score); err != nil {
			return nil, 0, fmt.Errorf("failed to scan product: %w", err)
		}

		results = append(results, SearchResult{
			ID:          id,
			Type:        SearchTypeProduct,
			Name:        name,
			Description: description,
			ImageURL:    imageURL,
			Score:       score,
			Metadata: ResultMeta{
				ProductCategory: productCategory,
				Price:           price,
				PriceDisplay:    formatPrice(price),
				StandID:         standID,
				StandName:       standName,
				FestivalID:      festivalIDStr,
			},
		})
	}

	return results, total, nil
}

// SearchAll performs a global search across all entity types using a UNION query
func (r *repository) SearchAll(ctx context.Context, query string, festivalID *uuid.UUID, offset, limit int) ([]SearchResult, int64, error) {
	var results []SearchResult
	var total int64

	// Union query for all entity types
	unionQuery := `
		WITH search_results AS (
			-- Artists
			SELECT
				a.id,
				'artist' as type,
				a.name,
				COALESCE(a.bio, '') as description,
				COALESCE(a.image_url, '') as image_url,
				COALESCE(a.genre, '') as meta1,
				'' as meta2,
				'' as meta3,
				0::bigint as meta_int,
				''::text as festival_id,
				ts_rank(
					setweight(to_tsvector('english', COALESCE(a.name, '')), 'A') ||
					setweight(to_tsvector('english', COALESCE(a.genre, '')), 'B') ||
					setweight(to_tsvector('english', COALESCE(a.bio, '')), 'C'),
					plainto_tsquery('english', $1)
				) as score
			FROM artists a
			WHERE (
				setweight(to_tsvector('english', COALESCE(a.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(a.genre, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(a.bio, '')), 'C')
			) @@ plainto_tsquery('english', $1)
			%s

			UNION ALL

			-- Stages
			SELECT
				s.id,
				'stage' as type,
				s.name,
				COALESCE(s.description, '') as description,
				COALESCE(s.image_url, '') as image_url,
				COALESCE(s.location, '') as meta1,
				'' as meta2,
				'' as meta3,
				COALESCE(s.capacity, 0)::bigint as meta_int,
				s.festival_id::text as festival_id,
				ts_rank(
					setweight(to_tsvector('english', COALESCE(s.name, '')), 'A') ||
					setweight(to_tsvector('english', COALESCE(s.description, '')), 'B') ||
					setweight(to_tsvector('english', COALESCE(s.location, '')), 'C'),
					plainto_tsquery('english', $1)
				) as score
			FROM stages s
			WHERE s.status = 'ACTIVE' AND (
				setweight(to_tsvector('english', COALESCE(s.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(s.description, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(s.location, '')), 'C')
			) @@ plainto_tsquery('english', $1)
			%s

			UNION ALL

			-- Stands
			SELECT
				st.id,
				'stand' as type,
				st.name,
				COALESCE(st.description, '') as description,
				COALESCE(st.image_url, '') as image_url,
				COALESCE(st.location, '') as meta1,
				st.category as meta2,
				st.status as meta3,
				0::bigint as meta_int,
				st.festival_id::text as festival_id,
				ts_rank(
					setweight(to_tsvector('english', COALESCE(st.name, '')), 'A') ||
					setweight(to_tsvector('english', COALESCE(st.description, '')), 'B') ||
					setweight(to_tsvector('english', COALESCE(st.location, '')), 'C'),
					plainto_tsquery('english', $1)
				) as score
			FROM stands st
			WHERE st.status = 'ACTIVE' AND (
				setweight(to_tsvector('english', COALESCE(st.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(st.description, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(st.location, '')), 'C')
			) @@ plainto_tsquery('english', $1)
			%s

			UNION ALL

			-- Products
			SELECT
				p.id,
				'product' as type,
				p.name,
				COALESCE(p.description, '') as description,
				COALESCE(p.image_url, '') as image_url,
				p.category as meta1,
				p.stand_id::text as meta2,
				COALESCE(stnd.name, '') as meta3,
				p.price as meta_int,
				stnd.festival_id::text as festival_id,
				ts_rank(
					setweight(to_tsvector('english', COALESCE(p.name, '')), 'A') ||
					setweight(to_tsvector('english', COALESCE(p.description, '')), 'B') ||
					setweight(to_tsvector('english', COALESCE(p.category, '')), 'C'),
					plainto_tsquery('english', $1)
				) as score
			FROM products p
			INNER JOIN stands stnd ON p.stand_id = stnd.id
			WHERE p.status = 'ACTIVE' AND stnd.status = 'ACTIVE' AND (
				setweight(to_tsvector('english', COALESCE(p.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(p.description, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(p.category, '')), 'C')
			) @@ plainto_tsquery('english', $1)
			%s
		)
		SELECT * FROM search_results
		ORDER BY score DESC, name ASC
		LIMIT $2 OFFSET $3
	`

	// Add festival filters
	artistFilter := ""
	stageFilter := ""
	standFilter := ""
	productFilter := ""

	if festivalID != nil {
		artistFilter = fmt.Sprintf(`AND EXISTS (SELECT 1 FROM performances perf WHERE perf.artist_id = a.id AND perf.festival_id = '%s')`, festivalID.String())
		stageFilter = fmt.Sprintf(`AND s.festival_id = '%s'`, festivalID.String())
		standFilter = fmt.Sprintf(`AND st.festival_id = '%s'`, festivalID.String())
		productFilter = fmt.Sprintf(`AND stnd.festival_id = '%s'`, festivalID.String())
	}

	finalQuery := fmt.Sprintf(unionQuery, artistFilter, stageFilter, standFilter, productFilter)

	// Count query
	countQuery := `
		WITH search_results AS (
			-- Artists count
			SELECT a.id
			FROM artists a
			WHERE (
				setweight(to_tsvector('english', COALESCE(a.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(a.genre, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(a.bio, '')), 'C')
			) @@ plainto_tsquery('english', $1)
			%s

			UNION ALL

			-- Stages count
			SELECT s.id
			FROM stages s
			WHERE s.status = 'ACTIVE' AND (
				setweight(to_tsvector('english', COALESCE(s.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(s.description, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(s.location, '')), 'C')
			) @@ plainto_tsquery('english', $1)
			%s

			UNION ALL

			-- Stands count
			SELECT st.id
			FROM stands st
			WHERE st.status = 'ACTIVE' AND (
				setweight(to_tsvector('english', COALESCE(st.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(st.description, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(st.location, '')), 'C')
			) @@ plainto_tsquery('english', $1)
			%s

			UNION ALL

			-- Products count
			SELECT p.id
			FROM products p
			INNER JOIN stands stnd ON p.stand_id = stnd.id
			WHERE p.status = 'ACTIVE' AND stnd.status = 'ACTIVE' AND (
				setweight(to_tsvector('english', COALESCE(p.name, '')), 'A') ||
				setweight(to_tsvector('english', COALESCE(p.description, '')), 'B') ||
				setweight(to_tsvector('english', COALESCE(p.category, '')), 'C')
			) @@ plainto_tsquery('english', $1)
			%s
		)
		SELECT COUNT(*) FROM search_results
	`

	finalCountQuery := fmt.Sprintf(countQuery, artistFilter, stageFilter, standFilter, productFilter)

	// Execute count
	if err := r.db.WithContext(ctx).Raw(finalCountQuery, query).Scan(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count search results: %w", err)
	}

	// Execute search
	rows, err := r.db.WithContext(ctx).Raw(finalQuery, query, limit, offset).Rows()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to search all: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var id uuid.UUID
		var entityType, name, description, imageURL, meta1, meta2, meta3, festivalIDStr string
		var metaInt int64
		var score float64

		if err := rows.Scan(&id, &entityType, &name, &description, &imageURL, &meta1, &meta2, &meta3, &metaInt, &festivalIDStr, &score); err != nil {
			return nil, 0, fmt.Errorf("failed to scan result: %w", err)
		}

		result := SearchResult{
			ID:          id,
			Type:        SearchType(entityType),
			Name:        name,
			Description: description,
			ImageURL:    imageURL,
			Score:       score,
		}

		// Set metadata based on type
		switch SearchType(entityType) {
		case SearchTypeArtist:
			result.Metadata = ResultMeta{Genre: meta1}
		case SearchTypeStage:
			result.Metadata = ResultMeta{
				Location:   meta1,
				Capacity:   int(metaInt),
				FestivalID: festivalIDStr,
			}
		case SearchTypeStand:
			result.Metadata = ResultMeta{
				Location:      meta1,
				StandCategory: meta2,
				StandStatus:   meta3,
				FestivalID:    festivalIDStr,
			}
		case SearchTypeProduct:
			result.Metadata = ResultMeta{
				ProductCategory: meta1,
				StandID:         meta2,
				StandName:       meta3,
				Price:           metaInt,
				PriceDisplay:    formatPrice(metaInt),
				FestivalID:      festivalIDStr,
			}
		}

		results = append(results, result)
	}

	return results, total, nil
}

// GetSuggestions returns search suggestions based on partial query
func (r *repository) GetSuggestions(ctx context.Context, query string, festivalID *uuid.UUID, limit int) ([]SearchSuggestion, error) {
	var suggestions []SearchSuggestion

	// Use prefix matching for suggestions
	suggestionQuery := `
		WITH suggestions AS (
			-- Artist suggestions
			SELECT DISTINCT name as text, 'artist' as type
			FROM artists
			WHERE name ILIKE $1 || '%'
			%s

			UNION

			-- Stage suggestions
			SELECT DISTINCT name as text, 'stage' as type
			FROM stages
			WHERE status = 'ACTIVE' AND name ILIKE $1 || '%'
			%s

			UNION

			-- Stand suggestions
			SELECT DISTINCT name as text, 'stand' as type
			FROM stands
			WHERE status = 'ACTIVE' AND name ILIKE $1 || '%'
			%s

			UNION

			-- Product suggestions
			SELECT DISTINCT p.name as text, 'product' as type
			FROM products p
			INNER JOIN stands s ON p.stand_id = s.id
			WHERE p.status = 'ACTIVE' AND s.status = 'ACTIVE' AND p.name ILIKE $1 || '%'
			%s
		)
		SELECT text, type FROM suggestions
		ORDER BY text ASC
		LIMIT $2
	`

	// Add festival filters
	artistFilter := ""
	stageFilter := ""
	standFilter := ""
	productFilter := ""

	if festivalID != nil {
		artistFilter = fmt.Sprintf(`AND EXISTS (SELECT 1 FROM performances perf WHERE perf.artist_id = artists.id AND perf.festival_id = '%s')`, festivalID.String())
		stageFilter = fmt.Sprintf(`AND festival_id = '%s'`, festivalID.String())
		standFilter = fmt.Sprintf(`AND festival_id = '%s'`, festivalID.String())
		productFilter = fmt.Sprintf(`AND s.festival_id = '%s'`, festivalID.String())
	}

	finalQuery := fmt.Sprintf(suggestionQuery, artistFilter, stageFilter, standFilter, productFilter)

	rows, err := r.db.WithContext(ctx).Raw(finalQuery, query, limit).Rows()
	if err != nil {
		return nil, fmt.Errorf("failed to get suggestions: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var text, suggType string
		if err := rows.Scan(&text, &suggType); err != nil {
			return nil, fmt.Errorf("failed to scan suggestion: %w", err)
		}
		suggestions = append(suggestions, SearchSuggestion{
			Text: text,
			Type: SearchType(suggType),
		})
	}

	return suggestions, nil
}

// formatPrice formats price in cents to a display string
func formatPrice(cents int64) string {
	dollars := float64(cents) / 100
	return fmt.Sprintf("$%.2f", dollars)
}
