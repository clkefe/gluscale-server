// This is the file that will be run at 8pm every day.
// It will check the average glucose level for each user and give their dragon cart if they have an average glucose level of less than 100 mg/dl.
// If they have an average glucose level of more than 100 mg/dl, they won't get a dragon cart.

import { CronJob } from "cron";

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const PROJECT_URL = process.env.PROJECT_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(PROJECT_URL, ANON_KEY);

export async function startJob() {
  const now = new Date();
  const filterDate = new Date(now);
  filterDate.setDate(filterDate.getDate() - 1);
  filterDate.setHours(20, 0, 0, 0);

  const yesterdayStr = filterDate.toISOString();

  const { data, error } = await supabase
    .from("glucose_level")
    .select()
    .gte("created_at", yesterdayStr);

  if (error) {
    console.error("Error fetching data:", error);
    return;
  }

  const userAverages = data.reduce((acc, curr) => {
    if (!acc[curr.user_id]) {
      acc[curr.user_id] = { sum: 0, count: 0 };
    }
    acc[curr.user_id].sum += curr.value;
    acc[curr.user_id].count++;
    return acc;
  }, {});

  Object.keys(userAverages).forEach((userId) => {
    const avg = userAverages[userId].sum / userAverages[userId].count;
    if (avg > 70 && avg < 150) {
      giveDragonCart(userId, yesterdayStr);
      console.log(`User ${userId} gets a dragon cart.`);
    } else {
      console.log(`User ${userId} does not get a dragon cart.`);
    }
  });

  console.log(userAverages);
}

async function giveDragonCart(userId, yesterdayStr) {
  const { data: eggData, error: eggError } = await supabase
    .from("dragon_egg")
    .select()
    .eq("user_id", userId)
    .gte("created_at", yesterdayStr);

  var dragon = DRAGONS[0];

  if (eggData.length > 0) {
    dragon = DRAGONS[eggData[0].dragon_id || 0];
  }

  const { error } = await supabase.from("dragon_cart").insert([
    {
      dragon_id: dragon.id,
      user_id: userId,
    },
  ]);

  if (error) {
    console.error("ERROR: ", error);
    return;
  }

  await supabase.from("dragon_egg").delete().eq("user_id", userId);
  await supabase.from("dragon_egg").insert([
    {
      user_id: userId,
      dragon_id: Math.floor(Math.random() * DRAGONS.length),
    },
  ]);
}

const DRAGONS = [
  {
    id: 0,
    name: "Fire Dragon",
    imageURLFull: "https://i.imgur.com/1.png",
  },
  {
    id: 1,
    name: "Ice Dragon",
    imageURLFull: "https://i.imgur.com/5.png",
  },
];
