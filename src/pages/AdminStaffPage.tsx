// src/pages/AdminStaffPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  InputGroup,
  ListGroup,
  Modal,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import {
  createStaff,
  deleteStaff,
  importStaff,
  listAllStaff,
  renameStaff,
  setStaffActive,
} from "../services/staff";
import { Staff } from "../types/staff";

export default function AdminStaffPage() {
  const [items, setItems] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{
    variant: "success" | "danger" | "warning" | "info";
    msg: string;
  } | null>(null);

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  // add/edit states
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // import modal
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("Alice,true\nBob,true");

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listAllStaff();
      setItems(data);
    } catch (e: any) {
      setAlert({
        variant: "danger",
        msg: e?.message ?? "Failed to load staff.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter(
      (s) =>
        (!onlyActive || s.active) &&
        (!needle || s.name.toLowerCase().includes(needle))
    );
  }, [items, q, onlyActive]);

  // actions
  const onCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createStaff(name, true);
      setNewName("");
      setAlert({ variant: "success", msg: `Added "${name}".` });
      await refresh();
    } catch (e: any) {
      setAlert({
        variant: "danger",
        msg: e?.message ?? "Failed to add staff.",
      });
    }
  };

  const onRename = async (id: string) => {
    const nm = editingName.trim();
    if (!nm) return;
    try {
      await renameStaff(id, nm);
      setEditingId(null);
      setEditingName("");
      setAlert({ variant: "success", msg: "Name updated." });
      await refresh();
    } catch (e: any) {
      setAlert({ variant: "danger", msg: e?.message ?? "Failed to rename." });
    }
  };

  const onToggle = async (id: string, to: boolean) => {
    try {
      await setStaffActive(id, to);
      await refresh();
    } catch (e: any) {
      setAlert({
        variant: "danger",
        msg: e?.message ?? "Failed to update active.",
      });
    }
  };

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteStaff(id);
      setAlert({ variant: "success", msg: `Deleted "${name}".` });
      await refresh();
    } catch (e: any) {
      setAlert({ variant: "danger", msg: e?.message ?? "Failed to delete." });
    }
  };

  const parseImport = () => {
    // Accept CSV "name,active?" or JSON [{name,active}]
    try {
      if (importText.trim().startsWith("[")) {
        const arr = JSON.parse(importText) as Array<{
          name: string;
          active?: boolean;
        }>;
        return arr.filter((r) => r.name && typeof r.name === "string");
      }
      const rows: Array<{ name: string; active?: boolean }> = [];
      for (const line of importText.split("\n")) {
        const t = line.trim();
        if (!t) continue;
        const [name, activeStr] = t.split(",").map((s) => s.trim());
        rows.push({ name, active: /^true$/i.test(activeStr ?? "true") });
      }
      return rows;
    } catch {
      return null;
    }
  };

  const doImport = async () => {
    const rows = parseImport();
    if (!rows || rows.length === 0) {
      setAlert({
        variant: "warning",
        msg: "Nothing to import or invalid format.",
      });
      return;
    }
    try {
      await importStaff(rows);
      setShowImport(false);
      setAlert({ variant: "success", msg: `Imported ${rows.length} staff.` });
      await refresh();
    } catch (e: any) {
      setAlert({ variant: "danger", msg: e?.message ?? "Import failed." });
    }
  };

  const exportCsv = () => {
    const lines = [
      "name,active",
      ...items.map((s) => `${s.name},${s.active ? "true" : "false"}`),
    ];
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const activateAll = async (to: boolean) => {
    try {
      // naive sequential; fine for small lists
      for (const s of items) {
        if (s.active !== to) await setStaffActive(s.id, to);
      }
      setAlert({
        variant: "success",
        msg: to ? "All active." : "All deactivated.",
      });
      await refresh();
    } catch (e: any) {
      setAlert({ variant: "danger", msg: e?.message ?? "Bulk update failed." });
    }
  };

  return (
    <Container className="py-3">
      <Row className="mb-3 align-items-end">
        <Col md={5}>
          <Form.Label>Search</Form.Label>
          <Form.Control
            placeholder="Search names…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Col>
        <Col md="auto" className="mt-2 mt-md-0">
          <Form.Check
            type="switch"
            id="onlyActive"
            label="Only active"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.currentTarget.checked)}
          />
        </Col>
        <Col className="mt-2 mt-md-0 d-flex gap-2 justify-content-end">
          <Button
            variant="outline-secondary"
            onClick={() => setShowImport(true)}
          >
            Import
          </Button>
          <Button variant="outline-secondary" onClick={exportCsv}>
            Export
          </Button>
          <Button variant="outline-success" onClick={() => activateAll(true)}>
            Activate all
          </Button>
          <Button variant="outline-danger" onClick={() => activateAll(false)}>
            Deactivate all
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

      <Card className="mb-3">
        <Card.Header>Add staff</Card.Header>
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col md={6}>
              <Form.Label>Name</Form.Label>
              <Form.Control
                placeholder="e.g., Alice Smith"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </Col>
            <Col md="auto">
              <Button onClick={onCreate} disabled={!newName.trim()}>
                Add
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body className="p-0">
          {loading ? (
            <div className="p-3 d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>Loading…</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-3 text-muted">No staff yet.</div>
          ) : (
            <div className="table-responsive">
              <Table hover className="m-0 align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}></th>
                    <th>Name</th>
                    <th style={{ width: 120 }}>Status</th>
                    <th style={{ width: 220 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const editing = editingId === s.id;
                    return (
                      <tr key={s.id}>
                        <td>
                          <span title={s.id}>•</span>
                        </td>
                        <td>
                          {editing ? (
                            <InputGroup>
                              <Form.Control
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                autoFocus
                              />
                              <Button
                                variant="outline-secondary"
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingName("");
                                }}
                              >
                                Cancel
                              </Button>
                              <Button onClick={() => onRename(s.id)}>
                                Save
                              </Button>
                            </InputGroup>
                          ) : (
                            <span className={s.active ? "" : "text-muted"}>
                              {s.name}
                            </span>
                          )}
                        </td>
                        <td>
                          <Badge bg={s.active ? "success" : "secondary"}>
                            {s.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="text-end">
                          {!editing && (
                            <>
                              <Button
                                size="sm"
                                className="me-2"
                                onClick={() => {
                                  setEditingId(s.id);
                                  setEditingName(s.name);
                                }}
                              >
                                Rename
                              </Button>
                              <Button
                                size="sm"
                                variant={
                                  s.active
                                    ? "outline-warning"
                                    : "outline-success"
                                }
                                className="me-2"
                                onClick={() => onToggle(s.id, !s.active)}
                              >
                                {s.active ? "Deactivate" : "Activate"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline-danger"
                                onClick={() => onDelete(s.id, s.name)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Import modal */}
      <Modal show={showImport} onHide={() => setShowImport(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Import staff</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted">
            Paste CSV (<code>name,active</code>) — one per line — or JSON (
            <code>[&#123;name, active&#125;]</code>).
            <br />
            Active defaults to <code>true</code>.
          </p>
          <Form.Control
            as="textarea"
            rows={12}
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            spellCheck={false}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowImport(false)}>
            Cancel
          </Button>
          <Button onClick={doImport}>Import</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
