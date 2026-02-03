package errors

import (
	"fmt"
	"runtime"
	"strings"
)

// MaxStackDepth is the maximum number of stack frames to capture
const MaxStackDepth = 32

// Frame represents a single stack frame
type Frame struct {
	Function string `json:"function"`
	File     string `json:"file"`
	Line     int    `json:"line"`
}

// String returns a string representation of the frame
func (f Frame) String() string {
	return fmt.Sprintf("%s\n\t%s:%d", f.Function, f.File, f.Line)
}

// StackTrace represents a captured stack trace
type StackTrace struct {
	Frames []Frame `json:"frames"`
}

// String returns a string representation of the stack trace
func (st StackTrace) String() string {
	var builder strings.Builder
	for i, frame := range st.Frames {
		if i > 0 {
			builder.WriteString("\n")
		}
		builder.WriteString(frame.String())
	}
	return builder.String()
}

// CaptureStack captures the current stack trace, skipping the specified number of frames
func CaptureStack(skip int) StackTrace {
	var pcs [MaxStackDepth]uintptr
	n := runtime.Callers(skip+2, pcs[:]) // +2 to skip CaptureStack and runtime.Callers

	frames := runtime.CallersFrames(pcs[:n])
	var stackFrames []Frame

	for {
		frame, more := frames.Next()

		// Skip runtime and reflect frames
		if shouldSkipFrame(frame.Function) {
			if !more {
				break
			}
			continue
		}

		stackFrames = append(stackFrames, Frame{
			Function: frame.Function,
			File:     frame.File,
			Line:     frame.Line,
		})

		if !more {
			break
		}
	}

	return StackTrace{Frames: stackFrames}
}

// shouldSkipFrame returns true if the frame should be skipped
func shouldSkipFrame(function string) bool {
	skipPrefixes := []string{
		"runtime.",
		"reflect.",
		"testing.",
		"github.com/gin-gonic/gin.",
	}

	for _, prefix := range skipPrefixes {
		if strings.HasPrefix(function, prefix) {
			return true
		}
	}

	return false
}

// CaptureStackString captures the current stack trace as a string
func CaptureStackString(skip int) string {
	return CaptureStack(skip + 1).String()
}

// WithStack adds a stack trace to an AppError
func WithStack(err *AppError) *AppError {
	if err == nil {
		return nil
	}
	if err.Stack == "" {
		err.Stack = CaptureStackString(1)
	}
	return err
}

// NewWithStack creates a new AppError with stack trace
func NewWithStack(code, message string) *AppError {
	return WithStack(&AppError{
		Code:       code,
		Message:    message,
		StatusCode: GetHTTPStatus(code),
	})
}

// WrapWithStack wraps an error with stack trace
func WrapWithStack(err error, code, message string) *AppError {
	if err == nil {
		return nil
	}

	appErr := Wrap(err, code, message)
	if appErr.Stack == "" {
		appErr.Stack = CaptureStackString(1)
	}
	return appErr
}

// ErrorWithStack is an interface for errors that include stack traces
type ErrorWithStack interface {
	error
	StackTrace() StackTrace
}

// GetStackTrace extracts a stack trace from an error if available
func GetStackTrace(err error) (StackTrace, bool) {
	if err == nil {
		return StackTrace{}, false
	}

	// Check if it's an AppError with a stack
	var appErr *AppError
	if As(err, &appErr) && appErr.Stack != "" {
		// Parse the string stack back to frames (simplified)
		return StackTrace{Frames: parseStackString(appErr.Stack)}, true
	}

	// Check if it implements ErrorWithStack
	if e, ok := err.(ErrorWithStack); ok {
		return e.StackTrace(), true
	}

	return StackTrace{}, false
}

// parseStackString parses a stack trace string back into frames
func parseStackString(stack string) []Frame {
	var frames []Frame
	lines := strings.Split(stack, "\n")

	for i := 0; i < len(lines); i++ {
		line := strings.TrimSpace(lines[i])
		if line == "" {
			continue
		}

		// Look for function name line followed by file:line
		if i+1 < len(lines) {
			funcName := line
			fileLine := strings.TrimSpace(lines[i+1])

			if strings.Contains(fileLine, ":") && !strings.Contains(funcName, ":") {
				parts := strings.Split(fileLine, ":")
				if len(parts) >= 2 {
					var lineNum int
					fmt.Sscanf(parts[len(parts)-1], "%d", &lineNum)
					file := strings.Join(parts[:len(parts)-1], ":")

					frames = append(frames, Frame{
						Function: funcName,
						File:     file,
						Line:     lineNum,
					})
					i++ // Skip the file:line line
					continue
				}
			}
		}
	}

	return frames
}

// RecoveredError creates an error from a panic recovery
type RecoveredError struct {
	*AppError
	PanicValue interface{} `json:"-"`
}

// NewRecoveredError creates an error from a panic recovery
func NewRecoveredError(recovered interface{}) *RecoveredError {
	var message string
	switch v := recovered.(type) {
	case string:
		message = v
	case error:
		message = v.Error()
	default:
		message = fmt.Sprintf("%v", v)
	}

	return &RecoveredError{
		AppError: &AppError{
			Code:       ErrCodeInternal,
			Message:    "An unexpected error occurred",
			Kind:       KindInternal,
			StatusCode: 500,
			Stack:      CaptureStackString(2), // Skip NewRecoveredError and the recovery handler
			Details: map[string]interface{}{
				"panic": message,
			},
		},
		PanicValue: recovered,
	}
}

// FormatForLogging formats the error and stack trace for logging
func FormatForLogging(err error) string {
	if err == nil {
		return ""
	}

	var builder strings.Builder
	builder.WriteString(err.Error())

	var appErr *AppError
	if As(err, &appErr) {
		if appErr.Op != "" {
			builder.WriteString(fmt.Sprintf("\nOperation: %s", appErr.Op))
		}
		if len(appErr.Details) > 0 {
			builder.WriteString(fmt.Sprintf("\nDetails: %v", appErr.Details))
		}
		if appErr.Stack != "" {
			builder.WriteString("\nStack trace:\n")
			builder.WriteString(appErr.Stack)
		}
	}

	return builder.String()
}

// SimplifyStackForClient returns a simplified stack representation suitable for debugging
// (only use in development mode)
func SimplifyStackForClient(st StackTrace, maxFrames int) []string {
	var result []string

	for i, frame := range st.Frames {
		if maxFrames > 0 && i >= maxFrames {
			result = append(result, fmt.Sprintf("... and %d more frames", len(st.Frames)-maxFrames))
			break
		}

		// Simplify the function name
		funcName := frame.Function
		if idx := strings.LastIndex(funcName, "/"); idx >= 0 {
			funcName = funcName[idx+1:]
		}

		// Simplify the file path
		file := frame.File
		if idx := strings.LastIndex(file, "/"); idx >= 0 {
			file = file[idx+1:]
		}

		result = append(result, fmt.Sprintf("%s (%s:%d)", funcName, file, frame.Line))
	}

	return result
}
