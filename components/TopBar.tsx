"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { AUTH_ENABLED } from "@/lib/auth";

export default function TopBar() {
  const { data: session } = useSession();
  return (
    <div className="topbar">
      <Link href="/" className="brand">
        Case Study Engine
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Link href="/published" className="topbar-link">
          View published →
        </Link>
        {AUTH_ENABLED && session?.user && (
          <span className="hint">
            {session.user.email}{" "}
            <button onClick={() => signOut()}>Sign out</button>
          </span>
        )}
      </div>
    </div>
  );
}
