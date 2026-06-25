import { GoogleGenerativeAI, Schema, Type } from "@google/generative-ai";

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined. AI functionality will fail.");
  }
  return new GoogleGenerativeAI(apiKey || "MOCK_KEY");
};

// System Instruction Tone Guide
const SYSTEM_TONE_INSTRUCTION = 
  "You are an integral part of 'FinishLine — The Anti-Abandonment Agent'. " +
  "Your tone of voice is direct, motivational, honest, supportive, and no-BS Hinglish (Hindi + English). " +
  "Think of yourself as a close friend who calls out the user's excuses but genuinely wants them to succeed. " +
  "Use Hinglish naturally (e.g., use words like 'Boss', 'yaar', 'sach bata', 'kidhar hai', 'chalo start karo'). " +
  "Do not use insulting, toxic, or disrespectful language. Keep it engaging, direct, and action-oriented.";

/**
 * 1. INTAKE AGENT
 * Triggered when a project is created.
 * Generates 3-5 milestones and a kickoff message.
 */
export async function runIntakeAgent(title: string, description: string) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: 
      `${SYSTEM_TONE_INSTRUCTION}\n` +
      "You are the Intake Agent. Your job is to understand the scope of the project the user wants to start, " +
      "break it down into exactly 3 to 5 logical, high-impact milestones, and write a motivational Hinglish kickoff message.",
  });

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      milestones: {
        type: Type.ARRAY,
        description: "List of 3 to 5 logical milestones for the project, ordered chronologically.",
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A short, actionable title for the milestone (e.g. 'Setup Database Schema'). Max 40 chars."
            },
            order: {
              type: Type.INTEGER,
              description: "The sequence order of the milestone, starting at 1."
            }
          },
          required: ["title", "order"]
        }
      },
      kickoffMessage: {
        type: Type.STRING,
        description: "A direct, motivational kickoff message in Hinglish style encouraging them to start."
      }
    },
    required: ["milestones", "kickoffMessage"]
  };

  const prompt = `Project Title: ${title}\nProject Description: ${description}\n\nAnalyze this project and break it down into milestones and return the JSON.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.7,
      }
    });

    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error in Intake Agent:", error);
    // Fallback milestones if API fails or key is missing
    return {
      milestones: [
        { title: "Define Core Features & Architecture", order: 1 },
        { title: "Build Minimum Viable Product (MVP)", order: 2 },
        { title: "Test, Debug & Deploy Project", order: 3 }
      ],
      kickoffMessage: "Boss, key issue ki wajah se AI setup incomplete hai, but template milestones generate kar diye hain. Let's finish this!"
    };
  }
}

/**
 * 2. BLOCKER AGENT
 * Triggered when user clicks 'I'm Stuck'.
 * Suggests the smallest next action to reduce decision fatigue.
 */
export async function runBlockerAgent(
  projectTitle: string, 
  projectDescription: string,
  completedMilestones: string[],
  pendingMilestones: string[],
  stuckReason: string
) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: 
      `${SYSTEM_TONE_INSTRUCTION}\n` +
      "You are the Blocker Agent. The user is stuck on a project and experiencing decision paralysis or perfectionism. " +
      "Your job is to read the project context, look at completed and pending milestones, analyze why they are stuck, " +
      "and suggest the single smallest possible next step they can complete in less than 10 minutes. Keep it dead simple.",
  });

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      microAction: {
        type: Type.STRING,
        description: "The absolute smallest, concrete next step to take right now. Takes < 10 mins. e.g. 'Write just one line of code' or 'Create a folder'."
      },
      response: {
        type: Type.STRING,
        description: "A supportive, no-BS Hinglish message calling out perfectionism and pushing them to complete the micro-action."
      }
    },
    required: ["microAction", "response"]
  };

  const prompt = `
    Project: ${projectTitle}
    Description: ${projectDescription}
    Completed Milestones: ${completedMilestones.join(", ") || "None"}
    Next Pending Milestones: ${pendingMilestones.join(", ") || "None"}
    User's Stuck Reason: "${stuckReason}"
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.8,
      }
    });

    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error in Blocker Agent:", error);
    return {
      microAction: "Just open your project directory and create a blank scratch file.",
      response: "Arey yaar, lagta hai AI server thoda response nahi de raha, par tu ruk mat. Just start with the absolute smallest step. Open your editor and write one line. Bas!"
    };
  }
}

/**
 * 3. WATCHDOG AGENT
 * Triggered on inactivity check.
 * Generates context-aware nudge messages referencing historical inactivity.
 */
export async function runWatchdogAgent(
  projectTitle: string,
  projectDescription: string,
  daysInactive: number,
  previousWarnings: string[]
) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: 
      `${SYSTEM_TONE_INSTRUCTION}\n` +
      "You are the Watchdog Agent. A project has been inactive for over 48 hours. " +
      "Your job is to generate a direct, honest, and motivational Hinglish nudge. " +
      "Reference how many days they've been inactive. If they have previous warnings, refer to them " +
      "so you don't repeat yourself and call them out on their repetition. Keep it brief (2-3 sentences max).",
  });

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      nudge: {
        type: Type.STRING,
        description: "A direct, customized, no-BS Hinglish accountability warning. Max 3 sentences."
      }
    },
    required: ["nudge"]
  };

  const prompt = `
    Project: ${projectTitle}
    Description: ${projectDescription}
    Days of Inactivity: ${daysInactive} days
    Previous Nudges Sent: ${previousWarnings.length > 0 ? previousWarnings.map(w => `"${w}"`).join(", ") : "None"}
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.8,
      }
    });

    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error in Watchdog Agent:", error);
    return {
      nudge: `Boss, ${daysInactive} din ho gaye. Kahan gayab ho? FinishLine waiting. Kuch progress karo yaar!`
    };
  }
}

/**
 * 4. PATTERN AGENT
 * Triggered after 3+ completed or abandoned projects.
 * Detects recurring abandonment behavior and provides predictive insights.
 */
interface ProjectHistoryInput {
  id: string;
  title: string;
  category: string;
  status: "completed" | "abandoned" | "active";
  createdAtDaysAgo: number;
  durationDays: number;
  milestonesCount: number;
  completedMilestonesCount: number;
}

export async function runPatternAgent(projects: ProjectHistoryInput[]) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: 
      `${SYSTEM_TONE_INSTRUCTION}\n` +
      "You are the Pattern Agent. You are an expert behavioral analyst. " +
      "You analyze a user's project history to detect abandonment trends (e.g. average abandonment day, " +
      "most productive days, distractive impact of starting new projects, deadline adherence, common blockers). " +
      "Your output must be structured, with insights written in direct, motivational Hinglish calling out their behavior patterns.",
  });

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      averageAbandonmentDay: {
        type: Type.NUMBER,
        description: "The estimated average day (from creation) when projects tend to go cold / get abandoned."
      },
      commonBlockers: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3-4 main blockers inferred from their history (e.g., 'Perfectionism at Day 3', 'Starting too many things')."
      },
      predictedAbandonmentWarnings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            projectId: { type: Type.STRING },
            projectTitle: { type: Type.STRING },
            riskLevel: { type: Type.STRING, description: "low, medium, high" },
            warningReason: { type: Type.STRING, description: "Predictive warning in Hinglish pointing out why they are at risk of abandoning this project." }
          },
          required: ["projectId", "projectTitle", "riskLevel", "warningReason"]
        },
        description: "Risk predictions for currently active projects based on history."
      },
      historicalInsights: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "3-4 brutally honest, insightful Hinglish statements about their habits (e.g., 'Aap naya project start karte hi purana bhul jaate ho')."
      },
      mostProductiveDays: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of days where checkins or milestones are completed most frequently (e.g. ['Monday', 'Saturday'])."
      }
    },
    required: ["averageAbandonmentDay", "commonBlockers", "predictedAbandonmentWarnings", "historicalInsights", "mostProductiveDays"]
  };

  const prompt = `
    Analyze this project history to find behavioral patterns:
    ${JSON.stringify(projects, null, 2)}
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.6,
      }
    });

    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error in Pattern Agent:", error);
    // Generic fallback insights
    return {
      averageAbandonmentDay: 4,
      commonBlockers: ["Starting new projects", "Lack of clear micro-actions"],
      predictedAbandonmentWarnings: [],
      historicalInsights: [
        "Boss, record dikhata hai ki milestone 2 ke baad interest thanda hone lagta hai.",
        "Naye projects ki excitement me purane wale ko drop karna aapka pattern hai. Is baar mat hone dena!"
      ],
      mostProductiveDays: ["Monday", "Wednesday"]
    };
  }
}
