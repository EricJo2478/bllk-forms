// src/contexts/AdminGuard.tsx
import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Alert, Button, Spinner } from "react-bootstrap";
import useAuth from "../hooks/useAuth";

type Props = {
  children: ReactNode;
  /** Optional allowlist of admin emails. If omitted, any signed-in user is admin. */
  allowEmails?: string[];
};

export default function AdminRoute({
  children,
  allowEmails = ["eric@bllk.forms", "jackson@bllk.forms"],
}: Props) {
  const { user, loading, signOut } = useAuth() as any; // provider-agnostic
  const loc = useLocation();

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2 p-3">
        <Spinner animation="border" size="sm" />
        <span>Checking session…</span>
      </div>
    );
  }

  if (!user) {
    // Not signed in → go to login and bounce back after
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`}
        replace
      />
    );
  }

  const email = (user?.email ?? "").toLowerCase();
  const allowed =
    !allowEmails ||
    allowEmails.length === 0 ||
    allowEmails.map((e) => e.toLowerCase()).includes(email);

  if (!allowed) {
    return (
      <div className="p-3">
        <Alert variant="danger" className="mb-3">
          You’re signed in as <strong>{user.email || "unknown"}</strong>, but
          you’re not authorized to access this page.
        </Alert>
        <Button
          variant="outline-secondary"
          onClick={() => signOut?.() ?? Promise.resolve()}
        >
          Sign out
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
