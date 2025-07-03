import type { Context } from '@netlify/functions';

async function fetchWithRetry(url: string, options: RequestInit, maxRetries: number = 3): Promise<Response> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries} to fetch signed URL from ElevenLabs...`);
      
      const response = await fetch(url, options);
      console.log(`✅ Attempt ${attempt} successful with status: ${response.status}`);
      return response;
      
    } catch (error: any) {
      lastError = error;
      console.warn(`❌ Attempt ${attempt} failed:`, error.message);
      
      // Check if it's a network error that we should retry
      const isNetworkError = error.message.includes('fetch failed') || 
                            error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
                            error.code === 'ECONNRESET' ||
                            error.code === 'ENOTFOUND';
      
      if (!isNetworkError || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

export default async (req: Request, context: Context) => {
  // Log all available environment variables for debugging
  // console.log("Available environment variables:", Object.keys(process.env));
  
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  const PUBLIC_AGENT_ID = process.env.PUBLIC_AGENT_ID;

  console.log(`Retrieved ELEVENLABS_API_KEY: ${ELEVENLABS_API_KEY ? 'found' : 'NOT FOUND'}`);
  console.log(`Retrieved PUBLIC_AGENT_ID: ${PUBLIC_AGENT_ID ? 'found' : 'NOT FOUND'}`);

  if (!ELEVENLABS_API_KEY) {
    console.error("Missing ELEVENLABS_API_KEY environment variable");
    return new Response(JSON.stringify({ error: "Server configuration error: Missing API Key. Check your .env file and Netlify settings." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  
  if (!PUBLIC_AGENT_ID) {
    console.error("Missing PUBLIC_AGENT_ID environment variable");
    return new Response(JSON.stringify({ error: "Server configuration error: Missing Agent ID. Check your .env file and Netlify settings." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const apiUrl = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${PUBLIC_AGENT_ID}`;
    
    console.log(`Fetching signed URL for agent: ${PUBLIC_AGENT_ID}`);

    const response = await fetchWithRetry(apiUrl, {
      method: 'GET',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
      },
    }, 3); // 3 attempts total

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs API responded with ${response.status}:`, errorText);
      return new Response(JSON.stringify({ error: `Failed to get signed URL from ElevenLabs. Status: ${response.status}`, details: errorText }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    if (!data.signed_url) {
        console.error("ElevenLabs response did not contain a signed_url:", data);
        return new Response(JSON.stringify({ error: "Invalid response from ElevenLabs API" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }

    console.log("✅ Successfully obtained signed URL from ElevenLabs");
    return new Response(JSON.stringify({ signedUrl: data.signed_url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-elevenlabs-signed-url function:', error);
    
    let errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    // Provide more specific error messages for network issues
    if (error instanceof Error && (error as any).cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      errorMessage = 'Could not connect to ElevenLabs API after multiple attempts (connection timeout). Please check your network connection and firewall settings.';
    } else if (error instanceof Error && error.message.includes('fetch failed')) {
      errorMessage = 'Network error: Unable to reach ElevenLabs servers after multiple retry attempts. Please check your internet connection.';
    }
    
    return new Response(JSON.stringify({ error: `Internal server error: ${errorMessage}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}; 