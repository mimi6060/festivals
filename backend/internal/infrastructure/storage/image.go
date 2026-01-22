package storage

import (
	"bytes"
	"fmt"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
)

// ImageFormat represents supported image formats
type ImageFormat string

const (
	ImageFormatJPEG ImageFormat = "jpeg"
	ImageFormatPNG  ImageFormat = "png"
	ImageFormatGIF  ImageFormat = "gif"
)

// ResizeOptions configures image resizing behavior
type ResizeOptions struct {
	// Width is the target width (0 means proportional to height)
	Width int

	// Height is the target height (0 means proportional to width)
	Height int

	// Quality is the JPEG quality (1-100, only applies to JPEG)
	Quality int

	// ResampleFilter is the resampling filter to use
	ResampleFilter imaging.ResampleFilter

	// PreserveAspectRatio maintains the original aspect ratio
	PreserveAspectRatio bool

	// Upscale allows images smaller than target to be scaled up
	Upscale bool
}

// ThumbnailSize represents common thumbnail sizes
type ThumbnailSize struct {
	Width  int
	Height int
	Name   string
}

// Common thumbnail sizes
var (
	ThumbnailSmall  = ThumbnailSize{Width: 150, Height: 150, Name: "small"}
	ThumbnailMedium = ThumbnailSize{Width: 300, Height: 300, Name: "medium"}
	ThumbnailLarge  = ThumbnailSize{Width: 600, Height: 600, Name: "large"}
)

// DefaultResizeOptions returns sensible defaults for resizing
func DefaultResizeOptions() ResizeOptions {
	return ResizeOptions{
		Quality:             85,
		ResampleFilter:      imaging.Lanczos,
		PreserveAspectRatio: true,
		Upscale:             false,
	}
}

// ImageProcessor handles image processing operations
type ImageProcessor struct {
	maxWidth    int
	maxHeight   int
	jpegQuality int
}

// NewImageProcessor creates a new image processor
func NewImageProcessor() *ImageProcessor {
	return &ImageProcessor{
		maxWidth:    4096,
		maxHeight:   4096,
		jpegQuality: 85,
	}
}

// ResizeImage resizes an image to the specified dimensions
func (p *ImageProcessor) ResizeImage(reader io.Reader, opts ResizeOptions) (*bytes.Buffer, ImageFormat, error) {
	// Decode the image
	img, format, err := image.Decode(reader)
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode image: %w", err)
	}

	// Get original dimensions
	bounds := img.Bounds()
	origWidth := bounds.Dx()
	origHeight := bounds.Dy()

	// Calculate target dimensions
	targetWidth, targetHeight := p.calculateDimensions(origWidth, origHeight, opts)

	// Skip resize if not needed
	if !opts.Upscale && targetWidth >= origWidth && targetHeight >= origHeight {
		// Return original image encoded
		return p.encodeImage(img, ImageFormat(format), opts.Quality)
	}

	// Resize the image
	var resized image.Image
	if opts.PreserveAspectRatio {
		resized = imaging.Fit(img, targetWidth, targetHeight, opts.ResampleFilter)
	} else {
		resized = imaging.Resize(img, targetWidth, targetHeight, opts.ResampleFilter)
	}

	return p.encodeImage(resized, ImageFormat(format), opts.Quality)
}

// GenerateThumbnail creates a thumbnail of the specified size
func (p *ImageProcessor) GenerateThumbnail(reader io.Reader, size ThumbnailSize) (*bytes.Buffer, ImageFormat, error) {
	// Decode the image
	img, format, err := image.Decode(reader)
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode image: %w", err)
	}

	// Create thumbnail using center crop
	thumbnail := imaging.Fill(img, size.Width, size.Height, imaging.Center, imaging.Lanczos)

	return p.encodeImage(thumbnail, ImageFormat(format), p.jpegQuality)
}

// GenerateMultipleThumbnails creates thumbnails at multiple sizes
func (p *ImageProcessor) GenerateMultipleThumbnails(reader io.Reader, sizes []ThumbnailSize) (map[string]*bytes.Buffer, ImageFormat, error) {
	// Read all data first
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read image data: %w", err)
	}

	// Decode once to get format
	img, format, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode image: %w", err)
	}

	result := make(map[string]*bytes.Buffer)

	for _, size := range sizes {
		thumbnail := imaging.Fill(img, size.Width, size.Height, imaging.Center, imaging.Lanczos)

		buf, _, err := p.encodeImage(thumbnail, ImageFormat(format), p.jpegQuality)
		if err != nil {
			return nil, "", fmt.Errorf("failed to encode thumbnail %s: %w", size.Name, err)
		}

		result[size.Name] = buf
	}

	return result, ImageFormat(format), nil
}

// OptimizeImage optimizes an image for web use
func (p *ImageProcessor) OptimizeImage(reader io.Reader, maxWidth, maxHeight int) (*bytes.Buffer, ImageFormat, error) {
	// Decode the image
	img, format, err := image.Decode(reader)
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode image: %w", err)
	}

	// Get original dimensions
	bounds := img.Bounds()
	origWidth := bounds.Dx()
	origHeight := bounds.Dy()

	// Check if resize is needed
	if origWidth > maxWidth || origHeight > maxHeight {
		img = imaging.Fit(img, maxWidth, maxHeight, imaging.Lanczos)
	}

	return p.encodeImage(img, ImageFormat(format), p.jpegQuality)
}

// ConvertFormat converts an image to a different format
func (p *ImageProcessor) ConvertFormat(reader io.Reader, targetFormat ImageFormat) (*bytes.Buffer, error) {
	// Decode the image
	img, _, err := image.Decode(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	buf, _, err := p.encodeImage(img, targetFormat, p.jpegQuality)
	return buf, err
}

// CropImage crops an image to the specified rectangle
func (p *ImageProcessor) CropImage(reader io.Reader, x, y, width, height int) (*bytes.Buffer, ImageFormat, error) {
	// Decode the image
	img, format, err := image.Decode(reader)
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode image: %w", err)
	}

	// Create crop rectangle
	rect := image.Rect(x, y, x+width, y+height)
	cropped := imaging.Crop(img, rect)

	return p.encodeImage(cropped, ImageFormat(format), p.jpegQuality)
}

// RotateImage rotates an image by the specified angle (90, 180, 270 degrees)
func (p *ImageProcessor) RotateImage(reader io.Reader, angle float64) (*bytes.Buffer, ImageFormat, error) {
	// Decode the image
	img, format, err := image.Decode(reader)
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode image: %w", err)
	}

	var rotated image.Image
	switch angle {
	case 90:
		rotated = imaging.Rotate90(img)
	case 180:
		rotated = imaging.Rotate180(img)
	case 270:
		rotated = imaging.Rotate270(img)
	default:
		rotated = imaging.Rotate(img, angle, imaging.Lanczos)
	}

	return p.encodeImage(rotated, ImageFormat(format), p.jpegQuality)
}

// GetImageDimensions returns the width and height of an image
func (p *ImageProcessor) GetImageDimensions(reader io.Reader) (int, int, error) {
	config, _, err := image.DecodeConfig(reader)
	if err != nil {
		return 0, 0, fmt.Errorf("failed to decode image config: %w", err)
	}
	return config.Width, config.Height, nil
}

// calculateDimensions calculates target dimensions based on options
func (p *ImageProcessor) calculateDimensions(origWidth, origHeight int, opts ResizeOptions) (int, int) {
	targetWidth := opts.Width
	targetHeight := opts.Height

	// If both are 0, use original dimensions
	if targetWidth == 0 && targetHeight == 0 {
		return origWidth, origHeight
	}

	// If only width is specified, calculate height proportionally
	if targetWidth > 0 && targetHeight == 0 {
		targetHeight = int(float64(origHeight) * float64(targetWidth) / float64(origWidth))
	}

	// If only height is specified, calculate width proportionally
	if targetHeight > 0 && targetWidth == 0 {
		targetWidth = int(float64(origWidth) * float64(targetHeight) / float64(origHeight))
	}

	// Enforce maximum dimensions
	if targetWidth > p.maxWidth {
		targetWidth = p.maxWidth
	}
	if targetHeight > p.maxHeight {
		targetHeight = p.maxHeight
	}

	return targetWidth, targetHeight
}

// encodeImage encodes an image to the specified format
func (p *ImageProcessor) encodeImage(img image.Image, format ImageFormat, quality int) (*bytes.Buffer, ImageFormat, error) {
	buf := new(bytes.Buffer)

	switch format {
	case ImageFormatJPEG, "jpg":
		err := jpeg.Encode(buf, img, &jpeg.Options{Quality: quality})
		if err != nil {
			return nil, "", fmt.Errorf("failed to encode JPEG: %w", err)
		}
		return buf, ImageFormatJPEG, nil

	case ImageFormatPNG:
		err := png.Encode(buf, img)
		if err != nil {
			return nil, "", fmt.Errorf("failed to encode PNG: %w", err)
		}
		return buf, ImageFormatPNG, nil

	case ImageFormatGIF:
		err := gif.Encode(buf, img, nil)
		if err != nil {
			return nil, "", fmt.Errorf("failed to encode GIF: %w", err)
		}
		return buf, ImageFormatGIF, nil

	default:
		// Default to JPEG for unknown formats
		err := jpeg.Encode(buf, img, &jpeg.Options{Quality: quality})
		if err != nil {
			return nil, "", fmt.Errorf("failed to encode image: %w", err)
		}
		return buf, ImageFormatJPEG, nil
	}
}

// GetContentType returns the content type for an image format
func GetContentType(format ImageFormat) string {
	switch format {
	case ImageFormatJPEG, "jpg":
		return ContentTypeJPEG
	case ImageFormatPNG:
		return ContentTypePNG
	case ImageFormatGIF:
		return ContentTypeGIF
	default:
		return "application/octet-stream"
	}
}

// GetFormatFromContentType returns the image format from a content type
func GetFormatFromContentType(contentType string) ImageFormat {
	switch contentType {
	case ContentTypeJPEG, "image/jpg":
		return ImageFormatJPEG
	case ContentTypePNG:
		return ImageFormatPNG
	case ContentTypeGIF:
		return ImageFormatGIF
	default:
		return ImageFormatJPEG
	}
}

// GetFormatFromFilename returns the image format from a filename
func GetFormatFromFilename(filename string) ImageFormat {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".jpg", ".jpeg":
		return ImageFormatJPEG
	case ".png":
		return ImageFormatPNG
	case ".gif":
		return ImageFormatGIF
	default:
		return ImageFormatJPEG
	}
}

// IsValidImageFormat checks if the format is a supported image format
func IsValidImageFormat(format string) bool {
	format = strings.ToLower(format)
	switch format {
	case "jpeg", "jpg", "png", "gif":
		return true
	default:
		return false
	}
}

// IsValidImageContentType checks if the content type is a supported image type
func IsValidImageContentType(contentType string) bool {
	switch contentType {
	case ContentTypeJPEG, "image/jpg", ContentTypePNG, ContentTypeGIF, ContentTypeWebP:
		return true
	default:
		return false
	}
}
