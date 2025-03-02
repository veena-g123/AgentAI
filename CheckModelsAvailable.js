import { GoogleGenerativeAI } from "@google/generative-ai";

const GOOGLE_API_KEY = "AIzaSyCdAu3krwirfs3dHZphM5IN8j2DR4f6Cn4";
const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);

async function listModels() {
  try {
    const models = await genAI.listModels();
    console.log("Available Models:", models);
  } catch (error) {
    console.error("Error listing models:", error.message);
  }
}

listModels();
