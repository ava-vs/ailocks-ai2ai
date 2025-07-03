import type { Handler } from '@netlify/functions';
import { db } from '../../src/lib/db';
import { users, intents } from '../../src/lib/schema';

type User = typeof users.$inferSelect;

// This function is a port of scripts/seed-demo.cjs to work as a Netlify Function
// It allows seeding the production database by calling an API endpoint.
// It will now ALWAYS clear the database before seeding to ensure a fresh demo state.

export const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method Not Allowed. Please use POST.' })
        };
    }

    console.log('🌱 Starting enhanced demo database seeding via API with 50 intents...');
  
    try {
        console.log('🧹 Cleaning existing data for a fresh demo setup...');
        await db.delete(intents); // Delete intents first due to foreign key constraints
        await db.delete(users);
        console.log('✅ Existing data cleared');

        console.log('👥 Creating a diverse set of 20 demo users...');
        const demoUsersData = [
          // Main characters for the demo scenario
          { email: 'lirea.designer@example.com', name: 'Lirea', country: 'PT', city: 'Lisbon', timezone: 'Europe/Lisbon', languages: ['pt', 'en'] },
          { email: 'marco.manager@fintechrio.com', name: 'Marco', country: 'BR', city: 'Rio de Janeiro', timezone: 'America/Sao_Paulo', languages: ['pt', 'en'] },
          // Diverse users from around the world
          { email: 'sanjay.ai@ml-india.com', name: 'Sanjay', country: 'IN', city: 'Bangalore', timezone: 'Asia/Kolkata', languages: ['en', 'hi'] },
          { email: 'amara.dev@lagos-tech.ng', name: 'Amara', country: 'NG', city: 'Lagos', timezone: 'Africa/Lagos', languages: ['en', 'yo'] },
          { email: 'kenji.gamedev@tokyo-creative.jp', name: 'Kenji', country: 'JP', city: 'Tokyo', timezone: 'Asia/Tokyo', languages: ['ja', 'en'] },
          { email: 'sofia.web3@berlin-crypto.de', name: 'Sofia', country: 'DE', city: 'Berlin', timezone: 'Europe/Berlin', languages: ['de', 'en'] },
          { email: 'david.marketing@boston-growth.com', name: 'David', country: 'US', city: 'Boston', timezone: 'America/New_York', languages: ['en'] },
          { email: 'chloe.research@sorbonne.fr', name: 'Chloe', country: 'FR', city: 'Paris', timezone: 'Europe/Paris', languages: ['fr', 'en'] },
          { email: 'omar.ecom@dubai-ventures.ae', name: 'Omar', country: 'AE', city: 'Dubai', timezone: 'Asia/Dubai', languages: ['ar', 'en'] },
          { email: 'fatima.health@nairobi-innovate.ke', name: 'Fatima', country: 'KE', city: 'Nairobi', timezone: 'Africa/Nairobi', languages: ['en', 'sw'] },
          { email: 'liam.cyber@london-security.co.uk', name: 'Liam', country: 'UK', city: 'London', timezone: 'Europe/London', languages: ['en'] },
          { email: 'isabella.travel@baires-tech.ar', name: 'Isabella', country: 'AR', city: 'Buenos Aires', timezone: 'America/Argentina/Buenos_Aires', languages: ['es', 'en'] },
          { email: 'mateo.edtech@bogota-edu.co', name: 'Mateo', country: 'CO', city: 'Bogota', timezone: 'America/Bogota', languages: ['es', 'en'] },
          { email: 'anya.data@warsaw-analytics.pl', name: 'Anya', country: 'PL', city: 'Warsaw', timezone: 'Europe/Warsaw', languages: ['pl', 'en'] },
          { email: 'carlos.iot@mexico-innovate.mx', name: 'Carlos', country: 'MX', city: 'Mexico City', timezone: 'America/Mexico_City', languages: ['es', 'en'] },
          { email: 'wei.smartcity@sg-gov.sg', name: 'Wei', country: 'SG', city: 'Singapore', timezone: 'Asia/Singapore', languages: ['en', 'zh'] },
          { email: 'elena.vr@moscow-realities.ru', name: 'Elena', country: 'RU', city: 'Moscow', timezone: 'Europe/Moscow', languages: ['ru', 'en'] },
          { email: 'jakob.green@stockholm-sustain.se', name: 'Jakob', country: 'SE', city: 'Stockholm', timezone: 'Europe/Stockholm', languages: ['sv', 'en'] },
          { email: 'zoe.food@sydney-eats.au', name: 'Zoe', country: 'AU', city: 'Sydney', timezone: 'Australia/Sydney', languages: ['en'] },
          { email: 'aditya.saas@jakarta-growth.id', name: 'Aditya', country: 'ID', city: 'Jakarta', timezone: 'Asia/Jakarta', languages: ['id', 'en'] },
        ];
        
        const insertedUsers: User[] = [];
        for (const userData of demoUsersData) {
          const [insertedUser] = await db.insert(users).values(userData).returning();
          insertedUsers.push(insertedUser);
        }
        const demoUsers = insertedUsers;
        console.log(`✅ Created ${demoUsers.length} users`);

        const userMap = demoUsers.reduce((acc: Record<string, string>, user) => {
          if (user.name) {
            acc[user.name] = user.id;
          }
          return acc;
        }, {});

        console.log('🎯 Creating 50 realistic and diverse intents...');
        
        const demoIntentsData = [
          // --- DEMO SCENARIO INTENTS ---
          {
            userId: userMap['Marco'],
            title: 'UX/UI Design for Fintech App',
            description: 'Seeking a creative UX/UI designer for an innovative mobile banking application. Must have experience with financial services and a strong portfolio. This is a key role for our new product launch in Rio de Janeiro.',
            category: 'Design',
            targetCountry: 'BR',
            targetCity: 'Rio de Janeiro',
            requiredSkills: ['Figma', 'UX Research', 'Mobile Design', 'Fintech', 'Prototyping'],
            budget: 45000,
            timeline: '3-4 months',
            priority: 'high',
            status: 'active'
          },
          {
            userId: userMap['Lirea'],
            title: 'Design Tours with an Australian Perspective in Rio',
            description: 'As a designer who has recently relocated, I want to create unique design tours that showcase an Australian perspective on aesthetics, exploring the most beautiful and inspiring places in Rio. Looking for a local partner to handle logistics and co-host.',
            category: 'Travel',
            targetCountry: 'BR',
            targetCity: 'Rio de Janeiro',
            requiredSkills: ['Tour Design', 'Cultural Perspective', 'Aesthetics', 'Local Knowledge', 'Event Planning'],
            budget: 15000,
            timeline: 'Ongoing',
            priority: 'medium',
            status: 'active'
          },

          // --- TECHNOLOGY (11) ---
          { userId: userMap['Sanjay'], title: 'Need AI Engineer for Recommendation Engine', description: 'Our e-commerce platform requires an AI/ML engineer to build a personalized recommendation engine. Experience with collaborative filtering and deep learning is a must.', category: 'Technology', targetCountry: 'IN', targetCity: 'Bangalore', requiredSkills: ['Python', 'TensorFlow', 'PyTorch', 'Recommender Systems'], budget: 60000, timeline: '6 months', priority: 'high', status: 'active' },
          { userId: userMap['Amara'], title: 'Offering Expert Flutter Development Services', description: 'I am a senior Flutter developer with 5+ years of experience building beautiful, high-performance cross-platform apps for clients in Africa and globally. Let\'s build your next big idea.', category: 'Technology', targetCountry: null, targetCity: null, requiredSkills: ['Flutter', 'Dart', 'Firebase', 'Mobile UI/UX'], budget: null, timeline: 'Flexible', priority: 'medium', status: 'active' },
          { userId: userMap['Sofia'], title: 'Looking for Rust Developer for High-Frequency Trading System', description: 'We are a Berlin-based fintech firm building a next-gen HFT system. We require a Rust developer with a deep understanding of low-latency systems and concurrency.', category: 'Technology', targetCountry: 'DE', city: 'Berlin', requiredSkills: ['Rust', 'Low-latency', 'Concurrency', 'Tokyo-codec'], budget: 120000, timeline: 'Long-term', priority: 'urgent', status: 'active' },
          { userId: userMap['Carlos'], title: 'IoT Specialist for Smart Agriculture Project in Mexico', description: 'Seeking an IoT engineer to develop and deploy sensor networks for a smart agriculture project aimed at optimizing water usage and crop yields in rural Mexico.', category: 'Technology', targetCountry: 'MX', city: 'Guadalajara', requiredSkills: ['IoT', 'MQTT', 'Raspberry Pi', 'Arduino', 'Sensor Networks'], budget: 40000, timeline: '5 months', priority: 'high', status: 'active' },
          { userId: userMap['Elena'], title: 'VR Developer for Immersive Historical Moscow Tour', description: 'We are creating a VR experience to walk through 19th-century Moscow. Need a Unity/Unreal developer skilled in creating realistic environments and interactive narratives.', category: 'Technology', targetCountry: 'RU', city: 'Moscow', requiredSkills: ['Unity', 'Unreal Engine', 'VR', '3D Modeling', 'C#'], budget: 55000, timeline: '7 months', priority: 'medium', status: 'active' },
          { userId: userMap['Aditya'], title: 'Full-Stack JavaScript Developer Needed for SaaS Platform', description: 'Our growing SaaS company in Jakarta is looking for a skilled full-stack developer (Node.js, React) to join our core product team.', category: 'Technology', targetCountry: 'ID', city: 'Jakarta', requiredSkills: ['Node.js', 'React', 'TypeScript', 'PostgreSQL', 'AWS'], budget: 35000, timeline: 'Full-time', priority: 'high', status: 'active' },
          { userId: userMap['Mateo'], title: 'Python/Django Developer for EdTech Platform', description: 'I am a Python/Django developer offering my expertise to build scalable and robust educational technology platforms. Based in Bogota, open to remote collaboration.', category: 'Technology', targetCountry: null, targetCity: null, requiredSkills: ['Python', 'Django', 'DRF', 'EdTech'], budget: null, timeline: 'Per project', priority: 'medium', status: 'active' },
          { userId: userMap['Wei'], title: 'Request for Proposal: Urban Data Analytics Platform', description: 'The Singapore Smart City Initiative is seeking proposals for the development of a unified urban data analytics platform. Focus on transport, energy, and waste management data.', category: 'Technology', targetCountry: 'SG', city: 'Singapore', requiredSkills: ['Big Data', 'Data Analytics', 'GIS', 'Urban Planning'], budget: 250000, timeline: '12 months', priority: 'high', status: 'active' },
          { userId: userMap['Amara'], title: 'Android Developer for Micro-Loan App in Lagos', description: 'Fintech startup focused on financial inclusion needs an Android native developer to improve and maintain our micro-lending application for the Nigerian market.', category: 'Technology', targetCountry: 'NG', city: 'Lagos', requiredSkills: ['Android', 'Kotlin', 'Fintech', 'Mobile Security'], budget: 30000, timeline: '6+ months', priority: 'high', status: 'active' },
          { userId: userMap['Sofia'], title: 'Senior DevOps Engineer (Kubernetes, Terraform)', description: 'I provide DevOps consulting services to help companies scale their infrastructure efficiently and securely. Specializing in Kubernetes, Terraform, and CI/CD pipelines. Open to remote contracts.', category: 'Technology', targetCountry: null, targetCity: null, requiredSkills: ['DevOps', 'Kubernetes', 'Terraform', 'CI/CD', 'GCP'], budget: null, timeline: 'Flexible', priority: 'normal', status: 'active' },
          { userId: userMap['Sanjay'], title: 'Machine Learning Model Optimization Project', description: 'Seeking data scientists specializing in ML model optimization and performance tuning for a large-scale deployment.', category: 'Technology', targetCountry: 'IN', city: 'Pune', requiredSkills: ['Machine Learning', 'Performance Tuning', 'Python'], budget: 40000, timeline: '3 months', priority: 'high', status: 'active' },

          // --- DESIGN (5) ---
          { userId: userMap['Kenji'], title: '3D Character Artist for JRPG Game', description: 'Indie game studio in Tokyo is looking for a talented 3D character artist with an anime/JRPG art style. Must be proficient in ZBrush and Blender.', category: 'Design', targetCountry: 'JP', city: 'Tokyo', requiredSkills: ['3D Modeling', 'ZBrush', 'Blender', 'Character Design', 'Game Art'], budget: 50000, timeline: '8 months', priority: 'high', status: 'active' },
          { userId: userMap['David'], title: 'Branding and Identity Design for a Boston Startup', description: 'Early-stage startup in the biotech space needs a complete branding package: logo, identity guidelines, and initial marketing materials.', category: 'Design', targetCountry: 'US', city: 'Boston', requiredSkills: ['Branding', 'Logo Design', 'Graphic Design', 'Marketing'], budget: 25000, timeline: '2 months', priority: 'high', status: 'active' },
          { userId: userMap['Isabella'], title: 'Freelance Illustrator for Travel Blog Content', description: 'I run a travel blog focused on South America and I am looking for an illustrator to create custom artwork for my articles. Offering ongoing work.', category: 'Design', targetCountry: 'AR', city: 'Buenos Aires', requiredSkills: ['Illustration', 'Graphic Design', 'Storytelling'], budget: 5000, timeline: 'Ongoing', priority: 'medium', status: 'active' },
          { userId: userMap['Liam'], title: 'UI Kit Designer for Enterprise SaaS Product', description: 'Seeking a designer to create a comprehensive and scalable UI kit in Figma for our complex enterprise security software.', category: 'Design', targetCountry: null, targetCity: null, requiredSkills: ['UI Design', 'Figma', 'Design Systems', 'SaaS'], budget: 30000, timeline: '3 months', priority: 'high', status: 'active' },
          { userId: userMap['Lirea'], title: 'Offering UX/UI Design & Prototyping Services', description: 'Experienced UX/UI designer specializing in creating intuitive and beautiful interfaces for web and mobile apps. Available for freelance projects worldwide.', category: 'Design', targetCountry: null, targetCity: null, requiredSkills: ['UX Design', 'UI Design', 'Figma', 'Prototyping'], budget: null, timeline: 'Flexible', priority: 'medium', status: 'active' },

          // --- RESEARCH (4) ---
          { userId: userMap['Chloe'], title: 'Collaboration on a Study of AI Ethics in Media', description: 'Academic researcher seeking collaborators for a paper on the ethical implications of generative AI in modern media. Open to co-authorship.', category: 'Research', targetCountry: 'FR', city: 'Paris', requiredSkills: ['AI Ethics', 'Media Studies', 'Academic Writing', 'Research'], budget: 10000, timeline: '6 months', priority: 'medium', status: 'active' },
          { userId: userMap['David'], title: 'UX Researcher for Biotech Patient Portal', description: 'Our Boston-based biotech firm needs a UX researcher to conduct user studies for a new patient-facing data portal. Healthcare experience is a plus.', category: 'Research', targetCountry: 'US', city: 'Boston', requiredSkills: ['UX Research', 'User Interviews', 'Healthcare', 'Data Analysis'], budget: 35000, timeline: '4 months', priority: 'high', status: 'active' },
          { userId: userMap['Anya'], title: 'Freelance Data Analyst for Market Research', description: 'Data analyst with expertise in statistical analysis (R, Python) and data visualization (Tableau) available for market research projects.', category: 'Research', targetCountry: null, targetCity: null, requiredSkills: ['Data Analysis', 'R', 'Python', 'Tableau', 'Statistics'], budget: null, timeline: 'Per project', priority: 'medium', status: 'active' },
          { userId: userMap['Jakob'], title: 'Need Researcher for Circular Economy Impact Study', description: 'Sustainability-focused organization in Stockholm is commissioning a study on the economic and environmental impact of circular economy models in Northern Europe.', category: 'Research', targetCountry: 'SE', city: 'Stockholm', requiredSkills: ['Sustainability', 'Circular Economy', 'Economic Modeling', 'Research'], budget: 45000, timeline: '5 months', priority: 'medium', status: 'active' },

          // --- MARKETING (6) ---
          { userId: userMap['Aditya'], title: 'Growth Hacker for B2B SaaS in Southeast Asia', description: 'We are looking for an experienced growth hacker to scale our user acquisition efforts for our new SaaS product across Southeast Asia.', category: 'Marketing', targetCountry: 'ID', city: 'Jakarta', requiredSkills: ['Growth Hacking', 'SaaS', 'B2B Marketing', 'User Acquisition', 'SEO'], budget: 30000, timeline: '6 months contract', priority: 'high', status: 'active' },
          { userId: userMap['Liam'], title: 'SEO Specialist for Cybersecurity Blog', description: 'Our cybersecurity firm needs an SEO expert to increase organic traffic and improve rankings for our technical blog content.', category: 'Marketing', targetCountry: 'UK', city: 'London', requiredSkills: ['SEO', 'Content Marketing', 'Cybersecurity', 'Technical SEO'], budget: 20000, timeline: 'Ongoing', priority: 'medium', status: 'active' },
          { userId: userMap['Omar'], title: 'PPC Campaign Manager for Luxury E-commerce', description: 'High-end e-commerce brand based in Dubai is seeking an expert PPC manager to handle a large budget across Google Ads and social media platforms.', category: 'Marketing', targetCountry: 'AE', city: 'Dubai', requiredSkills: ['PPC', 'Google Ads', 'Social Media Advertising', 'E-commerce'], budget: 50000, timeline: 'Full-time', priority: 'urgent', status: 'active' },
          { userId: userMap['Isabella'], title: 'Social Media Manager for Travel Tech App', description: 'I am a passionate social media manager specializing in the travel industry. I help brands tell compelling stories and engage with their audience. Based in Buenos Aires.', category: 'Marketing', targetCountry: null, targetCity: null, requiredSkills: ['Social Media', 'Content Creation', 'Community Management', 'Travel'], budget: null, timeline: 'Flexible', priority: 'medium', status: 'active' },
          { userId: userMap['Jakob'], title: 'Brand Storyteller for Sustainability Startup', description: 'Seeking a creative storyteller to craft our brand narrative and communicate our mission to a global audience. Must be passionate about sustainability.', category: 'Marketing', targetCountry: 'SE', city: 'Stockholm', requiredSkills: ['Brand Strategy', 'Storytelling', 'Content Creation', 'Sustainability'], budget: 40000, timeline: '4 months', priority: 'high', status: 'active' },
          { userId: userMap['David'], title: 'Content Strategist for Tech Companies', description: 'I help tech companies develop content strategies that drive leads and establish thought leadership. Available for remote consulting.', category: 'Marketing', targetCountry: null, targetCity: null, requiredSkills: ['Content Strategy', 'B2B Marketing', 'SEO', 'SaaS'], budget: null, timeline: 'Per project', priority: 'normal', status: 'active' },

          // --- BLOCKCHAIN (4) ---
          { userId: userMap['Sofia'], title: 'Smart Contract Auditor Needed Urgently', description: 'Our DeFi protocol is preparing for launch and requires an immediate, thorough audit of our Solidity smart contracts. Top-tier auditors only.', category: 'Blockchain', targetCountry: 'DE', city: 'Berlin', requiredSkills: ['Smart Contracts', 'Solidity', 'Security Audit', 'Blockchain'], budget: 75000, timeline: '3 weeks', priority: 'urgent', status: 'active' },
          { userId: userMap['Kenji'], title: 'Developer for an NFT-based Game Economy', description: 'We are integrating NFTs into our upcoming mobile game and need a developer with experience in ERC-721/1155 standards and Web3 integration.', category: 'Blockchain', targetCountry: null, targetCity: null, requiredSkills: ['NFT', 'Solidity', 'Web3.js', 'Game Development'], budget: 65000, timeline: '5 months', priority: 'high', status: 'active' },
          { userId: userMap['Liam'], title: 'Offering Web3 Community Management Services', description: 'Experienced community manager specializing in growing and engaging communities for Web3 and NFT projects on Discord and Twitter.', category: 'Blockchain', targetCountry: null, targetCity: null, requiredSkills: ['Community Management', 'Discord', 'Twitter', 'Web3'], budget: null, timeline: 'Flexible', priority: 'medium', status: 'active' },
          { userId: userMap['Sanjay'], title: 'Research Collaboration on Layer 2 Scaling Solutions', description: 'AI researcher exploring the application of machine learning for optimizing transaction routing on Layer 2 networks. Seeking blockchain experts for collaboration.', category: 'Blockchain', targetCountry: 'IN', city: 'Bangalore', requiredSkills: ['Blockchain', 'Layer 2', 'Research', 'Machine Learning'], budget: 25000, timeline: '6 months', priority: 'medium', status: 'active' },

          // --- HEALTH & WELLNESS (4) ---
          { userId: userMap['Fatima'], title: 'Mobile App for Maternal Health in Kenya', description: 'Non-profit seeking a mobile developer to build an app providing crucial maternal health information to women in rural Kenya. Social impact project.', category: 'Health', targetCountry: 'KE', city: 'Nairobi', requiredSkills: ['Mobile Development', 'React Native', 'Health Tech', 'Social Impact'], budget: 40000, timeline: '8 months', priority: 'high', status: 'active' },
          { userId: userMap['David'], title: 'Data Scientist for Predictive Analytics in Healthcare', description: 'Boston-based health-tech firm needs a data scientist to build predictive models for patient outcomes based on clinical data.', category: 'Health', targetCountry: 'US', city: 'Boston', requiredSkills: ['Data Science', 'Python', 'Predictive Modeling', 'Healthcare'], budget: 90000, timeline: 'Full-time', priority: 'high', status: 'active' },
          { userId: userMap['Anya'], title: 'Mental Wellness App Content Creator (Psychology background)', description: 'We are looking for content creators with a background in psychology to write scripts for guided meditations and wellness exercises for our app.', category: 'Health', targetCountry: null, targetCity: null, requiredSkills: ['Content Creation', 'Psychology', 'Mental Health', 'Writing'], budget: 15000, timeline: 'Ongoing', priority: 'medium', status: 'active' },
          { userId: userMap['Chloe'], title: 'I am a Medical Researcher available for collaborations', description: 'Medical researcher with a PhD in immunology, providing research and writing services for biotech companies and academic institutions.', category: 'Health', targetCountry: 'FR', city: 'Paris', requiredSkills: ['Medical Research', 'Immunology', 'Clinical Trials', 'Scientific Writing'], budget: null, timeline: 'Flexible', priority: 'medium', status: 'active' },

          // --- EDUCATION (4) ---
          { userId: userMap['Mateo'], title: 'Interactive Science Simulations for K-12 EdTech Platform', description: 'Our EdTech company in Bogota is looking for a developer/designer to create interactive science simulations (Physics, Chemistry) using JavaScript and WebGL.', category: 'Education', targetCountry: 'CO', city: 'Bogota', requiredSkills: ['JavaScript', 'WebGL', 'Three.js', 'Education', 'Simulations'], budget: 35000, timeline: '6 months', priority: 'high', status: 'active' },
          { userId: userMap['Sanjay'], title: 'AI-powered Language Learning App Tutor', description: 'Seeking experts in Natural Language Processing to help us build an AI tutor for our language learning application.', category: 'Education', targetCountry: null, targetCity: null, requiredSkills: ['NLP', 'AI', 'Language Technology', 'Python'], budget: 50000, timeline: '7 months', priority: 'high', status: 'active' },
          { userId: userMap['Chloe'], title: 'Curriculum Developer for History Courses', description: 'I am an experienced curriculum developer and historian, available to create engaging and accurate history courses for online platforms.', category: 'Education', targetCountry: null, targetCity: null, requiredSkills: ['Curriculum Development', 'History', 'E-learning', 'Instructional Design'], budget: null, timeline: 'Per course', priority: 'medium', status: 'active' },
          { userId: userMap['Fatima'], title: 'Need help building a platform for vocational training in Africa', description: 'We want to build a platform to connect young people in Africa with vocational training opportunities. Looking for technical and strategic partners.', category: 'Education', targetCountry: 'NG', city: 'Lagos', requiredSkills: ['EdTech', 'Platform Development', 'Social Impact', 'Business Strategy'], budget: 60000, timeline: '12 months', priority: 'high', status: 'active' },

          // --- MISC & CREATIVE (9) ---
          { userId: userMap['Zoe'], title: 'Food Tech Founder Seeking a Technical Co-founder', description: 'I have a validated idea for a sustainable food tech platform, but I need a technical co-founder to build the MVP. Based in Sydney.', category: 'Food-Tech', targetCountry: 'AU', city: 'Sydney', requiredSkills: ['Full-Stack', 'Entrepreneurship', 'Food Tech', 'Mobile App'], budget: null, timeline: 'Co-founder', priority: 'urgent', status: 'active' },
          { userId: userMap['Jakob'], title: 'Consultant for Corporate Sustainability Reporting', description: 'I help companies develop their sustainability strategy and prepare ESG reports in line with global standards. Open to consulting projects.', category: 'Sustainability', targetCountry: null, targetCity: null, requiredSkills: ['Sustainability', 'ESG', 'Corporate Strategy', 'Reporting'], budget: null, timeline: 'Flexible', priority: 'medium', status: 'active' },
          { userId: userMap['Isabella'], title: 'Partner for an Eco-Tourism Venture in Patagonia', description: 'Looking for a business partner to launch an eco-tourism company focused on sustainable travel in Patagonia. I have the local expertise, need a marketing/ops partner.', category: 'Travel', targetCountry: 'AR', city: 'Bariloche', requiredSkills: ['Tourism', 'Marketing', 'Operations', 'Sustainability'], budget: null, timeline: 'Co-founder', priority: 'high', status: 'active' },
          { userId: userMap['Omar'], title: 'Logistics and Supply Chain Optimization for E-commerce', description: 'Seeking a specialist to optimize our international supply chain and logistics for our rapidly growing e-commerce business in the Middle East.', category: 'E-commerce', targetCountry: 'AE', city: 'Dubai', requiredSkills: ['Logistics', 'Supply Chain', 'E-commerce', 'Operations'], budget: 70000, timeline: 'Full-time', priority: 'high', status: 'active' },
          { userId: userMap['Kenji'], title: 'Sound Designer for Indie Horror Game', description: 'Our indie game studio needs a sound designer to create an atmospheric and terrifying soundscape for our upcoming horror game.', category: 'Gaming', targetCountry: 'JP', city: 'Kyoto', requiredSkills: ['Sound Design', 'Game Audio', 'FMOD', 'Wwise'], budget: 20000, timeline: '4 months', priority: 'medium', status: 'active' },
          { userId: userMap['Carlos'], title: 'Firmware Engineer for a new line of Smart Home devices', description: 'We are developing a new line of IoT smart home devices and are looking for an experienced firmware engineer (C++, Embedded Linux).', category: 'Technology', targetCountry: 'MX', city: 'Mexico City', requiredSkills: ['Firmware', 'C++', 'Embedded Linux', 'IoT'], budget: 60000, timeline: 'Long-term', priority: 'high', status: 'active' },
          { userId: userMap['Elena'], title: 'Looking for writer for a Sci-Fi VR narrative', description: 'I\'m a VR developer creating a narrative-driven sci-fi experience. I need a talented writer to help me flesh out the story and write dialogue.', category: 'Gaming', targetCountry: null, targetCity: null, requiredSkills: ['Creative Writing', 'Narrative Design', 'Sci-Fi', 'Scriptwriting'], budget: 15000, timeline: '3 months', priority: 'medium', status: 'active' },
          { userId: userMap['Zoe'], title: 'Food Photographer for a new Restaurant in Sydney', description: 'Our new restaurant is opening soon and we need a professional food photographer to shoot our menu and venue for social media and press.', category: 'Food-Tech', targetCountry: 'AU', city: 'Sydney', requiredSkills: ['Photography', 'Food Styling', 'Social Media'], budget: 8000, timeline: '1 week project', priority: 'high', status: 'active' },
          { userId: userMap['Anya'], title: 'Data Visualization Expert (D3.js) for journalism project', description: 'Seeking a D3.js expert to create interactive data visualizations for a long-form investigative journalism piece. Remote work possible.', category: 'Analytics', targetCountry: null, targetCity: null, requiredSkills: ['Data Visualization', 'D3.js', 'JavaScript', 'Journalism'], budget: 25000, timeline: '2 months', priority: 'medium', status: 'active' },
        ];

        await db.insert(intents).values(demoIntentsData);
        
        const successMessage = `Database seeded successfully! Created ${demoUsers.length} users and ${demoIntentsData.length} intents.`;
        console.log(`🎉 ${successMessage}`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'success', message: successMessage })
        };
        
    } catch (error) {
        const errorMessage = (error as Error).message;
        console.error('❌ Demo database seeding failed:', errorMessage);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'error', message: errorMessage })
        };
    }
}; 
