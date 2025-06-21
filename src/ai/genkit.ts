
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

let aiInstance;

try {
  aiInstance = genkit({
    plugins: [googleAI()],
    model: 'googleai/gemini-2.0-flash',
  });
} catch (e) {
  console.error("!!! FAILED TO INITIALIZE GENKIT !!!", e);
  console.error("This may be due to a missing GOOGLE_API_KEY environment variable.");
  console.error("AI / GenAI features will not work.");
  // Create a dummy ai object to prevent crashes in other parts of the code that import 'ai'
  aiInstance = {
    defineFlow: (config: any, fn: any) => fn,
    definePrompt: (config: any) => (input: any) => Promise.resolve({ output: 'Genkit not initialized.' }),
    generate: (config: any) => Promise.resolve({ text: () => 'Genkit not initialized.' }),
    defineTool: (config: any, fn: any) => fn,
    model: (name: string) => ({ name }),
  };
}

export const ai = aiInstance as any;
