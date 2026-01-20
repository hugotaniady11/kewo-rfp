"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HomePage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const fetchName = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) {
        router.replace("/signin");
        return;
      }

      const userId = session.user.id;
      const { data } = await supabase
        .from("users")
        .select("full_name")
        .eq("id", userId)
        .single();

      if (data) setName(data.full_name);
    };

    fetchName();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/signin");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Header */}
      <header className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Project Dashboard</h1>

        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link href="/" className="hover:text-blue-600">
            Home
          </Link>
          <Link href="/bid-analysis" className="hover:text-blue-600">
            Phase 1 / Bid Analysis
          </Link>
          <Link href="/proposal-checker" className="hover:text-blue-600">
            Phase 2 / Proposal Checker
          </Link>
          {/* <Link href="/proposal-maker" className="hover:text-blue-600">
            Phase 3 / Proposal Maker
          </Link> */}
          <Link href="/history" className="hover:text-blue-600">
            History
          </Link>

          <span className="text-gray-500">|</span>
          <span className="text-gray-700">{name ? `Hi, ${name}` : "..."}</span>

          <button
            onClick={handleLogout}
            className="rounded bg-red-600 px-3 py-1 text-white text-sm hover:bg-red-700"
          >
            Logout
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex flex-col items-center justify-center py-24">
        <h2 className="text-3xl font-bold mb-2">Welcome back 👋</h2>
        <p className="text-gray-600 mb-8">Choose a tool to continue.</p>

        <div className="flex space-x-4">
          <Link
            href="/bid-analysis"
            className="rounded bg-blue-600 px-5 py-3 text-white hover:bg-blue-700 transition"
          >
            Go to Bid Analysis
          </Link>
          <Link
            href="/proposal-checker"
            className="rounded bg-gray-700 px-5 py-3 text-white hover:bg-gray-800 transition"
          >
            Go to Proposal Checker
          </Link>
        </div>
      </main>
    </div>
  );
}