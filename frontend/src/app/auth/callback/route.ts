import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/chat";

  if (code) {
    const res = NextResponse.redirect(new URL(next, url.origin));
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
    await supabase.auth.exchangeCodeForSession(code);
    return res;
  }

  return NextResponse.redirect(new URL("/signin", url.origin));
}
