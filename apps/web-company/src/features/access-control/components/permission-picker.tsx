"use client";

import React from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PermissionCatalogue } from "@/lib/rbac/catalogue";

/**
 * Feature-grouped permission picker used by the create and edit role dialogs.
 *
 * Rendered entirely from the catalogue it is handed: a permission added to the
 * platform's registry appears here without touching this component.
 *
 * The catalogue is a required prop rather than a module import with a fallback.
 * These checkboxes decide what a role will hold, and a fallback to this app's
 * own registry would quietly offer keys the identity service cannot store — the
 * sort of mistake that looks like it worked until somebody checks what the role
 * actually grants.
 */
export function PermissionPicker({
  catalogue,
  selected,
  onChange,
  /** Permission keys the current actor may delegate; others render disabled. */
  delegatable,
}: {
  catalogue: PermissionCatalogue;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  delegatable?: Set<string> | null;
}) {
  const canDelegate = (key: string) => !delegatable || delegatable.has(key);

  const toggle = (key: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(key);
    else next.delete(key);
    onChange(next);
  };

  const setMany = (keys: string[], checked: boolean) => {
    const next = new Set(selected);
    for (const key of keys) {
      if (checked) {
        if (canDelegate(key)) next.add(key);
      } else {
        next.delete(key);
      }
    }
    onChange(next);
  };

  const selectableKeys = catalogue.permissions.map((p) => p.key).filter(canDelegate);

  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-xs text-foreground">
          Feature Permissions ({selected.size} of {catalogue.permissions.length} selected)
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => setMany(selectableKeys, true)}
            className="h-6 text-[11px] text-copper"
          >
            Select All
          </Button>
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={() => onChange(new Set())}
            className="h-6 text-[11px] text-muted-foreground"
          >
            Clear All
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {catalogue.groups.map((group) => {
          const features = catalogue.features.filter((f) => f.group === group.key);
          if (features.length === 0) return null;

          return (
            <div key={group.key} className="space-y-2">
              <div className="font-semibold text-[11px] uppercase tracking-wider text-copper">
                {group.name}
              </div>

              {features.map((feature) => {
                const perms = feature.actions;
                const featureKeys = perms.map((p) => p.key);
                const allSelected = featureKeys.every((key) => selected.has(key));

                return (
                  <div
                    key={feature.key}
                    className="p-3 bg-muted/30 rounded-xs border border-border space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-semibold text-[11px] text-foreground block">
                          {feature.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground block leading-tight">
                          {feature.description}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() => setMany(featureKeys, !allSelected)}
                        className="h-6 shrink-0 text-[10px] text-copper"
                      >
                        {allSelected ? "Clear" : "Select all"}
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {perms.map((p) => {
                        const allowed = canDelegate(p.key);
                        return (
                          <label
                            key={p.key}
                            className={`flex items-start gap-2 p-1.5 rounded-xs text-xs ${
                              allowed
                                ? "hover:bg-muted/50 cursor-pointer"
                                : "opacity-50 cursor-not-allowed"
                            }`}
                            title={
                              allowed
                                ? undefined
                                : "You cannot grant a permission you do not hold yourself"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(p.key)}
                              disabled={!allowed}
                              onChange={(e) => toggle(p.key, e.target.checked)}
                              className="mt-0.5 size-3.5 rounded-xs accent-copper cursor-pointer disabled:cursor-not-allowed"
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-foreground block text-[11px] leading-tight">
                                {p.label}
                                {p.sensitive && (
                                  <Badge
                                    variant="outline"
                                    className="ml-1.5 text-[9px] uppercase tracking-wide text-copper border-copper/30"
                                  >
                                    Sensitive
                                  </Badge>
                                )}
                              </span>
                              <span className="text-[10px] text-muted-foreground leading-tight block">
                                {p.description}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70 leading-tight block">
                                {p.key}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
