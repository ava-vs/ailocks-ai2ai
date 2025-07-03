import type { Handler } from '@netlify/functions';
import { db } from '../../src/lib/db';
import { intents } from '../../src/lib/schema';
import { eq, or, isNull, sql, and } from 'drizzle-orm';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { searchParams } = new URL(event.rawUrl);
    const country = searchParams.get('country') || 'BR';
    const city = searchParams.get('city') || 'Rio de Janeiro';
    const skills = searchParams.get('skills')?.split(',') || [];
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build base query conditions
    const baseConditions = [
      or(
        eq(intents.targetCountry, country),
        isNull(intents.targetCountry)
      ),
      eq(intents.status, 'active')
    ];

    // Add category filter if specified
    if (category) {
      baseConditions.push(eq(intents.category, category));
    }

    // Build query for location-aware matching
    const query = db
      .select({
        id: intents.id,
        title: intents.title,
        description: intents.description,
        category: intents.category,
        requiredSkills: intents.requiredSkills,
        budget: intents.budget,
        timeline: intents.timeline,
        priority: intents.priority,
        createdAt: intents.createdAt,
        // Calculate distance score (simplified)
        locationScore: sql<number>`
          CASE 
            WHEN target_country = ${country} AND target_city = ${city} THEN 100
            WHEN target_country = ${country} THEN 80
            WHEN target_country IS NULL THEN 60
            ELSE 20
          END
        `
      })
      .from(intents)
      .where(and(...baseConditions))
      .orderBy(sql`location_score DESC, created_at DESC`)
      .limit(limit);

    const results = await query;

    // Calculate skill matching scores
    const enrichedResults = results.map(intent => {
      let skillScore = 0;
      if (skills.length > 0 && intent.requiredSkills) {
        const matchingSkills = intent.requiredSkills.filter(skill => 
          skills.some(userSkill => 
            skill.toLowerCase().includes(userSkill.toLowerCase()) ||
            userSkill.toLowerCase().includes(skill.toLowerCase())
          )
        );
        skillScore = (matchingSkills.length / intent.requiredSkills.length) * 100;
      }

      return {
        ...intent,
        matchScore: Math.round((intent.locationScore + skillScore) / 2),
        distance: intent.locationScore === 100 ? '< 1 mile' : 
                 intent.locationScore === 80 ? `${Math.floor(Math.random() * 50) + 10} miles` :
                 intent.locationScore === 60 ? 'Remote' : 'International'
      };
    });

    // Sort by match score
    enrichedResults.sort((a, b) => b.matchScore - a.matchScore);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        intents: enrichedResults,
        location: { country, city },
        totalCount: enrichedResults.length
      })
    };

  } catch (error) {
    console.error('Intent matching error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to match intents',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};