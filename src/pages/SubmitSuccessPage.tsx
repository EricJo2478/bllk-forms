import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Container } from "react-bootstrap";
import { useEffect } from "react";

type State = {
  formId?: string;
  staff?: string[];
  dateKey?: string;
  docId?: string;
};

export default function SubmitSuccessPage() {
  const nav = useNavigate();
  const { state } = useLocation();
  const s = (state as State) || {};

  // Optional: if someone lands here without state, bounce home
  useEffect(() => {
    if (!s?.formId) {
      // nav("/", { replace: true });
    }
  }, [s, nav]);

  return (
    <Container className="py-5">
      <Card className="mx-auto" style={{ maxWidth: 640 }}>
        <Card.Body className="text-center">
          <div style={{ fontSize: 56, lineHeight: 1 }}>✅</div>
          <h1 className="h3 mt-3">Submission received</h1>
          <p className="text-muted mb-4">
            {s.formId ? (
              <>
                <code>{s.formId}</code>{" "}
                {s.dateKey && (
                  <>
                    for <code>{s.dateKey}</code>{" "}
                  </>
                )}
                {s.staff && s.staff.length === 2 && (
                  <>
                    by <strong>{s.staff[0]}</strong> &amp;{" "}
                    <strong>{s.staff[1]}</strong>
                  </>
                )}
                {s.docId && (
                  <>
                    {" "}
                    (ref: <code>{s.docId}</code>)
                  </>
                )}
              </>
            ) : (
              <>Your checklist was submitted successfully.</>
            )}
          </p>

          <div className="d-flex flex-wrap justify-content-center gap-2">
            <Link to="/" className="btn btn-primary">
              Home
            </Link>
            {/* Quick link to do another one of the same form */}
            {s.formId && (
              <Link
                to={`/forms/${encodeURIComponent(s.formId)}`}
                state={{ s: s.staff?.join(",") }}
                className="btn btn-outline-secondary"
              >
                Submit another
              </Link>
            )}
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
}
