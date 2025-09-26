// src/pages/AdminFormsPage.tsx
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
  Modal,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import { listForms, upsertForm, deleteForm } from "../services/forms";
import type { FormDef } from "../types/form";

type EditorState = {
  formId: string;
  jsonText: string;
  parsed?: Omit<FormDef, "id">;
  error?: string | null;
};

function lightValidate(obj: any): obj is Omit<FormDef, "id"> {
  if (!obj || typeof obj !== "object") return false;
  if (!["daily", "weekly"].includes(obj.period)) return false;
  if (!Array.isArray(obj.sections)) return false;
  for (const sec of obj.sections) {
    if (!sec || typeof sec !== "object") return false;
    if (!Array.isArray(sec.fields)) return false;
    for (const f of sec.fields) {
      if (typeof f?.id !== "string") return false;
      if (!["text", "number", "boolean", "select"].includes(f.type))
        return false;
      if (typeof f.label !== "string") return false;
      if (f.type === "select" && f.options && !Array.isArray(f.options))
        return false;
    }
  }
  return true;
}

export default function AdminFormsPage() {
  const [forms, setForms] = useState<FormDef[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState<{
    variant: "success" | "danger" | "warning";
    msg: string;
  } | null>(null);

  const [showEditor, setShowEditor] = useState(false);
  const [editor, setEditor] = useState<EditorState>({
    formId: "",
    jsonText: `{
  "title": "New Checklist",
  "period": "daily",
  "sections": [
    { "title": "Section 1", "fields": [
      { "id": "example", "type": "text", "label": "Example field" }
    ]}
  ]
}`,
  });

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await listForms();
      setForms(data);
    } catch (e: any) {
      setAlert({
        variant: "danger",
        msg: e?.message ?? "Failed to load forms.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const parseEditor = () => {
    try {
      const obj = JSON.parse(editor.jsonText);
      if (!lightValidate(obj)) {
        setEditor((s) => ({
          ...s,
          parsed: undefined,
          error: "JSON shape invalid. Check period/sections/fields.",
        }));
      } else {
        setEditor((s) => ({ ...s, parsed: obj, error: null }));
      }
    } catch (e: any) {
      setEditor((s) => ({
        ...s,
        parsed: undefined,
        error: e?.message ?? "Invalid JSON.",
      }));
    }
  };

  useEffect(() => {
    parseEditor();
  }, [editor.jsonText]);

  const handleFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () =>
      setEditor((s) => ({ ...s, jsonText: String(reader.result ?? "") }));
    reader.readAsText(f);
  };

  const save = async () => {
    if (!editor.formId.trim()) {
      setAlert({ variant: "warning", msg: "Please enter a form ID." });
      return;
    }
    if (!editor.parsed) {
      setAlert({ variant: "warning", msg: "Fix JSON errors before saving." });
      return;
    }
    try {
      await upsertForm(editor.formId.trim(), editor.parsed);
      setAlert({ variant: "success", msg: `Saved form "${editor.formId}".` });
      setShowEditor(false);
      await refresh();
    } catch (e: any) {
      setAlert({
        variant: "danger",
        msg: e?.message ?? "Failed to save form.",
      });
    }
  };

  const doDelete = async (id: string) => {
    if (!confirm(`Delete form "${id}"?`)) return;
    try {
      await deleteForm(id);
      setAlert({ variant: "success", msg: `Deleted "${id}".` });
      await refresh();
    } catch (e: any) {
      setAlert({
        variant: "danger",
        msg: e?.message ?? "Failed to delete form.",
      });
    }
  };

  const download = (form: FormDef) => {
    const data = { ...form };
    delete (data as any).id;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Container className="py-4">
      <Row className="mb-3">
        <Col>
          <h1 className="h4 m-0">Admin · Forms</h1>
        </Col>
        <Col xs="auto">
          <Button
            onClick={() => {
              setEditor((e) => ({ ...e, formId: "", error: null }));
              setShowEditor(true);
            }}
          >
            + New / Upload
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

      {loading && (
        <div className="d-flex align-items-center gap-2">
          <Spinner animation="border" size="sm" /> Loading…
        </div>
      )}

      {!loading && forms && (
        <Card>
          <Table responsive hover className="m-0">
            <thead>
              <tr>
                <th style={{ width: 220 }}>Form ID</th>
                <th>Title</th>
                <th style={{ width: 120 }}>Period</th>
                <th style={{ width: 220 }}></th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id}>
                  <td>
                    <code>{f.id}</code>
                  </td>
                  <td>{f.title}</td>
                  <td>
                    <Badge bg={f.period === "daily" ? "primary" : "secondary"}>
                      {f.period}
                    </Badge>
                  </td>
                  <td className="text-end">
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="me-2"
                      onClick={() => download(f)}
                    >
                      Download JSON
                    </Button>
                    <Button
                      size="sm"
                      className="me-2"
                      onClick={() => {
                        const { id, ...rest } = f;
                        setEditor({
                          formId: id,
                          jsonText: JSON.stringify(rest, null, 2),
                        });
                        setShowEditor(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => doDelete(f.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {forms.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-4">
                    No forms yet
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal show={showEditor} onHide={() => setShowEditor(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editor.formId ? "Edit Form" : "New / Upload Form"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row className="g-3">
              <Col xs={12} md={6}>
                <Form.Label>Form ID</Form.Label>
                <Form.Control
                  placeholder='e.g., "daily" or "weekly"'
                  value={editor.formId}
                  onChange={(e) =>
                    setEditor((s) => ({ ...s, formId: e.target.value }))
                  }
                />
                <div className="form-text">
                  This is the Firestore document id under{" "}
                  <code>forms/&lt;id&gt;</code>.
                </div>
              </Col>
              <Col xs={12} md={6}>
                <Form.Label>Upload JSON file</Form.Label>
                <Form.Control
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const input = e.currentTarget as HTMLInputElement;
                    const file = input.files?.[0];
                    if (file) handleFile(file);
                  }}
                />
              </Col>

              <Col xs={12}>
                <Form.Label className="mt-2">Form JSON</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={16}
                  value={editor.jsonText}
                  onChange={(e) =>
                    setEditor((s) => ({ ...s, jsonText: e.target.value }))
                  }
                  spellCheck={false}
                />
                {editor.error ? (
                  <Alert variant="danger" className="mt-2">
                    {editor.error}
                  </Alert>
                ) : (
                  <Alert variant="success" className="mt-2">
                    JSON looks valid.
                  </Alert>
                )}
              </Col>
            </Row>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditor(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!editor.formId || !!editor.error}>
            Save
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
