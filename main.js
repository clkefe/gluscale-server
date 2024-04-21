import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

import express from "express";
import bodyParser from "body-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Supabase credentials
const PROJECT_URL = process.env.PROJECT_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

const app = express();
const PORT = 8080;

app.use(bodyParser.json());
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// This is the endpoint that the Vital webhook will send data to
app.post("/", async (req, res) => {
  const { body } = req;

  // This is an array of glucose data that is sent from the Vital webhook
  const glucose_data = body.data.data;

  const vital_uid = body.data.user_id;
  console.log("Vital UID:", vital_uid);

  const supabase = createClient(PROJECT_URL, ANON_KEY);

  for (let i = 0; i < glucose_data.length; i++) {
    const glucoseLevelInMmol = glucose_data[i].value;
    const glucoseLevelInMgdl = converteMmolToMgdl(glucoseLevelInMmol);

    console.log(glucoseLevelInMgdl, "mg/dl");

    const { error } = await supabase
      .from("glucose_level")
      .insert([{ value: glucoseLevelInMgdl }]);

    if (error) {
      console.error("ERROR: ", error);
      res.status(500).end();
      return;
    }
  }

  res.status(200).end();
});

function converteMmolToMgdl(mmol) {
  return mmol * 18.0182;
}

/////////GEMINI//////////////////////////////////////////////////////////////////////////////////

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);
var message ="You are now a virtual companion for a CHILDREN\'S APP that is focused on DIABETES, BLOOD SUGAR/GLUCOSE, and INSULIN. PLEASE BE AS KID FRIENDLY AS POSSIBLE NO MATTER WHAT THE USER SAYS AND USE SIMPLE TERMS AND WORDS THAT A KID WOULD UNDERSTAND. THIS IS A VERY IMPORTANT RULE You will be sent real-time data on a child\'s blood sugar level, which is {GLUCOSE} currently at a periodic interval and other information such as the type of diabetes they have, how long they have known they had diabetes, medication, and age. From this information, you will provide advice to the child user on what to do with that information as someone who is NEW TO HAVING DIABETES and IS A CHILD."

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-pro"});
  const supabase = createClient(PROJECT_URL, ANON_KEY);

  const { data, error } = await supabase
    .from("glucose_level")
    .select("value");

  const { data: survey_data, error: survey_error } = await supabase
    .from("survey_data")
    .select();

  const new_message = message.replace(/{GLUCOSE}/g, data[0].value);
  const prompt = new_message;
  console.log(prompt);

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  const { data: gemini_data, error: gemini_error } = await supabase
    .from("gemini_feedback")
    .insert([{advice: text}])

  console.log(text);
}
run();

////////////////////////////////////////////////////////