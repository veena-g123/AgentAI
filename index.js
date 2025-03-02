import { GoogleGenerativeAI } from "@google/generative-ai";
import readlineSync from "readline-sync";
import axios from "axios";

const GOOGLE_API_KEY = "AIzaSyCdAu3krwirfs3dHZphM5IN8j2DR4f6Cn4";
const WEATHER_API_KEY = "01e3e8767c4635da900180be170f2a0f";

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

const tools = {
  getWeatherDetails: async (city) => {
    try {
      const url = `http://api.weatherstack.com/current?access_key=${WEATHER_API_KEY}&query=${city}`;
      const response = await axios.get(url);
      const temp = await response.data.current.temperature; // ✅ Corrected destructuring
      const description = await response.data.current.weather_descriptions[0];

      return `${temp}°C and ${description}`;
    } catch (error) {
      return `Error: Could not fetch weather for ${city}.`;
    }
  },
};

const SYSTEM_PROMPT = `
You are a helpful AI assistant that follows a structured workflow.
DO NOT generate outputs outside the JSON format specified.

Workflow:
1. Plan: Identify the correct tool to call based on user input.
2. Action: Call the tool using its exact function name and input.
3. Observation: Wait for a response from the tool.
4. Output: Return the final response based on the tool's output.

Identify the city mentioned in the user’s request.
Call the 'getWeatherDetails' function with the correct city.

Available Tool:
- function getWeatherDetails(city: String): String
  - This function supports any city.

Strictly return responses in the following JSON format:
{
  "type": "plan",
  "plan": "I will call the getWeatherDetails function for <CITY>."
}

{
  "type": "action",
  "function": "getWeatherDetails",
  "input": "<CITY>"
}

{
  "type": "output",
  "output": "The weather in <CITY> is <TEMPERATURE>°C and <DESCRIPTION>."
}
`;

const messages = [{ role: "system", content: SYSTEM_PROMPT }];

async function chatLoop() {
  const username = process.env.REPL_OWNER || "there";
  let isFirstTime = true;

  while (true) {
    const greeting = isFirstTime
      ? `>> Hey ${username}, how are you? Do you want to know the weather of any location?\n>> `
      : ">> ";
    const query = readlineSync.question(greeting);
    isFirstTime = false;
    if (query.toLowerCase() === "exit") break;

    messages.push({
      role: "user",
      content: JSON.stringify({ type: "user", user: query }),
    });

    while (true) {
      const chat = messages.map((msg) => msg.content).join("\n");
      let agentResponseText;

      try {
        const result = await model.generateContent(chat);
        agentResponseText =
          result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      } catch (error) {
        console.error("Error with Gemini API:", error.message);
        break;
      }

      const cleanedResponse = agentResponseText
        .replace(/```json|```/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const jsonStrings = cleanedResponse.match(/\{.*?\}/g) || [];

      for (const jsonStr of jsonStrings) {
        try {
          // console.log("Parsing JSON:", jsonStr);
          const parsedResponse = JSON.parse(jsonStr);

          if (!["action", "output"].includes(parsedResponse.type)) {
            continue;
          }

          messages.push({
            role: "agent",
            content: JSON.stringify(parsedResponse),
          });

          // if (parsedResponse.type === "output") {
          //   console.log(`Weather is 🤖: ${parsedResponse.output}`);
          //   break;
          // } else
          if (parsedResponse.type === "action") {
            if (parsedResponse.function !== "getWeatherDetails") {
              console.error("Unknown function:", parsedResponse.function);
              break;
            }

            const observation = await tools.getWeatherDetails(
              parsedResponse.input
            );
            messages.push({
              role: "developer",
              content: JSON.stringify({ type: "observation", observation }),
            });

            console.log(` As per my Observation, it is 🤖: ${observation}`);
            break;
          }
        } catch (error) {
          console.error(
            "Skipping invalid JSON:",
            jsonStr,
            "Error:",
            error.message
          );
        }
      }
      break;
    }
  }
}

chatLoop();
