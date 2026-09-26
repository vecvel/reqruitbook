"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ArrowLeft } from "lucide-react";

interface AccessDeniedProps {
  errorCode?: string;
  title?: string;
  description?: string;
  showBackHome?: boolean;
}

export function AccessDenied({
  errorCode = "403",
  title = "Access Denied",
  description = "You do not have permission to view or access this page.",
  showBackHome = true,
}: AccessDeniedProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="size-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-4">
        <ShieldAlert className="size-6" />
      </div>

      <div className="text-3xl font-bold tracking-tight text-foreground mb-1">
        {errorCode}
      </div>

      <h1 className="text-base font-semibold text-foreground mb-2">
        {title}
      </h1>

      <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {showBackHome && (
        <Link href="/dashboard">
          <Button size="xs" variant="accent" className="gap-1.5 text-xs">
            <ArrowLeft className="size-3" />
            <span>Back to Dashboard</span>
          </Button>
        </Link>
      )}
    </div>
  );
}
