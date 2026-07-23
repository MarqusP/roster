import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, firebaseReady } from "../firebase.js";

// Checks whether the signed-in user has a doc in the /admins collection.
// Membership is granted manually in the Firebase console -- see firestore.rules.
export function useAdmin(uid) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!firebaseReady || !uid) {
      setIsAdmin(false);
      return undefined;
    }
    const ref = doc(db, "admins", uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => setIsAdmin(snap.exists()),
      () => setIsAdmin(false)
    );
    return unsubscribe;
  }, [uid]);

  return isAdmin;
}
