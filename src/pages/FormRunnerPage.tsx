// src/pages/FormRunnerPage.tsx
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
  Table,
} from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import FormRenderer from "../components/forms/FormRenderer";
import type { FormDef } from "../types/form";
import { fetchForm } from "../services/forms";
import { listActiveStaff } from "../services/staff";
import { listExistingByPair, nextSequence } from "../services/submissions";
import { dateKeyWeekly, dateToISO, makeStaffKey } from "../utils";

type Props = { formId: string };

export default function FormRunnerPage({ formId }: Props) {
  const [searchParams] = useSearchParams();

  const [formDef, setFormDef] = useState<FormDef | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // staff selection
  const [staffList, setStaffList] = useState<{ id: string; name: string }[]>(
    []
  );
  const [staffA, setStaffA] = useState("");
  const [staffB, setStaffB] = useState("");

  // existing submissions (context only)
  const [existing, setExisting] = useState<any[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // seed Staff A/B from ?s=Alice,Bob if present
  useEffect(() => {
    const s = searchParams.get("s");
    if (s) {
      const [a, b] = s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      if (a) setStaffA(a);
      if (b) setStaffB(b);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // load form def
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        const fd = await fetchForm(formId);
        if (!isMounted) return;
        if (!fd) {
          setError(`Form "${formId}" not found.`);
          setFormDef(null);
        } else {
          setFormDef(fd as FormDef);
          setError(null);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load form.");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [formId]);

  // load active staff list
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await listActiveStaff();
        if (!mounted) return;
        setStaffList(data.map((s) => ({ id: s.id, name: s.name })));
      } catch {
        // ignore; UI shows empty list
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const bothPicked = !!staffA && !!staffB && staffA !== staffB;

  const dateKey = useMemo(() => {
    if (!formDef) return "";
    return formDef.period === "weekly" ? dateKeyWeekly() : dateToISO();
  }, [formDef]);

  const staffKey = useMemo(
    () => (bothPicked ? makeStaffKey(staffA, staffB) : ""),
    [bothPicked, staffA, staffB]
  );

  // Load existing submissions for context (multiple allowed)
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!formDef || !bothPicked) {
        setExisting([]);
        return;
      }
      setLoadingExisting(true);
      try {
        const key = formDef.period === "weekly" ? dateKeyWeekly() : dateToISO();
        const docs = await listExistingByPair(formId, staffKey, key);
        if (!mounted) return;
        setExisting(docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
      } catch {
        if (mounted) setExisting([]);
      } finally {
        if (mounted) setLoadingExisting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDef, bothPicked, staffKey, formId]);

  return (
    <Container className="py-4">
      <Row className="mb-3">
        <Col>
          <h1 className="h3 m-0">Checklist</h1>
          <div className="text-muted">{formId}</div>
        </Col>
      </Row>

      {/* Load state */}
      {loading && (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" />
          <span>Loading form…</span>
        </div>
      )}

      {/* Error */}
      {!loading && error && <Alert variant="danger">{error}</Alert>}

      {/* Staff picker */}
      {!loading && !error && (
        <Card className="mb-3">
          <Card.Body>
            <Card.Title>Select on-duty staff</Card.Title>
            <Row className="g-2">
              <Col xs={12} md={6}>
                <Form.Label>Staff A</Form.Label>
                <Form.Select
                  value={staffA}
                  onChange={(e) => setStaffA(e.target.value)}
                >
                  <option value="">Select…</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={12} md={6}>
                <Form.Label>Staff B</Form.Label>
                <Form.Select
                  value={staffB}
                  onChange={(e) => setStaffB(e.target.value)}
                >
                  <option value="">Select…</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Row>
            {staffA && staffB && staffA === staffB && (
              <div className="text-danger mt-2">Pick two different people.</div>
            )}
            <div className="form-text mt-2">
              Tip: deep link with <code>?s=Alice,Bob</code> in the URL (print as
              a QR on the rig).
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Existing submissions (context only) */}
      {!loading && !error && bothPicked && formDef && existing.length > 0 && (
        <Card className="mb-3">
          <Card.Body>
            <Card.Title>
              Submissions for{" "}
              {formDef.period === "weekly" ? "this week" : "today"}
            </Card.Title>
            {loadingExisting ? (
              <div className="d-flex align-items-center gap-2">
                <Spinner animation="border" size="sm" />
                <span>Loading…</span>
              </div>
            ) : existing.length > 0 ? (
              <div className="table-responsive">
                <Table hover size="sm" className="m-0">
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>#</th>
                      <th>Created</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existing.map((s, i) => (
                      <tr key={s.id}>
                        <td>{s.sequence ?? i + 1}</td>
                        <td>
                          {s.createdAt?.toDate?.().toLocaleString?.() ?? "—"}
                        </td>
                        <td className="text-muted">
                          {s.answers?.fuel_notes ||
                            s.answers?.defib_notes ||
                            "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <div className="text-muted">No submissions yet.</div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Renderer (multiple allowed) */}
      {!loading && !error && bothPicked && formDef && (
        <FormRenderer
          formDef={formDef}
          staff={[staffA, staffB]}
          staffKey={staffKey}
          dateKey={dateKey}
          getNextSequence={
            formDef
              ? async () => nextSequence(formId, staffKey, dateKey)
              : undefined
          }
        />
      )}
    </Container>
  );
}
