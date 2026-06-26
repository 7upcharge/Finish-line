# FinishLine — The Anti-Abandonment Agent

**FinishLine** is a production-ready, multi-agent AI accountability SaaS platform built to ensure you actually finish the projects you start. By analyzing your behavior and intervening with direct, no-BS Hinglish coaching, FinishLine breaks decision paralysis and keeps you on target.

Inspired by the design aesthetics of Linear, Notion, and Vercel.

---

## Architecture Diagram

```
                                +-------------------+
                                |  Cloud Scheduler  |
                                +---------+---------+
                                          |
                                          | Trigger (every 6 hours)
                                          v
                                +---------+---------+
                                |  Cloud Function   |
                                +---------+---------+
                                          |
                                          | Secure POST /api/watchdog
                                          v
+-------------------+           +---------+---------+
|                   |  HTTPS    |                   |
|  Next.js Client   +---------->+  Next.js Server   |
|  (Dashboard & UI) |  Requests |  (API Routes)     |
|                   |           |                   |
+-------------------+           +----+---------+----+
                                     |         |
                     Firestore reads |         | Gemini API requests
                           & writes  |         |
                                     v         v
                         +-----------+---+ +---+-----------+
                         |               | |               |
                         |   Firestore   | |  Gemini AI    |
                         |   Database    | |  (Agents)     |
                         |               | |               |
                         +---------------+ +---------------+
```

---

## Core Features & AI Agents

FinishLine utilizes Google Gemini API models (`gemini-2.5-flash` and `gemini-2.5-pro`) to power 5 specialized accountability agents:

1. **Intake Agent**: Automatically triggered on project creation. Analyzes the project scope, splits it into `3-5` actionable milestones, identifies the #1 abandonment risk for this project type, and sets up a Hinglish kickoff conversation.
2. **Watchdog Agent**: Tracks inactivity. If a project has no updates for `48+ hours`, it generates a direct accountability nudge (e.g., *“Boss, teen din ho gaye. Progress kidhar hai?”*) referencing your previous history and abandonment patterns. Runs automatically in the background.
3. **Blocker Agent**: Triggered when you click **"I'm Stuck"**. Analyzes completed/pending milestones and the roadblock description, offering the **single smallest next action** taking less than 10 minutes to resolve perfectionism.
4. **Streak Agent**: Dynamically tracks your activity. Rewards you for daily progress, updates streaks, and generates coaching reviews on dashboard load.
5. **Pattern Agent**: Activated after `3+` completed or abandoned projects. Conducts behavioral pattern audits, tracks your average abandonment day, maps blockers, and issues proactive risk warnings.

---

## Setup & Installation

### 1. Local Setup Steps
1. **Clone the repository**:
   ```bash
   git clone <your-repository-url>
   cd capstoneproject
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Configure environment variables**:
   Create a `.env.local` file in the root directory based on the `.env.example` template:
   ```bash
   cp .env.example .env.local
   ```
   Fill in the required key-value pairs (see details below).
4. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to view the application.

---

### 2. Firebase Setup Steps
1. **Create a Firebase Project**:
   Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. **Enable Firebase Authentication**:
   - Navigate to Authentication > Sign-in method.
   - Enable **Google** sign-in provider.
3. **Enable Firestore Database**:
   - Create a Cloud Firestore database in production mode.
   - Deploy the rules defined in `firestore.rules`.
4. **Obtain Client Configuration Keys**:
   - Register a Web App in your Firebase project.
   - Copy the client configuration properties into your `.env.local` fields:
     - `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
     - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     - `NEXT_PUBLIC_FIREBASE_APP_ID`
5. **Generate Admin Service Account Keys**:
   - Go to Project Settings > Service accounts.
   - Click **Generate new private key** and download the JSON.
   - Extract `client_email` and `private_key` from the JSON to fill `FIREBASE_ADMIN_CLIENT_EMAIL` and `FIREBASE_ADMIN_PRIVATE_KEY` (ensure you handle newlines `\n` in the private key properly).

---

### 3. Gemini API Setup
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Click **Get API Key** and generate a new key.
3. Add this key to the `GEMINI_API_KEY` field in your `.env.local` file.

---

### 4. Cloud Run Deployment Steps

FinishLine is designed to deploy automatically using **Google Cloud Build** and **Secret Manager**.

#### Step 1: Enable Google Cloud APIs
Enable the required APIs in your Google Cloud Console project:
```bash
gcloud services enable run.googleapis.com \
                       cloudbuild.googleapis.com \
                       secretmanager.googleapis.com \
                       containerregistry.googleapis.com
```

#### Step 2: Configure Secret Manager
Create secrets in Secret Manager for each of the variables listed in `.env.example`:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `GEMINI_API_KEY`
- `FIREBASE_ADMIN_PRIVATE_KEY`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `NEXT_PUBLIC_APP_URL` (URL of your Cloud Run service once deployed)
- `CRON_SECRET` (A random secure token to authenticate background scheduler calls)

Give the Cloud Build Service Account permission to read these secrets:
```bash
# Grant Secret Manager Secret Accessor role to the default Cloud Build service account
gcloud secrets add-iam-policy-binding <SECRET_NAME> \
    --member="serviceAccount:<PROJECT_NUMBER>@cloudbuild.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

#### Step 3: Trigger Cloud Build
Deploy to Cloud Run by running the build pipeline:
```bash
gcloud builds submit --config=cloudbuild.yaml
```

#### Step 4: Schedule Watchdog Background Job (6 Hours)
1. Deploy the Firebase Cloud Function inside the `/functions` folder to your Firebase project.
2. In the Google Cloud Console, configure **Cloud Scheduler** to trigger the Cloud Function every 6 hours. Alternatively, point Cloud Scheduler directly to make a `POST` request to `https://<YOUR_APP_URL>/api/watchdog` with the header `Authorization: Bearer <CRON_SECRET>`.

---

## Screenshots

*(Place screenshots demonstrating the user dashboard, watchdog warning alert, and blocker micro-actions here)*

- **Dashboard Feed**: `[Add screenshot: Dashboard view showing streak counter & active projects]`
- **Watchdog Warning Alert**: `[Add screenshot: Project Card showing Hinglish watchdog callouts and the unread notification badge]`
- **Blocker Agent helper**: `[Add screenshot: Blocker Agent popup showing the 10-minute micro-action hint]`
