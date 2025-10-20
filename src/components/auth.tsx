"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const excludePaths = ["/signin", "/signup", "/reset-password"];

interface AuthLayoutProps {
  children: React.ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem("auth");

    // Only check auth for non-excluded routes
    if (!excludePaths.includes(pathname)) {
      if (auth !== "true") {
        router.replace("/signin");
        return;
      }
    }

    setIsReady(true);
  }, [pathname, router]);

  if (!isReady) {
    // show loading screen while checking auth
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-600">
        Checking session...
      </div>
    );
  }

  return <>{children}</>;
}