import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import pLimit from "p-limit";
import { Config, WeeklyLearnings, BatchAnswerResponse } from "./types";

export class APIService {
  private config: Config;
  private geminiClient: GoogleGenAI | null = null;
  private rateLimiter = pLimit(1); // 1 request at a time
  private lastRequestTime = 0;
  private minRequestInterval = 4000; // 4 seconds between requests (15 requests per minute for free tier)

  constructor(config: Config) {
    this.config = config;

    // Initialize Gemini client if using Gemini
    if (config.apiType === "gemini" && config.geminiApiKey) {
      this.geminiClient = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(
        `    Rate limiting: Waiting ${Math.round(waitTime / 1000)}s before next API call...`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  // Batch answer all questions for a week in one API call
  async generateBatchAnswers(
    questions: string[],
    learnings: WeeklyLearnings,
    weekNumber: number,
  ): Promise<Map<string, string>> {
    return this.rateLimiter(async () => {
      await this.waitForRateLimit();

      const prompt = this.buildBatchPrompt(questions, learnings, weekNumber);

      let jsonResponse: string;
      if (this.config.apiType === "openai") {
        jsonResponse = await this.generateWithOpenAI(prompt, true);
      } else if (this.config.apiType === "gemini") {
        jsonResponse = await this.generateWithGemini(prompt, true);
      } else {
        jsonResponse = await this.generateWithCustomAPI(prompt);
      }

      // Parse JSON response
      return this.parseJsonResponse(jsonResponse, questions);
    });
  }

  private buildBatchPrompt(
    questions: string[],
    learnings: WeeklyLearnings,
    weekNumber: number,
  ): string {
    // Randomly pick 2 topics from learnings for the entire week
    const shuffled = [...learnings.items].sort(() => Math.random() - 0.5);
    const selectedTopics = shuffled.slice(0, 2);

    const questionsList = questions.map((q, i) => `${i + 1}. ${q}`).join("\n");

    return `You are writing practice school diary entries for Week ${weekNumber}.

Weekly focus areas: ${selectedTopics.join(", ")}

Questions:
${questionsList}

Instructions:
- Answer ALL questions in a single JSON response
- Each answer should be 2-3 lines maximum
- Focus on the two topics mentioned above
- Include basic concepts, ideas, or activities related to these topics appropriate for Week ${weekNumber}
- Keep it professional but brief
- Do not use bullet points or lists, write in paragraph form
- Be specific about what was learned or done

Return your response as a JSON object with this exact structure:
{
  "answers": [
    {"question": "exact question text 1", "answer": "your answer here"},
    {"question": "exact question text 2", "answer": "your answer here"}
  ]
}

Generate the JSON response now:`;
  }

  private parseJsonResponse(
    jsonResponse: string,
    questions: string[],
  ): Map<string, string> {
    const answerMap = new Map<string, string>();

    try {
      // Try to extract JSON from the response (in case there's markdown formatting)
      let jsonText = jsonResponse.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith("```")) {
        jsonText = jsonText
          .replace(/```json?\n?/g, "")
          .replace(/```\n?$/g, "");
      }

      const parsed: BatchAnswerResponse = JSON.parse(jsonText);

      if (!parsed.answers || !Array.isArray(parsed.answers)) {
        throw new Error("Invalid JSON structure: missing answers array");
      }

      // Map answers to questions
      for (const item of parsed.answers) {
        if (item.question && item.answer) {
          // Find matching question (case-insensitive partial match)
          const matchingQuestion = questions.find(
            (q) =>
              q
                .toLowerCase()
                .includes(item.question.toLowerCase().substring(0, 20)) ||
              item.question
                .toLowerCase()
                .includes(q.toLowerCase().substring(0, 20)),
          );

          if (matchingQuestion) {
            answerMap.set(matchingQuestion, item.answer);
          }
        }
      }

      // If we didn't get all answers, log warning
      if (answerMap.size < questions.length) {
        console.warn(
          `    Warning: Only got ${answerMap.size} answers for ${questions.length} questions`,
        );
      }
    } catch (error: any) {
      console.error("    Error parsing JSON response:", error.message);
      console.error("    Full response (first 1000 chars):", jsonResponse.substring(0, 1000));
      console.error("    Response length:", jsonResponse.length, "characters");
      throw new Error("Failed to parse JSON response from AI");
    }

    return answerMap;
  }

  async generateAnswer(
    question: string,
    learnings: WeeklyLearnings,
    weekNumber: number,
  ): Promise<string> {
    return this.rateLimiter(async () => {
      await this.waitForRateLimit();

      const prompt = this.buildPrompt(question, learnings, weekNumber);

      if (this.config.apiType === "openai") {
        return this.generateWithOpenAI(prompt, false);
      } else if (this.config.apiType === "gemini") {
        return this.generateWithGemini(prompt, false);
      } else {
        return this.generateWithCustomAPI(prompt);
      }
    });
  }

  private buildPrompt(
    question: string,
    learnings: WeeklyLearnings,
    weekNumber: number,
  ): string {
    // Randomly pick 2 topics from learnings
    const shuffled = [...learnings.items].sort(() => Math.random() - 0.5);
    const selectedTopics = shuffled.slice(0, 2);

    return `You are writing a practice school diary entry for Week ${weekNumber}.

Question: ${question}

Weekly focus areas: ${selectedTopics.join(", ")}

Instructions:
- Answer the question directly and concisely in 2-3 lines maximum
- Focus on the two topics mentioned above
- Include basic concepts, ideas, or activities related to these topics appropriate for Week ${weekNumber}
- Keep it professional but brief
- Do not use bullet points or lists, write in paragraph form
- Be specific about what was learned or done

Generate a short, to-the-point answer:`;
  }

  private async generateWithOpenAI(prompt: string, jsonMode: boolean = false): Promise<string> {
    try {
      const messages: any[] = [
        {
          role: "system",
          content: jsonMode 
            ? "You are a concise assistant that writes brief, professional practice school diary entries. Always respond with valid JSON only."
            : "You are a concise assistant that writes brief, professional practice school diary entries. Keep responses to 2-3 lines maximum.",
        },
        {
          role: "user",
          content: prompt,
        },
      ];

      const requestBody: any = {
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: jsonMode ? 1500 : 150,  // Much higher for batch JSON responses
      };

      if (jsonMode) {
        requestBody.response_format = { type: "json_object" };
      }

      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${this.config.openaiApiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      return response.data.choices[0].message.content.trim();
    } catch (error: any) {
      console.error(
        "Error calling OpenAI API:",
        error.response?.data || error.message,
      );
      throw new Error("Failed to generate answer with OpenAI");
    }
  }

  private async generateWithGemini(prompt: string, jsonMode: boolean = false): Promise<string> {
    try {
      if (!this.geminiClient) {
        throw new Error("Gemini client not initialized");
      }

      const systemInstruction = jsonMode
        ? "You are a concise assistant that writes brief, professional practice school diary entries. Always respond with valid JSON only. Do not include markdown formatting or code blocks."
        : "You are a concise assistant that writes brief, professional practice school diary entries. Keep responses to 2-3 lines maximum. Answer Directly. NO salutations or additional greetings.";
      const fullPrompt = `${systemInstruction}\n\n${prompt}`;

      const config: any = {
        temperature: 0.7,
        maxOutputTokens: jsonMode ? 1500 : 150,  // Much higher for batch JSON responses
      };

      if (jsonMode) {
        config.responseMimeType = "application/json";
      }

      const response = await this.geminiClient.models.generateContent({
        model: "gemini-2.5-flash",
        contents: fullPrompt,
        config,
      });

      if (!response.text) {
        throw new Error("No text in Gemini response");
      }

      return response.text.trim();
    } catch (error: any) {
      console.error("Error calling Gemini API:", error.message || error);
      throw new Error("Failed to generate answer with Gemini");
    }
  }

  private async generateWithCustomAPI(prompt: string): Promise<string> {
    try {
      const response = await axios.post(
        this.config.customApiUrl!,
        {
          prompt: prompt,
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.customApiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      // Adjust this based on your custom API response structure
      return (
        response.data.answer || response.data.text || response.data.response
      );
    } catch (error: any) {
      console.error(
        "Error calling custom API:",
        error.response?.data || error.message,
      );
      throw new Error("Failed to generate answer with custom API");
    }
  }
}
