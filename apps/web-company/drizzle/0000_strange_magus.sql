CREATE TYPE "public"."application_stage" AS ENUM('applied', 'screening', 'shortlisted', 'interview', 'evaluation', 'selected', 'offer', 'hired', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'internship');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('draft', 'published', 'on_hold', 'closed');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('draft', 'pending_approval', 'approved', 'sent', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('system_admin', 'hr_admin', 'recruiter', 'hiring_manager', 'interviewer');--> statement-breakpoint
CREATE TYPE "public"."work_mode" AS ENUM('on_site', 'remote', 'hybrid');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"org_id" varchar(64) NOT NULL,
	"actor_id" varchar(64),
	"action" text NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(64) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_messages" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"candidate_id" varchar(64) NOT NULL,
	"template_id" varchar(64),
	"sender_id" varchar(64),
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" varchar(32) DEFAULT 'sent' NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"org_id" varchar(64) NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"city" text,
	"country" text,
	"current_designation" text,
	"current_company" text,
	"total_experience_years" integer,
	"expected_salary" integer,
	"notice_period_days" integer,
	"rating" text DEFAULT '4.8',
	"skills" jsonb DEFAULT '[]'::jsonb,
	"resume_url" text,
	"portfolio_url" text,
	"linkedin_url" text,
	"notes" text,
	"in_talent_pool" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_templates" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"org_id" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"trigger_event" varchar(64) NOT NULL,
	"subject" text NOT NULL,
	"body_template" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"org_id" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"code" varchar(16) NOT NULL,
	"lead_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interview_scorecards" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"interview_id" varchar(64) NOT NULL,
	"interviewer_id" varchar(64) NOT NULL,
	"overall_rating" integer NOT NULL,
	"recommendation" varchar(32) NOT NULL,
	"technical_score" integer,
	"communication_score" integer,
	"culture_score" integer,
	"strengths" text,
	"concerns" text,
	"feedback_notes" text,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"application_id" varchar(64) NOT NULL,
	"candidate_id" varchar(64) NOT NULL,
	"round_title" text NOT NULL,
	"round_type" varchar(32) DEFAULT 'technical',
	"scheduled_start" timestamp NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"format" varchar(32) DEFAULT 'video',
	"meeting_link" text,
	"panel_member_ids" jsonb DEFAULT '[]'::jsonb,
	"status" "interview_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"job_id" varchar(64) NOT NULL,
	"candidate_id" varchar(64) NOT NULL,
	"stage" "application_stage" DEFAULT 'applied' NOT NULL,
	"fit_score" integer DEFAULT 85,
	"source" text DEFAULT 'Careers Portal (Direct)',
	"answers" jsonb DEFAULT '{}'::jsonb,
	"rejected_reason" text,
	"hired_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_openings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"org_id" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"department_id" varchar(64),
	"location_id" varchar(64),
	"location_text" text DEFAULT 'San Francisco, CA / Remote',
	"work_mode" "work_mode" DEFAULT 'hybrid' NOT NULL,
	"employment_type" "employment_type" DEFAULT 'full_time' NOT NULL,
	"vacancies" integer DEFAULT 1 NOT NULL,
	"hiring_manager_id" varchar(64),
	"recruiter_id" varchar(64),
	"salary_min" integer,
	"salary_max" integer,
	"currency" varchar(8) DEFAULT 'USD',
	"status" "job_status" DEFAULT 'draft' NOT NULL,
	"summary" text,
	"responsibilities" text,
	"requirements" text,
	"benefits" text,
	"skills" jsonb DEFAULT '[]'::jsonb,
	"custom_questions" jsonb DEFAULT '[]'::jsonb,
	"published_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"org_id" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"country" text NOT NULL,
	"is_remote_hub" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"application_id" varchar(64) NOT NULL,
	"candidate_id" varchar(64) NOT NULL,
	"designation" text NOT NULL,
	"department_name" text NOT NULL,
	"base_salary" integer NOT NULL,
	"currency" varchar(8) DEFAULT 'USD' NOT NULL,
	"joining_date" text NOT NULL,
	"reporting_manager" text,
	"work_location" text,
	"benefits_summary" text,
	"offer_letter_content" text,
	"status" "offer_status" DEFAULT 'draft' NOT NULL,
	"hrm_synced" boolean DEFAULT false NOT NULL,
	"hrm_synced_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" text DEFAULT 'My Organisation' NOT NULL,
	"slug" varchar(64) NOT NULL,
	"careers_domain" text DEFAULT 'careers.myorganisation.com',
	"logo_url" text DEFAULT '/logo.png',
	"default_currency" varchar(8) DEFAULT 'USD',
	"timezone" varchar(64) DEFAULT 'UTC',
	"hrm_webhook_url" text,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"org_id" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'recruiter' NOT NULL,
	"department_id" varchar(64),
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_messages" ADD CONSTRAINT "candidate_messages_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_messages" ADD CONSTRAINT "candidate_messages_template_id_communication_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."communication_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidate_messages" ADD CONSTRAINT "candidate_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_scorecards" ADD CONSTRAINT "interview_scorecards_interviewer_id_users_id_fk" FOREIGN KEY ("interviewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_application_id_job_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_id_job_openings_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_openings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_hiring_manager_id_users_id_fk" FOREIGN KEY ("hiring_manager_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_openings" ADD CONSTRAINT "job_openings_recruiter_id_users_id_fk" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_application_id_job_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."job_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candidate_email_org_idx" ON "candidates" USING btree ("org_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "app_job_candidate_idx" ON "job_applications" USING btree ("job_id","candidate_id");--> statement-breakpoint
CREATE INDEX "app_stage_idx" ON "job_applications" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "job_status_idx" ON "job_openings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_dept_idx" ON "job_openings" USING btree ("department_id");