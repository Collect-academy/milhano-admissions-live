import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

function basicUnauthorized(): NextResponse {
  return new NextResponse("Autenticación requerida.", {
    status: 401,
    headers: {
      "WWW-Authenticate":
        'Basic realm="Milhano Dashboard", charset="UTF-8"',
    },
  });
}

function basicAuthFallback(request: NextRequest): NextResponse {
  const expectedUser = process.env.DASHBOARD_USERNAME;
  const expectedPassword = process.env.DASHBOARD_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    return new NextResponse(
      "Faltan las variables de autenticación del dashboard.",
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    return basicUnauthorized();
  }

  try {
    const decoded = atob(authorization.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) return basicUnauthorized();

    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);

    return username === expectedUser && password === expectedPassword
      ? NextResponse.next()
      : basicUnauthorized();
  } catch {
    return basicUnauthorized();
  }
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return basicAuthFallback(request);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );

        supabaseResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );

        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const hasSession = Boolean(data?.claims);
  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/login";
  const isPublicAuthRoute =
    isLogin || pathname.startsWith("/auth/");

  if (!hasSession && !isPublicAuthRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }


  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
