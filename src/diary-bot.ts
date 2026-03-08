import { chromium, Browser, Page, BrowserContext } from "playwright";
import { Config, WeeklyLearnings, DiaryQuestion } from "./types";
import { APIService } from "./api-service";

export class DiaryBot {
  private config: Config;
  private apiService: APIService;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  constructor(config: Config) {
    this.config = config;
    this.apiService = new APIService(config);
  }

  async initialize(): Promise<void> {
    console.log("Launching browser...");
    this.browser = await chromium.launch({
      headless: this.config.headless,
    });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
  }

  async login(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log("Navigating to login page...");
    await this.page.goto("https://ps2.bits-pilani.in/login");
    await this.page.waitForLoadState("networkidle");

    console.log("\n==============================================");
    console.log("🔐 MANUAL LOGIN REQUIRED");
    console.log("==============================================");
    console.log("Please complete the Google login in the browser window.");
    console.log(
      "The bot will automatically continue once you reach the diary page.",
    );
    console.log("==============================================\n");

    // Wait for user to complete Google OAuth login
    // The diary page URL pattern: https://ps2.bits-pilani.in/student/{user_id}/diary
    console.log("Waiting for navigation to diary page...");

    try {
      await this.page.waitForURL(/\/student\/\w+\/diary/, {
        timeout: 300000, // 5 minutes for user to login
      });

      console.log("\n✅ Login successful! Diary page detected.");
      console.log("Current URL:", this.page.url());

      // Wait a bit for the page to fully load
      await this.page.waitForLoadState("networkidle");
    } catch (error) {
      console.error("\n❌ Login timeout or failed.");
      console.error("Make sure you:");
      console.error("  1. Completed the Google login");
      console.error("  2. Were redirected to the diary page");
      console.error(
        "  3. The URL matches: https://ps2.bits-pilani.in/student/*/diary",
      );
      throw new Error("Login failed or timed out after 5 minutes");
    }
  }

  async fillDiaries(learnings: WeeklyLearnings): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    console.log(`Processing weeks ${this.config.startWeek} to ${this.config.endWeek}...`);
    console.log('Waiting for diary content to load...');

    // Wait for the main container to be visible (page is likely React/dynamic)
    try {
      await this.page.waitForSelector('.students-container-list-child', { 
        timeout: 30000,
        state: 'visible'
      });
      console.log('Main container found!');
    } catch (error) {
      console.error('Could not find .students-container-list-child container');
      console.log('Current page content:', await this.page.content());
      throw error;
    }

    // Get the main container, then find its child elements (the actual week items)
    const mainContainer = this.page.locator('.students-container-list-child').first();
    
    // The actual week items should be children of this container
    // Try common patterns: direct children divs, list items, buttons, etc.
    const weekElements = await mainContainer.locator('> *').all();
    
    console.log(`Found ${weekElements.length} week elements in container`);

    if (weekElements.length === 0) {
      console.log('No week elements found. Trying alternative selectors...');
      
      // Try other common patterns
      const alternatives = [
        '> div',
        '> li', 
        '> button',
        '> a',
        '[class*="week"]',
        '[class*="item"]'
      ];
      
      for (const selector of alternatives) {
        const elements = await mainContainer.locator(selector).all();
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          break;
        }
      }
      
      throw new Error('Could not find week elements. Check the page structure in debug mode.');
    }

    // Process weeks from START_WEEK to END_WEEK (inclusive)
    // Array is 0-indexed, so week 1 is at index 0
    const startIndex = this.config.startWeek - 1;
    const endIndex = Math.min(this.config.endWeek, weekElements.length);
    
    for (let i = startIndex; i < endIndex; i++) {
      const weekNumber = i + 1;
      console.log(`\nProcessing Week ${weekNumber}...`);

      try {
        // Click on the week element
        await weekElements[i].click();
        
        // Wait for questions to load (they might load dynamically)
        await this.page.waitForTimeout(2000);
        
        // Optionally wait for question elements to appear
        try {
          await this.page.waitForSelector('.diary-question', { 
            timeout: 5000,
            state: 'visible'
          });
        } catch {
          console.warn('  No .diary-question elements found immediately');
        }

        // Find all diary questions
        const questions = await this.getQuestions();
        console.log(
          `Found ${questions.length} questions for Week ${weekNumber}`,
        );

        if (questions.length === 0) {
          console.warn(`  No questions found for Week ${weekNumber}, skipping...`);
          continue;
        }

        // Get answers for all questions in one batch API call
        let answersMap: Map<string, string> | null = null;
        
        if (!this.config.dryRun && !this.config.testSave) {
          console.log(`  Generating answers for all ${questions.length} questions in one API call...`);
          const questionTexts = questions.map(q => q.question);
          answersMap = await this.apiService.generateBatchAnswers(
            questionTexts,
            learnings,
            weekNumber
          );
          console.log(`  Received ${answersMap.size} answers from API`);
        }

        // Fill each question with its answer
        for (let j = 0; j < questions.length; j++) {
          console.log(`  Filling question ${j + 1}/${questions.length}...`);
          await this.fillQuestion(questions[j], learnings, weekNumber, answersMap);
        }

        // Look for the Save button (Material-UI button)
        const saveButton = this.page
          .locator('button:has-text("Save")')
          .first();
        
        const saveButtonVisible = await saveButton.isVisible().catch(() => false);
        
        if (saveButtonVisible) {
          if (this.config.dryRun && !this.config.testSave) {
            console.log("DRY RUN: Would save diary for Week " + weekNumber);
          } else {
            const saveMode = this.config.testSave ? "TEST SAVE" : "Saving";
            console.log(`${saveMode}: diary for Week ${weekNumber}...`);
            await saveButton.click();
            await this.page.waitForTimeout(2000);
            console.log("Week " + weekNumber + " saved successfully!");
          }
        } else {
          console.warn(`  No Save button found for Week ${weekNumber}`);
        }
      } catch (error) {
        console.error(`Error processing Week ${weekNumber}:`, error);
      }
    }
  }

  private async getQuestions(): Promise<DiaryQuestion[]> {
    if (!this.page) throw new Error("Page not initialized");

    const questions: DiaryQuestion[] = [];
    const questionElements = await this.page.locator(".diary-question").all();

    for (const element of questionElements) {
      try {
        // Get the question text from the .diary-question-1 div
        const questionText = await element
          .locator(".diary-question-1")
          .first()
          .innerText();

        questions.push({
          question: questionText.trim(),
          element: element,
        });
      } catch (error) {
        console.warn("Could not extract question text:", error);
      }
    }

    return questions;
  }

  private generateTestAnswer(question: string, learnings: WeeklyLearnings): string {
    // Generate a basic but realistic pre-generated answer for testing
    const learningsList = learnings.items.slice(0, 3).join(', ');
    
    // Vary the answer based on question keywords
    const q = question.toLowerCase();
    
    if (q.includes('learn') || q.includes('knowledge') || q.includes('skill')) {
      return `During this week, I gained valuable insights in ${learningsList}. These experiences enhanced my understanding of the subject matter and helped me develop practical skills that will be beneficial in my professional journey.`;
    }
    
    if (q.includes('challenge') || q.includes('problem') || q.includes('difficult')) {
      return `I encountered some interesting challenges while working on ${learningsList}. Through systematic problem-solving and collaboration with team members, I was able to overcome these obstacles and learn from the experience.`;
    }
    
    if (q.includes('apply') || q.includes('implement') || q.includes('practice')) {
      return `I applied theoretical concepts to practical scenarios involving ${learningsList}. This hands-on experience helped bridge the gap between classroom learning and real-world application.`;
    }
    
    if (q.includes('improve') || q.includes('develop') || q.includes('progress')) {
      return `My work on ${learningsList} contributed to my professional development. I identified areas for improvement and took steps to enhance my competencies in these domains.`;
    }
    
    // Default generic answer
    return `This week focused on ${learningsList}. I participated actively in assigned tasks, collaborated with team members, and gained practical experience that complements my academic knowledge. The experience was valuable for my overall learning objectives.`;
  }

  private async fillQuestion(
    question: DiaryQuestion,
    learnings: WeeklyLearnings,
    weekNumber: number,
    answersMap: Map<string, string> | null,
  ): Promise<void> {
    try {
      console.log(`    Question: ${question.question.substring(0, 50)}...`);

      let answer: string;

      if (this.config.testSave) {
        // TEST_SAVE mode: Use a pre-generated basic answer and actually fill the form
        answer = this.generateTestAnswer(question.question, learnings);
        console.log(`    TEST SAVE: Using pre-generated answer (${answer.length} chars)`);
      } else if (this.config.dryRun) {
        // DRY_RUN mode: Don't make API calls, don't fill anything
        console.log(
          "    DRY RUN: Would generate answer for this question"
        );
        console.log(
          "    DRY RUN: Learnings context:",
          learnings.items.join(', ')
        );
        return; // Exit early - don't fill anything
      } else {
        // Normal mode: Use answer from batch response
        if (!answersMap || !answersMap.has(question.question)) {
          console.error(`    Error: No answer found for this question in batch response`);
          return;
        }
        answer = answersMap.get(question.question)!;
        console.log(`    Using batch answer (${answer.length} chars)`);
      }

      // Fill the form (only in TEST_SAVE or normal mode, not DRY_RUN)
      if (this.config.testSave || !this.config.dryRun) {
        // Find the visible textarea within the Material-UI component
        // The actual input textarea (not the hidden one) has aria-invalid and placeholder attributes
        const inputField = question.element
          .locator('textarea[aria-invalid="false"][placeholder]')
          .first();

        const isVisible = await inputField.isVisible();
        if (isVisible) {
          // Clear existing content first
          await inputField.clear();
          // Fill with the generated answer
          await inputField.fill(answer);
          // Optional: trigger blur event to ensure MUI registers the change
          await inputField.blur();
          console.log("    Answer filled successfully");
        } else {
          console.warn("    Could not find visible textarea for this question");
          // Try fallback selector
          const fallbackField = question.element.locator('textarea').first();
          if (await fallbackField.isVisible()) {
            await fallbackField.clear();
            await fallbackField.fill(answer);
            await fallbackField.blur();
            console.log("    Answer filled using fallback selector");
          }
        }
      }
    } catch (error) {
      console.error("    Error filling question:", error);
    }
  }

  async close(): Promise<void> {
    console.log("\nClosing browser...");
    if (this.browser) {
      await this.browser.close();
    }
  }
}
