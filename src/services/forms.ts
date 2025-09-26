// src/services/forms.ts
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import { FormDef } from "../types/form";

export async function fetchForm(formId: string) {
  const snap = await getDoc(doc(db, "forms", formId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as FormDef) : null;
}

export async function listForms(): Promise<FormDef[]> {
  const q = query(collection(db, "forms"), orderBy("__name__"));
  const s = await getDocs(q);
  return s.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<FormDef, "id">),
  })) as FormDef[];
}

export async function upsertForm(formId: string, data: Omit<FormDef, "id">) {
  await setDoc(doc(db, "forms", formId), data, { merge: false });
}

export async function deleteForm(formId: string) {
  await deleteDoc(doc(db, "forms", formId));
}
