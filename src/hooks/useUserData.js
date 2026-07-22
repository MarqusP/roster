import { useCallback, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, firebaseReady } from "../firebase.js";

const EMPTY_MY_INFO = { name: "", gradYear: "", major: "" };

// Each signed-in member's own outreach progress ("My Info" + per-alum status/
// notes/history) lives in one Firestore doc keyed by their uid, so it follows
// them across devices instead of being stuck in one browser's localStorage.
export function useUserData(uid) {
  const [myInfo, setMyInfoState] = useState(EMPTY_MY_INFO);
  const [outreachLog, setOutreachLogState] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady || !uid) {
      setMyInfoState(EMPTY_MY_INFO);
      setOutreachLogState({});
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const ref = doc(db, "users", uid);
    const unsubscribe = onSnapshot(ref, (snap) => {
      const data = snap.data() || {};
      setMyInfoState(data.myInfo || EMPTY_MY_INFO);
      setOutreachLogState(data.outreachLog || {});
      setLoading(false);
    });
    return unsubscribe;
  }, [uid]);

  const setMyInfo = useCallback(
    async (value) => {
      if (!firebaseReady || !uid) return;
      const next = typeof value === "function" ? value(myInfo) : value;
      setMyInfoState(next);
      await setDoc(doc(db, "users", uid), { myInfo: next }, { merge: true });
    },
    [uid, myInfo]
  );

  const setOutreachLog = useCallback(
    async (value) => {
      if (!firebaseReady || !uid) return;
      const next = typeof value === "function" ? value(outreachLog) : value;
      setOutreachLogState(next);
      await setDoc(doc(db, "users", uid), { outreachLog: next }, { merge: true });
    },
    [uid, outreachLog]
  );

  return { myInfo, setMyInfo, outreachLog, setOutreachLog, loading };
}
