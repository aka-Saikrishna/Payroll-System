"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginSchema } from "@/lib/validation/misc";
import { z } from "zod";

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm_ />
    </Suspense>
  );
}

function LoginForm_() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginForm) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Unable to sign in");
        return;
      }
      const redirectTo = searchParams.get("redirectTo") || "/dashboard";
      router.push(redirectTo);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-2xl font-bold tracking-tight text-navy-900">VEEKAY</div>
          <div className="text-sm text-navy-500 mt-1">Payroll System</div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
          {error && (
            <div className="rounded-md bg-danger-50 text-danger-700 text-sm px-3 py-2">{error}</div>
          )}

          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" className="input" autoComplete="username" {...register("email")} />
            {errors.email && <p className="text-xs text-danger-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && <p className="text-xs text-danger-500 mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? "Signing in..." : "Login"}
          </button>

          <div className="text-center">
            <Link href="/forgot-password" className="text-xs text-navy-500 hover:text-navy-700">
              Forgot Password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
