import { VertexAI, HarmCategory, HarmBlockThreshold } from '@google-cloud/vertexai';

const projectId = 'lemona-app'
const location = 'us-central1'
const model = 'gemini-2.5-flash-preview-05-20'

const vertexAI = new VertexAI({
    project: projectId,
    location: location
});

const generationConfig = {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 4096,
}

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    }
]

export const generativeModel = vertexAI.getGenerativeModel({
    model: model,
    generationConfig: generationConfig,
    safetySettings: safetySettings,
});