import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = new Set(["/login", "/auth/callback"]);

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isSignedIn = Boolean(user);
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
