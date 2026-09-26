// Package domain holds the candidates service's entities and rules.
//
// The rule this service exists to protect is discoverability: a candidate is
// invisible to every company until they say otherwise, and stays invisible to
// the companies they name. Everything else here is ordinary validation.
package domain

import (
	"errors"
	"fmt"
	"net/url"
	"path"
	"strings"
	"time"
	"unicode"
)

// EmploymentType is the shape of an engagement a candidate is open to.
type EmploymentType string

const (
	EmploymentFullTime   EmploymentType = "full_time"
	EmploymentPartTime   EmploymentType = "part_time"
	EmploymentContract   EmploymentType = "contract"
	EmploymentInternship EmploymentType = "internship"
	EmploymentTemporary  EmploymentType = "temporary"
	EmploymentFreelance  EmploymentType = "freelance"
)

// Valid reports whether the employment type is one the platform recognizes.
func (e EmploymentType) Valid() bool {
	switch e {
	case EmploymentFullTime, EmploymentPartTime, EmploymentContract,
		EmploymentInternship, EmploymentTemporary, EmploymentFreelance:
		return true
	default:
		return false
	}
}

// WorkAuthorisation is the candidate's right to work, as they declare it.
type WorkAuthorisation string

const (
	WorkAuthUnspecified         WorkAuthorisation = "unspecified"
	WorkAuthCitizen             WorkAuthorisation = "citizen"
	WorkAuthPermanentResident   WorkAuthorisation = "permanent_resident"
	WorkAuthVisaHolder          WorkAuthorisation = "visa_holder"
	WorkAuthRequiresSponsorship WorkAuthorisation = "requires_sponsorship"
)

// Valid reports whether the work authorisation is one the platform recognizes.
func (w WorkAuthorisation) Valid() bool {
	switch w {
	case WorkAuthUnspecified, WorkAuthCitizen, WorkAuthPermanentResident,
		WorkAuthVisaHolder, WorkAuthRequiresSponsorship:
		return true
	default:
		return false
	}
}

// Source records how a candidate entered a company's own pool.
type Source string

const (
	SourceSourced  Source = "sourced"
	SourceImported Source = "imported"
	SourceReferred Source = "referred"
	SourceApplied  Source = "applied"
)

// Valid reports whether the source is one the platform recognizes.
func (s Source) Valid() bool {
	switch s {
	case SourceSourced, SourceImported, SourceReferred, SourceApplied:
		return true
	default:
		return false
	}
}

/* -------------------------------------------------------------------------- */
/* Entities                                                                   */
/* -------------------------------------------------------------------------- */

// Profile is a candidate's own, platform-wide profile.
type Profile struct {
	ID        string
	AccountID string
	Email     string
	FullName  string

	Headline        string
	Summary         string
	Location        string
	YearsExperience int
	CurrentTitle    string
	CurrentEmployer string
	Phone           string

	Skills    []string
	Languages []string

	WebsiteURL  string
	LinkedInURL string
	GitHubURL   string

	DesiredSalaryMinor    *int64
	DesiredSalaryCurrency string

	OpenToTypes       []EmploymentType
	OpenToRemote      bool
	WorkAuthorisation WorkAuthorisation

	Visibility Visibility

	Version   int64
	DeletedAt *time.Time
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Visibility is the candidate's discoverability switch and its exceptions.
type Visibility struct {
	Discoverable        bool
	HideCurrentEmployer bool
	// HideFromCompanies is a block list of company ids, normally the candidate's
	// current employer and the agencies working for it.
	HideFromCompanies []string
}

// VisibleTo reports whether a company may see this profile in talent search.
//
// Both halves matter: the switch is the candidate's consent, and the block list
// is the reason most candidates are willing to flip it at all.
func (v Visibility) VisibleTo(companyID string) bool {
	if !v.Discoverable {
		return false
	}
	for _, blocked := range v.HideFromCompanies {
		if strings.EqualFold(blocked, companyID) {
			return false
		}
	}
	return true
}

// Experience is one entry in a candidate's employment history.
type Experience struct {
	ID             string
	CandidateID    string
	AccountID      string
	Title          string
	Employer       string
	Location       string
	EmploymentType *EmploymentType
	Description    string
	StartedOn      time.Time
	EndedOn        *time.Time
	IsCurrent      bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// Education is one qualification a candidate holds.
type Education struct {
	ID            string
	CandidateID   string
	AccountID     string
	Institution   string
	Qualification string
	FieldOfStudy  string
	Grade         string
	StartedOn     *time.Time
	EndedOn       *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// Certification is one credential a candidate holds.
type Certification struct {
	ID            string
	CandidateID   string
	AccountID     string
	Name          string
	Issuer        string
	CredentialID  string
	CredentialURL string
	IssuedOn      *time.Time
	ExpiresOn     *time.Time
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// Resume is the metadata for one uploaded document. The bytes live in object
// storage; this service records where they went and nothing more.
type Resume struct {
	ID          string
	CandidateID string
	AccountID   string
	ObjectKey   string
	Filename    string
	ContentType string
	SizeBytes   int64
	IsPrimary   bool
	CreatedAt   time.Time
}

// PoolCandidate is a record a company keeps for itself: sourced, imported or
// referred. It is tenant-scoped and never visible to another company.
type PoolCandidate struct {
	ID              string
	CompanyID       string
	FullName        string
	Email           string
	Phone           string
	Headline        string
	Location        string
	Source          Source
	CurrentTitle    string
	CurrentEmployer string
	YearsExperience int
	Skills          []string
	Tags            []string
	Notes           string
	LinkedProfileID string

	ResumeObjectKey   string
	ResumeFilename    string
	ResumeContentType string
	ResumeSizeBytes   int64

	CreatedBy string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Approach records one company reaching out to a discoverable candidate.
type Approach struct {
	ID             string
	CandidateID    string
	CompanyID      string
	ActorAccountID string
	JobID          string
	Subject        string
	Message        string
	CreatedAt      time.Time
}

// SearchResult is the reduced view a company sees in talent search.
//
// It is a separate type from Profile on purpose: contact details have no field
// to live in, so no future handler can accidentally serialize them.
type SearchResult struct {
	ID              string
	Headline        string
	Summary         string
	Location        string
	YearsExperience int
	CurrentTitle    string
	// CurrentEmployer is empty when the candidate chose to hide it.
	CurrentEmployer       string
	Skills                []string
	Languages             []string
	OpenToTypes           []EmploymentType
	OpenToRemote          bool
	WorkAuthorisation     WorkAuthorisation
	DesiredSalaryMinor    *int64
	DesiredSalaryCurrency string
	UpdatedAt             time.Time
}

/* -------------------------------------------------------------------------- */
/* Resume upload rules                                                        */
/* -------------------------------------------------------------------------- */

// MaxResumeBytes caps an upload. A resume is a document, not a media file, and
// ten megabytes is already generous for one.
const MaxResumeBytes int64 = 10 << 20

// ResumeContentTypes is the allow-list, mapped to the extension the stored
// object key gets. Anything else is refused before a URL is signed, because a
// signed URL is a capability we cannot take back once it is handed out.
var ResumeContentTypes = map[string]string{
	"application/pdf":    ".pdf",
	"application/msword": ".doc",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

// ResumeKeyPrefix is the object-storage prefix every candidate document sits
// under, so a bucket policy can enforce what this service also enforces.
func ResumeKeyPrefix(accountID string) string {
	return "candidate/" + accountID + "/"
}

// ResumeObjectKey builds the key an uploaded resume is stored at.
func ResumeObjectKey(accountID, resumeID, contentType string) string {
	return ResumeKeyPrefix(accountID) + resumeID + ResumeContentTypes[contentType]
}

// ValidateResumeUpload checks an upload request before anything is signed.
func ValidateResumeUpload(filename, contentType string, sizeBytes int64) error {
	v := NewValidation()

	name := strings.TrimSpace(filename)
	switch {
	case name == "":
		v.Add("filename", "A file name is required.")
	case len(name) > 255:
		v.Add("filename", "File name must be 255 characters or fewer.")
	case name != path.Base(name) || strings.Contains(name, "\\"):
		// The name is only ever echoed back on download, but a path in it is a
		// sign the caller is probing rather than uploading.
		v.Add("filename", "File name must not contain a path.")
	}

	if _, ok := ResumeContentTypes[strings.ToLower(strings.TrimSpace(contentType))]; !ok {
		v.Add("contentType", "Resumes must be a PDF, DOC or DOCX file.")
	}

	switch {
	case sizeBytes <= 0:
		v.Add("sizeBytes", "A file size is required.")
	case sizeBytes > MaxResumeBytes:
		v.Add("sizeBytes", fmt.Sprintf("Resumes must be %d MB or smaller.", MaxResumeBytes>>20))
	}

	return v.Err()
}

/* -------------------------------------------------------------------------- */
/* Approach rules                                                             */
/* -------------------------------------------------------------------------- */

// ApproachWindow is how long a company must wait before approaching the same
// candidate again. A recruiter who is ignored twice in a fortnight is not going
// to be welcome on the third attempt.
const ApproachWindow = 14 * 24 * time.Hour

// MaxApproachesPerWindow is how many times one company may approach one
// candidate within ApproachWindow.
const MaxApproachesPerWindow = 1

// ApproachAllowed reports whether another approach may be recorded given how
// many already exist inside the window.
func ApproachAllowed(recentCount int) bool {
	return recentCount < MaxApproachesPerWindow
}

// ValidateApproach checks the message a company wants to send.
func ValidateApproach(subject, message string) error {
	v := NewValidation()

	if len(strings.TrimSpace(subject)) > 200 {
		v.Add("subject", "Subject must be 200 characters or fewer.")
	}

	body := strings.TrimSpace(message)
	switch {
	case body == "":
		v.Add("message", "A message is required.")
	case len([]rune(body)) < 20:
		v.Add("message", "A message must be at least 20 characters — say why you are getting in touch.")
	case len([]rune(body)) > 4000:
		v.Add("message", "A message must be 4000 characters or fewer.")
	}

	return v.Err()
}

/* -------------------------------------------------------------------------- */
/* Profile validation                                                         */
/* -------------------------------------------------------------------------- */

// MaxSkills and friends bound the list fields, which are otherwise an easy way
// to turn one row into a megabyte.
const (
	MaxSkills     = 50
	MaxLanguages  = 20
	MaxTags       = 30
	MaxFreeText   = 5000
	MaxShortField = 200
)

// ProfileInput is a partial profile update. A nil pointer means "leave this
// alone", which is what makes PATCH distinguishable from "clear the field".
type ProfileInput struct {
	Headline        *string
	Summary         *string
	Location        *string
	YearsExperience *int
	CurrentTitle    *string
	CurrentEmployer *string
	Phone           *string

	Skills    *[]string
	Languages *[]string

	WebsiteURL  *string
	LinkedInURL *string
	GitHubURL   *string

	DesiredSalaryMinor    *int64
	DesiredSalaryCurrency *string

	OpenToTypes       *[]EmploymentType
	OpenToRemote      *bool
	WorkAuthorisation *WorkAuthorisation
}

// Validate checks a profile update.
func (in ProfileInput) Validate() error {
	v := NewValidation()

	checkShort(v, "headline", in.Headline)
	checkShort(v, "location", in.Location)
	checkShort(v, "currentTitle", in.CurrentTitle)
	checkShort(v, "currentEmployer", in.CurrentEmployer)

	if in.Summary != nil && len([]rune(*in.Summary)) > MaxFreeText {
		v.Add("summary", fmt.Sprintf("Summary must be %d characters or fewer.", MaxFreeText))
	}
	if in.YearsExperience != nil && (*in.YearsExperience < 0 || *in.YearsExperience > 70) {
		v.Add("yearsExperience", "Years of experience must be between 0 and 70.")
	}
	if in.Phone != nil && !validPhone(*in.Phone) {
		v.Add("phone", "Enter a phone number in international format, digits and spaces only.")
	}

	checkList(v, "skills", in.Skills, MaxSkills)
	checkList(v, "languages", in.Languages, MaxLanguages)

	checkURL(v, "websiteUrl", in.WebsiteURL)
	checkURL(v, "linkedinUrl", in.LinkedInURL)
	checkURL(v, "githubUrl", in.GitHubURL)

	// Minor units and a currency only mean something together.
	if in.DesiredSalaryMinor != nil && *in.DesiredSalaryMinor < 0 {
		v.Add("desiredSalaryMinor", "A desired salary cannot be negative.")
	}
	if in.DesiredSalaryCurrency != nil && *in.DesiredSalaryCurrency != "" && !ValidCurrency(*in.DesiredSalaryCurrency) {
		v.Add("desiredSalaryCurrency", "Currency must be a three-letter ISO 4217 code.")
	}
	if in.DesiredSalaryMinor != nil && *in.DesiredSalaryMinor > 0 {
		if in.DesiredSalaryCurrency == nil || !ValidCurrency(*in.DesiredSalaryCurrency) {
			v.Add("desiredSalaryCurrency", "A currency is required alongside a desired salary.")
		}
	}

	if in.OpenToTypes != nil {
		if len(*in.OpenToTypes) > 6 {
			v.Add("openToTypes", "Choose at most six employment types.")
		}
		for _, t := range *in.OpenToTypes {
			if !t.Valid() {
				v.Add("openToTypes", fmt.Sprintf("%q is not a recognised employment type.", string(t)))
				break
			}
		}
	}

	if in.WorkAuthorisation != nil && !in.WorkAuthorisation.Valid() {
		v.Add("workAuthorisation", "Work authorisation is not one of the recognised values.")
	}

	return v.Err()
}

// Validate checks a visibility change.
func (v Visibility) Validate() error {
	errs := NewValidation()
	if len(v.HideFromCompanies) > 100 {
		errs.Add("hideFromCompanies", "You can block at most 100 companies.")
	}
	for _, id := range v.HideFromCompanies {
		if !ValidUUID(id) {
			errs.Add("hideFromCompanies", "Each blocked company must be a valid company id.")
			break
		}
	}
	return errs.Err()
}

// Validate checks one employment-history entry.
func (e Experience) Validate() error {
	v := NewValidation()

	requireShort(v, "title", e.Title)
	requireShort(v, "employer", e.Employer)
	if len([]rune(e.Description)) > MaxFreeText {
		v.Add("description", fmt.Sprintf("Description must be %d characters or fewer.", MaxFreeText))
	}
	if e.EmploymentType != nil && !e.EmploymentType.Valid() {
		v.Add("employmentType", "Employment type is not one of the recognised values.")
	}
	if e.StartedOn.IsZero() {
		v.Add("startedOn", "A start date is required.")
	}
	// A role that is still held has no end date, and one that ended has to have
	// ended after it began — the two mistakes a date picker actually produces.
	if e.IsCurrent && e.EndedOn != nil {
		v.Add("endedOn", "A current role cannot have an end date.")
	}
	if e.EndedOn != nil && !e.StartedOn.IsZero() && e.EndedOn.Before(e.StartedOn) {
		v.Add("endedOn", "The end date must fall after the start date.")
	}

	return v.Err()
}

// Validate checks one education entry.
func (e Education) Validate() error {
	v := NewValidation()

	requireShort(v, "institution", e.Institution)
	requireShort(v, "qualification", e.Qualification)
	checkShort(v, "fieldOfStudy", &e.FieldOfStudy)
	checkShort(v, "grade", &e.Grade)
	if e.StartedOn != nil && e.EndedOn != nil && e.EndedOn.Before(*e.StartedOn) {
		v.Add("endedOn", "The end date must fall after the start date.")
	}

	return v.Err()
}

// Validate checks one certification entry.
func (c Certification) Validate() error {
	v := NewValidation()

	requireShort(v, "name", c.Name)
	checkShort(v, "issuer", &c.Issuer)
	checkShort(v, "credentialId", &c.CredentialID)
	checkURL(v, "credentialUrl", &c.CredentialURL)
	if c.IssuedOn != nil && c.ExpiresOn != nil && c.ExpiresOn.Before(*c.IssuedOn) {
		v.Add("expiresOn", "The expiry date must fall after the issue date.")
	}

	return v.Err()
}

// Validate checks a company's own pool record.
func (p PoolCandidate) Validate() error {
	v := NewValidation()

	requireShort(v, "fullName", p.FullName)
	if p.Email != "" && !looksLikeEmail(p.Email) {
		v.Add("email", "Enter a valid email address.")
	}
	if p.Phone != "" && !validPhone(p.Phone) {
		v.Add("phone", "Enter a phone number in international format, digits and spaces only.")
	}
	checkShort(v, "headline", &p.Headline)
	checkShort(v, "location", &p.Location)
	checkShort(v, "currentTitle", &p.CurrentTitle)
	checkShort(v, "currentEmployer", &p.CurrentEmployer)
	if !p.Source.Valid() {
		v.Add("source", "Source must be one of: sourced, imported, referred, applied.")
	}
	if p.YearsExperience < 0 || p.YearsExperience > 70 {
		v.Add("yearsExperience", "Years of experience must be between 0 and 70.")
	}
	if len(p.Skills) > MaxSkills {
		v.Add("skills", fmt.Sprintf("List at most %d skills.", MaxSkills))
	}
	if len(p.Tags) > MaxTags {
		v.Add("tags", fmt.Sprintf("Apply at most %d tags.", MaxTags))
	}
	if len([]rune(p.Notes)) > MaxFreeText {
		v.Add("notes", fmt.Sprintf("Notes must be %d characters or fewer.", MaxFreeText))
	}

	return v.Err()
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

// ValidCurrency reports whether a string is a three-letter ISO 4217 code.
func ValidCurrency(code string) bool {
	if len(code) != 3 {
		return false
	}
	for _, r := range code {
		if r < 'A' || r > 'Z' {
			return false
		}
	}
	return true
}

// ValidUUID reports whether a string is a canonical 8-4-4-4-12 UUID.
//
// Company ids reach this service as text and are cast to uuid in SQL; checking
// the shape first turns a malformed tenant into a clean refusal rather than a
// database error surfacing as a 500.
// ValidEmail is a deliberately permissive check.
//
// The only authoritative test of an address is delivering to it; a strict
// pattern here would reject valid addresses and still accept undeliverable
// ones, so this catches typos rather than pretending to verify.
func ValidEmail(value string) bool {
	value = strings.TrimSpace(value)
	at := strings.LastIndex(value, "@")
	if at <= 0 || at == len(value)-1 || len(value) > 254 {
		return false
	}
	domainPart := value[at+1:]
	return strings.Contains(domainPart, ".") &&
		!strings.HasPrefix(domainPart, ".") &&
		!strings.HasSuffix(domainPart, ".") &&
		!strings.ContainsAny(value, " \t\r\n")
}

// NormalizeList trims, drops blanks and de-duplicates case-insensitively while
// keeping the caller's order.
//
// Skill and tag lists arrive from free-text inputs, where "Go", "go " and "GO"
// are one skill; storing all three would fragment every search over them.
func NormalizeList(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, done := seen[key]; done {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, trimmed)
	}
	return out
}

func ValidUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for i, r := range value {
		switch i {
		case 8, 13, 18, 23:
			if r != '-' {
				return false
			}
		default:
			if !isHexDigit(r) {
				return false
			}
		}
	}
	return true
}

func isHexDigit(r rune) bool {
	return (r >= '0' && r <= '9') || (r >= 'a' && r <= 'f') || (r >= 'A' && r <= 'F')
}

func requireShort(v *Validation, field, value string) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		v.Add(field, "This field is required.")
		return
	}
	if len([]rune(trimmed)) > MaxShortField {
		v.Add(field, fmt.Sprintf("Must be %d characters or fewer.", MaxShortField))
	}
}

func checkShort(v *Validation, field string, value *string) {
	if value == nil {
		return
	}
	if len([]rune(*value)) > MaxShortField {
		v.Add(field, fmt.Sprintf("Must be %d characters or fewer.", MaxShortField))
	}
}

func checkList(v *Validation, field string, values *[]string, max int) {
	if values == nil {
		return
	}
	if len(*values) > max {
		v.Add(field, fmt.Sprintf("List at most %d entries.", max))
		return
	}
	for _, entry := range *values {
		if len([]rune(entry)) > MaxShortField {
			v.Add(field, fmt.Sprintf("Each entry must be %d characters or fewer.", MaxShortField))
			return
		}
	}
}

// checkURL refuses anything that is not an absolute http(s) URL, so a stored
// link cannot become a `javascript:` payload in whatever renders the profile.
func checkURL(v *Validation, field string, value *string) {
	if value == nil || strings.TrimSpace(*value) == "" {
		return
	}
	parsed, err := url.Parse(strings.TrimSpace(*value))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		v.Add(field, "Enter a full web address beginning with http:// or https://.")
		return
	}
	if len(*value) > 500 {
		v.Add(field, "Must be 500 characters or fewer.")
	}
}

func validPhone(value string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return true
	}
	if len(trimmed) < 6 || len(trimmed) > 32 {
		return false
	}
	digits := 0
	for i, r := range trimmed {
		switch {
		case unicode.IsDigit(r):
			digits++
		case r == '+' && i == 0, r == ' ', r == '-', r == '(', r == ')':
		default:
			return false
		}
	}
	return digits >= 6
}

func looksLikeEmail(value string) bool {
	value = strings.TrimSpace(value)
	at := strings.Index(value, "@")
	dot := strings.LastIndex(value, ".")
	return at > 0 && dot > at+1 && dot < len(value)-1 && !strings.Contains(value, " ")
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

// Errors returned by the candidates domain. Handlers map these onto HTTP
// responses; the messages are safe to show a user.
var (
	ErrProfileNotFound   = errors.New("candidate profile not found")
	ErrProfileDeleted    = errors.New("this profile has been deleted")
	ErrEntryNotFound     = errors.New("entry not found")
	ErrResumeNotFound    = errors.New("resume not found")
	ErrResumeLimit       = errors.New("you can keep at most ten resumes; delete one first")
	ErrCandidateNotFound = errors.New("candidate not found")
	ErrNoResume          = errors.New("this candidate has no resume on file")
	ErrApproachTooSoon   = errors.New("your company has already approached this candidate recently")
	ErrInvalidCursor     = errors.New("the page cursor is not valid")
)

// Validation collects field-level failures so one response can report every
// mistake a form made rather than the first.
type Validation struct {
	fields map[string][]string
}

// NewValidation starts an empty collection.
func NewValidation() *Validation {
	return &Validation{fields: map[string][]string{}}
}

// Add records a failure against a field.
func (v *Validation) Add(field, message string) {
	v.fields[field] = append(v.fields[field], message)
}

// Err returns the collected failures, or nil when there are none.
func (v *Validation) Err() error {
	if len(v.fields) == 0 {
		return nil
	}
	return &ValidationError{Fields: v.fields}
}

// ValidationError reports caller mistakes, one entry per offending field.
type ValidationError struct {
	Fields map[string][]string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation failed for %d field(s)", len(e.Fields))
}

// Invalid builds a single-field validation error.
func Invalid(field, message string) error {
	return &ValidationError{Fields: map[string][]string{field: {message}}}
}
