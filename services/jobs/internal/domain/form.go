package domain

import (
	"regexp"
	"strings"
)

// FieldType is the input a candidate is asked for.
type FieldType string

const (
	FieldShortText    FieldType = "short_text"
	FieldLongText     FieldType = "long_text"
	FieldEmail        FieldType = "email"
	FieldPhone        FieldType = "phone"
	FieldURL          FieldType = "url"
	FieldNumber       FieldType = "number"
	FieldDate         FieldType = "date"
	FieldSingleSelect FieldType = "single_select"
	FieldMultiSelect  FieldType = "multi_select"
	FieldBoolean      FieldType = "boolean"
	FieldFile         FieldType = "file"
)

// Valid reports whether the field type is one the portals can render.
func (t FieldType) Valid() bool {
	switch t {
	case FieldShortText, FieldLongText, FieldEmail, FieldPhone, FieldURL, FieldNumber,
		FieldDate, FieldSingleSelect, FieldMultiSelect, FieldBoolean, FieldFile:
		return true
	default:
		return false
	}
}

// textual reports whether length and pattern constraints apply to the type.
func (t FieldType) textual() bool {
	switch t {
	case FieldShortText, FieldLongText, FieldEmail, FieldPhone, FieldURL:
		return true
	default:
		return false
	}
}

// chooses reports whether the type presents a fixed option list.
func (t FieldType) chooses() bool {
	return t == FieldSingleSelect || t == FieldMultiSelect
}

// FieldOption is one choice in a select.
type FieldOption struct {
	Value string `json:"value"`
	Label string `json:"label"`
}

// FieldValidation constrains what a candidate may submit.
//
// It is stored with the field rather than applied here, because the service
// that receives an application is the one that must enforce it. Keeping the
// rules declarative means jobs and applications cannot drift apart.
type FieldValidation struct {
	MinLength *int     `json:"minLength,omitempty"`
	MaxLength *int     `json:"maxLength,omitempty"`
	Pattern   string   `json:"pattern,omitempty"`
	Min       *float64 `json:"min,omitempty"`
	Max       *float64 `json:"max,omitempty"`
	// AcceptedFileTypes are lower-case extensions without the dot.
	AcceptedFileTypes []string `json:"acceptedFileTypes,omitempty"`
	MaxFileSizeBytes  *int64   `json:"maxFileSizeBytes,omitempty"`
}

// FormField is one question on the application form.
type FormField struct {
	Key        string           `json:"key"`
	Label      string           `json:"label"`
	Type       FieldType        `json:"type"`
	Required   bool             `json:"required"`
	HelpText   string           `json:"helpText,omitempty"`
	Options    []FieldOption    `json:"options,omitempty"`
	Validation *FieldValidation `json:"validation,omitempty"`
}

// ApplicationForm is the ordered list of questions attached to a job.
//
// Order is the slice order: a form is a document, and a candidate reads it top
// to bottom, so position is content rather than presentation.
type ApplicationForm struct {
	Fields []FormField `json:"fields"`
	// Version increments on every replacement, so an application can record the
	// form it was actually answering rather than the one live today.
	Version int `json:"version"`
}

// Limits on a form. They exist so a malformed or hostile payload is rejected at
// the boundary instead of becoming a page nobody can load.
const (
	MaxFormFields       = 60
	MaxFieldKeyLength   = 64
	MaxFieldLabelLength = 200
	MaxHelpTextLength   = 500
	MaxFieldOptions     = 200
	MaxOptionLength     = 200
	MaxTextFieldLength  = 20_000
	MaxUploadSizeBytes  = 25 << 20
)

var fieldKeyPattern = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

// allowedFileTypes is the upload allow-list. A candidate attachment is opened by
// a recruiter on a laptop, so the list is documents and images only — never an
// archive or anything executable.
var allowedFileTypes = map[string]struct{}{
	"pdf": {}, "doc": {}, "docx": {}, "odt": {}, "rtf": {}, "txt": {},
	"png": {}, "jpg": {}, "jpeg": {}, "webp": {},
}

// AllowedFileTypes returns the upload allow-list, for a client that wants to
// show it rather than discover it through a 422.
func AllowedFileTypes() []string {
	out := make([]string, 0, len(allowedFileTypes))
	for ext := range allowedFileTypes {
		out = append(out, ext)
	}
	return out
}

// Normalize trims the form in place and renumbers nothing else.
func (f *ApplicationForm) Normalize() {
	for i := range f.Fields {
		field := &f.Fields[i]
		field.Key = strings.ToLower(strings.TrimSpace(field.Key))
		field.Label = collapseSpaces(field.Label)
		field.HelpText = strings.TrimSpace(field.HelpText)
		field.Type = FieldType(strings.ToLower(strings.TrimSpace(string(field.Type))))

		for j := range field.Options {
			field.Options[j].Value = strings.TrimSpace(field.Options[j].Value)
			field.Options[j].Label = collapseSpaces(field.Options[j].Label)
			if field.Options[j].Label == "" {
				field.Options[j].Label = field.Options[j].Value
			}
		}

		if field.Validation != nil {
			for k := range field.Validation.AcceptedFileTypes {
				field.Validation.AcceptedFileTypes[k] = strings.ToLower(strings.TrimPrefix(
					strings.TrimSpace(field.Validation.AcceptedFileTypes[k]), "."))
			}
			field.Validation.Pattern = strings.TrimSpace(field.Validation.Pattern)
		}
	}
}

// Validate reports every problem with the form.
//
// A form is stored as JSONB, which will accept anything; without this the first
// sign that a field is malformed would be a candidate failing to apply. Errors
// are keyed `fields[3].options` so an editor can highlight the offending input.
func (f ApplicationForm) Validate() FieldErrors {
	errs := FieldErrors{}

	if len(f.Fields) == 0 {
		errs.Add("fields", "An application form needs at least one field.")
		return errs
	}
	if len(f.Fields) > MaxFormFields {
		errs.Add("fields", "An application form may have at most 60 fields.")
		return errs
	}

	seen := make(map[string]struct{}, len(f.Fields))
	for i, field := range f.Fields {
		prefix := indexedField("fields", i) + "."

		switch {
		case field.Key == "":
			errs.Add(prefix+"key", "A field key is required.")
		case len(field.Key) > MaxFieldKeyLength:
			errs.Add(prefix+"key", "A field key may be at most 64 characters.")
		case !fieldKeyPattern.MatchString(field.Key):
			errs.Add(prefix+"key",
				"A field key must start with a letter and contain only lower-case letters, digits and underscores.")
		default:
			if _, duplicate := seen[field.Key]; duplicate {
				// Duplicate keys would silently overwrite one another in the
				// submitted answer map.
				errs.Add(prefix+"key", "Field keys must be unique within a form.")
			}
			seen[field.Key] = struct{}{}
		}

		switch {
		case field.Label == "":
			errs.Add(prefix+"label", "A field label is required.")
		case len([]rune(field.Label)) > MaxFieldLabelLength:
			errs.Add(prefix+"label", "A field label may be at most 200 characters.")
		}

		if len([]rune(field.HelpText)) > MaxHelpTextLength {
			errs.Add(prefix+"helpText", "Help text may be at most 500 characters.")
		}

		if !field.Type.Valid() {
			errs.Add(prefix+"type", "Unsupported field type.")
			// Every remaining rule is type-dependent; checking them against an
			// unknown type would only produce noise.
			continue
		}

		validateOptions(field, prefix, errs)
		validateFieldConstraints(field, prefix, errs)
	}

	return errs
}

func validateOptions(field FormField, prefix string, errs FieldErrors) {
	if !field.Type.chooses() {
		if len(field.Options) > 0 {
			errs.Add(prefix+"options", "Only single_select and multi_select fields may carry options.")
		}
		return
	}

	if len(field.Options) == 0 {
		errs.Add(prefix+"options", "A select field needs at least one option.")
		return
	}
	if len(field.Options) > MaxFieldOptions {
		errs.Add(prefix+"options", "A select field may have at most 200 options.")
		return
	}

	seen := make(map[string]struct{}, len(field.Options))
	for j, option := range field.Options {
		switch {
		case option.Value == "":
			errs.Add(indexedField(prefix+"options", j)+".value", "An option value is required.")
		case len([]rune(option.Value)) > MaxOptionLength, len([]rune(option.Label)) > MaxOptionLength:
			errs.Add(indexedField(prefix+"options", j), "An option may be at most 200 characters.")
		default:
			if _, duplicate := seen[option.Value]; duplicate {
				errs.Add(indexedField(prefix+"options", j)+".value", "Option values must be unique within a field.")
			}
			seen[option.Value] = struct{}{}
		}
	}
}

func validateFieldConstraints(field FormField, prefix string, errs FieldErrors) {
	v := field.Validation
	if v == nil {
		return
	}
	prefix += "validation."

	if v.MinLength != nil || v.MaxLength != nil || v.Pattern != "" {
		if !field.Type.textual() {
			errs.Add(prefix+"minLength", "Length and pattern rules apply only to text fields.")
		} else {
			validateLengths(v, prefix, errs)
			if v.Pattern != "" {
				// An uncompilable pattern would reject or accept everything at
				// submission time depending on how the client handled the error.
				if _, err := regexp.Compile(v.Pattern); err != nil {
					errs.Add(prefix+"pattern", "This is not a valid regular expression.")
				} else if len(v.Pattern) > 500 {
					errs.Add(prefix+"pattern", "A pattern may be at most 500 characters.")
				}
			}
		}
	}

	if v.Min != nil || v.Max != nil {
		if field.Type != FieldNumber {
			errs.Add(prefix+"min", "Minimum and maximum apply only to number fields.")
		} else if v.Min != nil && v.Max != nil && *v.Min > *v.Max {
			errs.Add(prefix+"max", "The maximum must be at least the minimum.")
		}
	}

	if len(v.AcceptedFileTypes) > 0 || v.MaxFileSizeBytes != nil {
		if field.Type != FieldFile {
			errs.Add(prefix+"acceptedFileTypes", "Upload rules apply only to file fields.")
			return
		}
		for _, ext := range v.AcceptedFileTypes {
			if _, ok := allowedFileTypes[ext]; !ok {
				errs.Add(prefix+"acceptedFileTypes", "Uploads of type \""+ext+"\" are not permitted.")
			}
		}
		if v.MaxFileSizeBytes != nil && (*v.MaxFileSizeBytes <= 0 || *v.MaxFileSizeBytes > MaxUploadSizeBytes) {
			errs.Add(prefix+"maxFileSizeBytes", "An upload limit must be between 1 byte and 25 MB.")
		}
	}
}

func validateLengths(v *FieldValidation, prefix string, errs FieldErrors) {
	if v.MinLength != nil && *v.MinLength < 0 {
		errs.Add(prefix+"minLength", "A minimum length cannot be negative.")
	}
	if v.MaxLength != nil && (*v.MaxLength < 1 || *v.MaxLength > MaxTextFieldLength) {
		errs.Add(prefix+"maxLength", "A maximum length must be between 1 and 20,000.")
	}
	if v.MinLength != nil && v.MaxLength != nil && *v.MinLength > *v.MaxLength {
		errs.Add(prefix+"maxLength", "The maximum length must be at least the minimum length.")
	}
}

// DefaultForm is the form a new requisition starts with.
//
// A job is useless without somewhere to apply, so creation never leaves the form
// empty; a recruiter who wants something else replaces it rather than building
// the obvious from nothing.
func DefaultForm() ApplicationForm {
	resumeSize := int64(10 << 20)

	return ApplicationForm{
		Version: 1,
		Fields: []FormField{
			{Key: "full_name", Label: "Full name", Type: FieldShortText, Required: true,
				Validation: &FieldValidation{MaxLength: intPtr(160)}},
			{Key: "email", Label: "Email address", Type: FieldEmail, Required: true},
			{Key: "phone", Label: "Phone number", Type: FieldPhone, Required: false},
			{Key: "location", Label: "Where are you based?", Type: FieldShortText, Required: false,
				Validation: &FieldValidation{MaxLength: intPtr(160)}},
			{Key: "resume", Label: "Résumé or CV", Type: FieldFile, Required: true,
				HelpText: "PDF or Word document, up to 10 MB.",
				Validation: &FieldValidation{
					AcceptedFileTypes: []string{"pdf", "doc", "docx"},
					MaxFileSizeBytes:  &resumeSize,
				}},
			{Key: "cover_letter", Label: "Cover letter", Type: FieldLongText, Required: false,
				Validation: &FieldValidation{MaxLength: intPtr(5000)}},
			{Key: "linkedin_url", Label: "LinkedIn profile", Type: FieldURL, Required: false},
			{Key: "work_authorized", Label: "Are you authorized to work in the role's location?",
				Type: FieldBoolean, Required: true},
		},
	}
}

func intPtr(v int) *int { return &v }
