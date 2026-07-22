import fs from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import Papa from "papaparse";

const keyPath = process.env.SEED_SERVICE_ACCOUNT || new URL("../service-account-key.json", import.meta.url);
if (!fs.existsSync(keyPath)) {
  console.error(`No service account key found at ${keyPath}.`);
  console.error("Download one from Firebase console -> Project settings -> Service accounts -> Generate new private key,");
  console.error("save it as service-account-key.json in the project root, then rerun this script.");
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, "utf8"));

const csvPath = process.argv[2] || new URL("../alumni-import-ready.csv", import.meta.url);
const raw = fs.readFileSync(csvPath, "utf8");
const { data: records } = Papa.parse(raw.trim(), { header: true, skipEmptyLines: true });

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const existing = await db.collection("alumni").limit(1).get();
if (!existing.empty) {
  console.error(`The "alumni" collection already has data. Aborting to avoid duplicates.`);
  process.exit(1);
}

const CHUNK_SIZE = 400;
const chunks = [];
for (let i = 0; i < records.length; i += CHUNK_SIZE) {
  chunks.push(records.slice(i, i + CHUNK_SIZE));
}

let written = 0;
for (const chunk of chunks) {
  const batch = db.batch();
  chunk.forEach((row) => {
    if (!row.Name) return;
    const ref = db.collection("alumni").doc();
    batch.set(ref, {
      name: row.Name || "",
      email: row.Email || "",
      company: row.Company || "",
      title: row.Title || "",
      industry: row.Industry || "",
      location: row.Location || "",
      gradYear: row["Grad Year"] || "",
      linkedin: row.LinkedIn || "",
      createdAt: FieldValue.serverTimestamp(),
    });
    written += 1;
  });
  await batch.commit();
}

console.log(`Seeded ${written} alumni records into Firestore.`);
process.exit(0);
