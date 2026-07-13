import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, AdminAccessError } from "@/lib/admin/require-admin";
import { SignOutButton } from "./sign-out-button";

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAccessError) {
      redirect(error.status === 401 ? "/admin/login" : "/");
    }
    throw error;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 bg-zinc-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
              Make It Terrible
            </p>
            <p className="font-black">Admin</p>
          </div>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <Link href="/admin">Dashboard</Link>
            <Link href="/admin/content-lab">Content Lab</Link>
            <Link href="/admin/cards">Review Queue</Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
