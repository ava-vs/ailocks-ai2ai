import type { Context } from '@netlify/edge-functions';

function detectLanguage(acceptLanguage: string | null, country: string | null): string {
  // Russian-speaking countries
  const russianCountries = ['RU', 'BY', 'KZ', 'KG', 'TJ', 'UZ', 'MD'];
  
  if (country && russianCountries.includes(country)) {
    return 'ru';
  }

  if (acceptLanguage) {
    const languages = acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim().toLowerCase());
    
    if (languages.some(lang => lang.startsWith('ru'))) {
      return 'ru';
    }
  }

  return 'en';
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  
  // Skip for API routes, static assets, and Netlify functions
  if (url.pathname.startsWith('/api/') || 
      url.pathname.startsWith('/.netlify/') ||
      url.pathname.includes('.') ||
      url.pathname.startsWith('/_astro/')) {
    return context.next();
  }

  // For now, don't redirect - just pass language info in headers
  // The React components will handle language switching client-side
  const acceptLang = request.headers.get('accept-language');
  const country = context.geo?.country?.code;
  const detectedLang = detectLanguage(acceptLang, country);
  
  const response = await context.next();
  
  // Add detected language to response headers for client-side use
  response.headers.set('X-Detected-Language', detectedLang);
  
  return response;
};

export const config = { path: '/*' };