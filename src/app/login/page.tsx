"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="w-full max-w-sm">
        {/* Branding above card */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#001C3D", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="24" height="24" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1.5" fill="#1A5AFF" />
              <rect x="10" y="2" width="6" height="6" rx="1.5" fill="#1A5AFF" fillOpacity="0.45" />
              <rect x="2" y="10" width="6" height="6" rx="1.5" fill="#1A5AFF" fillOpacity="0.45" />
              <rect x="10" y="10" width="6" height="6" rx="1.5" fill="#1A5AFF" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-base font-bold text-text-primary">APA Discovery Accelerator</h1>
            <p className="text-xs text-text-muted mt-0.5" style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>Backbase · Process Mining</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-bg-card border border-border p-8">
          <h2 className="text-sm font-semibold text-text-primary mb-1">Sign in</h2>
          <p className="text-xs text-text-muted mb-6">Enter your credentials to access the tool</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "rgba(224,32,32,0.06)", border: "1px solid rgba(224,32,32,0.2)", color: "#E02020" }}>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-text-secondary mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-colors"
                placeholder="you@backbase.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-text-secondary mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-border bg-bg-primary px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:ring-1 focus:ring-accent-blue outline-none transition-colors"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ background: "#1A5AFF" }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-text-muted">
          Backbase internal tool — contact your admin for access
        </p>
      </div>
    </div>
  );
}
