"use client";
import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div style={{ textAlign: "center", paddingTop: 80 }}>
      <h1>Case Study Engine</h1>
      <p className="hint">Sign in with your @gushwork.ai Google account to continue.</p>
      <button className="primary" onClick={() => signIn("google")}>
        Sign in with Google
      </button>
    </div>
  );
}
