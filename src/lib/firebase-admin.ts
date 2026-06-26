import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

let db: any;
let auth: any;

// Sentinel object we use to detect "serverTimestamp()" inside mock mode
const MOCK_SERVER_TIMESTAMP_SENTINEL = Symbol.for("MOCK_SERVER_TIMESTAMP");

const isServerConfigured = 
  !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY && 
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY !== "YOUR_FIREBASE_SERVICE_ACCOUNT_KEY_JSON_STRING" &&
  !process.env.FIREBASE_SERVICE_ACCOUNT_KEY.includes("YOUR_");

if (isServerConfigured) {
  try {
    if (!getApps().length) {
      const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "";
      const formattedKey = serviceAccountKey.replace(/\\n/g, '\n');
      const serviceAccount = JSON.parse(formattedKey);
      initializeApp({
        credential: cert(serviceAccount),
      });
    }
    db = getFirestore();
    auth = getAuth();
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error) {
    console.error("Firebase Admin initialization failed. Falling back to Mock Server DB:", error);
    setupMockAdmin();
  }
} else {
  console.warn("WARNING: FIREBASE_SERVICE_ACCOUNT_KEY not set. Running with local File-based Mock Database.");
  setupMockAdmin();
}

// Local File Database config
// Vercel serverless functions have a read-only workspace — write to /tmp instead.
const isVercel = !!process.env.VERCEL;
const SOURCE_DB_FILE = path.join(process.cwd(), "mock-db.json");
const DB_FILE = isVercel 
  ? path.join("/tmp", "mock-db.json") 
  : SOURCE_DB_FILE;

function readDb() {
  try {
    // On Vercel, seed /tmp from the bundled template on first access
    if (isVercel && !fs.existsSync(DB_FILE)) {
      if (fs.existsSync(SOURCE_DB_FILE)) {
        try {
          fs.writeFileSync(DB_FILE, fs.readFileSync(SOURCE_DB_FILE, "utf-8"), "utf-8");
          console.log("[MockDB] Seeded /tmp/mock-db.json from template.");
        } catch (e) {
          console.error("[MockDB] Failed to seed /tmp:", e);
        }
      }
    }
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    }
  } catch (error) {
    console.error("[MockDB] Failed to read:", error);
  }
  return { projects: {}, milestones: {}, checkins: {}, conversations: {}, users: {}, agentMessages: {} };
}

function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("[MockDB] Failed to write:", error);
  }
}

// ---------------------------------------------------------------------------
// FieldValue resolution: converts FieldValue sentinels and Date objects into
// a JSON-safe Firestore-timestamp-like shape { _seconds, _nanoseconds }.
// ---------------------------------------------------------------------------
function isFieldValueSentinel(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (val === MOCK_SERVER_TIMESTAMP_SENTINEL) return true;
  if (typeof val !== "object") return false;
  // firebase-admin FieldValue class name checks
  const ctorName = val?.constructor?.name || "";
  if (ctorName === "FieldValue" || ctorName === "FirestoreFieldValue" || ctorName === "ServerTimestampTransform") return true;
  // Internal property used by firebase-admin v11+
  if (val._methodName === "FieldValue.serverTimestamp") return true;
  // firebase-admin v12+ uses methodName on the prototype
  if (typeof val.methodName === "string" && val.methodName.includes("serverTimestamp")) return true;
  // Check if it stringifies to something recognizable
  try {
    const s = JSON.stringify(val);
    if (s === "{}" && Object.getPrototypeOf(val) !== Object.prototype) return true;
  } catch { /* ignore */ }
  return false;
}

function nowTimestamp() {
  return { _seconds: Math.floor(Date.now() / 1000), _nanoseconds: 0 };
}

function resolveMockData(val: any): any {
  if (val === null || val === undefined) return val;
  if (isFieldValueSentinel(val)) return nowTimestamp();
  if (val instanceof Date) {
    return { _seconds: Math.floor(val.getTime() / 1000), _nanoseconds: (val.getTime() % 1000) * 1000000 };
  }
  if (typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(resolveMockData);
  const copy: any = {};
  for (const key of Object.keys(val)) {
    copy[key] = resolveMockData(val[key]);
  }
  return copy;
}

function inflateMockData(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val !== "object") return val;
  // Empty plain object → treat as missing timestamp
  if (Object.keys(val).length === 0 && val.constructor === Object) {
    return addToDate(nowTimestamp());
  }
  // Has _seconds → it's a serialised timestamp
  if (typeof val._seconds === "number") {
    return addToDate({ ...val });
  }
  if (Array.isArray(val)) return val.map(inflateMockData);
  const copy: any = {};
  for (const key of Object.keys(val)) {
    copy[key] = inflateMockData(val[key]);
  }
  return copy;
}

function addToDate(obj: any) {
  Object.defineProperty(obj, "toDate", {
    value() { return new Date(this._seconds * 1000); },
    enumerable: false, writable: true, configurable: true,
  });
  return obj;
}

// ---------------------------------------------------------------------------
// Mock Firestore implementation
// ---------------------------------------------------------------------------
function setupMockAdmin() {
  /**
   * Creates a chainable mock collection reference.
   * @param colName  – collection name (projects, users, milestones, …)
   * @param parentPath – slash-separated ancestor path, e.g. "projects/abc"
   */
  const getMockCollection = (colName: string, parentPath = ""): any => {
    const makeQuery = (filters: { field: string; value: any }[] = []): any => {
      const queryBuilder: any = {
        where: (field: string, _op: string, value: any) => makeQuery([...filters, { field, value }]),
        orderBy: () => queryBuilder,
        limit: () => queryBuilder,
        get: async () => {
          const currentDb = readDb();
          let docs: any[] = [];

          if (colName === "projects") {
            docs = Object.values(currentDb.projects || {})
              .filter((p: any) => filters.every(f => p[f.field] === f.value))
              .map((p: any) => makeMockDocSnapshot(p, "projects", p.id));
          } else if (colName === "agentMessages") {
            docs = Object.values(currentDb.agentMessages || {})
              .filter((m: any) => filters.every(f => m[f.field] === f.value))
              .map((m: any) => makeMockDocSnapshot(m, "agentMessages", m.id));
          } else {
            // Sub-collection query
            const projectId = extractProjectId(parentPath);
            if (colName === "milestones" && currentDb.milestones?.[projectId]) {
              docs = currentDb.milestones[projectId].map((m: any) =>
                makeMockDocSnapshot(m, "milestones", m.id, projectId));
            } else if (colName === "checkins" && currentDb.checkins?.[projectId]) {
              docs = currentDb.checkins[projectId].map((c: any) =>
                makeMockDocSnapshot(c, "checkins", c.id, projectId));
            } else if (colName === "conversations" && currentDb.conversations?.[projectId]) {
              docs = currentDb.conversations[projectId].map((c: any) =>
                makeMockDocSnapshot(c, "conversations", c.id, projectId));
            }
          }

          return { docs, empty: docs.length === 0, size: docs.length };
        },
      };
      return queryBuilder;
    };

    return {
      doc: (docId?: string) => {
        const id = docId || genId();
        const fullPath = parentPath ? `${parentPath}/${colName}/${id}` : `${colName}/${id}`;
        return makeMockDocRef(colName, id, fullPath, parentPath);
      },
      ...makeQuery(),
    };
  };

  /** Extracts the project ID from a parentPath like "projects/abc" */
  function extractProjectId(parentPath: string): string {
    const parts = parentPath.split("/");
    return parts[1] || "";
  }

  function genId(): string {
    return Math.random().toString(36).substring(2, 8);
  }

  // -----------------------------------------------------------------------
  // Mock Document Snapshot  (returned from queries and .get())
  // -----------------------------------------------------------------------
  function makeMockDocSnapshot(rawData: any, colName: string, id: string, projectId?: string): any {
    const fullPath = projectId
      ? `projects/${projectId}/${colName}/${id}`
      : `${colName}/${id}`;
    return {
      id,
      exists: true,
      data: () => inflateMockData(rawData),
      ref: makeMockDocRef(colName, id, fullPath,
        projectId ? `projects/${projectId}` : ""),
    };
  }

  // -----------------------------------------------------------------------
  // Mock Document Reference  (returned from collection().doc())
  // -----------------------------------------------------------------------
  function makeMockDocRef(colName: string, id: string, fullPath: string, parentPath: string): any {
    const projectId = extractProjectId(parentPath || fullPath);

    return {
      id,
      path: fullPath,
      get: async () => {
        const currentDb = readDb();
        let data: any = null;
        let exists = false;

        if (colName === "projects") {
          data = currentDb.projects?.[id] || null;
          exists = !!data;
        } else if (colName === "users") {
          data = currentDb.users?.[id] || null;
          exists = !!data;
        } else if (colName === "agentMessages") {
          data = currentDb.agentMessages?.[id] || null;
          exists = !!data;
        } else if (colName === "milestones") {
          data = currentDb.milestones?.[projectId]?.find((m: any) => m.id === id) || null;
          exists = !!data;
        } else if (colName === "analytics") {
          // Sub-sub-collection: users/<uid>/analytics/<docId>
          const userId = parentPath.split("/")[1] || "";
          data = currentDb.users?.[userId]?.analytics?.[id] || null;
          exists = !!data;
        }

        return {
          id,
          exists,
          data: () => inflateMockData(data),
          ref: makeMockDocRef(colName, id, fullPath, parentPath),
        };
      },

      set: async (data: any) => {
        const currentDb = readDb();
        const resolved = resolveMockData(data);
        if (colName === "projects") {
          currentDb.projects[id] = { ...resolved, id };
        } else if (colName === "users") {
          currentDb.users[id] = { ...resolved, uid: id };
        } else if (colName === "agentMessages") {
          if (!currentDb.agentMessages) currentDb.agentMessages = {};
          currentDb.agentMessages[id] = { ...resolved, id };
        } else if (colName === "analytics") {
          // Sub-sub-collection: users/<uid>/analytics/<docId>
          const userId = parentPath.split("/")[1] || "";
          if (!currentDb.users[userId]) currentDb.users[userId] = {};
          if (!currentDb.users[userId].analytics) currentDb.users[userId].analytics = {};
          currentDb.users[userId].analytics[id] = { ...resolved };
        } else {
          const pid = projectId || extractProjectId(parentPath);
          if (colName === "milestones") {
            if (!currentDb.milestones[pid]) currentDb.milestones[pid] = [];
            const idx = currentDb.milestones[pid].findIndex((m: any) => m.id === id);
            if (idx > -1) currentDb.milestones[pid][idx] = { ...resolved, id };
            else currentDb.milestones[pid].push({ ...resolved, id });
          } else if (colName === "checkins") {
            if (!currentDb.checkins[pid]) currentDb.checkins[pid] = [];
            currentDb.checkins[pid].push({ ...resolved, id });
          } else if (colName === "conversations") {
            if (!currentDb.conversations[pid]) currentDb.conversations[pid] = [];
            currentDb.conversations[pid].push({ ...resolved, id });
          }
        }
        writeDb(currentDb);
      },

      update: async (data: any) => {
        const currentDb = readDb();
        const resolved = resolveMockData(data);
        if (colName === "projects" && currentDb.projects[id]) {
          currentDb.projects[id] = { ...currentDb.projects[id], ...resolved };
        } else if (colName === "users") {
          if (!currentDb.users[id]) currentDb.users[id] = { uid: id };
          currentDb.users[id] = { ...currentDb.users[id], ...resolved };
        } else if (colName === "agentMessages") {
          if (!currentDb.agentMessages) currentDb.agentMessages = {};
          if (currentDb.agentMessages[id]) {
            currentDb.agentMessages[id] = { ...currentDb.agentMessages[id], ...resolved };
          }
        } else if (colName === "milestones") {
          const pid = projectId || extractProjectId(parentPath);
          if (currentDb.milestones?.[pid]) {
            currentDb.milestones[pid] = currentDb.milestones[pid].map((m: any) =>
              m.id === id ? { ...m, ...resolved } : m);
          }
        }
        writeDb(currentDb);
      },

      collection: (subCol: string) => getMockCollection(subCol, fullPath),
    };
  }

  // -----------------------------------------------------------------------
  // Wire up the db and auth objects
  // -----------------------------------------------------------------------
  db = {
    collection: (colName: string) => getMockCollection(colName),
    batch: () => {
      const operations: (() => Promise<void>)[] = [];
      return {
        set: (ref: any, data: any) => {
          operations.push(async () => ref.set(data));
        },
        update: (ref: any, data: any) => {
          operations.push(async () => ref.update(data));
        },
        commit: async () => {
          for (const op of operations) {
            await op();
          }
          console.log("[MockDB] Batch committed (" + operations.length + " ops).");
        },
      };
    },
  };

  auth = {
    verifyIdToken: async (_token: string) => ({
      uid: "mock-user-123",
      email: "boss@finishline.ai",
      name: "Developer Boss",
      picture: "https://api.dicebear.com/7.x/bottts/svg?seed=FinishLineBoss",
    }),
  };
}

export { db, auth };
