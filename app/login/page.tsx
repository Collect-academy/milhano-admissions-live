import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { login } from "@/app/login/actions";
import {
  getCurrentAppUser,
  isSupabaseAuthConfigured,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  error?: string;
  next?: string;
}>;

const errorMessages: Record<string, string> = {
  invalid: "The username/email or password is incorrect.",
  missing: "Enter your username/email and password.",
  access:
    "The account signed in, but it is not linked to an active dashboard user.",
  "not-configured":
    "Supabase Auth is not configured in Vercel.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  if (isSupabaseAuthConfigured()) {
    const currentUser = await getCurrentAppUser();
    if (currentUser) redirect(currentUser.role === "student_staff" ? "/alumnos" : "/");
  }

  const next =
    params.next?.startsWith("/") &&
    !params.next.startsWith("//")
      ? params.next
      : "/";

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span className="brand-mark">M</span>
          <div>
            <strong>Milhano</strong>
            <span>Admissions OS</span>
          </div>
        </div>

        <div className="login-heading">
          <LockKeyhole size={24} />
          <div>
            <p className="eyebrow">Private access</p>
            <h1>Sign In</h1>
            <p>
              Use your dashboard username and password.
            </p>
          </div>
        </div>

        {params.error ? (
          <div className="login-error">
            {errorMessages[params.error] ??
              "Unable to sign in."}
          </div>
        ) : null}

        {!isSupabaseAuthConfigured() ? (
          <div className="login-notice">
            The project remains protected by Basic Auth until
            the public Supabase variables are configured.
          </div>
        ) : (
          <form action={login} className="login-form">
            <input name="next" type="hidden" value={next} />

            <label>
              <span>Username</span>
              <input
                autoCapitalize="none"
                autoComplete="username"
                name="identifier"
                placeholder="MonaCashflow"
                required
                spellCheck={false}
                type="text"
              />
            </label>

            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>

            <button type="submit">
              Enter Dashboard
            </button>
          </form>
        )}

        <p className="login-footer">
          Operational source: GHL → n8n → Supabase
        </p>
      </section>
    </main>
  );
}
