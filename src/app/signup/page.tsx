"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/db";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // 1️⃣ Register user using Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    // 2️⃣ Insert user's name into "users" table
    if (data.user) {
      await supabase.from("users").insert({
        id: data.user.id,
        full_name: name,
      });
      setSuccess("Account created successfully! Redirecting...");
      setTimeout(() => router.replace("/signin"), 2000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-lg">
        <h1 className="mb-4 text-center text-2xl font-bold text-gray-800">
          Sign Up
        </h1>

        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            className="w-full rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            className="w-full rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full rounded border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <button
            type="submit"
            className="w-full rounded bg-green-600 p-2 text-white hover:bg-green-700"
          >
            Register
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            href="/signin"
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
