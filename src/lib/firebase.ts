import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: any;
let auth: any;
let db: any;
let googleProvider: any;

const isConfigured = 
  !!firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "your_firebase_api_key" &&
  !firebaseConfig.apiKey.startsWith("YOUR_");

if (isConfigured) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  } catch (error) {
    console.error("Firebase client initialization failed, falling back to mock:", error);
    setupMockFirebase();
  }
} else {
  console.warn("WARNING: Firebase credentials not set or contain template placeholders. Running in Mock Auth Mode.");
  setupMockFirebase();
}

function setupMockFirebase() {
  auth = {
    onAuthStateChanged: (callback: (user: any) => void) => {
      // Check if logged in in localStorage (dev testing)
      const mockLoggedIn = typeof window !== "undefined" && localStorage.getItem("mock_login") === "true";
      const mockUser = mockLoggedIn 
        ? {
            uid: "mock-user-123",
            email: "boss@finishline.ai",
            displayName: "Developer Boss",
            photoURL: "https://api.dicebear.com/7.x/bottts/svg?seed=FinishLineBoss",
            getIdToken: async () => "MOCK_TOKEN"
          }
        : null;

      // Simulate async network trigger
      setTimeout(() => callback(mockUser), 150);
      return () => {};
    },
    signInWithPopup: async () => {
      if (typeof window !== "undefined") {
        localStorage.setItem("mock_login", "true");
        window.location.reload();
      }
    },
    signOut: async () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem("mock_login");
        window.location.reload();
      }
    }
  };
  db = {};
  googleProvider = {
    setCustomParameters: () => {}
  };
}

export { app, auth, db, googleProvider, signInWithPopup, signOut };
