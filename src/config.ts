import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

export function getConfig(): Config {
  const apiType = process.env.API_TYPE as 'openai' | 'gemini' | 'custom' || 'openai';
  const dryRun = process.env.DRY_RUN === 'true';
  const testSave = process.env.TEST_SAVE === 'true';
  
  // Only require API keys if not in test save mode
  if (!testSave) {
    if (apiType === 'openai' && !process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY must be set when using OpenAI API (or use TEST_SAVE=true)');
    }

    if (apiType === 'gemini' && !process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY must be set when using Gemini API (or use TEST_SAVE=true)');
    }

    if (apiType === 'custom' && (!process.env.API_URL || !process.env.API_KEY)) {
      throw new Error('API_URL and API_KEY must be set when using custom API (or use TEST_SAVE=true)');
    }
  }

  const startWeek = parseInt(process.env.START_WEEK || '1', 10);
  const endWeek = parseInt(process.env.END_WEEK || '24', 10);

  // Validate week numbers
  if (startWeek < 1 || startWeek > 24) {
    throw new Error('START_WEEK must be between 1 and 24');
  }
  if (endWeek < 1 || endWeek > 24) {
    throw new Error('END_WEEK must be between 1 and 24');
  }
  if (startWeek > endWeek) {
    throw new Error('START_WEEK cannot be greater than END_WEEK');
  }

  return {
    startWeek,
    endWeek,
    headless: process.env.HEADLESS === 'true',
    dryRun,
    testSave,
    apiType,
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    customApiUrl: process.env.API_URL,
    customApiKey: process.env.API_KEY,
  };
}
