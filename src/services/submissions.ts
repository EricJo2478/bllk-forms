// submissions.ts
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  orderBy,
  doc,
  runTransaction,
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot,
  startAfter,
} from "firebase/firestore";
import { db } from "./firebase";

export async function findExistingByPair(
  formId: string,
  staffKey: string,
  dateKey: string
) {
  const q = query(
    collection(db, "submissions"),
    where("formId", "==", formId),
    where("staffKey", "==", staffKey),
    where("dateKey", "==", dateKey),
    limit(1)
  );
  const s = await getDocs(q);
  return s.docs[0];
}

export async function listExistingByPair(
  formId: string,
  staffKey: string,
  dateKey: string
) {
  const q = query(
    collection(db, "submissions"),
    where("formId", "==", formId),
    where("staffKey", "==", staffKey),
    where("dateKey", "==", dateKey),
    orderBy("createdAt", "asc")
  );
  const s = await getDocs(q);
  return s.docs; // array of QueryDocumentSnapshot
}

/** Optional: get next sequence number per (formId, staffKey, dateKey) */
export async function nextSequence(
  formId: string,
  staffKey: string,
  dateKey: string
) {
  const counterId = `${formId}__${dateKey}__${staffKey}`;
  const ref = doc(db, "counters", counterId);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists() ? snap.data().value : 0) ?? 0;
    tx.set(ref, { value: current + 1 }, { merge: true });
    return current + 1;
  });
  return seq as number;
}

export async function createSubmission(data: any) {
  return addDoc(collection(db, "submissions"), data);
}

export type Submission = {
  id: string;
  formId: string;
  period: "daily" | "weekly";
  dateKey: string; // "YYYY-MM-DD" or "YYYY-Www"
  staff: [string, string];
  staffKey: string;
  sequence?: number;
  answers: Record<string, unknown>;
  createdAt?: Timestamp | Date;
};

type Page<T> = {
  items: T[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
};

export async function querySubmissions(opts: {
  formId?: string;
  staffKey?: string;
  createdFrom?: Date; // inclusive
  createdTo?: Date; // exclusive
  pageSize?: number; // default 25
  after?: QueryDocumentSnapshot<DocumentData> | null;
}): Promise<Page<Submission>> {
  const col = collection(db, "submissions");
  const parts: any[] = [];

  if (opts.formId) parts.push(where("formId", "==", opts.formId));
  if (opts.staffKey) parts.push(where("staffKey", "==", opts.staffKey));
  if (opts.createdFrom) parts.push(where("createdAt", ">=", opts.createdFrom));
  if (opts.createdTo) parts.push(where("createdAt", "<", opts.createdTo));

  // Order newest first
  const q = query(
    col,
    ...parts,
    orderBy("createdAt", "desc"),
    limit(opts.pageSize ?? 25)
  );

  const snap = await getDocs(opts.after ? query(q, startAfter(opts.after)) : q);
  const items: Submission[] = snap.docs.map((d) => {
    const data = d.data() as any;
    const createdAt: any = data.createdAt?.toDate?.() ?? data.createdAt ?? null;
    return { id: d.id, ...data, createdAt } as Submission;
  });

  return {
    items,
    cursor: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
  };
}
