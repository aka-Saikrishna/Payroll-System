"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { z } from "zod";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation/misc";

type ForgotForm = z.infer<typeof forgotPasswordSchema>;
type ResetForm = z.infer<typeof resetPasswordSchema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const requestForm = useForm<ForgotForm>({ resolver: zodResolver(forgotPasswordSchema) });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetPasswordSchema) });

  async function onRequest(values: ForgotForm) {
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    setSent(true);
    if (data.devToken) {
      setDevToken(data.devToken);
      resetForm.setValue("token", data.devToken);
    }
  }

  async function onReset(values: ResetForm) {
    setMessage(null);
    const res = await fetch("/api/auth/forgot-password", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || "Unable to reset password");
      return;
    }
    setMessage("Password reset. You can now sign in with your new password.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center mb-4">
          <div className="text-2xl font-bold tracking-tight text-navy-900">VEEKAY</div>
          <div className="text-sm text-navy-500 mt-1">Reset your password</div>
        </div>

        {!sent ? (
          <form onSubmit={requestForm.handleSubmit(onRequest)} className="card p-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input id="email" type="email" className="input" {...requestForm.register("email")} />
              {requestForm.formState.errors.email && (
                <p className="text-xs text-danger-500 mt-1">{requestForm.formState.errors.email.message}</p>
              )}
            </div>
            <button type="submit" className="btn-primary w-full">
              Send Reset Link
            </button>
            <div className="text-center">
              <Link href="/login" className="text-xs text-navy-500 hover:text-navy-700">
                Back to login
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={resetForm.handleSubmit(onReset)} className="card p-6 space-y-4">
            <p className="text-sm text-navy-600">
              If an account exists for that email, a reset link has been sent.
              {devToken && " (dev mode: token pre-filled below)"}
            </p>
            {message && <div className="rounded-md bg-success-50 text-success-700 text-sm px-3 py-2">{message}</div>}
            <div>
              <label className="label" htmlFor="token">
                Reset Token
              </label>
              <input id="token" className="input" {...resetForm.register("token")} />
            </div>
            <div>
              <label className="label" htmlFor="password">
                New Password
              </label>
              <input id="password" type="password" className="input" {...resetForm.register("password")} />
              {resetForm.formState.errors.password && (
                <p className="text-xs text-danger-500 mt-1">{resetForm.formState.errors.password.message}</p>
              )}
            </div>
            <button type="submit" className="btn-primary w-full">
              Reset Password
            </button>
            <div className="text-center">
              <Link href="/login" className="text-xs text-navy-500 hover:text-navy-700">
                Back to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
