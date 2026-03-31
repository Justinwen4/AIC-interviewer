"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={loading}
      className="rounded-lg border border-zinc-400 bg-white px-3 py-1.5 font-sans text-xs font-medium text-zinc-950 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
    >
      {loading ? "…" : "Log out"}
    </button>
  );
}
