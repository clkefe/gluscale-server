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

async function startJob() {
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
    console.log(curr);
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
      giveDragonCart(userId);
      console.log(`User ${userId} gets a dragon cart.`);
    } else {
      console.log(`User ${userId} does not get a dragon cart.`);
    }
  });

  console.log(userAverages);
}

new CronJob(
  "0 20 * * *",
  async () => {
    await startJob();
  },
  null,
  true,
  "America/Los_Angeles"
);

async function giveDragonCart(userId) {
  //TODO: Replace this with the actual dragon that was assigned to the user previously
  const dragon = DRAGONS[Math.floor(Math.random() * DRAGONS.length)];

  const { error } = await supabase.from("dragon_cart").insert([
    {
      dragon_name: dragon.name,
      dragon_image_full: dragon.imageURLFull,
      dragon_egg_images: dragon.eggImagesURL,
      user_id: userId,
    },
  ]);

  if (error) {
    console.error("ERROR: ", error);
    return;
  }
}

const DRAGONS = [
  {
    name: "Fire Dragon",
    imageURLFull: "https://i.imgur.com/1.png",
    eggImagesURL: [
      "https://i.imgur.com/2.png",
      "https://i.imgur.com/3.png",
      "https://i.imgur.com/4.png",
    ],
  },
  {
    name: "Ice Dragon",
    imageURLFull: "https://i.imgur.com/5.png",
    eggImagesURL: [
      "https://i.imgur.com/6.png",
      "https://i.imgur.com/7.png",
      "https://i.imgur.com/8.png",
    ],
  },
];
