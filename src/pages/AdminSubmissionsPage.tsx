// src/pages/AdminSubmissionsPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  Modal,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { listForms } from "../services/forms";
import type { FormDef } from "../types/form";
import { querySubmissions, type Submission } from "../services/submissions";
import { makeStaffKey } from "../utils"; // from earlier answer

// Date helpers
function startOfToday(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfTomorrow(d = new Date()) {
  const x = startOfToday(d);
  x.setDate(x.getDate() + 1);
  return x;
}
function startOfWeek(d = new Date()) {
  const x = startOfToday(d);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // Monday=0
  x.setDate(x.getDate() - diff);
  return x;
}
function endOfWeek(d = new Date()) {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 7);
  return x;
}

export default function AdminSubmissionsPage() {
  // Filters
  const [forms, setForms] = useState<FormDef[]>([]);
  const [formId, setFormId] = useState<string>("");
  const [staffA, setStaffA] = useState("");
  const [staffB, setStaffB] = useState("");
  const [from, setFrom] = useState<string>(""); // yyyy-mm-dd
  const [to, setTo] = useState<string>(""); // yyyy-mm-dd

  // Data
  const [rows, setRows] = useState<Submission[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{
    variant: "success" | "danger" | "warning" | "info";
    msg: string;
  } | null>(null);

  // Modal (view JSON)
  const [view, setView] = useState<Submission | null>(null);

  // Initial forms list
  useEffect(() => {
    (async () => {
      try {
        const data = await listForms();
        setForms(data);
      } catch (e: any) {
        setAlert({
          variant: "danger",
          msg: e?.message ?? "Failed to load forms.",
        });
      }
    })();
  }, []);

  const staffKey = useMemo(() => {
    if (!staffA || !staffB || staffA === staffB) return "";
    const [a, b] = [staffA, staffB];
    return makeStaffKey(a, b);
  }, [staffA, staffB]);

  const createdFrom = useMemo(
    () => (from ? new Date(from + "T00:00:00") : undefined),
    [from]
  );
  const createdTo = useMemo(
    () => (to ? new Date(to + "T00:00:00") : undefined),
    [to]
  );

  const load = async (reset = true) => {
    try {
      setLoading(true);
      const page = await querySubmissions({
        formId: formId || undefined,
        staffKey: staffKey || undefined,
        createdFrom,
        createdTo,
        pageSize: 25,
        after: reset ? null : cursor,
      });
      if (reset) {
        setRows(page.items);
      } else {
        setRows((r) => r.concat(page.items));
      }
      setCursor(page.cursor);
    } catch (e: any) {
      setAlert({
        variant: "danger",
        msg: e?.message ?? "Failed to query submissions.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Quick chips
  const setToday = () => {
    const s = startOfToday();
    const e = startOfTomorrow();
    setFrom(s.toISOString().slice(0, 10));
    setTo(e.toISOString().slice(0, 10));
  };
  const setThisWeek = () => {
    const s = startOfWeek();
    const e = endOfWeek();
    setFrom(s.toISOString().slice(0, 10));
    setTo(e.toISOString().slice(0, 10));
  };

  // Export CSV of currently loaded rows
  const exportCsv = () => {
    if (rows.length === 0) return;
    // Collect all answer keys (from loaded rows)
    const answerKeys = Array.from(
      rows.reduce((acc, r) => {
        Object.keys(r.answers || {}).forEach((k) => acc.add(k));
        return acc;
      }, new Set<string>())
    ).sort();

    const header = [
      "id",
      "createdAt",
      "formId",
      "period",
      "dateKey",
      "staffA",
      "staffB",
      "sequence",
      ...answerKeys,
    ];

    const lines = [header.join(",")];

    for (const r of rows) {
      const created =
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : (r.createdAt as any) ?? "";
      const base = [
        r.id,
        created,
        r.formId,
        r.period,
        r.dateKey,
        r.staff?.[0] ?? "",
        r.staff?.[1] ?? "",
        r.sequence ?? "",
      ];
      const answers = answerKeys.map((k) => {
        const v = (r.answers ?? {})[k];
        // CSV-safe
        const cell =
          v == null
            ? ""
            : typeof v === "object"
            ? JSON.stringify(v)
            : String(v);
        const needsQuotes = /[",\n]/.test(cell);
        const escaped = cell.replace(/"/g, '""');
        return needsQuotes ? `"${escaped}"` : escaped;
      });
      lines.push([...base, ...answers].join(","));
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Container fluid className="py-3">
      <Row className="mb-3 align-items-end">
        <Col md={3} lg={3}>
          <Form.Label>Form</Form.Label>
          <Form.Select
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
          >
            <option value="">All forms</option>
            {forms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title} ({f.id})
              </option>
            ))}
          </Form.Select>
        </Col>

        <Col md={3} lg={3}>
          <Form.Label>Staff A</Form.Label>
          <Form.Control
            value={staffA}
            onChange={(e) => setStaffA(e.target.value)}
            placeholder="e.g., Alice"
          />
        </Col>
        <Col md={3} lg={3}>
          <Form.Label>Staff B</Form.Label>
          <Form.Control
            value={staffB}
            onChange={(e) => setStaffB(e.target.value)}
            placeholder="e.g., Bob"
          />
        </Col>

        <Col md={3} lg={3} className="mt-2 mt-md-0">
          <div className="d-flex gap-2">
            <div style={{ minWidth: 140 }}>
              <Form.Label>From</Form.Label>
              <Form.Control
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div style={{ minWidth: 140 }}>
              <Form.Label>To</Form.Label>
              <Form.Control
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
        </Col>
      </Row>

      <Row className="mb-3">
        <Col className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={setToday}>
            Today
          </Button>
          <Button variant="outline-secondary" onClick={setThisWeek}>
            This week
          </Button>
          <Button onClick={() => load(true)} disabled={loading}>
            {loading ? "Loading…" : "Apply filters"}
          </Button>
          <Button
            variant="outline-primary"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            Export CSV ({rows.length})
          </Button>
        </Col>
      </Row>

      {alert && (
        <Alert
          variant={alert.variant}
          onClose={() => setAlert(null)}
          dismissible
        >
          {alert.msg}
        </Alert>
      )}

      <Card>
        <Card.Body className="p-0">
          {loading && rows.length === 0 ? (
            <div className="p-3 d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>Loading…</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-3 text-muted">No submissions.</div>
          ) : (
            <div className="table-responsive">
              <Table hover size="sm" className="align-middle m-0">
                <thead>
                  <tr>
                    <th style={{ width: 84 }}>#</th>
                    <th style={{ width: 210 }}>Created</th>
                    <th>Form</th>
                    <th>Staff</th>
                    <th>Date/Week</th>
                    <th>Peek</th>
                    <th style={{ width: 120 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const created =
                      r.createdAt instanceof Date
                        ? r.createdAt.toLocaleString()
                        : typeof r.createdAt === "string"
                        ? r.createdAt
                        : "";
                    const notes = (r.answers?.["fuel_notes"] ??
                      r.answers?.["defib_notes"] ??
                      r.answers?.["notes"] ??
                      "") as string;
                    return (
                      <tr key={r.id}>
                        <td>{r.sequence ?? i + 1}</td>
                        <td>{created}</td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <Badge
                              bg={
                                r.period === "weekly" ? "secondary" : "primary"
                              }
                            >
                              {r.period}
                            </Badge>
                            <code>{r.formId}</code>
                          </div>
                        </td>
                        <td>
                          {r.staff?.[0] && r.staff?.[1] ? (
                            <>
                              <span>{r.staff[0]}</span> &{" "}
                              <span>{r.staff[1]}</span>
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <code>{r.dateKey}</code>
                        </td>
                        <td className="text-muted">
                          {typeof notes === "string" && notes.length > 0
                            ? notes.slice(0, 60) +
                              (notes.length > 60 ? "…" : "")
                            : "—"}
                        </td>
                        <td className="text-end">
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            onClick={() => setView(r)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
        {cursor && (
          <Card.Footer className="d-flex justify-content-center">
            <Button onClick={() => load(false)} disabled={loading}>
              {loading ? "Loading…" : "Load more"}
            </Button>
          </Card.Footer>
        )}
      </Card>

      {/* View Modal */}
      <Modal show={!!view} onHide={() => setView(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Submission details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {view ? (
            <>
              <div className="mb-2">
                <strong>ID:</strong> <code>{view.id}</code>
              </div>
              <div className="mb-2">
                <strong>Created:</strong>{" "}
                {view.createdAt instanceof Date
                  ? view.createdAt.toLocaleString()
                  : String(view.createdAt ?? "")}
              </div>
              <div className="mb-2">
                <strong>Form:</strong> <code>{view.formId}</code> ·{" "}
                <Badge bg={view.period === "weekly" ? "secondary" : "primary"}>
                  {view.period}
                </Badge>{" "}
                · <strong>Date/Week:</strong> <code>{view.dateKey}</code>
              </div>
              <div className="mb-2">
                <strong>Staff:</strong> {view.staff?.[0] ?? "—"} &{" "}
                {view.staff?.[1] ?? "—"}
              </div>
              {view.sequence != null && (
                <div className="mb-2">
                  <strong>Sequence:</strong> {view.sequence}
                </div>
              )}
              <hr />
              <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                {JSON.stringify(view.answers ?? {}, null, 2)}
              </pre>
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setView(null)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
