import * as admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      // Handle escaped newlines in service account key
      const formattedKey = serviceAccountKey.replace(/\\n/g, '\n');
      const serviceAccount = JSON.parse(formattedKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("Firebase Admin SDK initialized successfully using Service Account Key.");
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON. Initializing with default app credentials.", e);
      admin.initializeApp();
    }
  } else {
    // On Cloud Run or local gcloud authenticated environment, this falls back to Application Default Credentials
    try {
      admin.initializeApp();
      console.log("Firebase Admin SDK initialized using Application Default Credentials.");
    } catch (error) {
      console.error("Failed to initialize Firebase Admin SDK. Ensure credentials are set.", error);
    }
  }
}

const db = admin.firestore();
const auth = admin.auth();

export { db, auth };
export default admin;
