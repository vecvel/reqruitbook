"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Field, FormError } from "@/components/shared/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  // Both start empty. The form used to open pre-filled with a demo account and
  // a shared password printed beside it, which named four addresses that do not
  // exist on the platform and published a credential on the one page an attacker
  // is already looking at.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        // The route forwards identity's problem+json verbatim, so the useful
        // message is in `detail`: "account is temporarily locked", "too many
        // attempts", "this company portal is not currently available". Reading
        // `error` collapsed every one of those into "invalid password", which
        // sends a locked-out user back to try the password they already know.
        const message =
          typeof data?.detail === "string" && data.detail
            ? data.detail
            : "Invalid email or password.";
        setErrorMsg(message);
        toast.error(message);
        setLoading(false);
        return;
      }

      toast.success(`Welcome back, ${data.user.name}`);
      window.location.href = redirectUrl;
    } catch {
      setErrorMsg("Unable to connect to server. Please try again.");
      toast.error("Network error");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormError message={errorMsg} />

        <Field label="Email address" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            disabled={loading}
          />
        </Field>

        <Field label="Password" htmlFor="password" required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
        </Field>

        <Button
          type="submit"
          disabled={loading}
          className="w-full"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : null}
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
