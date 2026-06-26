import { GoogleGenerativeAI } from "@google/generative-ai";

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
export async function runIntakeAgent(title: string, description: string, deadline: string | null = null) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: 
      `${SYSTEM_TONE_INSTRUCTION}\n` +
      "You are the Intake Agent for FinishLine, an anti-abandonment system.\n" +
      "When a user gives you a project title, description, and deadline:\n" +
      "1. Break it into exactly 3-5 concrete, actionable milestones\n" +
      "2. Estimate days per milestone\n" +
      "3. Identify the #1 abandonment risk for this project type\n" +
      "4. Give a blunt one-line warning\n\n" +
      "Be specific. Not \"Set up project\" — say \"Install deps and run hello world\".\n" +
      "Tone: direct, Hinglish okay, no fluff.",
  });

  const schema = {
    type: "object",
    properties: {
      milestones: {
        type: "array",
        description: "List of exactly 3 to 5 concrete, actionable milestones for the project, ordered chronologically.",
        items: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "A short, actionable title for the milestone (e.g. 'Install deps and run hello world'). Max 40 chars."
            },
            days: {
              type: "integer",
              description: "Estimated days to complete this milestone."
            },
            order: {
              type: "integer",
              description: "The sequence order of the milestone, starting at 1."
            }
          },
          required: ["title", "days", "order"]
        }
      },
      abandonment_risk: {
        type: "string",
        description: "The #1 abandonment risk for this project type."
      },
      kickoff_message: {
        type: "string",
        description: "A direct, motivational kickoff message in Hinglish style encouraging them to start."
      },
      warning: {
        type: "string",
        description: "A blunt one-line warning."
      }
    },
    required: ["milestones", "abandonment_risk", "kickoff_message", "warning"]
  };

  const prompt = `Project Title: ${title}\nProject Description: ${description}\nProject Deadline: ${deadline || "Not specified"}\n\nAnalyze this project and break it down into milestones and return the JSON.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema as any,
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
        { title: "Define Core Features & Architecture", days: 2, order: 1 },
        { title: "Build Minimum Viable Product (MVP)", days: 5, order: 2 },
        { title: "Test, Debug & Deploy Project", days: 3, order: 3 }
      ],
      abandonment_risk: "Losing momentum after the initial coding setup excitement fades.",
      kickoff_message: "Boss, key issue ki wajah se AI setup incomplete hai, but template milestones generate kar diye hain. Let's finish this!",
      warning: "Initial excitement covers up the lack of discipline. Keep showing up daily!"
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
  currentMilestone: string,
  stuckReason: string,
  techStack: string,
  completedMilestones: string[]
) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: 
      `${SYSTEM_TONE_INSTRUCTION}\n` +
      "You are the Blocker Agent for FinishLine.\n" +
      "You receive the following inputs about a stuck project:\n" +
      "- project_name\n" +
      "- current_milestone\n" +
      "- stuck_reason (may be vague)\n" +
      "- tech_stack\n" +
      "- completed_milestones list\n\n" +
      "Analyze the blocker and write a 3-4 line response (nudge/response text) that:\n" +
      "1. Acknowledges the block in exactly ONE sentence\n" +
      "2. Gives exactly ONE next action under 20 minutes (microAction)\n" +
      "3. If technical: give specific hint or code snippet\n" +
      "4. If overwhelmed: reframe into something tiny\n\n" +
      "Tone: calm, practical, senior dev helping junior. Hinglish okay. No pep talks. Just the next step.",
  });

  const schema = {
    type: "object",
    properties: {
      microAction: {
        type: "string",
        description: "Exactly one next action under 20 minutes. Keep it small, tiny, and concrete."
      },
      response: {
        type: "string",
        description: "The 3-4 lines max response. Acknowledge block in one sentence, give the next action, and include a specific technical hint/code snippet or reframe if overwhelmed. Calm tone."
      }
    },
    required: ["microAction", "response"]
  };

  const prompt = `
    project_name: ${projectTitle}
    current_milestone: ${currentMilestone || "None"}
    stuck_reason: ${stuckReason}
    tech_stack: ${techStack || "General"}
    completed_milestones: ${completedMilestones.join(", ") || "None"}
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema as any,
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
  daysInactive: number,
  lastMilestone: string,
  abandonmentPattern: string,
  previousWarnings: string[]
) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: 
      `${SYSTEM_TONE_INSTRUCTION}\n` +
      "You are the Watchdog Agent for FinishLine.\n" +
      "You receive details of an inactive project:\n" +
      "- project_name\n" +
      "- days_silent: days since last update\n" +
      "- last_milestone: last completed milestone\n" +
      "- abandonment_pattern: historical pattern (if available)\n" +
      "- previous_messages: last 3 watchdog messages sent (avoid repetition)\n\n" +
      "Write a 2-3 line callout message that:\n" +
      "1. Calls out silence directly — mention exact days\n" +
      "2. References last known milestone\n" +
      "3. Uses abandonment_pattern if available\n" +
      "4. Ends with ONE specific question\n\n" +
      "Tone: brutally honest friend. Hinglish. No corporate language.\n" +
      "Never repeat a previous message. Always fresh angle.\n" +
      "Respond ONLY in the JSON schema provided.",
  });

  const schema = {
    type: "object",
    properties: {
      nudge: {
        type: "string",
        description: "The 2-3 line callout message."
      }
    },
    required: ["nudge"]
  };

  const prompt = `
    project_name: ${projectTitle}
    days_silent: ${daysInactive}
    last_milestone: ${lastMilestone || "None"}
    abandonment_pattern: ${abandonmentPattern || "None"}
    previous_messages: ${previousWarnings.length > 0 ? previousWarnings.map(w => `"${w}"`).join(", ") : "None"}
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema as any,
        temperature: 0.8,
      }
    });

    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error in Watchdog Agent:", error);
    return {
      nudge: `Boss, ${daysInactive} din ho gaye silent rehkar. Aakhri milestone "${lastMilestone}" par hi atke hue ho. Kya aaj ek chota sa step shuru kar sakte ho?`
    };
  }
}

/**
 * 4. PATTERN AGENT
 * Triggered after 3+ completed or abandoned projects.
 * Detects recurring abandonment behavior and provides predictive insights.
 */
interface ProjectHistoryInput {
  project_name: string;
  start_date: string;
  last_active_date: string;
  completed: boolean;
  milestones_done: number;
  total_milestones: number;
}

export async function runPatternAgent(projects: ProjectHistoryInput[]) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    systemInstruction: 
      `${SYSTEM_TONE_INSTRUCTION}\n` +
      "You are the Pattern Agent for FinishLine.\n" +
      "You receive a list of past projects with:\n" +
      "- project_name, start_date, last_active_date\n" +
      "- completed: true/false\n" +
      "- milestones_done, total_milestones\n\n" +
      "Analyze the list to find behavioral patterns and respond ONLY in the JSON schema provided.\n" +
      "Be ruthlessly specific. Generic advice is useless.\n" +
      "Tone: direct, Hinglish okay, no fluff.",
  });

  const schema = {
    type: "object",
    properties: {
      pattern_summary: {
        type: "string",
        description: "Brutally honest Hinglish summary of user patterns (e.g. 'You typically abandon on day 4-5, right after setup')."
      },
      trigger: {
        type: "string",
        description: "The primary behavioral trigger identified (e.g. 'You started 3 new projects in 2 weeks. Danger zone')."
      },
      risk_level: {
        type: "string",
        enum: ["high", "medium", "low"],
        description: "Estimated abandonment risk level for active projects."
      },
      abandonment_day_avg: {
        type: "integer",
        description: "The average number of days before abandonment."
      },
      finish_rate: {
        type: "string",
        description: "Fraction format string representing completed projects out of total (e.g. '2 out of 5')."
      },
      advice: {
        type: "string",
        description: "Single most important, ruthlessly specific actionable advice to do RIGHT NOW."
      },
      predicted_next_abandonment: {
        type: "string",
        description: "Predictive alert for next risk (e.g. 'Project X is at risk in 2 days')."
      }
    },
    required: ["pattern_summary", "trigger", "risk_level", "abandonment_day_avg", "finish_rate", "advice", "predicted_next_abandonment"]
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
        responseSchema: schema as any,
        temperature: 0.6,
      }
    });

    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error in Pattern Agent:", error);
    // Generic fallback insights following the correct schema
    return {
      pattern_summary: "Aap milestone 2 cross karte hi momentum lose karte ho.",
      trigger: "Multiple concurrent active projects start karna is the main trigger.",
      risk_level: "high",
      abandonment_day_avg: 4,
      finish_rate: "1 out of 3",
      advice: "Shut down all other tabs and write just one component test for your current project right now.",
      predicted_next_abandonment: "Active project is at risk in 2 days"
    };
  }
}

/**
 * 5. STREAK AGENT
 * Generates a dashboard streak and finish rate summary.
 */
export async function runStreakAgent(
  totalProjectsStarted: number,
  totalProjectsCompleted: number,
  currentStreak: number,
  bestStreak: number,
  projectsInProgress: string[]
) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: 
      `${SYSTEM_TONE_INSTRUCTION}\n` +
      "You are the Streak Agent for FinishLine.\n" +
      "You receive the following stats about a user's projects:\n" +
      "- total_projects_started\n" +
      "- total_projects_completed\n" +
      "- current_streak: consecutive check-in days\n" +
      "- best_streak\n" +
      "- projects_in_progress: list of active project names\n\n" +
      "Generate a 3-4 line dashboard summary that:\n" +
      "1. States finish rate honestly\n" +
      "2. Acknowledges current streak\n" +
      "3. Calls out parallel projects count\n" +
      "4. Ends with one sharp observation\n\n" +
      "Tone: honest, slightly roasting but not mean. Coach reviewing stats. Hinglish welcome. Respond ONLY in the JSON schema provided.",
  });

  const schema = {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "The 3-4 line dashboard summary text."
      }
    },
    required: ["summary"]
  };

  const prompt = `
    total_projects_started: ${totalProjectsStarted}
    total_projects_completed: ${totalProjectsCompleted}
    current_streak: ${currentStreak}
    best_streak: ${bestStreak}
    projects_in_progress: ${JSON.stringify(projectsInProgress)}
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema as any,
        temperature: 0.8,
      }
    });

    const text = result.response.text();
    return JSON.parse(text);
  } catch (error) {
    console.error("Error in Streak Agent:", error);
    const finishRate = totalProjectsStarted > 0 ? Math.round((totalProjectsCompleted / totalProjectsStarted) * 100) : 0;
    return {
      summary: `Aapka finish rate ${finishRate}% hai, aur aap abhi ${currentStreak} days streak par ho. Parallel mein ${projectsInProgress.length} projects chal rahe hain. Zyada haath mat failao, pehle wale khatam karo!`
    };
  }
}
