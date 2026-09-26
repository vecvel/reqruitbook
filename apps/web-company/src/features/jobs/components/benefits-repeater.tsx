"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Layers,
} from "lucide-react";

export interface BenefitItem {
  id: string;
  title: string;
  description?: string;
  category: "healthcare" | "financial" | "pto" | "growth" | "equipment" | "wellness" | "custom";
}

export const BENEFIT_CATEGORIES = [
  { value: "healthcare", label: "Health & Medical", color: "text-rose-600 bg-rose-500/10 border-rose-500/20" },
  { value: "financial", label: "Financial & Equity", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  { value: "pto", label: "Time Off & Leave", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  { value: "growth", label: "Growth & Learning", color: "text-purple-600 bg-purple-500/10 border-purple-500/20" },
  { value: "equipment", label: "Equipment & Remote", color: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
  { value: "wellness", label: "Wellness & Lifestyle", color: "text-teal-600 bg-teal-500/10 border-teal-500/20" },
  { value: "custom", label: "Other Perks", color: "text-copper bg-copper/10 border-copper/20" },
] as const;

export const BENEFIT_PRESETS: Omit<BenefitItem, "id">[] = [
  {
    title: "Comprehensive Health, Dental & Vision",
    description: "100% premium coverage for employees and 75% for dependents with top-tier PPO/HMO options.",
    category: "healthcare",
  },
  {
    title: "401(k) / Pension 5% Match",
    description: "Dollar-for-dollar matching up to 5% with immediate vesting from day one.",
    category: "financial",
  },
  {
    title: "Equity & Stock Options",
    description: "Early-stage incentive stock option grants with standard 4-year vesting and 1-year cliff.",
    category: "financial",
  },
  {
    title: "Flexible & Unlimited Paid Time Off",
    description: "Encouraged minimum 25 days annual leave plus 12 official public holidays.",
    category: "pto",
  },
  {
    title: "Home Office & Hardware Stipend",
    description: "$1,500 one-time workspace setup allowance + top-spec MacBook Pro or workstation.",
    category: "equipment",
  },
  {
    title: "$2,500 Annual Learning Budget",
    description: "Dedicated budget for tech conferences, certifications, books, and professional courses.",
    category: "growth",
  },
  {
    title: "$100/Month Wellness Allowance",
    description: "Monthly stipend for gym memberships, fitness classes, mindfulness apps, or massage.",
    category: "wellness",
  },
  {
    title: "16 Weeks Paid Parental Leave",
    description: "Fully paid leave for primary and secondary caregivers following birth or adoption.",
    category: "pto",
  },
];

interface BenefitsRepeaterProps {
  items: BenefitItem[];
  onChange: (items: BenefitItem[]) => void;
}

export function BenefitsRepeater({ items = [], onChange }: BenefitsRepeaterProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState<BenefitItem["category"]>("healthcare");
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const getCategoryMeta = (cat: string) => {
    return BENEFIT_CATEGORIES.find((c) => c.value === cat) || BENEFIT_CATEGORIES[6];
  };

  const handleAddPreset = (preset: Omit<BenefitItem, "id">) => {
    // Check if already added
    if (items.some((i) => i.title.toLowerCase() === preset.title.toLowerCase())) {
      return;
    }
    const newItem: BenefitItem = {
      id: `benefit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...preset,
    };
    onChange([...items, newItem]);
  };

  const handleAddCustom = () => {
    if (!newTitle.trim()) return;
    const newItem: BenefitItem = {
      id: `benefit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      category: newCategory,
    };
    onChange([...items, newItem]);
    setNewTitle("");
    setNewDescription("");
    setIsAddingCustom(false);
  };

  const handleRemove = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<BenefitItem>) => {
    onChange(
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header & Quick Add Presets */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Layers className="size-3.5 text-copper" />
            <span>Configured Benefits ({items.length})</span>
          </span>
          <Button
            type="button"
            size="xs"
            variant={isAddingCustom ? "secondary" : "outline"}
            onClick={() => setIsAddingCustom(!isAddingCustom)}
            className="gap-1 text-xs"
          >
            {isAddingCustom ? <X className="size-3" /> : <Plus className="size-3" />}
            <span>{isAddingCustom ? "Cancel" : "Add Custom Benefit"}</span>
          </Button>
        </div>

        {/* 1-Click Quick Preset Chips */}
        <div className="p-2.5 bg-muted/30 rounded-xs border border-border/80 space-y-1.5">
          <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
            <span>Quick-Add Popular Perks:</span>
            <span className="text-[10px] text-copper">1-click insert</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {BENEFIT_PRESETS.map((preset) => {
              const isAdded = items.some((i) => i.title.toLowerCase() === preset.title.toLowerCase());

              return (
                <button
                  key={preset.title}
                  type="button"
                  disabled={isAdded}
                  onClick={() => handleAddPreset(preset)}
                  className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-xs border transition-all text-left cursor-pointer ${
                    isAdded
                      ? "opacity-40 bg-muted border-border cursor-not-allowed line-through"
                      : "bg-card hover:bg-copper/10 hover:border-copper/40 text-foreground"
                  }`}
                >
                  <span className="truncate max-w-50">{preset.title}</span>
                  {!isAdded && <Plus className="size-2.5 ml-0.5 opacity-60" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* New Custom Benefit Form */}
      {isAddingCustom && (
        <Card className="p-3.5 border-copper/40 bg-copper/5 shadow-none space-y-3">
          <div className="text-xs font-semibold text-foreground">Add Custom Benefit / Perk</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="space-y-1 sm:col-span-2">
              <label className="field-label">Benefit Title *</label>
              <Input
                placeholder="e.g. Annual Company Retreat in Lisbon"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-8 text-xs bg-card"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Category</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="h-8 w-full rounded-xs border border-border bg-card px-2 text-xs text-foreground focus:border-ring"
              >
                {BENEFIT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-3">
              <label className="field-label">Description / Highlight (Optional)</label>
              <Input
                placeholder="e.g. All-inclusive team gathering in Europe once every year"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="h-8 text-xs bg-card"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={() => setIsAddingCustom(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="xs"
              variant="accent"
              disabled={!newTitle.trim()}
              onClick={handleAddCustom}
              className="gap-1"
            >
              <Check className="size-3" />
              <span>Add to Requisition</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Benefit Cards Repeater List */}
      {items.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xs bg-muted/10 space-y-1">
          <p className="font-medium text-foreground">No benefits added yet</p>
          <p className="text-[11px]">Click the presets above or add custom benefits to highlight your compensation &amp; culture on Careers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {items.map((item) => {
            const meta = getCategoryMeta(item.category);
            const isEditing = editingId === item.id;

            if (isEditing) {
              return (
                <Card key={item.id} className="p-3 border-copper/50 bg-card shadow-none space-y-2 col-span-1 sm:col-span-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Input
                      defaultValue={item.title}
                      id={`edit-title-${item.id}`}
                      placeholder="Benefit title"
                      className="h-7 text-xs sm:col-span-2"
                    />
                    <select
                      defaultValue={item.category}
                      id={`edit-cat-${item.id}`}
                      className="h-7 w-full rounded-xs border border-border bg-card px-2 text-xs text-foreground"
                    >
                      {BENEFIT_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <Input
                      defaultValue={item.description || ""}
                      id={`edit-desc-${item.id}`}
                      placeholder="Description"
                      className="h-7 text-xs sm:col-span-3"
                    />
                  </div>
                  <div className="flex justify-end gap-1.5 pt-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => setEditingId(null)}
                      className="h-6 text-[11px]"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="accent"
                      onClick={() => {
                        const titleEl = document.getElementById(`edit-title-${item.id}`) as HTMLInputElement;
                        const catEl = document.getElementById(`edit-cat-${item.id}`) as HTMLSelectElement;
                        const descEl = document.getElementById(`edit-desc-${item.id}`) as HTMLInputElement;
                        handleUpdateItem(item.id, {
                          title: titleEl?.value || item.title,
                          category: (catEl?.value as any) || item.category,
                          description: descEl?.value || undefined,
                        });
                      }}
                      className="h-6 text-[11px] gap-1"
                    >
                      <Check className="size-3" />
                      <span>Done</span>
                    </Button>
                  </div>
                </Card>
              );
            }

            return (
              <Card
                key={item.id}
                className="p-3 bg-card shadow-none border border-border hover:border-copper/30 transition-colors flex items-start justify-between gap-3 group"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-xs text-foreground block">
                      {item.title}
                    </span>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border shrink-0 ${meta.color}`}>
                      {meta.label}
                    </Badge>
                  </div>
                  {item.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditingId(item.id)}
                    className="h-6 w-6 inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-xs hover:bg-muted cursor-pointer"
                    title="Edit benefit"
                  >
                    <Edit2 className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="h-6 w-6 inline-flex items-center justify-center text-destructive/70 hover:text-destructive rounded-xs hover:bg-destructive/10 cursor-pointer"
                    title="Delete benefit"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
