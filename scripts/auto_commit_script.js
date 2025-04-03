// Auto-commit script for GitMorph
// Last updated: 2025-04-03T03:55:14.323Z

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin with service account
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccount) {
    console.error('Firebase service account not found');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount))
});

async function getCommitSchedule() {
    try {
        const db = admin.firestore();
        const repoName = process.env.GITHUB_REPOSITORY.split('/')[1];
        const userId = process.env.GITHUB_ACTOR;

        const settingsDoc = await db.collection('users')
            .doc(userId)
            .collection('autoCommitSettings')
            .doc(repoName)
            .get();

        if (!settingsDoc.exists) {
            console.log('No commit schedule found');
            return null;
        }

        return settingsDoc.data();
    } catch (error) {
        console.error('Error fetching commit schedule:', error);
        return null;
    }
}

async function shouldCommit() {
    const schedule = await getCommitSchedule();
    if (!schedule) return false;

    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[now.getDay()];
    
    const commitsForToday = schedule.commitSchedule[today] || 0;
    if (commitsForToday === 0) return false;

    // Get current hour to determine if we should commit
    const currentHour = now.getHours();
    const interval = Math.floor(24 / commitsForToday);
    const hourSlot = Math.floor(currentHour / interval);

    // Only commit if we're in a valid hour slot for today's commit count
    return hourSlot < commitsForToday;
}

async function main() {
    if (await shouldCommit()) {
        const timestamp = new Date().toISOString();
        const changes = {
            timestamp,
            message: 'Auto-commit activity recorded'
        };

        // Update this file with new timestamp
        const currentFilePath = __filename;
        const fileContent = `// Auto-commit script for GitMorph
// Last updated: ${timestamp}
${fs.readFileSync(currentFilePath, 'utf8').split('
').slice(2).join('
')}`;

        fs.writeFileSync(currentFilePath, fileContent);
        console.log('Changes made:', changes);
    } else {
        console.log('No commit scheduled for current time');
    }
}

main().catch(console.error);
