import type { Handler } from '@netlify/functions';
import { db } from '../../src/lib/db';
import { users, intents } from '../../src/lib/schema';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Create sample users
    const sampleUsers = await db.insert(users).values([
      {
        email: 'john.smith@example.com',
        name: 'John Smith',
        country: 'US',
        city: 'New York',
        timezone: 'America/New_York',
        languages: ['en']
      },
      {
        email: 'anna.petrov@example.com', 
        name: 'Anna Petrov',
        country: 'RU',
        city: 'Moscow',
        timezone: 'Europe/Moscow',
        languages: ['ru', 'en']
      },
      {
        email: 'maria.garcia@example.com',
        name: 'Maria Garcia',
        country: 'ES',
        city: 'Madrid',
        timezone: 'Europe/Madrid',
        languages: ['es', 'en']
      },
      {
        email: 'david.chen@example.com',
        name: 'David Chen',
        country: 'CN',
        city: 'Shanghai',
        timezone: 'Asia/Shanghai',
        languages: ['zh', 'en']
      },
      {
        email: 'sarah.johnson@example.com',
        name: 'Sarah Johnson',
        country: 'CA',
        city: 'Toronto',
        timezone: 'America/Toronto',
        languages: ['en', 'fr']
      }
    ]).returning();

    // Create diverse sample intents across different locations and categories
    const sampleIntents = await db.insert(intents).values([
      {
        userId: sampleUsers[0].id,
        title: 'AI Startup Collaboration',
        description: 'Looking for AI developers to build next-gen chatbot platform with advanced NLP capabilities. Need expertise in React, Python, and machine learning frameworks.',
        category: 'Technology',
        targetCountry: 'US',
        targetCity: 'New York',
        requiredSkills: ['React', 'Python', 'Machine Learning', 'NLP', 'TensorFlow'],
        budget: 75000,
        timeline: '3-6 months',
        priority: 'urgent'
      },
      {
        userId: sampleUsers[1].id,
        title: 'Market Research Project',
        description: 'Need experienced researcher for consumer behavior analysis in tech sector. Focus on emerging markets and digital transformation trends.',
        category: 'Research', 
        targetCountry: 'RU',
        targetCity: 'Moscow',
        requiredSkills: ['Analytics', 'Statistics', 'Survey Design', 'Data Visualization'],
        budget: 20000,
        timeline: '2-3 months',
        priority: 'medium'
      },
      {
        userId: sampleUsers[2].id,
        title: 'UX/UI Design for Fintech App',
        description: 'Seeking creative UX/UI designer for innovative mobile banking application. Must have experience with financial services and regulatory compliance.',
        category: 'Design',
        targetCountry: 'ES',
        targetCity: 'Madrid',
        requiredSkills: ['Figma', 'UX Research', 'Mobile Design', 'Fintech', 'Prototyping'],
        budget: 35000,
        timeline: '4-5 months',
        priority: 'medium'
      },
      {
        userId: sampleUsers[3].id,
        title: 'Blockchain Development Partnership',
        description: 'DeFi protocol seeking smart contract developers for new lending platform. Experience with Solidity and Web3 technologies required.',
        category: 'Blockchain',
        targetCountry: 'CN',
        targetCity: 'Shanghai',
        requiredSkills: ['Solidity', 'Web3', 'DeFi', 'Smart Contracts', 'Ethereum'],
        budget: 90000,
        timeline: '6-8 months',
        priority: 'high'
      },
      {
        userId: sampleUsers[4].id,
        title: 'Data Science Consulting',
        description: 'Healthcare startup needs data scientist for predictive analytics implementation. Focus on patient outcome prediction and treatment optimization.',
        category: 'Analytics',
        targetCountry: 'CA',
        targetCity: 'Toronto',
        requiredSkills: ['Python', 'R', 'Healthcare Data', 'Predictive Modeling', 'SQL'],
        budget: 55000,
        timeline: '4-6 months',
        priority: 'medium'
      },
      {
        userId: sampleUsers[0].id,
        title: 'E-commerce Platform Development',
        description: 'Building next-generation e-commerce platform with AI-powered recommendations. Need full-stack developers with cloud experience.',
        category: 'Technology',
        targetCountry: 'US',
        targetCity: 'San Francisco',
        requiredSkills: ['Node.js', 'React', 'AWS', 'MongoDB', 'AI/ML'],
        budget: 120000,
        timeline: '8-12 months',
        priority: 'high'
      },
      {
        userId: sampleUsers[1].id,
        title: 'Content Strategy for Tech Startup',
        description: 'Looking for content strategist to develop comprehensive content marketing strategy for B2B SaaS platform.',
        category: 'Marketing',
        targetCountry: null, // Remote opportunity
        targetCity: null,
        requiredSkills: ['Content Strategy', 'B2B Marketing', 'SEO', 'Technical Writing'],
        budget: 25000,
        timeline: '2-4 months',
        priority: 'medium'
      },
      {
        userId: sampleUsers[2].id,
        title: 'Mobile App Security Audit',
        description: 'Need cybersecurity expert to conduct comprehensive security audit of mobile banking application before launch.',
        category: 'Security',
        targetCountry: 'ES',
        targetCity: 'Barcelona',
        requiredSkills: ['Cybersecurity', 'Mobile Security', 'Penetration Testing', 'Compliance'],
        budget: 40000,
        timeline: '1-2 months',
        priority: 'urgent'
      },
      {
        userId: sampleUsers[3].id,
        title: 'AI Research Collaboration',
        description: 'Academic research project on computer vision applications in autonomous vehicles. Looking for PhD-level researchers.',
        category: 'Research',
        targetCountry: 'CN',
        targetCity: 'Beijing',
        requiredSkills: ['Computer Vision', 'Deep Learning', 'Autonomous Systems', 'Research'],
        budget: 60000,
        timeline: '12-18 months',
        priority: 'low'
      },
      {
        userId: sampleUsers[4].id,
        title: 'DevOps Infrastructure Setup',
        description: 'Startup needs DevOps engineer to set up scalable cloud infrastructure and CI/CD pipelines for rapid growth.',
        category: 'Technology',
        targetCountry: 'CA',
        targetCity: 'Vancouver',
        requiredSkills: ['DevOps', 'Kubernetes', 'Docker', 'CI/CD', 'Cloud Architecture'],
        budget: 70000,
        timeline: '3-4 months',
        priority: 'high'
      }
    ]).returning();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        message: 'Database seeded successfully',
        users: sampleUsers.length,
        intents: sampleIntents.length,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Database seeding error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to seed database',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};