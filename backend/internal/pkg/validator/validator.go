package validator

import (
	"regexp"
	"strings"

	"github.com/google/uuid"
)

var (
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	phoneRegex = regexp.MustCompile(`^\+?[0-9]{10,15}$`)
)

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ValidationErrors is a collection of validation errors
type ValidationErrors []ValidationError

func (v ValidationErrors) Error() string {
	var messages []string
	for _, err := range v {
		messages = append(messages, err.Field+": "+err.Message)
	}
	return strings.Join(messages, "; ")
}

func (v ValidationErrors) HasErrors() bool {
	return len(v) > 0
}

// Validator provides validation methods
type Validator struct {
	errors ValidationErrors
}

func New() *Validator {
	return &Validator{}
}

func (v *Validator) Required(field, value string) *Validator {
	if strings.TrimSpace(value) == "" {
		v.errors = append(v.errors, ValidationError{Field: field, Message: "is required"})
	}
	return v
}

func (v *Validator) Email(field, value string) *Validator {
	if value != "" && !emailRegex.MatchString(value) {
		v.errors = append(v.errors, ValidationError{Field: field, Message: "must be a valid email"})
	}
	return v
}

func (v *Validator) Phone(field, value string) *Validator {
	if value != "" && !phoneRegex.MatchString(value) {
		v.errors = append(v.errors, ValidationError{Field: field, Message: "must be a valid phone number"})
	}
	return v
}

func (v *Validator) UUID(field, value string) *Validator {
	if value != "" {
		if _, err := uuid.Parse(value); err != nil {
			v.errors = append(v.errors, ValidationError{Field: field, Message: "must be a valid UUID"})
		}
	}
	return v
}

func (v *Validator) MinLength(field, value string, min int) *Validator {
	if len(value) < min {
		v.errors = append(v.errors, ValidationError{Field: field, Message: "must be at least " + string(rune(min)) + " characters"})
	}
	return v
}

func (v *Validator) MaxLength(field, value string, max int) *Validator {
	if len(value) > max {
		v.errors = append(v.errors, ValidationError{Field: field, Message: "must be at most " + string(rune(max)) + " characters"})
	}
	return v
}

func (v *Validator) Min(field string, value, min int64) *Validator {
	if value < min {
		v.errors = append(v.errors, ValidationError{Field: field, Message: "must be greater than or equal to minimum"})
	}
	return v
}

func (v *Validator) Max(field string, value, max int64) *Validator {
	if value > max {
		v.errors = append(v.errors, ValidationError{Field: field, Message: "must be less than or equal to maximum"})
	}
	return v
}

func (v *Validator) Errors() ValidationErrors {
	return v.errors
}

func (v *Validator) Valid() bool {
	return !v.errors.HasErrors()
}
