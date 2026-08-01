import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = new Set(["/login", "/auth/callback"]);

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabasePublishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headersToSet).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  // `getClaims()` only proves that the JWT is structurally valid. A browser can
  // still hold such a token after its Auth user was removed (for example after
  // a local reset), which previously caused an endless /login <-> / redirect.
  // `getUser()` validates the session against Supabase Auth and lets the SSR
  // client clear/refresh stale cookies through setAll above.
  const { data, error } = await supabase.auth.getUser();
  const isSignedIn = !error && Boolean(data.user);
  const pathname = request.nextUrl.pathname;
  const isDevelopmentPreview =
    process.env.NODE_ENV !== "production" && pathname === "/preview";
  const isPublicPath = publicPaths.has(pathname) || isDevelopmentPreview;

  if (!isSignedIn && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isSignedIn && pathname === "/login") {
    const workspaceUrl = request.nextUrl.clone();
    workspaceUrl.pathname = "/";
    workspaceUrl.search = "";
    return NextResponse.redirect(workspaceUrl);
  }

  return response;
}
