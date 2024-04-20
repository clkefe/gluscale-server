const achievements = [
    { id: 1, name: 'First Flight', condition: glucose_level !== null },
    { id: 2, name: 'Crack the Shell', condition: checkDays(glucoseData) >= 1 },
    { id: 3, name: 'Weekly Warrior', condition: checkDays(glucoseData) >= 7  },
    { id: 4, name: 'Month Master', condition: checkDays(glucoseData) >= 30  },
    { id: 5, name: 'Legendary Streak', condition: checkDays(glucoseData) >= 90 }
    // { id: 6, name: 'Dragon Collector', condition: "all dragons" }
    // Define conditions for other achievements here
];

function checkDays() {
    if (glucoseData.length < 2) {
        return false;
    }

    // Get the timestamp of the first and last glucose readings
    const firstReadingTime = new Date(glucoseData[0].time);
    const lastReadingTime = new Date(glucoseData[-1].time);

    // Calculate the difference in days between the first and last readings
    const timeDifferenceInDays = Math.floor((lastReadingTime - firstReadingTime) / (1000 * 60 * 60 * 24));

    // Condition is met if the time difference is more than one day
    return timeDifferenceInDays;
}

// Function to retrieve glucose levels from the database and unlock achievements
async function unlockAchievements(userId) {
    try {
        // Fetch user's unlocked achievements from the Supabase database
        const { data: userAchievements, error: userAchievementsError } = await supabase
            .from('user_achievements')
            .select('achievement_id')
            .eq('user_id', userId);

        if (userAchievementsError) {
            console.error('Error fetching user achievements:', userAchievementsError);
            return null;
        }

        // Get user's unlocked achievement IDs
        const unlockedAchievementIds = userAchievements.map(achievement => achievement.achievement_id);

        // Array to store unlocked achievements
        const unlockedAchievements = [];

        // Iterate through each achievement
        for (const achievement of achievements) {
            // Check if the achievement is already unlocked for the user
            if (!unlockedAchievementIds.includes(achievement.id)) {
                // If the achievement is not already unlocked, check if the condition is met
                const { data: glucoseData, error: glucoseError } = await supabase
                    .from('glucose_level')
                    .select('value')
                    .eq('user_id', userId);

                if (glucoseError) {
                    console.error('Error fetching glucose data:', glucoseError);
                    return null;
                }

                if (glucoseData.length > 0 && eval(achievement.condition)) {
                    // If the condition is met, add the achievement to the list of unlocked achievements
                    unlockedAchievements.push(achievement.id);

                    // Add the unlocked achievement to the database
                    await supabase
                        .from('user_achievements')
                        .insert([{ user_id: userId, achievement_id: achievement.id }]);
                }
            }
        }

        // If no achievements are unlocked, return null
        if (unlockedAchievements.length === 0) {
            return null;
        }

        // Return the array of unlocked achievement IDs
        return unlockedAchievements;
    } catch (error) {
        console.error('Error unlocking achievements:', error.message);
        return null;
    }
}