// src/pages/AdminFormBuilderPage.tsx
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  ButtonGroup,
  Card,
  Col,
  Collapse,
  Container,
  Dropdown,
  Form,
  InputGroup,
  ListGroup,
  Modal,
  Row,
  Spinner,
  Table,
} from "react-bootstrap";
import FormRenderer from "../components/forms/FormRenderer";
import type { FieldType, FormDef } from "../types/form";
import {
  listForms,
  upsertForm,
  deleteForm,
  fetchForm,
} from "../services/forms";

// ---- Helpers / local editor types (with a stable _uid for React keys) ----
type ShowIfOp = "eq" | "neq" | "in";
type ShowIf =
  | { field: string; op: ShowIfOp; value: unknown }
  | { and: ShowIf[] }
  | { or: ShowIf[] };

type FieldWithUid = {
  _uid: string; // used only in the editor UI
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // select/checklist only
  switchLabel?: string; // boolean
  showIf?: ShowIf;
};

type SectionWithUid = { title: string; fields: FieldWithUid[] };
type DraftWithUid = Omit<FormDef, "id" | "sections"> & {
  sections: SectionWithUid[];
};

const DEFAULT_DRAFT: DraftWithUid = {
  title: "Untitled Checklist",
  period: "daily",
  sections: [
    {
      title: "New Section",
      fields: [
        {
          _uid: crypto.randomUUID(),
          id: "example",
          type: "text",
          label: "Example field",
        },
      ],
    },
  ],
};

// utils
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}
function idify(label: string) {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field"
  );
}

function ensureUniqueFieldId(
  sec: SectionWithUid,
  base: string,
  _uidToIgnore?: string
) {
  let i = 1;
  let candidate = base;
  const used = new Set(
    sec.fields
      .filter((f) => f._uid !== _uidToIgnore) // ignore the current field
      .map((f) => f.id)
  );
  while (used.has(candidate)) candidate = `${base}_${i++}`;
  return candidate;
}

function lightValidate(obj: any): obj is Omit<FormDef, "id"> {
  if (!obj || typeof obj !== "object") return false;
  if (!["daily", "weekly"].includes(obj.period)) return false;
  if (typeof obj.title !== "string") return false;
  if (!Array.isArray(obj.sections)) return false;
  for (const sec of obj.sections) {
    if (!sec || typeof sec !== "object") return false;
    if (typeof sec.title !== "string") return false;
    if (!Array.isArray(sec.fields)) return false;
    for (const f of sec.fields) {
      if (typeof f?.id !== "string") return false;
      if (
        !["text", "number", "boolean", "select", "checklist", "date"].includes(
          f.type
        )
      )
        return false;
      if (typeof f.label !== "string") return false;
      if (
        (f.type === "select" || f.type === "checklist") &&
        f.options &&
        !Array.isArray(f.options)
      ) {
        return false;
      }
    }
  }
  return true;
}

// Convert persisted form (no _uid) -> editor draft (with _uid)
function toDraftWithUid(src: Omit<FormDef, "id">): DraftWithUid {
  return {
    title: src.title,
    period: src.period,
    sections: (src.sections ?? []).map((sec) => ({
      title: sec.title,
      fields: (sec.fields ?? []).map((f) => ({
        _uid: crypto.randomUUID(),
        id: f.id,
        type: f.type as FieldType,
        label: f.label,
        placeholder: (f as any).placeholder,
        required: (f as any).required,
        options: (f as any).options,
        switchLabel: (f as any).switchLabel,
        showIf: (f as any).showIf,
      })),
    })),
  };
}

// Strip _uid before saving/exporting
function stripUid(d: DraftWithUid): Omit<FormDef, "id"> {
  return {
    title: d.title,
    period: d.period,
    sections: d.sections.map((sec) => ({
      title: sec.title,
      fields: sec.fields.map(({ _uid, ...rest }) => rest),
    })),
  } as Omit<FormDef, "id">;
}

/* ===========================================================
   Nested Show-If editor (AND/OR + conditions)
   =========================================================== */

function isGroup(s?: ShowIf): s is { and: ShowIf[] } | { or: ShowIf[] } {
  return (
    !!s &&
    (Object.prototype.hasOwnProperty.call(s, "and") ||
      Object.prototype.hasOwnProperty.call(s, "or"))
  );
}
function groupOp(s: { and: ShowIf[] } | { or: ShowIf[] }): "and" | "or" {
  return (s as any).and ? "and" : "or";
}
function groupChildren(s: { and: ShowIf[] } | { or: ShowIf[] }): ShowIf[] {
  return ((s as any).and ?? (s as any).or) as ShowIf[];
}
function makeGroup(
  op: "and" | "or",
  children: ShowIf[] = []
): { and: ShowIf[] } | { or: ShowIf[] } {
  return op === "and" ? { and: children } : { or: children };
}
function makeAtom(): { field: string; op: ShowIfOp; value: unknown } {
  return { field: "", op: "eq", value: "" };
}

function ShowIfEditor({
  value,
  onChange,
}: {
  value?: ShowIf;
  onChange: (next?: ShowIf) => void;
}) {
  const removeSelf = () => onChange(undefined);

  if (!value) {
    return (
      <div className="border rounded p-2 bg-body-secondary">
        <div className="d-flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onChange(makeAtom())}>
            + Condition
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => onChange(makeGroup("and", [makeAtom()]))}
          >
            + AND Group
          </Button>
          <Button
            size="sm"
            variant="outline-secondary"
            onClick={() => onChange(makeGroup("or", [makeAtom()]))}
          >
            + OR Group
          </Button>
        </div>
      </div>
    );
  }

  if (!isGroup(value)) {
    // Atom
    const atom = value as { field: string; op: ShowIfOp; value: unknown };
    const isIn = atom.op === "in";
    const valueText = Array.isArray(atom.value)
      ? (atom.value as any[]).join("|")
      : (atom.value as any) ?? "";

    return (
      <div className="border rounded p-2 bg-body-tertiary">
        <div className="d-flex flex-wrap gap-2 align-items-start">
          <Form.Control
            placeholder="field"
            value={atom.field}
            onChange={(e) => onChange({ ...atom, field: e.target.value })}
            style={{ maxWidth: 200 }}
          />
          <Form.Select
            value={atom.op}
            onChange={(e) => {
              const op = e.target.value as ShowIfOp;
              const nextVal =
                op === "in"
                  ? Array.isArray(atom.value)
                    ? atom.value
                    : ([] as string[])
                  : Array.isArray(atom.value)
                  ? ""
                  : atom.value ?? "";
              onChange({ ...atom, op, value: nextVal });
            }}
            style={{ maxWidth: 110 }}
          >
            <option value="eq">eq</option>
            <option value="neq">neq</option>
            <option value="in">in</option>
          </Form.Select>
          <Form.Control
            placeholder={isIn ? "a|b|c" : "value"}
            value={valueText}
            onChange={(e) => {
              if (isIn) {
                const arr = e.target.value
                  .split("|")
                  .map((s) => s.trim())
                  .filter(Boolean);
                onChange({ ...atom, value: arr });
              } else {
                onChange({ ...atom, value: e.target.value });
              }
            }}
            style={{ minWidth: 200 }}
          />
          <Button size="sm" variant="outline-danger" onClick={removeSelf}>
            Remove
          </Button>
        </div>
        <div className="form-text mt-1">
          For checklist/array fields, <code>eq</code> means “includes value”.
          Use <code>in</code> for any-of.
        </div>
      </div>
    );
  }

  // Group
  const g = value as { and: ShowIf[] } | { or: ShowIf[] };
  const op = groupOp(g);
  const children = groupChildren(g);

  const setOp = (nextOp: "and" | "or") => onChange(makeGroup(nextOp, children));
  const updateChild = (idx: number, child?: ShowIf) => {
    const next = [...children];
    if (child) next[idx] = child;
    else next.splice(idx, 1);
    if (next.length === 0) onChange(undefined); // collapse empty group
    else onChange(makeGroup(op, next));
  };

  const addCond = () => onChange(makeGroup(op, [...children, makeAtom()]));
  const addGroup = (which: "and" | "or") =>
    onChange(makeGroup(op, [...children, makeGroup(which, [makeAtom()])]));

  return (
    <div className="border rounded p-2 bg-body-tertiary">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold text-uppercase small">Group</span>
          <ButtonGroup size="sm">
            <Button
              variant={op === "and" ? "secondary" : "outline-secondary"}
              onClick={() => setOp("and")}
            >
              AND
            </Button>
            <Button
              variant={op === "or" ? "secondary" : "outline-secondary"}
              onClick={() => setOp("or")}
            >
              OR
            </Button>
          </ButtonGroup>
        </div>
        <div className="d-flex gap-2">
          <Button
            size="sm"
            variant="outline-danger"
            onClick={() => onChange(undefined)}
          >
            Remove Group
          </Button>
        </div>
      </div>

      <div className="d-flex flex-column gap-2">
        {children.map((c, idx) => (
          <div key={idx}>
            <ShowIfEditor
              value={c}
              onChange={(next) => updateChild(idx, next)}
            />
          </div>
        ))}
      </div>

      <div className="d-flex flex-wrap gap-2 mt-2">
        <Button size="sm" onClick={addCond}>
          + Condition
        </Button>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => addGroup("and")}
        >
          + AND Group
        </Button>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => addGroup("or")}
        >
          + OR Group
        </Button>
      </div>
    </div>
  );
}

export default function AdminFormBuilderPage() {
  // Left list
  const [forms, setForms] = useState<FormDef[] | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  // Current selection
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftWithUid>(clone(DEFAULT_DRAFT));
  const [dirty, setDirty] = useState(false);

  // Buffer for select options text (so commas can be typed)
  const [optionsText, setOptionsText] = useState<Record<string, string>>({});

  // UI states
  const [alert, setAlert] = useState<{
    variant: "success" | "danger" | "warning" | "info";
    msg: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [jsonModal, setJsonModal] = useState(false);
  const [jsonText, setJsonText] = useState("");

  // Track which sections are collapsed
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const toggleSection = (i: number) =>
    setCollapsed((m) => ({ ...m, [i]: !m[i] }));

  // buffer for editing field IDs without immediate sanitization
  const [idText, setIdText] = useState<Record<string, string>>({});
  const getIdText = (f: FieldWithUid) => idText[f._uid] ?? f.id;
  const setIdBuffer = (f: FieldWithUid, text: string) =>
    setIdText((m) => ({ ...m, [f._uid]: text }));

  function commitIdFromText(secIdx: number, fieldIdx: number, f: FieldWithUid) {
    const raw = idText[f._uid] ?? f.id ?? "";
    const normalized = idify(raw);

    // If user didn't actually change anything, keep as-is and sync buffer.
    if (normalized === f.id) {
      setIdText((m) => ({ ...m, [f._uid]: f.id }));
      return;
    }

    let next: string;
    if (!normalized) {
      // still empty -> derive from label or fallback to "field"
      const base = idify(f.label || "field") || "field";
      next = ensureUniqueFieldId(draft.sections[secIdx], base, f._uid);
    } else {
      next = ensureUniqueFieldId(draft.sections[secIdx], normalized, f._uid);
    }

    setField(secIdx, fieldIdx, { id: next });
    setIdText((m) => ({ ...m, [f._uid]: next }));
  }

  // Load list of forms
  const refreshList = async () => {
    setLoadingList(true);
    try {
      const data = await listForms();
      setForms(data);
    } catch (e: any) {
      setAlert({
        variant: "danger",
        msg: e?.message ?? "Failed to load forms.",
      });
      setForms([]);
    } finally {
      setLoadingList(false);
    }
  };
  useEffect(() => {
    refreshList();
  }, []);

  // Select an item
  const loadForm = async (id: string) => {
    try {
      const fd = await fetchForm(id);
      if (!fd) throw new Error("Form not found");
      const { id: _omit, ...rest } = fd as any;
      const base = lightValidate(rest)
        ? (rest as Omit<FormDef, "id">)
        : stripUid(DEFAULT_DRAFT);
      const withUids = toDraftWithUid(base);
      setSelectedId(id);
      setDraft(clone(withUids));
      setOptionsText({});
      setIdText({});
      setDirty(false);
      setAlert(null);
    } catch (e: any) {
      setAlert({
        variant: "danger",
        msg: e?.message ?? "Failed to load form.",
      });
    }
  };

  // New form
  const newForm = () => {
    setSelectedId(null);
    setDraft(clone(DEFAULT_DRAFT));
    setOptionsText({});
    setIdText({});
    setDirty(false);
    setAlert(null);
  };

  // Save
  const [tmpId, setTmpId] = useState("daily");
  const canSave = useMemo(
    () => !!draft?.title && (selectedId || tmpId),
    [draft?.title, selectedId, tmpId]
  );
  const save = async () => {
    if (!canSave) return;
    const id = selectedId ?? tmpId.trim();
    if (!id) {
      setAlert({ variant: "warning", msg: "Please enter a form ID." });
      return;
    }
    const toPersist = stripUid(draft);
    if (!lightValidate(toPersist)) {
      setAlert({
        variant: "warning",
        msg: "Form JSON is invalid. Fix errors first.",
      });
      return;
    }
    try {
      setSaving(true);
      await upsertForm(id, toPersist);
      setSelectedId(id);
      setDirty(false);
      setAlert({ variant: "success", msg: `Saved form "${id}".` });
      await refreshList();
    } catch (e: any) {
      setAlert({
        variant: "danger",
        msg: e?.message ?? "Failed to save form.",
      });
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const remove = async (id: string) => {
    if (!confirm(`Delete form "${id}"?`)) return;
    try {
      setDeleting(id);
      await deleteForm(id);
      if (selectedId === id) newForm();
      setAlert({ variant: "success", msg: `Deleted "${id}".` });
      await refreshList();
    } catch (e: any) {
      setAlert({
        variant: "danger",
        msg: e?.message ?? "Failed to delete form.",
      });
    } finally {
      setDeleting(null);
    }
  };

  // JSON import/export
  const openJson = () => {
    setJsonText(JSON.stringify(stripUid(draft), null, 2));
    setJsonModal(true);
  };
  const importJson = () => {
    try {
      const obj = JSON.parse(jsonText);
      if (!lightValidate(obj)) {
        setAlert({ variant: "warning", msg: "Invalid JSON shape." });
        return;
      }
      const withUids = toDraftWithUid(obj);
      setDraft(withUids);
      setOptionsText({});
      setIdText({});
      setDirty(true);
      setJsonModal(false);
    } catch (e: any) {
      setAlert({ variant: "danger", msg: e?.message ?? "Invalid JSON." });
    }
  };
  const exportJson = () => {
    const data = JSON.stringify(stripUid(draft), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${selectedId ?? "new-form"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // --- Editing helpers ---
  const set = <K extends keyof DraftWithUid>(k: K, v: DraftWithUid[K]) => {
    setDraft((d) => {
      const next = clone(d);
      (next as any)[k] = v;
      return next;
    });
    setDirty(true);
  };
  const setSection = (i: number, next: Partial<SectionWithUid>) => {
    setDraft((d) => {
      const dup = clone(d);
      dup.sections[i] = { ...dup.sections[i], ...next };
      return dup;
    });
    setDirty(true);
  };
  const addSection = () => {
    setDraft((d) => {
      const dup = clone(d);
      dup.sections.push({
        title: `Section ${dup.sections.length + 1}`,
        fields: [],
      });
      return dup;
    });
    setDirty(true);
  };
  const removeSection = (i: number) => {
    setDraft((d) => {
      const dup = clone(d);
      dup.sections.splice(i, 1);
      return dup;
    });
    setDirty(true);
  };
  const moveSection = (i: number, dir: -1 | 1) => {
    setDraft((d) => {
      const dup = clone(d);
      const j = i + dir;
      if (j < 0 || j >= dup.sections.length) return dup;
      const [sp] = dup.sections.splice(i, 1);
      dup.sections.splice(j, 0, sp);
      return dup;
    });
    setDirty(true);
  };

  const addField = (secIdx: number, type: FieldType) => {
    setDraft((d) => {
      const dup = clone(d);
      const sec = dup.sections[secIdx];
      const baseLabel =
        type === "boolean"
          ? "OK?"
          : type === "number"
          ? "Number"
          : type === "select"
          ? "Select"
          : type === "checklist"
          ? "Checklist"
          : type === "date"
          ? "Date"
          : "Text";
      const id = ensureUniqueFieldId(sec, idify(baseLabel));
      const f: FieldWithUid = {
        _uid: crypto.randomUUID(),
        id,
        type,
        label: baseLabel,
      };
      if (type === "select" || type === "checklist")
        f.options = ["Option A", "Option B"];
      if (type === "boolean") f.switchLabel = "Yes";
      sec.fields.push(f);
      return dup;
    });
    setDirty(true);
  };

  const setField = (
    secIdx: number,
    fieldIdx: number,
    next: Partial<FieldWithUid>
  ) => {
    setDraft((d) => {
      const dup = clone(d);
      dup.sections[secIdx].fields[fieldIdx] = {
        ...dup.sections[secIdx].fields[fieldIdx],
        ...next,
      };
      return dup;
    });
    setDirty(true);
  };
  const moveField = (secIdx: number, fieldIdx: number, dir: -1 | 1) => {
    setDraft((d) => {
      const dup = clone(d);
      const arr = dup.sections[secIdx].fields;
      const j = fieldIdx + dir;
      if (j < 0 || j >= arr.length) return dup;
      const [sp] = arr.splice(fieldIdx, 1);
      arr.splice(j, 0, sp);
      return dup;
    });
    setDirty(true);
  };
  const removeField = (secIdx: number, fieldIdx: number) => {
    setDraft((d) => {
      const dup = clone(d);
      const f = dup.sections[secIdx].fields[fieldIdx];
      setOptionsText((buf) => {
        const n = { ...buf };
        delete n[f._uid];
        return n;
      });
      dup.sections[secIdx].fields.splice(fieldIdx, 1);
      return dup;
    });
    setDirty(true);
  };

  const valid = lightValidate(stripUid(draft));

  // Options text buffer helpers
  const getOptionsText = (f: FieldWithUid) =>
    optionsText[f._uid] ?? (f.options ?? []).join(", ");
  const setOptionsBuffer = (f: FieldWithUid, text: string) =>
    setOptionsText((m) => ({ ...m, [f._uid]: text }));
  const commitOptionsFromText = (
    secIdx: number,
    fieldIdx: number,
    f: FieldWithUid
  ) => {
    const text = getOptionsText(f);
    const arr = text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    setField(secIdx, fieldIdx, { options: arr.length ? arr : undefined });
  };

  return (
    <Container fluid className="py-3">
      <Row>
        {/* LEFT: Forms list */}
        <Col md={3} lg={2} className="mb-3">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h2 className="h6 m-0">Forms</h2>
            <Button size="sm" variant="outline-secondary" onClick={refreshList}>
              Refresh
            </Button>
          </div>
          <Card>
            <Card.Body className="p-0">
              {loadingList ? (
                <div className="p-3 d-flex align-items-center gap-2">
                  <Spinner animation="border" size="sm" />
                  <span>Loading…</span>
                </div>
              ) : (
                <>
                  <ListGroup variant="flush">
                    {forms && forms.length > 0 ? (
                      forms.map((f) => (
                        <ListGroup.Item
                          as="div"
                          key={f.id}
                          action
                          active={selectedId === f.id}
                          onClick={() => loadForm(f.id)}
                          className="d-flex justify-content-between align-items-center"
                        >
                          <div>
                            <div className="fw-semibold">{f.title}</div>
                            <div className="small text-muted">
                              <code>{f.id}</code> ·{" "}
                              <Badge
                                bg={
                                  f.period === "daily" ? "primary" : "secondary"
                                }
                              >
                                {f.period}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={(e) => {
                              e.stopPropagation();
                              remove(f.id);
                            }}
                            disabled={deleting === f.id}
                          >
                            {deleting === f.id ? "…" : "Delete"}
                          </Button>
                        </ListGroup.Item>
                      ))
                    ) : (
                      <div className="p-3 text-muted">No forms yet.</div>
                    )}
                  </ListGroup>
                  <div className="p-2">
                    <Button className="w-100" onClick={newForm}>
                      + New form
                    </Button>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* CENTER: Editor */}
        <Col md={5} lg={6} className="mb-3">
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
            <Card.Body>
              <div className="d-flex flex-wrap gap-2 align-items-end">
                <div style={{ minWidth: 220 }}>
                  <Form.Label className="mb-1">Form title</Form.Label>
                  <Form.Control
                    value={draft.title}
                    onChange={(e) => set("title", e.target.value)}
                    placeholder="Daily Ambulance Checklist"
                  />
                </div>
                <div style={{ minWidth: 180 }}>
                  <Form.Label className="mb-1">Period</Form.Label>
                  <Form.Select
                    value={draft.period}
                    onChange={(e) =>
                      set("period", e.target.value as "daily" | "weekly")
                    }
                  >
                    <option value="daily">daily</option>
                    <option value="weekly">weekly</option>
                  </Form.Select>
                </div>
                <div className="ms-auto d-flex gap-2">
                  <Button variant="outline-secondary" onClick={openJson}>
                    JSON
                  </Button>
                  <Button variant="outline-secondary" onClick={exportJson}>
                    Export
                  </Button>
                  {!selectedId && (
                    <InputGroup style={{ width: 240 }}>
                      <InputGroup.Text>forms/</InputGroup.Text>
                      <Form.Control
                        value={tmpId}
                        onChange={(e) => setTmpId(e.target.value)}
                        placeholder="daily"
                      />
                    </InputGroup>
                  )}
                  <Button
                    onClick={save}
                    disabled={!canSave || !valid || saving}
                  >
                    {saving ? "Saving…" : selectedId ? "Save" : "Create"}
                  </Button>
                </div>
              </div>
              {!valid && (
                <div className="text-danger mt-2">
                  Form has validation issues.
                </div>
              )}
              {dirty && (
                <div className="text-warning mt-1 small">Unsaved changes</div>
              )}
            </Card.Body>
          </Card>

          {/* Sections */}
          {draft.sections.map((sec, i) => (
            <Card className="mb-3" key={i}>
              <Card.Header className="d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => toggleSection(i)}
                    aria-expanded={!collapsed[i]}
                  >
                    {collapsed[i] ? "▶" : "▼"}
                  </Button>
                  <Form.Control
                    value={sec.title}
                    onChange={(e) => setSection(i, { title: e.target.value })}
                    style={{ width: 260 }}
                  />
                  <Badge bg="light" text="dark">
                    {sec.fields.length} fields
                  </Badge>
                </div>
                <div className="d-flex gap-2">
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => moveSection(i, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => moveSection(i, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => removeSection(i)}
                  >
                    Remove
                  </Button>
                </div>
              </Card.Header>
              <Collapse in={!collapsed[i]}>
                <div>
                  <Card.Body>
                    {/* Fields table */}
                    {sec.fields.length === 0 ? (
                      <div className="text-muted">
                        No fields in this section.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <Table hover size="sm" className="align-middle m-0">
                          <thead>
                            <tr>
                              <th style={{ width: 200 }}>Field ID</th>
                              <th style={{ width: 140 }}>Type</th>
                              <th style={{ width: 110 }}>Required</th>
                              <th style={{ width: 210 }} className="text-end">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.fields.map((f, j) => (
                              <Fragment key={f._uid}>
                                {/* Row 1: compact core controls */}
                                <tr>
                                  <td>
                                    <Form.Control
                                      placeholder="field_id"
                                      value={getIdText(f)}
                                      onChange={(e) =>
                                        setIdBuffer(f, e.target.value)
                                      }
                                      onBlur={() => commitIdFromText(i, j, f)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          commitIdFromText(i, j, f);
                                        }
                                      }}
                                    />
                                  </td>
                                  <td>
                                    <Form.Select
                                      value={f.type}
                                      onChange={(e) =>
                                        setField(i, j, {
                                          type: e.target.value as FieldType,
                                        })
                                      }
                                    >
                                      <option value="text">text</option>
                                      <option value="number">number</option>
                                      <option value="boolean">boolean</option>
                                      <option value="select">select</option>
                                      <option value="checklist">
                                        checklist
                                      </option>
                                      <option value="date">date</option>
                                    </Form.Select>
                                  </td>
                                  <td className="text-center">
                                    <Form.Check
                                      checked={!!f.required}
                                      onChange={(e) =>
                                        setField(i, j, {
                                          required: e.currentTarget.checked,
                                        })
                                      }
                                    />
                                  </td>
                                  <td className="text-end">
                                    <Button
                                      size="sm"
                                      variant="outline-secondary"
                                      onClick={() => moveField(i, j, -1)}
                                      className="me-1"
                                    >
                                      ↑
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline-secondary"
                                      onClick={() => moveField(i, j, 1)}
                                      className="me-1"
                                    >
                                      ↓
                                    </Button>
                                    <Dropdown as={ButtonGroup} size="sm">
                                      <Button
                                        variant="outline-danger"
                                        onClick={() => removeField(i, j)}
                                      >
                                        Remove
                                      </Button>
                                      <Dropdown.Toggle
                                        split
                                        variant="outline-secondary"
                                        id={`dup-${i}-${j}`}
                                      />
                                      <Dropdown.Menu>
                                        <Dropdown.Item
                                          onClick={() =>
                                            setDraft((d) => {
                                              const dup = clone(d);
                                              const sec2 = dup.sections[i];
                                              const next = clone(
                                                sec2.fields[j]
                                              );
                                              next._uid = crypto.randomUUID();
                                              next.id = ensureUniqueFieldId(
                                                sec2,
                                                next.id
                                              );
                                              sec2.fields.splice(
                                                j + 1,
                                                0,
                                                next
                                              );
                                              return dup;
                                            })
                                          }
                                        >
                                          Duplicate
                                        </Dropdown.Item>
                                      </Dropdown.Menu>
                                    </Dropdown>
                                  </td>
                                </tr>

                                {/* Combined details panel for this field */}
                                <tr>
                                  <td colSpan={4}>
                                    <div className="border rounded-3 p-3 bg-body-tertiary mb-2">
                                      {/* Row: Label (left) + Options/Placeholder (right) */}
                                      <Row className="g-3">
                                        <Col md={6}>
                                          <Form.Label className="mb-1">
                                            Label
                                          </Form.Label>
                                          <Form.Control
                                            className="form-control-lg"
                                            placeholder="Field label shown to crews"
                                            value={f.label}
                                            onChange={(e) =>
                                              setField(i, j, {
                                                label: e.target.value,
                                              })
                                            }
                                          />
                                        </Col>

                                        <Col md={6}>
                                          <Form.Label className="mb-1">
                                            {f.type === "select" ||
                                            f.type === "checklist"
                                              ? "Options (comma-separated)"
                                              : f.type === "boolean"
                                              ? "Yes label (optional)"
                                              : "Placeholder (optional)"}
                                          </Form.Label>

                                          {f.type === "select" ||
                                          f.type === "checklist" ? (
                                            <Form.Control
                                              as="textarea"
                                              rows={2}
                                              placeholder="e.g. Oxygen, Trauma kit, Airway bag"
                                              value={getOptionsText(f)}
                                              onChange={(e) =>
                                                setOptionsBuffer(
                                                  f,
                                                  e.target.value
                                                )
                                              }
                                              onBlur={() =>
                                                commitOptionsFromText(i, j, f)
                                              }
                                              onKeyDown={(e) => {
                                                if (
                                                  e.key === "Enter" &&
                                                  (e.metaKey || e.ctrlKey)
                                                ) {
                                                  e.preventDefault();
                                                  commitOptionsFromText(
                                                    i,
                                                    j,
                                                    f
                                                  );
                                                }
                                              }}
                                            />
                                          ) : f.type === "boolean" ? (
                                            <Form.Control
                                              placeholder="e.g. Yes"
                                              value={f.switchLabel ?? ""}
                                              onChange={(e) =>
                                                setField(i, j, {
                                                  switchLabel: e.target.value,
                                                })
                                              }
                                            />
                                          ) : (
                                            <Form.Control
                                              placeholder="e.g. Enter reading…"
                                              value={f.placeholder ?? ""}
                                              onChange={(e) =>
                                                setField(i, j, {
                                                  placeholder: e.target.value,
                                                })
                                              }
                                            />
                                          )}

                                          {(f.type === "select" ||
                                            f.type === "checklist") && (
                                            <div className="form-text">
                                              Press <kbd>Ctrl</kbd>/
                                              <kbd>Cmd</kbd>+<kbd>Enter</kbd> to
                                              commit, or click out.
                                            </div>
                                          )}
                                        </Col>
                                      </Row>

                                      {/* Divider */}
                                      <hr className="my-3 opacity-25" />

                                      {/* Show If editor full width */}
                                      <Form.Label className="mb-1">
                                        Show If
                                      </Form.Label>
                                      <ShowIfEditor
                                        value={f.showIf}
                                        onChange={(next) =>
                                          setField(i, j, { showIf: next })
                                        }
                                      />
                                    </div>
                                  </td>
                                </tr>
                              </Fragment>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}
                    {/* Add field toolbar */}
                    <div className="mb-2">
                      <ButtonGroup>
                        <Button size="sm" onClick={() => addField(i, "text")}>
                          + Text
                        </Button>
                        <Button size="sm" onClick={() => addField(i, "number")}>
                          + Number
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => addField(i, "boolean")}
                        >
                          + Boolean
                        </Button>
                        <Button size="sm" onClick={() => addField(i, "select")}>
                          + Select
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => addField(i, "checklist")}
                        >
                          + Checklist
                        </Button>
                        <Button size="sm" onClick={() => addField(i, "date")}>
                          + Date
                        </Button>
                      </ButtonGroup>
                    </div>
                  </Card.Body>
                </div>
              </Collapse>
            </Card>
          ))}
          <div className="mb-4">
            <Button variant="outline-primary" onClick={addSection}>
              + Add section
            </Button>
          </div>
        </Col>

        {/* RIGHT: Live Preview */}
        <Col md={4} lg={4} className="mb-3">
          <Card>
            <Card.Header className="d-flex justify-content-between align-items-center">
              <div className="fw-semibold">Live preview</div>
              <Badge bg={valid ? "success" : "danger"}>
                {valid ? "valid" : "invalid"}
              </Badge>
            </Card.Header>
            <Card.Body>
              <FormRenderer
                // safe to cast here; _uid never reaches the renderer because it ignores extra props.
                formDef={
                  {
                    ...(stripUid(draft) as any),
                    id: selectedId ?? "preview",
                  } as FormDef
                }
                staff={["Alice", "Bob"]}
                staffKey={"alice__bob"}
                dateKey={"2025-09-26"}
              />
            </Card.Body>
          </Card>
          <div className="text-muted small mt-2">
            Preview uses demo staff and date; saving doesn’t use preview data.
          </div>
        </Col>
      </Row>

      {/* JSON modal */}
      <Modal show={jsonModal} onHide={() => setJsonModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Form JSON</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control
            as="textarea"
            rows={18}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
          />
          <div className="small text-muted mt-2">
            Paste JSON to import, or edit directly and click{" "}
            <strong>Import</strong>.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setJsonModal(false)}>
            Close
          </Button>
          <Button variant="outline-primary" onClick={importJson}>
            Import
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
}
