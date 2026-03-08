import { chromium } from 'playwright';
import { getConfig } from './config';

/**
 * Debug script to explore the page structure
 * Run this to see what selectors are available on the page
 */
async function debug() {
  const config = getConfig();
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('Navigating to login page...');
    await page.goto('https://ps2.bits-pilani.in/login');
    await page.waitForLoadState('networkidle');

    console.log('\n==============================================');
    console.log('🔐 MANUAL LOGIN REQUIRED');
    console.log('==============================================');
    console.log('Please complete the Google login in the browser.');
    console.log('Waiting for you to reach the diary page...');
    console.log('==============================================\n');

    // Wait for user to complete login
    await page.waitForURL(/\/student\/\w+\/diary/, { timeout: 300000 });

    console.log('\n=== After Login ===');
    console.log('Current URL:', page.url());

    // Wait for page to stabilize
    console.log('\nWaiting for page to load...');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for the main container
    console.log('\n=== Looking for Week Container ===');
    const mainContainer = page.locator('.students-container-list-child').first();
    const containerCount = await page.locator('.students-container-list-child').count();
    console.log(`Found ${containerCount} main container(s) (.students-container-list-child)`);

    if (containerCount > 0) {
      // Try to get information about the container
      const containerVisible = await mainContainer.isVisible();
      console.log(`Main container visible: ${containerVisible}`);

      if (containerVisible) {
        // Get child elements
        console.log('\n=== Analyzing Container Children ===');
        
        const directChildren = await mainContainer.locator('> *').all();
        console.log(`Direct children count: ${directChildren.length}`);

        // Try different selectors
        const selectors = [
          '> div',
          '> li',
          '> button', 
          '> a',
          '[class*="week"]',
          '[class*="item"]',
          '[class*="child"]'
        ];

        for (const selector of selectors) {
          const count = await mainContainer.locator(selector).count();
          if (count > 0) {
            console.log(`  ${selector}: ${count} elements`);
            
            // Get first element details
            const first = mainContainer.locator(selector).first();
            const tag = await first.evaluate(el => el.tagName);
            const classes = await first.evaluate(el => el.className);
            const text = await first.innerText().catch(() => '');
            console.log(`    First element: <${tag}> class="${classes}" text="${text.substring(0, 50)}"`);
          }
        }

        // Print HTML structure
        console.log('\n=== Container HTML (first 500 chars) ===');
        const html = await mainContainer.innerHTML();
        console.log(html.substring(0, 500));

        // Try clicking first child
        console.log('\n=== Attempting to Click First Week ===');
        if (directChildren.length > 0) {
          try {
            console.log('Clicking first child element...');
            await directChildren[0].click();
            await page.waitForTimeout(2000);
            console.log('Click successful!');

            // Look for diary questions
            console.log('\n=== Looking for Diary Questions ===');
            const questionCount = await page.locator('.diary-question').count();
            console.log(`Found ${questionCount} elements with .diary-question`);

            if (questionCount > 0) {
              const questions = await page.locator('.diary-question').all();
              console.log('\nFirst question analysis:');
              const firstQuestion = questions[0];
              
              // Check for diary-question-1 (question text)
              const questionText1 = await firstQuestion.locator('.diary-question-1').count();
              console.log(`  .diary-question-1 elements: ${questionText1}`);
              
              if (questionText1 > 0) {
                const text = await firstQuestion.locator('.diary-question-1').innerText();
                console.log(`  Question text: ${text}`);
              }
              
              // Check for diary-question-2-active (answer area)
              const questionArea = await firstQuestion.locator('.diary-question-2-active').count();
              console.log(`  .diary-question-2-active elements: ${questionArea}`);

              // Check for textarea
              const textareas = await firstQuestion.locator('textarea').all();
              console.log(`  Total textarea elements: ${textareas.length}`);
              
              // Check for visible textarea (with aria-invalid)
              const visibleTextarea = await firstQuestion.locator('textarea[aria-invalid="false"]').count();
              console.log(`  Visible textarea (aria-invalid="false"): ${visibleTextarea}`);
              
              if (visibleTextarea > 0) {
                const placeholder = await firstQuestion.locator('textarea[aria-invalid="false"]').getAttribute('placeholder');
                console.log(`  Placeholder: ${placeholder}`);
              }

              // Print question HTML
              console.log('\n=== Question HTML (first 500 chars) ===');
              const qHtml = await firstQuestion.innerHTML();
              console.log(qHtml.substring(0, 500));
              
              // Check for Save button
              console.log('\n=== Looking for Save Button ===');
              const saveButtonCount = await page.locator('button:has-text("Save")').count();
              console.log(`Found ${saveButtonCount} Save button(s)`);
              
              if (saveButtonCount > 0) {
                const saveBtn = page.locator('button:has-text("Save")').first();
                const btnVisible = await saveBtn.isVisible();
                console.log(`  Save button visible: ${btnVisible}`);
              }
            } else {
              console.log('No .diary-question elements found.');
              console.log('Looking for alternative question selectors...');
              
              const altSelectors = [
                '[class*="question"]',
                '[class*="diary"]',
                'form input, form textarea',
                'label'
              ];

              for (const sel of altSelectors) {
                const count = await page.locator(sel).count();
                if (count > 0) {
                  console.log(`  ${sel}: ${count} elements`);
                }
              }
            }
          } catch (err) {
            console.error('Error clicking first child:', err);
          }
        }
      }
    } else {
      console.log('Main container not found!');
      console.log('\n=== Looking for Alternative Selectors ===');
      
      const alternatives = [
        '.students-container',
        '[class*="student"]',
        '[class*="week"]',
        '[class*="diary"]',
        '[class*="container"]'
      ];

      for (const selector of alternatives) {
        const count = await page.locator(selector).count();
        if (count > 0) {
          console.log(`${selector}: ${count} elements`);
        }
      }

      // Print sample of page elements
      console.log('\n=== Sample Page Elements ===');
      const sampleElements = await page.locator('body *').all();
      console.log(`Total elements on page: ${sampleElements.length}`);
    }

    console.log('\n=== Debug session ===');
    console.log('Browser will stay open for manual inspection.');
    console.log('Press Ctrl+C to close when done.');
    
    // Keep browser open for manual inspection
    await page.waitForTimeout(300000); // 5 minutes

  } catch (error) {
    console.error('Error during debug:', error);
  } finally {
    await browser.close();
  }
}

debug();
