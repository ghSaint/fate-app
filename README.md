# Pillars & Palaces

A web app that casts a person's **BaZi (八字, Four Pillars)** chart and **Zi Wei Dou Shu (紫微斗数)** chart from their birth date and time. It then reads their luck for any year using both systems together.

Live version (private until shared): https://claude.ai/artifact/RCtz7MDGep1ChGbRsdrnqG

## What it does

- **Year reading:** pick a year and the topics you care about (career, wealth, love and marriage, property, family, children, health, studies, travel, friends and helpers). Each topic gets a verdict from Excellent to Difficult, with advice.
- **Shows its working:** every reading lists each BaZi and Zi Wei rule that fired, its points, and how the two systems' scores were combined.
- **Luck timeline (大运流年):** scores every year of every 10-year luck pillar, as a lifetime curve and a year-by-year grid per decade.
- **Ask Claude:** a chat that sends both charts, the year reading and the timeline to Claude with your question. This works only when the page is opened on claude.ai.
- **Both charts in full:** the Four Pillars with ten gods, hidden stems and element balance, and the 12-palace Zi Wei grid with star brightness and 四化.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | Page layout and styling |
| `app.js` | Page logic: form, readings, timeline, chat, chart drawing |
| `engine.js` | Chart casting and all BaZi and Zi Wei scoring rules |

Calendar maths comes from [lunar-javascript](https://github.com/6tail/lunar-javascript) (BaZi) and [iztro](https://github.com/SylarLong/iztro) (Zi Wei Dou Shu), loaded from jsDelivr.

## Running it locally

Serve the folder with any static web server and open `index.html`, for example:

```bash
npx serve .
```

Opening `index.html` straight from disk may block `engine.js` and `app.js` in some browsers. The Ask Claude chat is unavailable outside claude.ai.

## Notes

- Birth time is local clock time, with no true-solar-time correction.
- The scoring rules and weights are this app's own synthesis of common classical techniques. Schools differ, especially on Day Master strength and the late 子 hour.
- Readings are for cultural interest and reflection, not for medical, financial or legal decisions.
