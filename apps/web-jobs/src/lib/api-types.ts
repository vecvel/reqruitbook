/**
 * The wire shapes this portal reads, transcribed from the services that emit
 * them. Nothing here is invented: each type mirrors a view struct in
 * services/{jobs,candidates,applications,messaging,notifications}.
 */

/* ------------------------------------------------------------------ jobs -- */

export type WorkMode = "onsite" | "hybrid" | "remote";
export type EmploymentType =
  | "full_time"
  | "part_time"
  | "contract"
  | "temporary"
  | "internship";
export type Seniority =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "principal"
  | "executive";

export interface PublicSalary {
  min?: number;
  max?: number;
  currency?: string;
}

export interface JobSummary {
  id: string;
  slug: string;
  title: string;
  department?: string;
  locations: string[];
  workMode: WorkMode;
  employmentType: EmploymentType;
  seniority: Seniority;
  salary?: PublicSalary;
  publishedAt?: string;
}

export interface JobDetail extends JobSummary {
  description: string;
  requirements?: string;
  updatedAt: string;
}

export interface JobBoardPage {
  jobs: JobSummary[];
  nextCursor: string;
}

/* ------------------------------------------------------- application form -- */

export type FieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "url"
  | "number"
  | "date"
  | "single_select"
  | "multi_select"
  | "boolean"
  | "file";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  /** Lower-case extensions without the dot. */
  acceptedFileTypes?: string[];
  maxFileSizeBytes?: number;
  maxSelections?: number;
}

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  helpText?: string;
  options?: FieldOption[];
  validation?: FieldValidation;
}

export interface ApplicationForm {
  fields: FormField[];
  version: number;
}

export interface JobFormResponse {
  jobId: string;
  slug: string;
  title: string;
  form: ApplicationForm;
  allowedFileTypes: string[];
}

/* ------------------------------------------------------- candidate profile */

export interface Salary {
  minor: number;
  currency: string;
}

export interface Visibility {
  discoverable: boolean;
  hideCurrentEmployer: boolean;
  hideFromCompanies: string[];
}

export type WorkAuthorisation =
  | "unspecified"
  | "citizen"
  | "permanent_resident"
  | "visa_holder"
  | "requires_sponsorship";

export interface Profile {
  id: string;
  accountId: string;
  email: string;
  fullName: string;
  headline: string;
  summary: string;
  location: string;
  yearsExperience: number;
  currentTitle: string;
  currentEmployer: string;
  phone: string;
  skills: string[];
  languages: string[];
  websiteUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  desiredSalary?: Salary;
  openToTypes: EmploymentType[];
  openToRemote: boolean;
  workAuthorisation: WorkAuthorisation;
  visibility: Visibility;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProfilePatch {
  headline?: string;
  summary?: string;
  location?: string;
  yearsExperience?: number;
  currentTitle?: string;
  currentEmployer?: string;
  phone?: string;
  skills?: string[];
  languages?: string[];
  websiteUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  desiredSalaryMinor?: number | null;
  desiredSalaryCurrency?: string | null;
  openToTypes?: EmploymentType[];
  openToRemote?: boolean;
  workAuthorisation?: WorkAuthorisation;
}

export interface Experience {
  id: string;
  title: string;
  employer: string;
  location: string;
  employmentType?: EmploymentType;
  description: string;
  startedOn: string;
  endedOn?: string;
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Education {
  id: string;
  institution: string;
  qualification: string;
  fieldOfStudy: string;
  grade: string;
  startedOn?: string;
  endedOn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  credentialId: string;
  credentialUrl: string;
  issuedOn?: string;
  expiresOn?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Resume {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  isPrimary: boolean;
  createdAt: string;
}

export interface ResumeUploadTicket {
  resumeId: string;
  uploadUrl: string;
  method: string;
  headers: { "Content-Type": string };
  expiresAt: string;
  resume: Resume;
}

/** The candidates service wraps every list in `{ data, nextCursor }`. */
export interface DataPage<T> {
  data: T[];
  nextCursor?: string;
}

/* ---------------------------------------------------------- applications -- */

export type ApplicationStatus =
  | "submitted"
  | "in_review"
  | "interviewing"
  | "offered"
  | "hired"
  | "rejected"
  | "withdrawn";

export interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  status: ApplicationStatus;
  stageName?: string;
  answers?: Record<string, unknown>;
  resumeKey?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  withdrawnAt?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface ApplicationPage {
  applications: Application[];
  nextCursor: string;
}

export interface ApplyRequest {
  jobId: string;
  answers: Record<string, unknown>;
  resumeKey?: string;
  source?: string;
}

/* -------------------------------------------------------------- messaging -- */

export interface Conversation {
  id: string;
  companyId?: string;
  applicationId?: string;
  jobId?: string;
  subject?: string;
  origin: string;
  lastActivityAt: string;
  lastMessagePreview?: string;
  lastMessageSender?: string;
  unreadCount: number;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderType: "company" | "candidate";
  body: string;
  attachments: Attachment[];
  sentAt: string;
  readAt?: string;
}

/* ---------------------------------------------------------- notifications -- */

export interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  payload: Record<string, unknown>;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationPage {
  notifications: Notification[];
  nextCursor: string;
  unreadCount: number;
}
