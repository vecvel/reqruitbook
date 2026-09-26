"use server";

import {
  listMaster,
  createMaster,
  updateMaster,
  deleteMaster,
} from "./master-crud";

/**
 * Named server actions for each master-data feature.
 *
 * These are thin, explicitly-typed entry points over the shared CRUD factory —
 * the factory holds the guard, the org scoping, and the audit entry, so a new
 * master needs only its config plus the four wrappers below.
 */

/* --- Departments --- */

export async function getDepartments() {
  return listMaster("departments");
}

export async function createDepartment(data: Record<string, any>) {
  return createMaster("departments", data);
}

export async function updateDepartment(id: string, data: Record<string, any>) {
  return updateMaster("departments", id, data);
}

export async function deleteDepartment(id: string) {
  return deleteMaster("departments", id);
}

/* --- Locations --- */

export async function getLocations() {
  return listMaster("locations");
}

export async function createLocation(data: Record<string, any>) {
  return createMaster("locations", data);
}

export async function updateLocation(id: string, data: Record<string, any>) {
  return updateMaster("locations", id, data);
}

export async function deleteLocation(id: string) {
  return deleteMaster("locations", id);
}

/* --- WorkModes --- */

export async function getWorkModes() {
  return listMaster("work-modes");
}

export async function createWorkMode(data: Record<string, any>) {
  return createMaster("work-modes", data);
}

export async function updateWorkMode(id: string, data: Record<string, any>) {
  return updateMaster("work-modes", id, data);
}

export async function deleteWorkMode(id: string) {
  return deleteMaster("work-modes", id);
}

/* --- EmploymentTypes --- */

export async function getEmploymentTypes() {
  return listMaster("employment-types");
}

export async function createEmploymentType(data: Record<string, any>) {
  return createMaster("employment-types", data);
}

export async function updateEmploymentType(id: string, data: Record<string, any>) {
  return updateMaster("employment-types", id, data);
}

export async function deleteEmploymentType(id: string) {
  return deleteMaster("employment-types", id);
}

/* --- ExperienceLevels --- */

export async function getExperienceLevels() {
  return listMaster("experience-levels");
}

export async function createExperienceLevel(data: Record<string, any>) {
  return createMaster("experience-levels", data);
}

export async function updateExperienceLevel(id: string, data: Record<string, any>) {
  return updateMaster("experience-levels", id, data);
}

export async function deleteExperienceLevel(id: string) {
  return deleteMaster("experience-levels", id);
}

/* --- EducationLevels --- */

export async function getEducationLevels() {
  return listMaster("education-levels");
}

export async function createEducationLevel(data: Record<string, any>) {
  return createMaster("education-levels", data);
}

export async function updateEducationLevel(id: string, data: Record<string, any>) {
  return updateMaster("education-levels", id, data);
}

export async function deleteEducationLevel(id: string) {
  return deleteMaster("education-levels", id);
}

/* --- Currencies --- */

export async function getCurrencies() {
  return listMaster("currencies");
}

export async function createCurrency(data: Record<string, any>) {
  return createMaster("currencies", data);
}

export async function updateCurrency(id: string, data: Record<string, any>) {
  return updateMaster("currencies", id, data);
}

export async function deleteCurrency(id: string) {
  return deleteMaster("currencies", id);
}

/* --- PayFrequencies --- */

export async function getPayFrequencies() {
  return listMaster("pay-frequencies");
}

export async function createPayFrequency(data: Record<string, any>) {
  return createMaster("pay-frequencies", data);
}

export async function updatePayFrequency(id: string, data: Record<string, any>) {
  return updateMaster("pay-frequencies", id, data);
}

export async function deletePayFrequency(id: string) {
  return deleteMaster("pay-frequencies", id);
}

/* --- JobStatuses --- */

export async function getJobStatuses() {
  return listMaster("job-statuses");
}

export async function createJobStatus(data: Record<string, any>) {
  return createMaster("job-statuses", data);
}

export async function updateJobStatus(id: string, data: Record<string, any>) {
  return updateMaster("job-statuses", id, data);
}

export async function deleteJobStatus(id: string) {
  return deleteMaster("job-statuses", id);
}

/* --- InterviewTypes --- */

export async function getInterviewTypes() {
  return listMaster("interview-types");
}

export async function createInterviewType(data: Record<string, any>) {
  return createMaster("interview-types", data);
}

export async function updateInterviewType(id: string, data: Record<string, any>) {
  return updateMaster("interview-types", id, data);
}

export async function deleteInterviewType(id: string) {
  return deleteMaster("interview-types", id);
}

/* --- BenefitCategories --- */

export async function getBenefitCategories() {
  return listMaster("benefit-categories");
}

export async function createBenefitCategory(data: Record<string, any>) {
  return createMaster("benefit-categories", data);
}

export async function updateBenefitCategory(id: string, data: Record<string, any>) {
  return updateMaster("benefit-categories", id, data);
}

export async function deleteBenefitCategory(id: string) {
  return deleteMaster("benefit-categories", id);
}
