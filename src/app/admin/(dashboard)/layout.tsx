import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/admin/LogoutButton";
import { verifyAdminSession } from "@/lib/auth/admin";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  return (
    <div className="mx-auto min-h-full max-w-6xl px-4 py-6">
      <nav className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-sm font-semibold text-white hover:text-indigo-300">
            Insights dashboard
          </Link>
        </div>
        <LogoutButton />
      </nav>
      {children}
    </div>
  );
}
