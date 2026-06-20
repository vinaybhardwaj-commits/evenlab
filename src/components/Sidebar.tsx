"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/today", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/monthly", label: "Monthly summaries" },
  { href: "/settings", label: "Settings" },
];

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const initials = (email[0] ?? "L").toUpperCase();
  return (
    <aside className="side">
      <div className="brand">
        <div className="logo">E</div>
        <div><div className="nm">Even Lab</div><div className="sb">Race Course Road</div></div>
      </div>
      {ITEMS.map((it) => (
        <Link key={it.href} href={it.href}
          className={`nav${pathname.startsWith(it.href) ? " active" : ""}`}>
          {it.label}
        </Link>
      ))}
      <div className="spacer" />
      <form action="/api/auth/logout" method="post">
        <button className="nav" type="submit" style={{ color: "#9aa3b2" }}>Sign out</button>
      </form>
      <div className="userbox">
        <div className="avatar">{initials}</div>
        <div>Lab Director<br /><span style={{ fontSize: 11 }}>{email}</span></div>
      </div>
    </aside>
  );
}
