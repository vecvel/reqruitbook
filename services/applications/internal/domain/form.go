package domain

import (
	"fmt"
	"net/mail"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

// FieldType is one kind of question a company can put on an application form.
type FieldType string

// The values are the ones the jobs service serializes, not names chosen here:
// this service validates a form it does not own, so its vocabulary has to be
// that form's. A mismatch would not fail loudly — an unrecognized type falls
// through to "cannot be answered", so every application to a job with a select
// field would be refused for no visible reason.
const (
	FieldText        FieldType = "short_text"
	FieldTextarea    FieldType = "long_text"
	FieldEmail       FieldType = "email"
	FieldPhone       FieldType = "phone"
	FieldURL         FieldType = "url"
	FieldNumber      FieldType = "number"
	FieldDate        FieldType = "date"
	FieldSelect      FieldType = "single_select"
	FieldMultiSelect FieldType = "multi_select"
	FieldBoolean     FieldType = "boolean"
	FieldFile        FieldType = "file"
)

// FieldOption is one choice on a select field.
type FieldOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// FieldValidation constrains what a candidate may submit.
type FieldValidation struct {
	MinLength *int     `json:"minLength,omitempty"`
	MaxLength *int     `json:"maxLength,omitempty"`
	Pattern   string   `json:"pattern,omitempty"`
	Min       *float64 `json:"min,omitempty"`
	Max       *float64 `json:"max,omitempty"`
	// AcceptedFileTypes are lower-case extensions without the dot.
	AcceptedFileTypes []string `json:"acceptedFileTypes,omitempty"`
	MaxFileSizeBytes  *int64   `json:"maxFileSizeBytes,omitempty"`
	// MaxSelections caps a multi-select; zero means no cap.
	MaxSelections int `json:"maxSelections,omitempty"`
}

// FormField is one question, mirroring the jobs service's wire format exactly.
//
// It is a copy rather than a shared package because the two services deploy
// independently; what keeps them honest is that this struct is decoded from the
// owner's response on every submission, so a drift shows up as a failing
// application rather than as a silently unchecked answer.
type FormField struct {
	Key        string           `json:"key"`
	Label      string           `json:"label"`
	Type       FieldType        `json:"type"`
	Required   bool             `json:"required"`
	HelpText   string           `json:"helpText,omitempty"`
	Options    []FieldOption    `json:"options,omitempty"`
	Validation *FieldValidation `json:"validation,omitempty"`
}

// The accessors below read through an absent Validation block, so a field
// authored without constraints needs no special case at each use.

func (f FormField) minLength() *int {
	if f.Validation == nil {
		return nil
	}
	return f.Validation.MinLength
}

func (f FormField) maxLength() *int {
	if f.Validation == nil {
		return nil
	}
	return f.Validation.MaxLength
}

func (f FormField) min() *float64 {
	if f.Validation == nil {
		return nil
	}
	return f.Validation.Min
}

func (f FormField) max() *float64 {
	if f.Validation == nil {
		return nil
	}
	return f.Validation.Max
}

func (f FormField) maxSelections() int {
	if f.Validation == nil {
		return 0
	}
	return f.Validation.MaxSelections
}

func (f FormField) acceptedFileTypes() []string {
	if f.Validation == nil {
		return nil
	}
	return f.Validation.AcceptedFileTypes
}

// optionValues flattens the published option objects to the values a submission
// is allowed to carry.
func (f FormField) optionValues() []string {
	values := make([]string, 0, len(f.Options))
	for _, option := range f.Options {
		values = append(values, option.Value)
	}
	return values
}

// Form is a job's custom application form.
type Form struct {
	Fields []FormField `json:"fields"`
}

// defaultMaxTextLength bounds any text answer a form did not bound itself, so a
// form authored without limits cannot be used to store megabytes per row.
const defaultMaxTextLength = 5000

// ValidateAnswers checks a submission against the job's form.
//
// The form is authored by the company and rendered by the client, but the client
// is not the enforcement point: a submission arrives as arbitrary JSON from a
// browser, a script or a replayed request, so every rule the form declares is
// re-checked here. The result is a per-field map so the portal can put each
// message back beside the question that produced it.
func ValidateAnswers(form Form, answers map[string]any) map[string][]string {
	problems := map[string][]string{}
	known := make(map[string]struct{}, len(form.Fields))

	for _, field := range form.Fields {
		known[field.Key] = struct{}{}

		raw, present := answers[field.Key]
		if !present || isBlank(raw) {
			if field.Required {
				add(problems, field.Key, fmt.Sprintf("%s is required.", label(field)))
			}
			continue
		}

		if messages := validateField(field, raw); len(messages) > 0 {
			problems[field.Key] = append(problems[field.Key], messages...)
		}
	}

	// An unknown key is either a stale client or someone probing what the server
	// will store. Neither is worth persisting, and silently dropping the value
	// would hide a genuinely broken form from whoever authored it.
	for key := range answers {
		if _, ok := known[key]; !ok {
			add(problems, key, "This question is not part of the application form.")
		}
	}

	if len(problems) == 0 {
		return nil
	}
	return problems
}

func validateField(field FormField, raw any) []string {
	switch field.Type {
	case FieldText, FieldTextarea, FieldPhone:
		value, ok := asString(raw)
		if !ok {
			return []string{fmt.Sprintf("%s must be text.", label(field))}
		}
		return checkLength(field, value)

	case FieldEmail:
		value, ok := asString(raw)
		if !ok {
			return []string{fmt.Sprintf("%s must be text.", label(field))}
		}
		if _, err := mail.ParseAddress(strings.TrimSpace(value)); err != nil {
			return []string{fmt.Sprintf("%s must be a valid email address.", label(field))}
		}
		return checkLength(field, value)

	case FieldURL:
		value, ok := asString(raw)
		if !ok {
			return []string{fmt.Sprintf("%s must be text.", label(field))}
		}
		parsed, err := url.Parse(strings.TrimSpace(value))
		if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			return []string{fmt.Sprintf("%s must be a valid http or https link.", label(field))}
		}
		return checkLength(field, value)

	case FieldNumber:
		value, ok := asNumber(raw)
		if !ok {
			return []string{fmt.Sprintf("%s must be a number.", label(field))}
		}
		var messages []string
		if field.min() != nil && value < *field.min() {
			messages = append(messages, fmt.Sprintf("%s must be at least %s.", label(field), formatNumber(*field.min())))
		}
		if field.max() != nil && value > *field.max() {
			messages = append(messages, fmt.Sprintf("%s must be at most %s.", label(field), formatNumber(*field.max())))
		}
		return messages

	case FieldDate:
		value, ok := asString(raw)
		if !ok {
			return []string{fmt.Sprintf("%s must be a date.", label(field))}
		}
		if _, err := time.Parse(time.DateOnly, strings.TrimSpace(value)); err != nil {
			return []string{fmt.Sprintf("%s must be a date in YYYY-MM-DD form.", label(field))}
		}
		return nil

	case FieldSelect:
		value, ok := asString(raw)
		if !ok {
			return []string{fmt.Sprintf("%s must be one of the offered choices.", label(field))}
		}
		if !contains(field.optionValues(), value) {
			return []string{fmt.Sprintf("%s must be one of the offered choices.", label(field))}
		}
		return nil

	case FieldMultiSelect:
		values, ok := asStringSlice(raw)
		if !ok {
			return []string{fmt.Sprintf("%s must be a list of the offered choices.", label(field))}
		}
		var messages []string
		for _, value := range values {
			if !contains(field.optionValues(), value) {
				messages = append(messages,
					fmt.Sprintf("%q is not one of the choices offered for %s.", value, label(field)))
			}
		}
		if field.maxSelections() > 0 && len(values) > field.maxSelections() {
			messages = append(messages,
				fmt.Sprintf("%s allows at most %d selections.", label(field), field.maxSelections()))
		}
		return messages

	case FieldBoolean:
		if _, ok := raw.(bool); !ok {
			return []string{fmt.Sprintf("%s must be yes or no.", label(field))}
		}
		return nil

	case FieldFile:
		value, ok := asString(raw)
		if !ok {
			return []string{fmt.Sprintf("%s must be an uploaded file.", label(field))}
		}
		// The answer is an object key the upload step already produced; what is
		// checkable here is that its type is one the company said it accepts.
		if len(field.acceptedFileTypes()) > 0 && !hasAcceptedExtension(value, field.acceptedFileTypes()) {
			return []string{fmt.Sprintf("%s must be one of: %s.",
				label(field), strings.Join(field.acceptedFileTypes(), ", "))}
		}
		return nil

	default:
		// A field type this service does not know is a form it cannot honestly
		// validate, so it refuses rather than storing an unchecked answer.
		return []string{"This question cannot be answered right now. Please contact the company."}
	}
}

func checkLength(field FormField, value string) []string {
	length := utf8.RuneCountInString(strings.TrimSpace(value))
	max := defaultMaxTextLength
	if field.maxLength() != nil && *field.maxLength() > 0 {
		max = *field.maxLength()
	}

	var messages []string
	if field.minLength() != nil && length < *field.minLength() {
		messages = append(messages,
			fmt.Sprintf("%s must be at least %d characters.", label(field), *field.minLength()))
	}
	if length > max {
		messages = append(messages, fmt.Sprintf("%s must be at most %d characters.", label(field), max))
	}
	return messages
}

func label(field FormField) string {
	if strings.TrimSpace(field.Label) != "" {
		return field.Label
	}
	return field.Key
}

func isBlank(raw any) bool {
	switch value := raw.(type) {
	case nil:
		return true
	case string:
		return strings.TrimSpace(value) == ""
	case []any:
		return len(value) == 0
	default:
		return false
	}
}

func asString(raw any) (string, bool) {
	value, ok := raw.(string)
	return value, ok
}

// asNumber accepts the float64 encoding/json produces, plus the numeric strings
// a form control emits when it is backed by a text input.
func asNumber(raw any) (float64, bool) {
	switch value := raw.(type) {
	case float64:
		return value, true
	case int:
		return float64(value), true
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func asStringSlice(raw any) ([]string, bool) {
	items, ok := raw.([]any)
	if !ok {
		return nil, false
	}
	values := make([]string, 0, len(items))
	for _, item := range items {
		value, ok := item.(string)
		if !ok {
			return nil, false
		}
		values = append(values, value)
	}
	return values, true
}

func contains(options []string, value string) bool {
	for _, option := range options {
		if option == value {
			return true
		}
	}
	return false
}

func hasAcceptedExtension(key string, accepted []string) bool {
	lower := strings.ToLower(key)
	for _, ext := range accepted {
		if strings.HasSuffix(lower, "."+strings.ToLower(strings.TrimPrefix(ext, "."))) {
			return true
		}
	}
	return false
}

func formatNumber(v float64) string {
	if v == float64(int64(v)) {
		return fmt.Sprintf("%d", int64(v))
	}
	return fmt.Sprintf("%g", v)
}

func add(problems map[string][]string, key, message string) {
	problems[key] = append(problems[key], message)
}
