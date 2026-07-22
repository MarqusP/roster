import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, firebaseReady } from "../firebase.js";

// Chapter-wide settings (currently just the chapter name shown on the
// letterhead) live in one shared Firestore document.
export function useSettings() {
  const [chapterName, setChapterNameState] = useState("");

  useEffect(() => {
    if (!firebaseReady) return undefined;
    const ref = doc(db, "settings", "main");
    const unsubscribe = onSnapshot(ref, (snap) => {
      setChapterNameState(snap.exists() ? snap.data().chapterName || "" : "");
    });
    return unsubscribe;
  }, []);

  const setChapterName = useCallback(async (name) => {
    if (!firebaseReady) return;
    await setDoc(doc(db, "settings", "main"), { chapterName: name }, { merge: true });
  }, []);

  return { chapterName, setChapterName };
}
