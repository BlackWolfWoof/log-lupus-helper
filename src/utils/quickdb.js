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

const avatarDb = db.table("avatars")
const userDb = db.table("users")
const emailDb = db.table("emails")

export { avatarDb, userDb, emailDb };