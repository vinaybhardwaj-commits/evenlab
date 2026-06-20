import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  return (
    <>
      <div className="pagehead"><div><h1>Settings</h1><div className="sub">Account &amp; preferences</div></div></div>
      <div className="card">
        <h3>Account</h3>
        <p className="hint" style={{ marginTop: 8 }}>Signed in as <b>{session?.email}</b>.</p>
        <p className="hint">Password changes and the 24-hour WhatsApp upload reminder (via the WaSender line)
          will be configurable here in a later phase.</p>
      </div>
      <div className="card">
        <h3>Data &amp; branding</h3>
        <p className="hint" style={{ marginTop: 8 }}>Retention: keep everything. Theme: Even brand (matching evenos.app) — interim navy/blue applied.</p>
      </div>
    </>
  );
}
