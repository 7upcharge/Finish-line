import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";

let db: any;
let auth: any;

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

// Local File Database config (survives dev server restarts)
const DB_FILE = path.join(process.cwd(), "mock-db.json");

function readDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read mock db file:", error);
  }
  return {
    projects: {},
    milestones: {},
    checkins: {},
    conversations: {},
    users: {},
    agentMessages: {},
  };
}

function writeDb(data: any) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write mock db file:", error);
  }
}

function resolveMockData(val: any): any {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val === "object") {
    // Check if it is a FieldValue object
    if (val.constructor && (val.constructor.name === "FieldValue" || val.constructor.name === "FirestoreFieldValue")) {
      return {
        _seconds: Math.floor(Date.now() / 1000),
        _nanoseconds: 0
      };
    }
    // Check if it has the internal field name
    if (val._methodName === "FieldValue.serverTimestamp") {
      return {
        _seconds: Math.floor(Date.now() / 1000),
        _nanoseconds: 0
      };
    }
    // If it's a date object
    if (val instanceof Date) {
      return {
        _seconds: Math.floor(val.getTime() / 1000),
        _nanoseconds: (val.getTime() % 1000) * 1000000
      };
    }
    // If it's an array
    if (Array.isArray(val)) {
      return val.map(resolveMockData);
    }
    // Otherwise it's a plain object
    const copy: any = {};
    for (const key of Object.keys(val)) {
      copy[key] = resolveMockData(val[key]);
    }
    return copy;
  }
  return val;
}

function inflateMockData(val: any): any {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val === "object") {
    // Check if it's an empty object (likely from a previously serialized FieldValue.serverTimestamp())
    if (Object.keys(val).length === 0 && val.constructor === Object) {
      const timestampObj = { _seconds: Math.floor(Date.now() / 1000), _nanoseconds: 0 };
      Object.defineProperty(timestampObj, "toDate", {
        value: function() {
          return new Date(this._seconds * 1000);
        },
        enumerable: false,
        writable: true,
        configurable: true
      });
      return timestampObj;
    }

    // Check if it has _seconds, meaning it's a serialized Timestamp!
    if (typeof val._seconds === "number") {
      const timestampObj = { ...val };
      Object.defineProperty(timestampObj, "toDate", {
        value: function() {
          return new Date(this._seconds * 1000);
        },
        enumerable: false,
        writable: true,
        configurable: true
      });
      return timestampObj;
    }
    
    if (Array.isArray(val)) {
      return val.map(inflateMockData);
    }
    
    const copy: any = {};
    for (const key of Object.keys(val)) {
      copy[key] = inflateMockData(val[key]);
    }
    return copy;
  }
  return val;
}

function setupMockAdmin() {
  const getMockCollection = (colName: string, parentPath = ""): any => {
    // Generate a chainable mock query builder that loads from mock-db.json and supports multiple where filters recursively
    const makeQuery = (filters: { field: string; value: any }[] = []): any => {
      const queryBuilder = {
        where: (field: string, op: string, value: any) => {
          return makeQuery([...filters, { field, value }]);
        },
        orderBy: () => queryBuilder,
        limit: () => queryBuilder,
        get: async () => {
          const currentDb = readDb();
          let docs: any[] = [];
          
          if (colName === "projects") {
            docs = Object.values(currentDb.projects || {})
              .filter((p: any) => {
                // Ensure document matches every applied filter
                return filters.every(f => p[f.field] === f.value);
              })
              .map((p: any) => ({
                id: p.id,
                data: () => inflateMockData(p),
                ref: {
                  collection: (subCol: string) => getMockCollection(subCol, `projects/${p.id}`),
                }
              }));
          } else if (colName === "agentMessages") {
            docs = Object.values(currentDb.agentMessages || {})
              .filter((m: any) => {
                return filters.every(f => m[f.field] === f.value);
              })
              .map((m: any) => ({
                id: m.id,
                data: () => inflateMockData(m),
                ref: {
                  id: m.id,
                  update: async (d: any) => {
                    const dbData = readDb();
                    if (!dbData.agentMessages) dbData.agentMessages = {};
                    if (dbData.agentMessages[m.id]) {
                      dbData.agentMessages[m.id] = { ...dbData.agentMessages[m.id], ...resolveMockData(d) };
                      writeDb(dbData);
                    }
                  }
                }
              }));
          } else {
            const parts = parentPath.split("/");
            const projectId = parts[1];
            if (colName === "milestones" && currentDb.milestones[projectId]) {
              docs = currentDb.milestones[projectId].map((m: any) => ({
                id: m.id,
                data: () => inflateMockData(m),
                ref: {
                  update: async (d: any) => {
                    const dbData = readDb();
                    const resolvedUpdate = resolveMockData(d);
                    if (dbData.milestones[projectId]) {
                      dbData.milestones[projectId] = dbData.milestones[projectId].map((x: any) => 
                        x.id === m.id ? { ...x, ...resolvedUpdate } : x
                      );
                      writeDb(dbData);
                    }
                  }
                }
              }));
            } else if (colName === "checkins" && currentDb.checkins[projectId]) {
              docs = currentDb.checkins[projectId].map((c: any) => ({ id: c.id, data: () => inflateMockData(c) }));
            } else if (colName === "conversations" && currentDb.conversations[projectId]) {
              docs = currentDb.conversations[projectId].map((c: any) => ({ id: c.id, data: () => inflateMockData(c) }));
            }
          }
          
          return {
            docs,
            empty: docs.length === 0,
          };
        }
      };
      return queryBuilder;
    };

    return {
      doc: (docId?: string) => {
        const id = docId || Math.random().toString(36).substring(7);
        const fullPath = parentPath ? `${parentPath}/${colName}/${id}` : `${colName}/${id}`;
        
        return {
          id,
          get: async () => {
            const currentDb = readDb();
            let data = null;
            let exists = false;
            
            if (colName === "projects") {
              data = currentDb.projects[id] || null;
              exists = !!data;
            } else if (colName === "users") {
              data = currentDb.users[id] || null;
              exists = !!data;
            } else if (colName === "agentMessages") {
              data = (currentDb.agentMessages && currentDb.agentMessages[id]) || null;
              exists = !!data;
            } else {
              const parts = parentPath.split("/");
              const projectId = parts[1];
              if (colName === "milestones" && currentDb.milestones[projectId]) {
                data = currentDb.milestones[projectId].find((m: any) => m.id === id) || null;
                exists = !!data;
              }
            }
            
            return {
              id,
              exists,
              data: () => inflateMockData(data),
              ref: {
                collection: (subCol: string) => getMockCollection(subCol, fullPath),
              }
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
            } else {
              const parts = parentPath.split("/");
              const projectId = parts[1];
              if (colName === "milestones") {
                if (!currentDb.milestones[projectId]) currentDb.milestones[projectId] = [];
                const idx = currentDb.milestones[projectId].findIndex((m: any) => m.id === id);
                if (idx > -1) currentDb.milestones[projectId][idx] = { ...resolved, id };
                else currentDb.milestones[projectId].push({ ...resolved, id });
              } else if (colName === "checkins") {
                if (!currentDb.checkins[projectId]) currentDb.checkins[projectId] = [];
                currentDb.checkins[projectId].push({ ...resolved, id });
              } else if (colName === "conversations") {
                if (!currentDb.conversations[projectId]) currentDb.conversations[projectId] = [];
                currentDb.conversations[projectId].push({ ...resolved, id });
              }
            }
            writeDb(currentDb);
            return {};
          },
          update: async (data: any) => {
            const currentDb = readDb();
            const resolved = resolveMockData(data);
            if (colName === "projects" && currentDb.projects[id]) {
              currentDb.projects[id] = { ...currentDb.projects[id], ...resolved };
            } else if (colName === "users" && currentDb.users[id]) {
              currentDb.users[id] = { ...currentDb.users[id], ...resolved };
            } else if (colName === "agentMessages") {
              if (!currentDb.agentMessages) currentDb.agentMessages = {};
              if (currentDb.agentMessages[id]) {
                currentDb.agentMessages[id] = { ...currentDb.agentMessages[id], ...resolved };
              }
            } else if (colName === "milestones") {
              const parts = parentPath.split("/");
              const projectId = parts[1];
              if (currentDb.milestones[projectId]) {
                currentDb.milestones[projectId] = currentDb.milestones[projectId].map((m: any) => 
                  m.id === id ? { ...m, ...resolved } : m
                );
              }
            }
            writeDb(currentDb);
            return {};
          },
          collection: (subCol: string) => getMockCollection(subCol, fullPath),
        };
      },
      ...makeQuery()
    };
  };

  db = {
    collection: (colName: string) => getMockCollection(colName),
    batch: () => {
      const operations: (() => void)[] = [];
      return {
        set: (ref: any, data: any) => {
          operations.push(() => ref.set(data));
        },
        update: (ref: any, data: any) => {
          operations.push(() => ref.update(data));
        },
        commit: async () => {
          operations.forEach(op => op());
          console.log("[MockDB] Batch transaction committed successfully.");
        }
      };
    }
  };

  auth = {
    verifyIdToken: async (token: string) => {
      return {
        uid: "mock-user-123",
        email: "boss@finishline.ai",
        name: "Developer Boss",
        picture: "https://api.dicebear.com/7.x/bottts/svg?seed=FinishLineBoss",
      };
    }
  };
}

export { db, auth };
