
import { GoogleGenAI, Type } from "@google/genai";
import type { GeminiResponse } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = {
    type: Type.OBJECT,
    properties: {
        flowchart: {
            type: Type.OBJECT,
            properties: {
                nodes: {
                    type: Type.ARRAY,
                    description: "An array of flowchart nodes.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING, description: "Unique identifier for the node." },
                            label: { type: Type.STRING, description: "A short, descriptive label for the step (max 5 words)." },
                            type: { type: Type.STRING, enum: ['start', 'process', 'decision', 'end'] },
                            description: { type: Type.STRING, description: "(Optional) A more detailed, one-sentence description of the node's action, derived directly from the script." }
                        },
                        required: ['id', 'label', 'type'],
                    },
                },
                edges: {
                    type: Type.ARRAY,
                    description: "An array of edges connecting the nodes.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            source: { type: Type.STRING, description: "The id of the source node." },
                            target: { type: Type.STRING, description: "The id of the target node." },
                            label: { type: Type.STRING, description: "(Optional) A label for the edge, e.g., 'Yes' or 'No' for decisions." },
                        },
                        required: ['source', 'target'],
                    },
                },
            },
            required: ['nodes', 'edges'],
        },
        functions: {
            type: Type.ARRAY,
            description: "An array of necessary helper functions implied by the script.",
            items: {
                type: Type.STRING,
                description: "A description of a function, e.g., 'function to check player inventory'."
            },
        },
    },
    required: ['flowchart', 'functions'],
};

export const generateFlowFromScript = async (script: string): Promise<GeminiResponse> => {
    const maxRetries = 3;
    let attempt = 0;
    let delayMs = 2000; // Start with a 2-second delay

    const prompt = `
        Analyze the following plot script and convert it into a structured program flow.
        The output must be a valid JSON object that adheres to the provided schema.

        IMPORTANT: The language used for all text in the output JSON, including node 'label' and 'description' fields and 'functions' descriptions, must be the SAME language as the input script. Do not translate the text.

        The JSON object should have two keys: "flowchart" and "functions".

        1.  "flowchart": This should contain "nodes" and "edges" to build a directed graph.
            - "nodes" is an array of objects. Each node must have a unique "id", a "label" (max 5 words), a "type", and an optional "description".
            - The "description" for each node should be a one-sentence explanation of the step, providing more context than the label. It should be extracted or summarized from the script.
            - "edges" is an array of objects connecting nodes. Each edge must have a "source" and "target" corresponding to node IDs.

        2.  "functions": This should be an array of strings. Each string is a description of a necessary helper function implied by the script.

        Here is the script:
        ---
        ${script}
        ---
    `;

    while (attempt < maxRetries) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });

            const jsonText = response.text.trim();
            const parsedData = JSON.parse(jsonText);

            // Comprehensive validation
            const { flowchart, functions } = parsedData;

            if (!flowchart || typeof flowchart !== 'object' ||
                !Array.isArray(flowchart.nodes) ||
                !Array.isArray(flowchart.edges) ||
                !Array.isArray(functions)) {
                throw new Error("Invalid data structure: The AI response is missing key components or has incorrect types.");
            }

            const nodeIds = new Set(flowchart.nodes.map((node: any) => {
                if (!node || typeof node.id !== 'string' || typeof node.label !== 'string' || typeof node.type !== 'string') {
                    throw new Error("Invalid node data: Each node must have a valid 'id', 'label', and 'type'.");
                }
                if (!['start', 'process', 'decision', 'end'].includes(node.type)) {
                    throw new Error(`Invalid node type: Node '${node.id}' has an unsupported type '${node.type}'.`);
                }
                return node.id;
            }));

            for (const edge of flowchart.edges) {
                if (!edge || typeof edge.source !== 'string' || typeof edge.target !== 'string') {
                    throw new Error("Invalid edge data: Each edge must have a 'source' and 'target'.");
                }
                if (!nodeIds.has(edge.source)) {
                    throw new Error(`Data integrity issue: Edge references a non-existent source node with ID '${edge.source}'.`);
                }
                if (!nodeIds.has(edge.target)) {
                    throw new Error(`Data integrity issue: Edge references a non-existent target node with ID '${edge.target}'.`);
                }
            }
            
            return parsedData as GeminiResponse; // Success, exit the loop

        } catch (error) {
            attempt++;
            console.error(`Attempt ${attempt} failed.`, error);

            const isRateLimitError = error instanceof Error && error.message.includes('429');

            if (isRateLimitError && attempt < maxRetries) {
                console.log(`Rate limit hit. Retrying in ${delayMs / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
                delayMs *= 2; // Exponential backoff for the next retry
            } else {
                // This was the last attempt, or it was not a rate-limit error
                let finalErrorMessage = "An unknown error occurred while communicating with the AI.";
                if (error instanceof Error) {
                    finalErrorMessage = error.message;
                    // Attempt to parse the error message as JSON to find a cleaner message from the API
                    try {
                        const jsonMatch = finalErrorMessage.match(/({.*})/s);
                        if (jsonMatch && jsonMatch[1]) {
                            const errorJson = JSON.parse(jsonMatch[1]);
                            if (errorJson?.error?.message) {
                                finalErrorMessage = errorJson.error.message;
                            }
                        }
                    } catch (e) {
                        // Parsing failed, stick with the original or already parsed message
                    }
                }
                
                const message = `Failed to generate flowchart: ${finalErrorMessage}`;
                throw new Error(message);
            }
        }
    }

    // This line is reached only if all retries were rate-limit errors
    throw new Error("Failed to generate flowchart after multiple attempts. The API is busy, please try again later.");
};
