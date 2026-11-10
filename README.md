# Pillars & Palaces

A web app that casts a person's **BaZi (八字, Four Pillars)** chart and **Zi Wei Dou Shu (紫微斗数)** chart from their birth date and time. It then reads their luck for any year using both systems together, and explains in plain language what to do next. A second tab answers specific questions with **Qimen Dunjia (奇门遁甲)**.

Live version (private until shared): https://claude.ai/artifact/RCtz7MDGep1ChGbRsdrnqG

## What it does

- **Your guide:** a plain-language summary. It covers who you are, your useful element and how to strengthen it in daily life (colours, directions, best times, work, activities, food, home and habits), what to focus on and protect this year, ages to look out for (strongest and hardest decades, best and hardest years in the next 20 years, turning points and warning-sign years, with how to handle each), and a checklist of next steps.
- **Year reading:** pick a year and the topics you care about (career, wealth, love and marriage, property, family, children, health, studies, travel, friends and helpers). Each topic gets a verdict from Excellent to Difficult, with advice.
- **Shows its working:** every reading lists each BaZi and Zi Wei rule that fired, its points, and how the two systems' scores were combined.
- **Luck timeline (大运流年):** scores every year of every 10-year luck pillar, as a lifetime curve and a year-by-year grid per decade.
- **Ten gods explained:** what each ten god 十神 in each pillar means for the Day Master, with the life area and ages that pillar governs.
- **Ask AI:** a chat that sends both charts, the year reading and the timeline to the AI model you choose.
- **Ask a question (奇门遁甲):** casts a Qimen Dunjia hour chart (rotating plate, Chai Bu or Mao Shan 局) for the moment of your question. It reads the indicator palaces for the topic and draws the nine-palace board, a direction compass and a timing chart of the next twelve two-hour periods. The AI then gives guidance on what to do, when, and in which direction.
- **Both charts in full:** the Four Pillars with hidden stems and element balance, and the 12-palace Zi Wei grid with star brightness and 四化.

## Choosing the AI model

Click **AI model** at the top right of the page. There are three choices:

| Choice | Works when | Models |
| --- | --- | --- |
| **Claude on claude.ai** | The page is opened from its claude.ai artifact link | Balanced, most capable or fastest tier, or a named Claude model |
| **Claude Code (my Claude login)** | The app runs through `server.js` on your computer and Claude Code is signed in | Claude Code's aliases (`opus`, `fable`, `sonnet`, `haiku`, your default) and full model names. **Check access to all models** tests which ones your account can use |
| **LM Studio / OpenAI-compatible** | Anywhere except inside claude.ai | Loaded live from the server's `/v1/models` (LM Studio, Ollama, OpenAI and others) |

For LM Studio: open its Developer tab, load a model and start the server (default `http://localhost:1234/v1`), then click **Load models**. Without `server.js`, the browser connects to LM Studio directly, so turn on CORS in LM Studio's server settings. An API key, if your server needs one, stays in the page's memory and is not saved.

## Running it on your computer

Double-click `start.bat` (Windows), or run:

```bash
node server.js
```

Then open http://localhost:8787. The server needs Node.js 18 or later and nothing else. It listens only on your own computer and accepts requests only from this app's pages (localhost:8787 and ghsaint.github.io).

Opening `index.html` straight from disk also works for the charts and readings, but then only LM Studio (with CORS on) is available for the AI features.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page layout and styling |
| `app.js` | Page logic: form, readings, timeline, chat, chart drawing |
| `engine.js` | Chart casting and all BaZi and Zi Wei scoring rules |
| `guide.js` | Plain-language guide, element advice and ten-god explanations |
| `llm.js` | AI model picker and the code that sends questions to the chosen model |
| `qimen.js` | Qimen Dunjia chart casting and question scoring |
| `qimen-ui.js` | The Ask a question tab: board, compass, timing chart and AI guidance |
| `server.js` | Optional local server: serves the app and connects to Claude Code and LM Studio |
| `start.bat` | Starts the local server and opens the app (Windows) |

Calendar maths comes from [lunar-javascript](https://github.com/6tail/lunar-javascript) (BaZi) and [iztro](https://github.com/SylarLong/iztro) (Zi Wei Dou Shu), loaded from jsDelivr.

## Notes

- Birth time is local clock time, with no true-solar-time correction.
- The scoring rules and weights are this app's own synthesis of common classical techniques. Schools differ, especially on Day Master strength and the late 子 hour.
- Element advice (colours, directions, foods and so on) follows common Chinese metaphysics practice and is meant as gentle lifestyle guidance.
- Readings are for cultural interest and reflection, not for medical, financial or legal decisions.
