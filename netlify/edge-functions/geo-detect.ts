import type { Context } from '@netlify/edge-functions';

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);

  // Default to BR location if geo data is unavailable
  const country = context.geo?.country?.code || 'BR';
  const city = context.geo?.city || 'Rio de Janeiro';
  const timezone = context.geo?.timezone || 'America/Sao_Paulo';
  const region = context.geo?.subdivision?.code || 'RJ';
  
  const locationData = {
    country,
    city,
    timezone,
    region,
    // Corrected default coordinates to Rio de Janeiro
    latitude: context.geo?.latitude || -22.9068,
    longitude: context.geo?.longitude || -43.2045,
    isDefault: !context.geo?.country?.code
  };

  // If the request is for our API endpoint, return the location data as JSON.
  // This makes local development with `netlify dev` work as expected with the `useLocation` hook.
  if (url.pathname === '/api/geo-detect') {
    return new Response(JSON.stringify(locationData), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // For all other requests, add location data to headers and continue to the requested page.
  const response = await context.next();
  response.headers.set('X-User-Location', JSON.stringify(locationData));
  
  return response;
};

export const config = { path: '/*' };