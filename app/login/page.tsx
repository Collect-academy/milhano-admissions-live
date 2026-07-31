import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { getCurrentAppUser, isSupabaseAuthConfigured } from "@/lib/auth";
import { login } from "@/app/login/actions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  error?: string;
  next?: string;
}>;

const errorMessages: Record<string, string> = {
  invalid: "El correo o la contraseña no son correctos.",
  missing: "Escribe tu correo y contraseña.",
  access:
    "La cuenta inició sesión, pero todavía no está vinculada a un usuario activo del dashboard.",
  "not-configured":
    "Supabase Auth todavía no está configurado en Vercel.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  if (isSupabaseAuthConfigured()) {
    const currentUser = await getCurrentAppUser();
    if (currentUser) redirect("/");
  }

  const next =
    params.next?.startsWith("/") && !params.next.startsWith("//")
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
            <p className="eyebrow">Acceso privado</p>
            <h1>Iniciar sesión</h1>
            <p>
              Usa la cuenta individual creada para el dashboard.
            </p>
          </div>
        </div>

        {params.error ? (
          <div className="login-error">
            {errorMessages[params.error] ??
              "No fue posible iniciar sesión."}
          </div>
        ) : null}

        {!isSupabaseAuthConfigured() ? (
          <div className="login-notice">
            El proyecto continúa protegido por la contraseña básica
            hasta configurar las variables públicas de Supabase.
          </div>
        ) : (
          <form action={login} className="login-form">
            <input name="next" type="hidden" value={next} />

            <label>
              <span>Correo</span>
              <input
                autoComplete="email"
                name="email"
                placeholder="nombre@coldem.edu.mx"
                required
                type="email"
              />
            </label>

            <label>
              <span>Contraseña</span>
              <input
                autoComplete="current-password"
                minLength={8}
                name="password"
                required
                type="password"
              />
            </label>

            <button type="submit">Entrar al dashboard</button>
          </form>
        )}

        <p className="login-footer">
          Fuente operativa: GHL → n8n → Supabase
        </p>
      </section>
    </main>
  );
}
