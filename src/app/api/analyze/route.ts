import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// 1. Use the Edge Runtime for faster cold starts and lower latency on Vercel
export const runtime = 'edge';

// 2. Initialize the client outside the handler to reuse the connection across warm starts
const getXAIClient = () => {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey || apiKey === 'your_xai_api_key_here') {
    throw new Error('xAI API Key is missing');
  }
  return new OpenAI({
    apiKey: apiKey,
    baseURL: 'https://api.x.ai/v1',
  });
};

export async function POST(req: NextRequest) {
  try {
    const xai = getXAIClient();
    const body = await req.json();
    const { payload, prompt } = body;

    if (payload === undefined || !prompt) {
      return NextResponse.json(
        { error: 'Both "payload" and "prompt" are required in the request body.' },
        { status: 400 }
      );
    }

    // 3. Use a "Fast" model for significantly better performance and lower cost
    const response = await xai.chat.completions.create({
      model: 'grok-4-1-fast-non-reasoning',
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that analyzes JSON data based on a user-provided prompt.
Your goal is to determine if the JSON data matches the description or rules in the prompt.

Rules:
1. If the JSON payload matches what the prompt describes, respond ONLY with the string "null".
2. If the JSON payload DOES NOT match what the prompt describes, respond with a short, business-style explanation of why it does not match. Do not mention JSON, payloads, fields, booleans, or variable names. Talk only about the claim or business situation.
3. Do not include any other text, formatting, or markdown in your response.`,
        },
        {
          role: 'user',
          content: `Prompt: ${prompt}\n\nJSON Payload: ${JSON.stringify(payload, null, 2)}`,
        },
      ],
      temperature: 0,
    });

    const result = response.choices[0].message.content?.trim() || '';

    // If the model returns "null" (case-insensitive check but we asked for exactly "null")
    if (result.toLowerCase() === 'null') {
      return new NextResponse(null, {
        status: 204,
      });
    }

    // Otherwise return the explanation string
    return new NextResponse(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in analysis API:', error);

    // Provide specific help for SSL certificate issues
    if (error.message?.includes('unable to get local issuer certificate') || 
        error.cause?.message?.includes('unable to get local issuer certificate')) {
      return NextResponse.json(
        { 
          error: 'SSL Certificate Error', 
          details: 'Your local environment is unable to verify the xAI API SSL certificate. This is common in some corporate networks.',
          fix: 'Try running your app with: NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to analyze payload', details: error.message },
      { status: 500 }
    );
  }
}
