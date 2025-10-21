"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/db";

const excludePaths = ["/signin", "/signup", "/reset-password"];

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Ensure client-side render before calling Supabase
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const session = data?.session;
        const isLoggedIn = !!session;

        // Only check for protected pages
        if (!excludePaths.includes(pathname)) {
          if (!isLoggedIn) {
            setIsAuthenticated(false);
            router.replace("/signin");
            return;
          }
        }

        setIsAuthenticated(true);
      } catch (err) {
        console.error("Error checking Supabase session:", err);
        setIsAuthenticated(false);
      }
    };

    checkSession();

    // Re-check when auth state changes (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session && !excludePaths.includes(pathname)) {
        setIsAuthenticated(false);
        router.replace("/signin");
      } else {
        setIsAuthenticated(true);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [hydrated, pathname, router]);

  // Wait until hydration complete
  if (!hydrated) return null;

  // Show “Checking session” only when first verifying
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-600">
        Checking session...
      </div>
    );
  }

  return <>{children}</>;
}