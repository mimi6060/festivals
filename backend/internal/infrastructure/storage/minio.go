package storage

import (
	"context"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/rs/zerolog/log"
)

// MinioConfig holds the configuration for MinIO client
type MinioConfig struct {
	Endpoint        string
	AccessKeyID     string
	SecretAccessKey string
	UseSSL          bool
	Region          string
	DefaultBucket   string
}

// MinioStorage implements the Storage interface using MinIO
type MinioStorage struct {
	client        *minio.Client
	defaultBucket string
	endpoint      string
	useSSL        bool
}

// NewMinioStorage creates a new MinIO storage client
func NewMinioStorage(cfg MinioConfig) (*MinioStorage, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		Secure: cfg.UseSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create MinIO client: %w", err)
	}

	storage := &MinioStorage{
		client:        client,
		defaultBucket: cfg.DefaultBucket,
		endpoint:      cfg.Endpoint,
		useSSL:        cfg.UseSSL,
	}

	log.Info().
		Str("endpoint", cfg.Endpoint).
		Str("bucket", cfg.DefaultBucket).
		Msg("MinIO storage client initialized")

	return storage, nil
}

// Upload uploads a file to MinIO
func (s *MinioStorage) Upload(ctx context.Context, bucket, objectName string, reader io.Reader, size int64, opts UploadOptions) (*FileInfo, error) {
	if bucket == "" {
		bucket = s.defaultBucket
	}

	// Ensure bucket exists
	exists, err := s.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to check bucket existence: %w", err)
	}
	if !exists {
		if err := s.CreateBucket(ctx, bucket); err != nil {
			return nil, fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	// Build put options
	putOpts := minio.PutObjectOptions{
		ContentType:        opts.ContentType,
		ContentDisposition: opts.ContentDisposition,
		CacheControl:       opts.CacheControl,
		ContentEncoding:    opts.ContentEncoding,
		StorageClass:       opts.StorageClass,
		UserMetadata:       opts.Metadata,
	}

	// Upload the object
	info, err := s.client.PutObject(ctx, bucket, objectName, reader, size, putOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to upload object: %w", err)
	}

	// Build the object URL
	objectURL := s.buildObjectURL(bucket, objectName)

	log.Info().
		Str("bucket", bucket).
		Str("object", objectName).
		Int64("size", info.Size).
		Msg("Object uploaded successfully")

	return &FileInfo{
		Bucket:       bucket,
		Key:          objectName,
		Size:         info.Size,
		ContentType:  opts.ContentType,
		ETag:         info.ETag,
		LastModified: time.Now(),
		Metadata:     opts.Metadata,
		URL:          objectURL,
	}, nil
}

// Download downloads a file from MinIO
func (s *MinioStorage) Download(ctx context.Context, bucket, objectName string) (io.ReadCloser, error) {
	if bucket == "" {
		bucket = s.defaultBucket
	}

	obj, err := s.client.GetObject(ctx, bucket, objectName, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to get object: %w", err)
	}

	// Verify the object exists by getting its info
	_, err = obj.Stat()
	if err != nil {
		obj.Close()
		errResp := minio.ToErrorResponse(err)
		if errResp.Code == "NoSuchKey" {
			return nil, fmt.Errorf("object not found: %s/%s", bucket, objectName)
		}
		return nil, fmt.Errorf("failed to stat object: %w", err)
	}

	return obj, nil
}

// Delete removes a file from MinIO
func (s *MinioStorage) Delete(ctx context.Context, bucket, objectName string) error {
	if bucket == "" {
		bucket = s.defaultBucket
	}

	err := s.client.RemoveObject(ctx, bucket, objectName, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to delete object: %w", err)
	}

	log.Info().
		Str("bucket", bucket).
		Str("object", objectName).
		Msg("Object deleted successfully")

	return nil
}

// GetSignedURL generates a presigned URL for accessing the object
func (s *MinioStorage) GetSignedURL(ctx context.Context, bucket, objectName string, expiry time.Duration) (string, error) {
	if bucket == "" {
		bucket = s.defaultBucket
	}

	// Set request parameters for response headers
	reqParams := make(url.Values)

	presignedURL, err := s.client.PresignedGetObject(ctx, bucket, objectName, expiry, reqParams)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	return presignedURL.String(), nil
}

// GetSignedUploadURL generates a presigned URL for uploading an object
func (s *MinioStorage) GetSignedUploadURL(ctx context.Context, bucket, objectName string, expiry time.Duration) (string, error) {
	if bucket == "" {
		bucket = s.defaultBucket
	}

	presignedURL, err := s.client.PresignedPutObject(ctx, bucket, objectName, expiry)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned upload URL: %w", err)
	}

	return presignedURL.String(), nil
}

// CreateBucket creates a new bucket if it doesn't exist
func (s *MinioStorage) CreateBucket(ctx context.Context, bucket string) error {
	exists, err := s.BucketExists(ctx, bucket)
	if err != nil {
		return err
	}

	if exists {
		return nil
	}

	err = s.client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{})
	if err != nil {
		return fmt.Errorf("failed to create bucket: %w", err)
	}

	log.Info().Str("bucket", bucket).Msg("Bucket created successfully")

	return nil
}

// BucketExists checks if a bucket exists
func (s *MinioStorage) BucketExists(ctx context.Context, bucket string) (bool, error) {
	exists, err := s.client.BucketExists(ctx, bucket)
	if err != nil {
		return false, fmt.Errorf("failed to check bucket existence: %w", err)
	}
	return exists, nil
}

// GetFileInfo retrieves metadata about an object
func (s *MinioStorage) GetFileInfo(ctx context.Context, bucket, objectName string) (*FileInfo, error) {
	if bucket == "" {
		bucket = s.defaultBucket
	}

	info, err := s.client.StatObject(ctx, bucket, objectName, minio.StatObjectOptions{})
	if err != nil {
		errResp := minio.ToErrorResponse(err)
		if errResp.Code == "NoSuchKey" {
			return nil, fmt.Errorf("object not found: %s/%s", bucket, objectName)
		}
		return nil, fmt.Errorf("failed to stat object: %w", err)
	}

	return &FileInfo{
		Bucket:       bucket,
		Key:          info.Key,
		Size:         info.Size,
		ContentType:  info.ContentType,
		ETag:         info.ETag,
		LastModified: info.LastModified,
		Metadata:     info.UserMetadata,
		URL:          s.buildObjectURL(bucket, objectName),
	}, nil
}

// ListObjects lists objects in a bucket with optional prefix
func (s *MinioStorage) ListObjects(ctx context.Context, bucket, prefix string) ([]FileInfo, error) {
	if bucket == "" {
		bucket = s.defaultBucket
	}

	var files []FileInfo

	opts := minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	}

	for obj := range s.client.ListObjects(ctx, bucket, opts) {
		if obj.Err != nil {
			return nil, fmt.Errorf("failed to list objects: %w", obj.Err)
		}

		files = append(files, FileInfo{
			Bucket:       bucket,
			Key:          obj.Key,
			Size:         obj.Size,
			ContentType:  obj.ContentType,
			ETag:         obj.ETag,
			LastModified: obj.LastModified,
			URL:          s.buildObjectURL(bucket, obj.Key),
		})
	}

	return files, nil
}

// CopyObject copies an object within the storage
func (s *MinioStorage) CopyObject(ctx context.Context, srcBucket, srcObject, destBucket, destObject string) error {
	if srcBucket == "" {
		srcBucket = s.defaultBucket
	}
	if destBucket == "" {
		destBucket = s.defaultBucket
	}

	src := minio.CopySrcOptions{
		Bucket: srcBucket,
		Object: srcObject,
	}

	dst := minio.CopyDestOptions{
		Bucket: destBucket,
		Object: destObject,
	}

	_, err := s.client.CopyObject(ctx, dst, src)
	if err != nil {
		return fmt.Errorf("failed to copy object: %w", err)
	}

	log.Info().
		Str("src", fmt.Sprintf("%s/%s", srcBucket, srcObject)).
		Str("dest", fmt.Sprintf("%s/%s", destBucket, destObject)).
		Msg("Object copied successfully")

	return nil
}

// buildObjectURL constructs the URL for an object
func (s *MinioStorage) buildObjectURL(bucket, objectName string) string {
	protocol := "http"
	if s.useSSL {
		protocol = "https"
	}
	return fmt.Sprintf("%s://%s/%s/%s", protocol, s.endpoint, bucket, objectName)
}

// GetDefaultBucket returns the default bucket name
func (s *MinioStorage) GetDefaultBucket() string {
	return s.defaultBucket
}

// SetBucketPolicy sets the access policy for a bucket
func (s *MinioStorage) SetBucketPolicy(ctx context.Context, bucket, policy string) error {
	if bucket == "" {
		bucket = s.defaultBucket
	}

	err := s.client.SetBucketPolicy(ctx, bucket, policy)
	if err != nil {
		return fmt.Errorf("failed to set bucket policy: %w", err)
	}

	log.Info().Str("bucket", bucket).Msg("Bucket policy set successfully")

	return nil
}

// SetPublicReadPolicy sets a public read policy on the bucket
func (s *MinioStorage) SetPublicReadPolicy(ctx context.Context, bucket string) error {
	if bucket == "" {
		bucket = s.defaultBucket
	}

	policy := fmt.Sprintf(`{
		"Version": "2012-10-17",
		"Statement": [
			{
				"Effect": "Allow",
				"Principal": {"AWS": ["*"]},
				"Action": ["s3:GetObject"],
				"Resource": ["arn:aws:s3:::%s/*"]
			}
		]
	}`, bucket)

	return s.SetBucketPolicy(ctx, bucket, policy)
}

// DeleteMultiple deletes multiple objects at once
func (s *MinioStorage) DeleteMultiple(ctx context.Context, bucket string, objectNames []string) error {
	if bucket == "" {
		bucket = s.defaultBucket
	}

	objectsCh := make(chan minio.ObjectInfo, len(objectNames))
	go func() {
		defer close(objectsCh)
		for _, name := range objectNames {
			objectsCh <- minio.ObjectInfo{Key: name}
		}
	}()

	errCh := s.client.RemoveObjects(ctx, bucket, objectsCh, minio.RemoveObjectsOptions{})
	var errs []error
	for err := range errCh {
		errs = append(errs, err.Err)
	}

	if len(errs) > 0 {
		return fmt.Errorf("failed to delete some objects: %v", errs)
	}

	log.Info().
		Str("bucket", bucket).
		Int("count", len(objectNames)).
		Msg("Objects deleted successfully")

	return nil
}
