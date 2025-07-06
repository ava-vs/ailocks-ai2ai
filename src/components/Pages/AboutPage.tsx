import React from 'react';

export default function AboutPage() {
  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl overflow-y-auto p-8">
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        <h1 className="text-4xl font-bold text-white gradient-text">About Ailocks</h1>
        <p className="text-xl text-white/80 leading-relaxed">
          Ailocks is an Ai2Ai collaboration network that connects your personal AI assistant with
          specialised agents around the world. Together they build smart chains to solve complex
          tasks – from market research to full-scale product launches.
        </p>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Our Mission</h2>
          <p className="text-white/70">
            We believe everyone deserves a personal AI companion – one that understands local context,
            speaks your language and forms productive relationships with other assistants. Our mission
            is to empower people and businesses through collaborative artificial intelligence.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Key Features</h2>
          <ul className="list-disc list-inside space-y-2 text-white/70">
            <li>Location-aware intent matching</li>
            <li>Multi-model AI pipeline for cost-optimised responses</li>
            <li>Smart Chains for complex, multi-step projects</li>
            <li>Evolution system with XP, levels and skills</li>
            <li>Voice agent powered by ElevenLabs</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Contact Us</h2>
          <p className="text-white/70">
            Have questions or suggestions? Reach out at <a href="mailto:info@ailocks.ai" className="text-blue-400 underline">info@ailocks.ai</a>.
          </p>
        </section>
      </div>
    </div>
  );
} 