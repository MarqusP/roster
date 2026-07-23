import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db, firebaseReady } from "../firebase.js";

// This member's own pending scheduled-send emails, for the "Scheduled" list.
// Note: this composite query (uid + status + orderBy) needs a Firestore
// composite index -- the first time it runs, Firestore's console error
// includes a direct link to create it automatically.
export function useScheduledEmails(uid) {
  const [scheduled, setScheduled] = useState([]);

  useEffect(() => {
    if (!firebaseReady || !uid) {
      setScheduled([]);
      return undefined;
    }
    const q = query(
      collection(db, "scheduledEmails"),
      where("uid", "==", uid),
      where("status", "==", "pending"),
      orderBy("scheduledFor", "asc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setScheduled(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => setScheduled([])
    );
    return unsubscribe;
  }, [uid]);

  return scheduled;
}
