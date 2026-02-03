package storage

import (
	"context"
	"io"
	"time"
)

// Storage defines the interface for object storage operations
type Storage interface {
	// Upload uploads a file to the storage
	Upload(ctx context.Context, bucket, objectName string, reader io.Reader, size int64, opts UploadOptions) (*FileInfo, error)

	// Download downloads a file from the storage
	Download(ctx context.Context, bucket, objectName string) (io.ReadCloser, error)

	// Delete removes a file from the storage
	Delete(ctx context.Context, bucket, objectName string) error

	// GetSignedURL generates a presigned URL for accessing the object
	GetSignedURL(ctx context.Context, bucket, objectName string, expiry time.Duration) (string, error)

	// CreateBucket creates a new bucket if it doesn't exist
	CreateBucket(ctx context.Context, bucket string) error

	// BucketExists checks if a bucket exists
	BucketExists(ctx context.Context, bucket string) (bool, error)

	// GetFileInfo retrieves metadata about an object
	GetFileInfo(ctx context.Context, bucket, objectName string) (*FileInfo, error)

	// ListObjects lists objects in a bucket with optional prefix
	ListObjects(ctx context.Context, bucket, prefix string) ([]FileInfo, error)

	// CopyObject copies an object within the storage
	CopyObject(ctx context.Context, srcBucket, srcObject, destBucket, destObject string) error
}

// FileInfo contains metadata about a stored file
type FileInfo struct {
	Bucket       string            `json:"bucket"`
	Key          string            `json:"key"`
	Size         int64             `json:"size"`
	ContentType  string            `json:"contentType"`
	ETag         string            `json:"etag"`
	LastModified time.Time         `json:"lastModified"`
	Metadata     map[string]string `json:"metadata,omitempty"`
	URL          string            `json:"url,omitempty"`
}

// UploadOptions configures upload behavior
type UploadOptions struct {
	// ContentType specifies the MIME type of the object
	ContentType string

	// ContentDisposition specifies the Content-Disposition header
	ContentDisposition string

	// ACL specifies the access control for the object
	// Common values: "private", "public-read", "public-read-write"
	ACL string

	// Metadata contains custom metadata key-value pairs
	Metadata map[string]string

	// CacheControl specifies the Cache-Control header
	CacheControl string

	// ContentEncoding specifies the Content-Encoding header
	ContentEncoding string

	// StorageClass specifies the storage class (e.g., "STANDARD", "REDUCED_REDUNDANCY")
	StorageClass string
}

// DefaultUploadOptions returns default upload options
func DefaultUploadOptions() UploadOptions {
	return UploadOptions{
		ContentType: "application/octet-stream",
		ACL:         "private",
		Metadata:    make(map[string]string),
	}
}

// ACL constants for common access control settings
const (
	ACLPrivate         = "private"
	ACLPublicRead      = "public-read"
	ACLPublicReadWrite = "public-read-write"
)

// Common content types
const (
	ContentTypeJPEG = "image/jpeg"
	ContentTypePNG  = "image/png"
	ContentTypeGIF  = "image/gif"
	ContentTypeWebP = "image/webp"
	ContentTypePDF  = "application/pdf"
	ContentTypeJSON = "application/json"
	ContentTypeCSV  = "text/csv"
	ContentTypeXLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
)
