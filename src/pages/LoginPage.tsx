// src/pages/LoginPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Container,
  Form,
  Row,
  Spinner,
} from "react-bootstrap";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import useAuth from "../hooks/useAuth";

type AuthShape = {
  user?: { email?: string | null } | null;
  loading?: boolean;
  error?: string | null;
  // Optional capabilities; we test for existence
  signIn?: (email: string, password: string) => Promise<unknown>;
  signOut?: () => Promise<unknown>;
};

export default function LoginPage() {
  const auth = useAuth() as unknown as AuthShape;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const next = params.get("next") || "/"; // where to send user after login

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [working, setWorking] = useState<boolean>(false);
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // If already signed in → bounce to next
  useEffect(() => {
    if (!auth.loading && auth.user) {
      navigate(next, { replace: true, state: { from: location } });
    }
  }, [auth.loading, auth.user, navigate, next, location]);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.signIn) return;
    setErr(null);
    setInfo(null);
    setWorking(true);
    try {
      await auth.signIn(username.trim(), password);
    } catch (e: any) {
      setErr(e?.message ?? "username/password sign-in failed.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col xs={12} md={6} lg={5}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-3">Admin Sign In</Card.Title>

              {(auth.loading || working) && (
                <div className="d-flex align-items-center gap-2 mb-3">
                  <Spinner animation="border" size="sm" />
                </div>
              )}

              {err && (
                <Alert
                  variant="danger"
                  onClose={() => setErr(null)}
                  dismissible
                >
                  {err}
                </Alert>
              )}
              {info && (
                <Alert variant="info" onClose={() => setInfo(null)} dismissible>
                  {info}
                </Alert>
              )}
              {auth.error && (
                <Alert variant="warning" className="mb-3">
                  {auth.error}
                </Alert>
              )}

              {/* If you’re already signed in (but maybe not admin), offer sign out */}
              {auth.user && (
                <div className="mb-3">
                  Signed in as{" "}
                  <strong>
                    {auth.user.email?.replace("@bllk.forms", "") ?? "unknown"}
                  </strong>
                  {auth.signOut && (
                    <>
                      {" · "}
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => auth.signOut?.()}
                      >
                        Sign out
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Email + Password */}
              {!auth.loading && (
                <Form onSubmit={onSignIn} className="mb-3">
                  <Form.Group className="mb-2">
                    <Form.Label>Username</Form.Label>
                    <Form.Control
                      type="text"
                      autoComplete="email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Form.Group>
                  <div className="d-grid">
                    <Button type="submit" disabled={working}>
                      {working ? "Signing in…" : "Sign in"}
                    </Button>
                  </div>
                </Form>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}
