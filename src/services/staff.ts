// src/services/staff.ts
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { Staff } from "../types/staff";

export async function listActiveStaff(): Promise<Staff[]> {
  console.log("[staff] listing");
  try {
    const qy = query(
      collection(db, "staff"),
      where("active", "==", true),
      orderBy("name")
    );
    console.log("[staff] query", qy);
    const snap = await getDocs(qy);
    console.log("[staff] snap size", snap.size);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Staff, "id">),
    }));
  } catch (err: any) {
    // These are the two you most likely hit:
    // err.code === 'failed-precondition' (index needed)
    // err.code === 'permission-denied'   (rules)
    console.error(
      "[staff] listActiveStaff failed:",
      err?.code,
      err?.message,
      err
    );
    throw err;
  }
}

export async function listAllStaff(): Promise<Staff[]> {
  const qy = query(collection(db, "staff"), orderBy("name"));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Staff, "id">),
  }));
}

export async function upsertStaff(id: string, data: Omit<Staff, "id">) {
  await setDoc(doc(db, "staff", id), data, { merge: true });
}

export async function createStaff(name: string, active = true) {
  const id =
    name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 40) || crypto.randomUUID();
  await setDoc(doc(db, "staff", id), { name, active });
  return id;
}

export async function renameStaff(id: string, newName: string) {
  await updateDoc(doc(db, "staff", id), { name: newName });
}

export async function setStaffActive(id: string, active: boolean) {
  await updateDoc(doc(db, "staff", id), { active });
}

export async function deleteStaff(id: string) {
  await deleteDoc(doc(db, "staff", id));
}

/** Bulk import: accepts array of {name, active} and upserts by generated id from name */
export async function importStaff(
  rows: Array<{ name: string; active?: boolean }>
) {
  for (const r of rows) {
    const id = r.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 40);
    await setDoc(
      doc(db, "staff", id || crypto.randomUUID()),
      { name: r.name, active: r.active ?? true },
      { merge: true }
    );
  }
}
