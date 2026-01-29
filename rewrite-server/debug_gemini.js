import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCK8VUMIhxkPIXLtXKbUAsCfqFdBCtfKGc";
const MODEL_NAME = "gemini-flash-latest";

async function testGemini() {
    console.log("Testing Gemini API...");
    console.log(`Model: ${MODEL_NAME}`);

    try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const prompt = "Explain why the sky is blue in 10 words.";
        console.log(`Prompt: ${prompt}`);

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("Success!");
        console.log("Response:", text);
    } catch (error) {
        console.error("Error calling Gemini API:", error.message);
    }
}

testGemini();
