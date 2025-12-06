# API Integration To-Do List

## Google Gemini API

**API Key:** `AIzaSyBrQ_bA6yby8wtANqTuxMXzAsteux1mPhw`

### Conexión en JavaScript

```javascript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: "Explain how AI works in a few words",
  });
  console.log(response.text);
}

await main();
```
