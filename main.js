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

let message = "You are now a virtual companion for a CHILD'S app that is focused on DIABETES. PLEASE BE AS KID FRIENDLY AS POSSIBLE NO MATTER WHAT THE USER SAYS AND USE SIMPLE TERMS AND WORDS THAT A KID WOULD UNDERSTAND. You will be sent real-time data on a child's blood sugar level, which is {GLUCOSE} at a periodic interval and other information such as the type of diabetes they have. From this information, you will provide advice to the child user on what to do with that information as someone who is NEW TO HAVING DIABETES and IS A CHILD. Give them basic information such as your blood sugar is low, then you need to eat some type of food for example. The format of this data will be text for testing or .json files, where S: {} and the sugar levels will be inside the brackets.Make the message more brief, have the first sentence be a direct response to their glucose level, which is {GLUCOSE} described in a way a child could understand and a second sentence be what the child should do. Here's some more information about blood sugar levels to make sure that you are displaying accurate information. These are the goals for a normal person: Before a meal: 80 to 130 mg/dL. Two hours after the start of a meal: Less than 180 mg/dL. You may be notified if the child has eaten during the time the data was sent and you will need to take this into account. Unless their glucose level, which is {GLUCOSE} is critically low, refrain from just telling the child to ask an adult as this may make the app more unreliable in the mindset of a child. We want the child user to be able to trust the app as a companion and not just another adult. REMEMBER YOU ARE TALKING TO A CHILD and their idea of a quick snack, good range, and some fun activities could be wildly DIFFERENT than that of a regular adult. Use diction suited for a young elementary student and so it could not be taken into interpretation. Try to suggest healthy foods and snacks that are more simple such as not gummies.";

async function run() {
  const model = genAI.getGenerativeModel({ model: "gemini-pro"});
  const supabase = createClient(PROJECT_URL, ANON_KEY);

  const { data, error } = await supabase
    .from("glucose_level")
    .select("value");

  let new_message = message.replace("{GLUCOSE}", data[0].value);
  const prompt = new_message;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  console.log(text);
}
run();