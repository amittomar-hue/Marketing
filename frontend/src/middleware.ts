import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that REQUIRE auth. Everything else is public.
const PROTECTED_PREFIXES = ["/chat", "/admin", "/brand"];

// Auth-only pages: signed-in users get redirected away from these
const AUTH_PAGES = ["/signin", "/signup", "/forgot-password", "/reset-password"];

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/") || path === p);
  const isAuthPage = AUTH_PAGES.some((p) => path === p || path.startsWith(p + "/"));

  // Unauthenticated user trying to access protected route → redirect to signin
  if (!user && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  // Authenticated user on auth page → send to chat
  if (user && isAuthPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/chat";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Admin route additional check
  if (path.startsWith("/admin")) {
    const adminEmails = (process.env.ADMIN_EMAILS ?? "")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!user || !adminEmails.includes((user.email ?? "").toLowerCase())) {
      const url = req.nextUrl.clone();
      url.pathname = "/chat";
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|otf|css|js)$).*)",
  ],
};
