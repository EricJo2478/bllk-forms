// src/types/form.ts

export type ShowIf =
  | { field: string; op: "eq" | "neq" | "in"; value: unknown }
  | { and: ShowIf[] }
  | { or: ShowIf[] };

export type FormDef = {
  id: string;
  title: string;
  period: "daily" | "weekly";
  sections: { title: string; fields: Field[] }[];
  computed?: { id: string; expr: string }[];
  validation?: { field: string; rule: string; message: string }[];
};

export type BaseField = {
  id: string;
  type: FieldType;
  label: string;
  required?: boolean;
  showIf?: any; // keep your existing ShowIf type
};

export type ChecklistField = BaseField & {
  type: "checklist";
  options: string[];
};

export type SelectField = BaseField & {
  type: "select";
  options: string[];
};

export type TextField = BaseField & { type: "text"; placeholder?: string };
export type NumberField = BaseField & { type: "number"; placeholder?: string };
export type BooleanField = BaseField & {
  type: "boolean";
  switchLabel?: string;
};

export type Field =
  | TextField
  | NumberField
  | BooleanField
  | SelectField
  | ChecklistField
  | DateField;

// Add "date" to your FieldType
export type FieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "checklist"
  | "date";

// Optionally, if you have a field union, extend it:
export type DateField = {
  id: string;
  type: "date";
  label: string;
  required?: boolean;
  placeholder?: string; // help text
  min?: string; // "YYYY-MM-DD"
  max?: string; // "YYYY-MM-DD"
  showIf?: ShowIf; // if you have this in your types
};
