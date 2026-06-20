"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.replace(params.get("next") || "/today");
        router.refresh();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Incorrect email or password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="loginbox" onSubmit={submit}>
      <div className="logo">E</div>
      <h1>Even Lab Dashboard</h1>
      <p>Sign in to continue</p>
      <div className="field">
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      </div>
      <div className="field">
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </div>
      {error && <div className="err">{error}</div>}
      <button className="btn" style={{ width: "100%", justifyContent: "center" }} disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p style={{ marginTop: 16, fontSize: "11.5px" }}>Single secure account · no public signup</p>
    </form>
  );
}
