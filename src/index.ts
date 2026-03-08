import { DiaryBot } from './diary-bot';
import { getConfig } from './config';
import { WeeklyLearnings } from './types';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  try {
    console.log('=== PS Diary Bot ===\n');
    
    // Load configuration
    const config = getConfig();
    
    // Display mode
    if (config.testSave) {
      console.log('🧪 TEST SAVE MODE - Using pre-generated answers, will save to forms\n');
    } else if (config.dryRun) {
      console.log('🔍 DRY RUN MODE - No API calls, no form filling, no saves\n');
    } else {
      console.log(`🤖 LIVE MODE - Using ${config.apiType.toUpperCase()} API\n`);
    }
    
    // Load learnings from file
    const learningsPath = path.join(__dirname, '..', 'learnings.json');
    const learnings: WeeklyLearnings = JSON.parse(fs.readFileSync(learningsPath, 'utf-8'));

    console.log('Weekly Learnings:');
    learnings.items.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item}`);
    });
    console.log('');

    // Initialize bot
    const bot = new DiaryBot(config);
    await bot.initialize();

    // Login
    await bot.login();

    // Fill diaries
    await bot.fillDiaries(learnings);

    // Close browser
    await bot.close();

    // Summary
    if (config.testSave) {
      console.log('\n=== Test save completed! Forms filled with pre-generated answers. ===');
    } else if (config.dryRun) {
      console.log('\n=== Dry run completed! No changes were submitted. ===');
    } else {
      console.log('\n=== Diary filling completed! ===');
    }
  } catch (error) {
    console.error('Error running bot:', error);
    process.exit(1);
  }
}

main();
