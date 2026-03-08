export interface Config {
  startWeek: number;
  endWeek: number;
  headless: boolean;
  dryRun: boolean;
  testSave: boolean;
  apiType: 'openai' | 'gemini' | 'custom';
  openaiApiKey?: string;
  geminiApiKey?: string;
  customApiUrl?: string;
  customApiKey?: string;
}

export interface WeeklyLearnings {
  items: string[];
}

export interface DiaryQuestion {
  question: string;
  element: any; // Playwright element locator
}

export interface BatchAnswerResponse {
  answers: {
    question: string;
    answer: string;
  }[];
}
