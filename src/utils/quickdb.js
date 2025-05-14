import fs from "fs";
import { QuickDB } from "quick.db";
import path from "path";

const dbPath = path.resolve("json.sqlite");

// Check if the file exists, if not create an empty file
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, "");
}

// Initialize the database
const db = new QuickDB({ filePath: dbPath });

await db.set("isLocked", false); // Set lock to false, so on restart it is unlocked

export { db };