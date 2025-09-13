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

const userDb = db.table("users")
const avatarDb = db.table("avatars")
const groupDb = db.table("groups")
const worldDb = db.table("worlds")
const countDb = db.table("count")

export { avatarDb, userDb, groupDb, worldDb, countDb };