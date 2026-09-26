import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPLOYMENT_TYPES, WORK_MODES } from "@/lib/format";

export interface JobFilterValues {
  q: string;
  location: string;
  department: string;
  employmentType: string;
  workMode: string;
}

/**
 * A plain GET form, not a controlled client component.
 *
 * Submitting navigates, so the filters live in the URL: a filtered board can be
 * bookmarked, shared and linked to, the back button does the obvious thing, and
 * the whole thing still works before — or without — hydration.
 */
export function JobFilters({ values }: { values: JobFilterValues }) {
  return (
    <form method="get" action="/" className="surface p-4" role="search">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="q">Search</Label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={values.q}
            placeholder="Title, skill or keyword"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            defaultValue={values.location}
            placeholder="Anywhere"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="employmentType">Employment type</Label>
          {/* A native select: it is keyboard- and screen-reader-correct on
              every platform for free, and it submits with the form. */}
          <select
            id="employmentType"
            name="employmentType"
            defaultValue={values.employmentType}
            className="flex h-10 w-full rounded-xs border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Any</option>
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="workMode">Work mode</Label>
          <select
            id="workMode"
            name="workMode"
            defaultValue={values.workMode}
            className="flex h-10 w-full rounded-xs border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Any</option>
            {WORK_MODES.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="department">Department</Label>
          <Input
            id="department"
            name="department"
            defaultValue={values.department}
            placeholder="Any department"
          />
        </div>
        <Button type="submit" variant="accent" className="gap-2">
          <Search aria-hidden="true" />
          Search jobs
        </Button>
      </div>
    </form>
  );
}
