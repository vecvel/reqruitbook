package domain

import "time"

// PublicSalary is the part of a salary band a candidate may see.
type PublicSalary struct {
	Min      *int64 `json:"min,omitempty"`
	Max      *int64 `json:"max,omitempty"`
	Currency string `json:"currency,omitempty"`
}

// PublicJob is the only shape a job takes on an unauthenticated surface.
//
// It is a separate type rather than a set of `omitempty` tags on Job because
// omission has to be the default: a field added to a requisition later should
// stay private until somebody deliberately publishes it here. Notably absent are
// the hiring manager and recruiter ids, the internal notes, the headcount, and
// any salary band the company chose to keep to itself.
type PublicJob struct {
	ID             string         `json:"id"`
	Slug           string         `json:"slug"`
	Title          string         `json:"title"`
	Department     string         `json:"department,omitempty"`
	Locations      []string       `json:"locations"`
	WorkMode       WorkMode       `json:"workMode"`
	EmploymentType EmploymentType `json:"employmentType"`
	Seniority      Seniority      `json:"seniority"`
	Description    string         `json:"description"`
	Requirements   string         `json:"requirements,omitempty"`
	Salary         *PublicSalary  `json:"salary,omitempty"`
	PublishedAt    *time.Time     `json:"publishedAt,omitempty"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}

// PublicView projects a job onto its public shape.
func (j Job) PublicView() PublicJob {
	view := PublicJob{
		ID:             j.ID,
		Slug:           j.Slug,
		Title:          j.Title,
		Department:     j.Department,
		Locations:      j.Locations,
		WorkMode:       j.WorkMode,
		EmploymentType: j.EmploymentType,
		Seniority:      j.Seniority,
		Description:    j.Description,
		Requirements:   j.Requirements,
		PublishedAt:    j.OpenedAt,
		UpdatedAt:      j.UpdatedAt,
	}

	if view.Locations == nil {
		view.Locations = []string{}
	}

	// The flag is the company's decision and the only thing that may reveal the
	// band. A band with no bounds is nothing to show.
	if j.Salary.Public && j.Salary.Declared() {
		view.Salary = &PublicSalary{
			Min:      j.Salary.Min,
			Max:      j.Salary.Max,
			Currency: j.Salary.Currency,
		}
	}

	return view
}

// PublicSummary is a row on a job board listing.
type PublicSummary struct {
	ID             string         `json:"id"`
	Slug           string         `json:"slug"`
	Title          string         `json:"title"`
	Department     string         `json:"department,omitempty"`
	Locations      []string       `json:"locations"`
	WorkMode       WorkMode       `json:"workMode"`
	EmploymentType EmploymentType `json:"employmentType"`
	Seniority      Seniority      `json:"seniority"`
	Salary         *PublicSalary  `json:"salary,omitempty"`
	PublishedAt    *time.Time     `json:"publishedAt,omitempty"`
}

// PublicSummaryView projects a job onto a board row.
func (j Job) PublicSummaryView() PublicSummary {
	full := j.PublicView()
	return PublicSummary{
		ID:             full.ID,
		Slug:           full.Slug,
		Title:          full.Title,
		Department:     full.Department,
		Locations:      full.Locations,
		WorkMode:       full.WorkMode,
		EmploymentType: full.EmploymentType,
		Seniority:      full.Seniority,
		Salary:         full.Salary,
		PublishedAt:    full.PublishedAt,
	}
}
