import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, AdminAccessError } from "@/lib/admin/auth";
import { SignOutButton } from "./sign-out-button";

export default async function ProtectedAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AdminAccessError) redirect("/admin/login");
    throw error;
  }
  return (
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link href="/admin">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">Make It Terrible</p>
            <p className="font-black">Admin</p>
          </Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm font-semibold">
            <Link href="/admin/content-lab">Content Lab</Link>
            <Link href="/admin/cards">Review Queue</Link>
            <Link href="/?step=menu">Game</Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
