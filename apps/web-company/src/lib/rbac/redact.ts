/**
 * Field-level redaction.
 *
 * Permissions gate whole operations; some fields need gating inside an allowed
 * one. Compensation is the clearest case: a hiring manager may read an
 * application but not the candidate's salary expectation, so the server strips
 * those columns rather than trusting the client to hide them.
 */
const COMPENSATION_FIELDS = [
  "expectedSalary",
  "expectedSalaryText",
  "salaryMin",
  "salaryMax",
  "baseSalary",
  "signOnBonus",
  "annualBonus",
  "equityShares",
  "equityRange",
  "bonusStructure",
] as const;

export function redactCompensation<T extends Record<string, any>>(
  row: T,
  canViewCompensation: boolean,
): T {
  if (canViewCompensation) return row;
  const copy: Record<string, any> = { ...row };
  for (const field of COMPENSATION_FIELDS) {
    if (field in copy) copy[field] = null;
  }
  return copy as T;
}

export function redactCompensationAll<T extends Record<string, any>>(
  rows: T[],
  canViewCompensation: boolean,
): T[] {
  if (canViewCompensation) return rows;
  return rows.map((row) => redactCompensation(row, false));
}
