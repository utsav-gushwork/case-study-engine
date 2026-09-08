"use client";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AUTH_ENABLED } from "@/lib/auth";

function BrandMark() {
  return (
    <span className="brand-mark">
      <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M76.6088 4.56344C77.5025 2.36058 75.8495 0 73.4723 0H9.14286C4.0934 0 0 4.0934 0 9.14286V66.7778C0 72.018 5.17081 75.6829 9.9603 73.5568C40.8494 59.8449 64.3785 34.7075 76.6088 4.56344Z"
          fill="#fff"
        />
        <path
          d="M32.5161 80C31.4022 80 30.9357 78.5531 31.8259 77.8835C54.9007 60.5265 71.4338 35.8047 78.7658 8.0522C78.9403 7.39154 80 7.51618 80 8.19951V70.8571C80 75.9066 75.9066 80 70.8571 80H32.5161Z"
          fill="#fff"
        />
      </svg>
    </span>
  );
}

export default function TopBar() {
  const { data: session } = useSession();
  const user = AUTH_ENABLED ? session?.user : null;
  const initials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="topbar">
      <Link href="/" className="brand">
        <BrandMark />
        <span className="brand-name">Case Study Gen Studio</span>
      </Link>
      {user && (
        <div className="user-menu">
          <span className="user-avatar">{initials || "?"}</span>
          <span>
            <span className="user-name" style={{ display: "block" }}>
              {user.name}
            </span>
            <span className="user-role">Admin</span>
          </span>
        </div>
      )}
    </div>
  );
}
