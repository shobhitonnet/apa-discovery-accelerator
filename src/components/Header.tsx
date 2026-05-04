"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="border-b border-border bg-bg-secondary">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-accent-blue flex items-center justify-center text-sm font-bold text-white">
            A
          </div>
          <div>
            <h1 className="text-sm font-semibold text-text-primary tracking-wide">
              APA Discovery Accelerator
            </h1>
            <p className="text-xs text-text-muted">
              Backbase Process Mining
            </p>
          </div>
        </Link>

        {session?.user && (
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Config
            </Link>
            <span className="text-xs text-text-secondary">
              {session.user.name}
            </span>
            <button
              onClick={() => signOut()}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
