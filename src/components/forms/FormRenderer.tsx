// src/components/forms/FormRenderer.tsx
import { Button, Form } from "react-bootstrap";
import { Controller, Path, useForm, useWatch } from "react-hook-form";
import type { FormDef } from "../../types/form";
import { createSubmission } from "../../services/submissions";
import "../../styles/touch-fields.css";

type FormValues = Record<string, unknown>;

type Props = {
  formDef: FormDef;
  staff: [string, string];
  staffKey: string;
  dateKey: string;
  getNextSequence?: () => Promise<number>;
};

type ShowIf =
  | { field: string; op: "eq" | "neq" | "in"; value: unknown }
  | { and: ShowIf[] }
  | { or: ShowIf[] };
function evalShowIf(cond: ShowIf | undefined, values: FormValues): boolean {
  if (!cond) return true;
  if ("and" in cond) return cond.and.every((c) => evalShowIf(c, values));
  if ("or" in cond) return cond.or.some((c) => evalShowIf(c, values));

  const v = values[(cond as any).field as string];
  const op = (cond as any).op;
  const cval = (cond as any).value;

  const isArr = Array.isArray(v);
  switch (op) {
    case "eq":
      // if field value is array, treat eq as “array includes value”
      if (typeof v === "boolean") {
        return v ? cval === "true" : cval === "false";
      }
      return isArr ? v.includes(cval) : v === cval;
    case "neq":
      return isArr ? !v.includes(cval) : v !== cval;
    case "in":
      if (Array.isArray(cval)) {
        return isArr ? v.some((x: any) => cval.includes(x)) : cval.includes(v);
      }
      return false;
    default:
      return true;
  }
}

export default function FormRenderer({
  formDef,
  staff,
  staffKey,
  dateKey,
  getNextSequence,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({
    defaultValues: {},
    // Hidden fields are unregistered so their "required" won't fire.
    shouldUnregister: true,
    // Validate on submit (default). If you want instant feedback, add:
    // mode: "onTouched",
  });

  const values = useWatch({ control }) as FormValues;

  const Label = ({ f }: { f: any }) => (
    <Form.Label>
      {f.label}
      {f.required ? <span className="text-danger ms-1">*</span> : null}
    </Form.Label>
  );
  const Err = ({ id }: { id: string }) =>
    (errors as any)?.[id] ? (
      <div className="invalid-feedback d-block">
        {((errors as any)[id].message as string) || "Required"}
      </div>
    ) : null;

  const rulesFor = (f: any) =>
    f.required ? { required: "Required" } : undefined;

  const renderField = (f: any) => {
    if (!evalShowIf(f.showIf as ShowIf | undefined, values)) return null;

    switch (f.type) {
      case "text":
        return (
          <Form.Group className="mb-3" key={f.id}>
            <Label f={f} />
            <Form.Control
              {...register(f.id as Path<FormValues>, { ...rulesFor(f) })}
              placeholder={f.placeholder}
              isInvalid={!!(errors as any)?.[f.id]}
            />
            <Err id={f.id} />
          </Form.Group>
        );

      case "number":
        return (
          <Form.Group className="mb-3" key={f.id}>
            <Label f={f} />
            <Form.Control
              type="number"
              {...register(f.id as Path<FormValues>, {
                valueAsNumber: true,
                ...(rulesFor(f) || {}),
              })}
              placeholder={f.placeholder}
              isInvalid={!!(errors as any)?.[f.id]}
            />
            <Err id={f.id} />
          </Form.Group>
        );

      // inside renderField(f: any) in FormRenderer.tsx, replace the "boolean" case with:

      case "boolean": {
        // Required now means: user must choose Yes or No (i.e., not undefined)
        const rules = f.required
          ? {
              validate: (val: unknown) =>
                val === true || val === false || "Required",
            }
          : undefined;

        // Labels — reuse existing switchLabel as the "Yes" label if provided
        const yesLabel: string = f.switchLabel ?? "Yes";
        const noLabel: string = (f as any).noLabel ?? "No"; // optional; defaults to "No"

        return (
          <Form.Group className="mb-3" key={f.id}>
            <Label f={f} />
            <Controller
              name={f.id as Path<FormValues>}
              control={control}
              defaultValue={undefined} // undefined until user chooses
              rules={rules}
              render={({ field }) => {
                const val = field.value as boolean | undefined;
                const yesId = `${f.id}__yes`;
                const noId = `${f.id}__no`;

                return (
                  <div className="option-grid">
                    {/* YES */}
                    <label className="touch-item" htmlFor={yesId}>
                      <Form.Check
                        id={yesId}
                        type="radio"
                        name={f.id}
                        checked={val === true}
                        onChange={() => field.onChange(true)}
                        className="m-0"
                      />
                      <span className="label-text">{yesLabel}</span>
                    </label>

                    {/* NO */}
                    <label className="touch-item" htmlFor={noId}>
                      <Form.Check
                        id={noId}
                        type="radio"
                        name={f.id}
                        checked={val === false}
                        onChange={() => field.onChange(false)}
                        className="m-0"
                      />
                      <span className="label-text">{noLabel}</span>
                    </label>

                    {/* CLEAR (only if not required) */}
                    {!f.required && (
                      <button
                        type="button"
                        className="touch-item btn w-100 text-start"
                        onClick={() => field.onChange(undefined)}
                      >
                        <span className="label-text">Clear</span>
                      </button>
                    )}
                  </div>
                );
              }}
            />
            <Err id={f.id} />
          </Form.Group>
        );
      }

      case "select":
        return (
          <Form.Group className="mb-3" key={f.id}>
            <Label f={f} />
            <Form.Select
              {...register(f.id as Path<FormValues>, { ...rulesFor(f) })}
              isInvalid={!!(errors as any)?.[f.id]}
            >
              <option value="">Select…</option>
              {(f.options ?? []).map((o: string) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Form.Select>
            <Err id={f.id} />
          </Form.Group>
        );
      case "checklist": {
        const opts: string[] = Array.isArray(f.options) ? f.options : [];
        // required => custom validator: at least one selected
        const rules = f.required
          ? {
              validate: (val: unknown) =>
                (Array.isArray(val) && val.length > 0) || "Required",
            }
          : undefined;

        return (
          <Form.Group className="mb-3" key={f.id}>
            <Label f={f} />
            <Controller
              name={f.id as Path<FormValues>}
              control={control}
              defaultValue={[]}
              rules={rules}
              render={({ field }) => {
                const arr = Array.isArray(field.value)
                  ? (field.value as string[])
                  : [];
                const toggle = (opt: string) => {
                  const cur = new Set<string>(arr);
                  if (cur.has(opt)) cur.delete(opt);
                  else cur.add(opt);
                  field.onChange(Array.from(cur));
                };

                return (
                  <div className="option-grid">
                    {opts.length === 0 ? (
                      <div className="text-muted">No options.</div>
                    ) : (
                      opts.map((opt) => {
                        const checked = arr.includes(opt);
                        const inputId = `${f.id}__${opt.replace(/\s+/g, "_")}`;
                        return (
                          <label
                            key={opt}
                            className="touch-item"
                            htmlFor={inputId}
                          >
                            <Form.Check
                              id={inputId}
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(opt)}
                              className="m-0"
                            />
                            <span className="label-text">{opt}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                );
              }}
            />
            <Err id={f.id} />
          </Form.Group>
        );
      }

      default:
        return (
          <Form.Group className="mb-3" key={f.id}>
            <Label f={f} />
            <Form.Control
              {...register(f.id as Path<FormValues>, { ...rulesFor(f) })}
              isInvalid={!!(errors as any)?.[f.id]}
            />
            <Err id={f.id} />
          </Form.Group>
        );
    }
  };

  const onSubmit = async (answers: FormValues) => {
    let sequence: number | undefined;
    if (getNextSequence) {
      try {
        sequence = await getNextSequence();
      } catch {
        /* ignore */
      }
    }
    await createSubmission({
      formId: formDef.id,
      period: formDef.period,
      dateKey,
      staff,
      staffKey,
      sequence,
      answers,
      createdAt: new Date(),
    });
    alert("Submitted!");
    reset({});
  };

  return (
    <div className="form-runner">
      <Form onSubmit={handleSubmit(onSubmit)}>
        <h2 className="mb-2">{formDef.title}</h2>
        <div className="text-muted mb-3">
          {formDef.period === "weekly" ? "Week" : "Date"}:{" "}
          <code>{dateKey}</code> · Staff: <strong>{staff[0]}</strong> &{" "}
          <strong>{staff[1]}</strong>
        </div>

        {(formDef.sections ?? []).map((sec, i) => (
          <fieldset key={i} className="mb-4">
            {sec.title && <legend className="h5">{sec.title}</legend>}
            {(sec.fields ?? []).map((f: any) => renderField(f))}
          </fieldset>
        ))}

        <div className="text-muted mb-2">
          <span className="text-danger">*</span> required
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit"}
        </Button>
      </Form>
    </div>
  );
}
