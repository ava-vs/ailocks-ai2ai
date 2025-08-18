// English comment: Using type-only imports for types as required by verbatimModuleSyntax.
import type { Handler, HandlerEvent } from "@netlify/functions";

/**
 * English comment: Helper function to create a standardized JSON response with CORS headers.
 * @param statusCode - The HTTP status code.
 * @param body - The response body, which will be automatically stringified.
 * @returns A Netlify handler response object.
 */
const jsonResp = (statusCode: number, body: object) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*', // Allow requests from any origin
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  },
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Global storage for created orders (in a real application this would be in a database)
// Using a global variable to simulate storage between function calls
let createdOrders: any[] = [];

// Function to add a new order to the storage
export const addCreatedOrder = (order: any) => {
  createdOrders.push(order);
  console.log(`New order added to storage, ID: ${order.id}, total orders: ${createdOrders.length}`);
};

// Mock data for testing
const generateMockOrders = () => {
  const now = new Date();
  
  const baseOrders = [
    {
      id: 'mock-order-3',
      title: 'Eco-Fashion Collection',
      description: 'A capsule collection of 12 items, combining Australian minimalism and Brazilian vibrancy. Eco-friendly materials, limited edition.',
      status: 'in-progress',
      progress: 40,
      amount: 2500,
      fundingGoal: 8000,
      currency: 'USD',
      cashback: '150%',
      minContribution: 200,
      investorCount: 24,
      daysLeft: 14,
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      author: {
        name: 'Lirea',
        level: 5,
        rating: 4.8,
        projectCount: 12,
        profession: 'eco-fashion, sustainable fashion'
      },
      projectRisks: 'Potential Risks:\n\nDelays in eco-friendly material deliveries\nProduction cost increase - if prices rise more than 15%, additional fundraising up to $2,000 will be launched or cost revision while maintaining 150% return\nSeasonal demand fluctuations\n\nGuarantees:\n\n150% return in collection products\nExclusive access to future collections\nProject insurance through platform\nDesigner experience: 12 successful projects',
      milestones: [
        {
          id: 'milestone-1-mock-order-3',
          description: 'Design and Development (2 weeks)',
          amount: 1500,
          deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'in-progress'
        },
        {
          id: 'milestone-2-mock-order-3',
          description: 'Sample Production (3 weeks)',
          amount: 2000,
          deadline: new Date(now.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        },
        {
          id: 'milestone-3-mock-order-3',
          description: 'Production Launch (4 weeks)',
          amount: 3500,
          deadline: new Date(now.getTime() + 63 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        },
        {
          id: 'milestone-4-mock-order-3',
          description: 'Packaging and Shipping (1 week)',
          amount: 1000,
          deadline: new Date(now.getTime() + 70 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        }
      ],
      recentInvestors: [
        {
          id: 'investor-1',
          name: 'Alex Smith',
          amount: 500,
          date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'investor-2',
          name: 'Maria Johnson',
          amount: 350,
          date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'investor-3',
          name: 'David Lee',
          amount: 800,
          date: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
        }
      ]
    },
    {
      id: 'mock-order-1',
      title: 'Website Development',
      description: 'Creating a modern website with responsive design and CMS integration',
      status: 'in-progress',
      progress: 35,
      amount: 2500,
      currency: 'USD',
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      milestones: [
        {
          id: 'milestone-1-mock-order-1',
          description: 'Design and prototyping',
          amount: 750,
          deadline: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'completed'
        },
        {
          id: 'milestone-2-mock-order-1',
          description: 'Frontend development',
          amount: 1000,
          deadline: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'in-progress'
        },
        {
          id: 'milestone-3-mock-order-1',
          description: 'Backend integration and testing',
          amount: 750,
          deadline: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        }
      ]
    },
    {
      id: 'mock-order-2',
      title: 'iOS Mobile Application',
      description: 'Development of a native iOS application for task and project management',
      status: 'created',
      progress: 0,
      amount: 4000,
      currency: 'USD',
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      milestones: [
        {
          id: 'milestone-1-mock-order-2',
          description: 'UX/UI Design',
          amount: 1000,
          deadline: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        },
        {
          id: 'milestone-2-mock-order-2',
          description: 'MVP Development',
          amount: 2000,
          deadline: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        },
        {
          id: 'milestone-3-mock-order-2',
          description: 'Testing and App Store publication',
          amount: 1000,
          deadline: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        }
      ]
    }
  ];
  
  // Combine base orders with user-created ones
  return [...baseOrders, ...createdOrders];
};

export const handler: Handler = async (event: HandlerEvent) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  // Basic validation
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }), headers: { ...corsHeaders, 'Content-Type': 'application/json' } };
  }

  try {
    // In a real function, there would be code here to get user orders from a database or API
    // For testing, we return mock data
    const mockOrders = generateMockOrders();
    
    console.log('Возвращаем мок-заказы для тестирования:', mockOrders.length);
    
    return jsonResp(200, { orders: mockOrders });
  } catch (error: any) {
    console.error('Failed to get user orders:', error.message);
    return jsonResp(500, { error: 'Failed to get user orders', details: error.message });
  }
};
