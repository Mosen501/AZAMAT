import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// We are not strictly requiring a database for this app's core functionality, 
// but we set it up to satisfy the template's structure.
const connectionString = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres";

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
