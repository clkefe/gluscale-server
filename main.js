import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

import express from "express";
import bodyParser from "body-parser";

// Supabase credentials
const PROJECT_URL = process.env.PROJECT_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(PROJECT_URL, ANON_KEY);

const app = express();
const PORT = 8080;

app.use(bodyParser.json());
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

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

    console.log(glucoseLevelInMgdl, "mg/dl");

    const { error } = await supabase
      .from("glucose_level")
      .insert([
        {
          value: glucoseLevelInMgdl,
          user_id: uid,
          created_at: new Date().toISOString(),
        },
      ]);

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

async function getUidByVitaUid(vita_uid) {
  const { data, error } = await supabase
    .from("wearable_connection")
    .select()
    .eq("vital_uid", vita_uid);

  if (error) {
    console.log(error);
    return;
  }

  return data[0].user_id;
}
