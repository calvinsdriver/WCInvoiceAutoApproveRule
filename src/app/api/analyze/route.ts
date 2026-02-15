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
          content: `You analyze structured claim data against a business rule described in natural language.
You must respond strictly as a single JSON object with this exact shape:
{"match": true, "reason": ""} if the payload matches the rule.
{"match": false, "reason": "<short business-style explanation>"} if the payload does not match the rule.
The reason must use only business language about the claim or scenario, without mentioning JSON, field names, or technical terms.`,
        },
        {
          role: 'user',
          content: `Prompt: ${prompt}\n\nJSON Payload: ${JSON.stringify(payload, null, 2)}`,
        },
      ],
      temperature: 0,
    });

    const raw = response.choices[0].message.content?.trim() || '';

    let match = false;
    let reason = '';

    try {
      const parsed = JSON.parse(raw) as { match?: boolean; reason?: string };
      if (typeof parsed.match === 'boolean') {
        match = parsed.match;
      }
      if (typeof parsed.reason === 'string') {
        reason = parsed.reason;
      }
    } catch {
      if (raw.toLowerCase() === 'null') {
        match = true;
      } else {
        reason = raw;
      }
    }

    if (match) {
      return new NextResponse(null, {
        status: 204,
      });
    }

    return new NextResponse(JSON.stringify(reason || raw), {
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
