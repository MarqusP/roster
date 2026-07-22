import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db, firebaseReady } from "../firebase.js";

const COLLECTION = "alumni";
const CHUNK_SIZE = 400; // Firestore batches cap at 500 writes

export function useAlumni(uid) {
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!firebaseReady || !uid) {
      setLoading(false);
      return undefined;
    }
    const q = query(collection(db, COLLECTION), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setAlumni(
          snapshot.docs.map((docSnap, index) => ({
            id: docSnap.id,
            seq: index + 1,
            ...docSnap.data(),
          }))
        );
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [uid]);

  const addAlumnus = useCallback(async (record) => {
    const batch = writeBatch(db);
    const ref = doc(collection(db, COLLECTION));
    batch.set(ref, { ...record, createdAt: serverTimestamp() });
    await batch.commit();
  }, []);

  const importMany = useCallback(
    async (records) => {
      const existingByEmail = {};
      alumni.forEach((a) => {
        if (a.email) existingByEmail[a.email.trim().toLowerCase()] = a;
      });

      let added = 0;
      let updated = 0;
      const chunks = [];
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        chunks.push(records.slice(i, i + CHUNK_SIZE));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((record) => {
          const key = (record.email || "").trim().toLowerCase();
          if (key && existingByEmail[key]) {
            batch.update(doc(db, COLLECTION, existingByEmail[key].id), record);
            updated += 1;
          } else {
            const ref = doc(collection(db, COLLECTION));
            batch.set(ref, { ...record, createdAt: serverTimestamp() });
            if (key) existingByEmail[key] = { id: ref.id };
            added += 1;
          }
        });
        await batch.commit();
      }

      return { added, updated };
    },
    [alumni]
  );

  const clearAll = useCallback(async () => {
    const snapshot = await getDocs(collection(db, COLLECTION));
    const docsArr = snapshot.docs;
    const chunks = [];
    for (let i = 0; i < docsArr.length; i += CHUNK_SIZE) {
      chunks.push(docsArr.slice(i, i + CHUNK_SIZE));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }, []);

  return { alumni, loading, error, addAlumnus, importMany, clearAll };
}
