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
  const response = await context.next();

  const acceptLang = request.headers.get('accept-language');
  const country = context.geo?.country?.code;

  // Ensure undefined values are converted to null for the function call
  const detectedLang = detectLanguage(acceptLang ?? null, country ?? null);
  
  // Set a cookie with the detected language
  response.headers.set('Set-Cookie', `nf_lang=${detectedLang}; Path=/; Max-Age=604800`); // 7 days

  return response;
};

export const config = { path: '/*' };