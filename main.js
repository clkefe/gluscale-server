import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

import express from "express";
import bodyParser from "body-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CronJob } from "cron";

import { startJob } from "./cronJob.js";

new CronJob(
  "0 20 * * *",
  async () => {
    await startJob();
  },
  null,
  true,
  "America/Los_Angeles"
);

// Gemini init
const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
const PROMPT = `You are an assistant who is tasked to help children with diabetes. Your main task is to give children live feedback on their glucose levels using the information you know about them in a short message. Your message should consist of around 2 short sentences. Your answer should be kid-friendly, almost (but not exactly) entertaining them while they adapt to their new lifestyle. Give them basic information such as telling them their glucose level is decreasing, and they should do a certain task (eating, exercising, etc..) The message should be brief, and its first sentence should directly respond to their glucose level. Lastly, don't forget that you are talking to a child. So your message should be simple and easy to understand; don't use too many medical terms.

As a reminder, the suggested glucose levels for children are 80-150 mg/dL.

Child's data:
“””
Current glucose Level: <glucose_level> (mg/dL),
How long ago they diagnosed diabetes: <time_diagnosis>
Medication that they are on (for diabetes): <medication>,
Age: <age>
“””

Your feedback (AI):`;

// Supabase credentials
const PROJECT_URL = process.env.PROJECT_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(PROJECT_URL, ANON_KEY);

const app = express();

app.use(bodyParser.json());
app.listen(process.env.PORT || 3000, () =>
  console.log(`🚀 Server running on port ${process.env.PORT || 3000}`)
);

app.get("/", async (req, res) => {
  res.json({ message: "Hello World!" });
});

// This is the endpoint that the Vital webhook will send data to
app.post("/", async (req, res) => {
  const { body } = req;

  // This is an array of glucose data that is sent from the Vital webhook
  const glucose_data = body.data.data;

  const vita_uid = body.data.user_id;
  const uid = await getUidByVitaUid(vita_uid);

  console.log("UID:", uid);

  for (let i = 0; i < glucose_data.length; i++) {
    const glucoseLevelInMmol = glucose_data[i].value;
    const glucoseLevelInMgdl = converteMmolToMgdl(glucoseLevelInMmol);

    const { error } = await supabase.from("glucose_level").insert([
      {
        value: glucoseLevelInMgdl,
        user_id: uid,
      },
    ]);

    if (error) {
      console.error("ERROR: ", error);
      res.status(500).end();
      return;
    }
  }

  await getAIFeedback(uid);

  res.status(200).end();
});

function converteMmolToMgdl(mmol) {
  return mmol * 18.0182;
}

async function getUidByVitaUid(vita_uid) {
  const { data, error } = await supabase
    .from("wearable_connection")
    .select()
    .eq("vital_uid", vita_uid);

  if (error) {
    console.log(error);
    return;
  }

  //TODO: Testing; remove this
  return data[0]?.user_id || "e7b91d14-44c7-4ff6-9403-cbc2b044e9a2";
}

async function getAIFeedback(userId) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });
  const supabase = createClient(PROJECT_URL, ANON_KEY);

  // Get user's latest glucose level
  const { data, error } = await supabase
    .from("glucose_level")
    .select("value")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  // Get user's survey data
  const { data: survey_data, error: survey_error } = await supabase
    .from("survey_data")
    .select()
    .eq("user_id", userId);

  const glucoseLevel = data[0].value;
  const survey = survey_data[0];

  // Generate the prompt
  var newPrompt = PROMPT;
  newPrompt = newPrompt.replace("<glucose_level>", glucoseLevel);
  newPrompt = newPrompt.replace("<time_diagnosis>", survey?.time_diagnosis);
  newPrompt = newPrompt.replace("<medication>", survey?.medication);
  newPrompt = newPrompt.replace("<age>", survey?.age);

  console.log("Prompt:", newPrompt);

  const { response } = await model.generateContent(newPrompt);
  const text = response.text();

  console.log("AI:", text);

  await supabase
    .from("gemini_feedback")
    .insert([{ advice: text, user_id: userId }]);
}
