"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/db";
import { useRouter } from "next/navigation";

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

  const goToProposalChecker = () => {
    router.push("/proposal-checker");
  };

  const goToBidAnalysis = () => {
    router.push("/bid-analysis");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <h1 className="text-3xl font-bold text-gray-800">
        Hello, {name || "Loading..."} 👋
      </h1>

      {/* 🟢 New button */}
      {/* <button
        onClick={goToProposalChecker}
        className="mt-6 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Go to Proposal Checker
      </button> */}

      <button
        onClick={goToBidAnalysis}
        className="mt-6 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Go to Bid Analysis
      </button>

      <button
        onClick={handleLogout}
        className="mt-3 rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
      >
        Logout
      </button>
    </div>
  );
}