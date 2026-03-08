# PS Diary Automate

Automated bot to fill your university PS (Practice School) diary using Playwright and AI.

## Features

- **Batch question answering**: All questions per week in one API call
- **Rate limiting**: 4-second delay between calls (respects free tier)
- **Three testing modes**: DRY_RUN, TEST_SAVE, LIVE
- **Concise answers**: 2-3 lines, randomly picks 2 topics per week
- Manual Google OAuth login with auto-detection

## Quick Start

```bash
# 1. Install
npm install
cp .env.example .env

# 2. Get free Gemini API key from https://aistudio.google.com/app/apikey

# 3. Configure .env
API_TYPE=gemini
GEMINI_API_KEY=AIzaXXXXXXXXXXXXXXXX
START_WEEK=1
END_WEEK=24

# 4. Edit learnings.json with your weekly activities

# 5. Run
npm run dev
# Complete Google OAuth login in browser → Bot fills all weeks!
```

## Testing Modes

| Mode | DRY_RUN | TEST_SAVE | API Calls | Form Filling | Saves |
|------|---------|-----------|-----------|--------------|-------|
| **DRY_RUN** | true | false | ❌ | ❌ | ❌ |
| **TEST_SAVE** | false | true | ❌ | ✅ | ✅ |
| **LIVE** | false | false | ✅ | ✅ | ✅ |

- **DRY_RUN**: Test navigation and selectors
- **TEST_SAVE**: Test filling without API costs
- **LIVE**: Actually fill your diary

## Configuration

### .env
```env
# Required
API_TYPE=gemini              # or: openai, custom
GEMINI_API_KEY=AIza...      # Get from https://aistudio.google.com/app/apikey

# Optional
START_WEEK=1                 # First week to fill (1-24)
END_WEEK=24                  # Last week to fill (1-24)
HEADLESS=false               # Must be false for manual login
DRY_RUN=false                # true = test only
TEST_SAVE=false              # true = test with pre-generated answers
```

### learnings.json
```json
{
  "items": [
    "Learnt Python",
    "Springboot",
    "Perl",
    "Rate Limiting"
  ]
}
```

## API Options

### Google Gemini (Recommended)
- Free tier: 1500 requests/day, no credit card required
- Model: gemini-2.5-flash

### OpenAI
- Requires payment after free credits
- Set: `API_TYPE=openai`, `OPENAI_API_KEY=sk-...`

### Custom API
- Set: `API_TYPE=custom`, `API_URL=https://...`, `API_KEY=...`
- Edit `src/api-service.ts` → `generateWithCustomAPI()`

## Commands

```bash
npm run build       # Compile TypeScript
npm run dev         # Build and run
npm run debug       # Inspect page selectors
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Login timeout | Complete OAuth within 5 min, ensure `HEADLESS=false` |
| "Unexpected end of JSON" | Fixed: token limit now 1500 |
| "Quota exceeded" | Wait a few minutes, bot auto-waits 4s between calls |
| "No questions found" | Run `npm run debug` to inspect selectors |

## Recommended Workflow

```bash
# Test navigation
DRY_RUN=true npm run dev

# Test form filling (no API costs)
DRY_RUN=false TEST_SAVE=true START_WEEK=1 END_WEEK=1 npm run dev

# Fill one week
DRY_RUN=false TEST_SAVE=false START_WEEK=1 END_WEEK=1 npm run dev

# Fill all weeks
START_WEEK=1 END_WEEK=24 npm run dev
```

## Security

- Never commit `.env` (in `.gitignore`)
- Keep API keys secure
- Review generated content before submitting

## License

ISC

## Disclaimer

For educational purposes. Ensure you have permission to automate your university's systems. Use responsibly.
