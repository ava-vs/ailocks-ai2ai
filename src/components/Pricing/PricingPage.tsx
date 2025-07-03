import { useState, useEffect } from 'react';
import { ArrowLeft, Check, Crown, Zap, Star, Database, Brain, Sparkles, X } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { currentLanguage, isClientInitialized } from '../../lib/store';
import Header from '../Header';
import StatusBar from '../StatusBar';

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  originalPrice?: string;
  discount?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  popular?: boolean;
  badge?: string | null;
  buttonText: string;
  buttonStyle: 'primary' | 'secondary' | 'premium';
  stripePriceId?: string;
  limits: {
    queries: number | 'unlimited';
    aiModels: string[];
    storage: string;
    support: string;
  };
}

export default function PricingPage() {
  const language = useStore(currentLanguage);
  const clientInitialized = useStore(isClientInitialized);
  const [isHydrated, setIsHydrated] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const getTexts = () => {
    const texts = {
      en: {
        title: 'Choose Your Plan',
        subtitle: 'Transform your AI collaboration experience',
        monthly: 'Monthly',
        yearly: 'Yearly',
        save: 'Save 20%',
        popular: 'Most Popular',
        currentPlan: 'Current Plan',
        upgrade: 'Upgrade Now',
        getStarted: 'Get Started',
        backToApp: 'Back to App',
        features: 'Features',
        whatYouGet: 'What you get:',
        faq: 'Frequently Asked Questions',
        contact: 'Contact Sales',
        freeTrial: '14-day free trial',
        noCommitment: 'No commitment, cancel anytime',
        limitedOffer: '40% OFF first 3 months',
        trustedBy: 'Trusted by 10,000+ professionals',
        reviews: '4.9/5 from 500+ reviews',
        plans: {
          free: {
            name: 'Starter',
            description: 'Perfect for getting started',
            features: [
              '50 AI queries per month',
              'Basic intent matching',
              'Standard chat interface',
              'Community support',
              'Basic collaboration tools'
            ],
            buttonText: 'Start Free Today',
            buttonStyle: 'secondary'
          },
          pro: {
            name: 'Professional',
            description: 'Advanced features',
            features: [
              '1,500 AI queries per month',
              'Semantic search with embeddings',
              'Smart intent matching', 
              'Voice Agent Interface',
              'Priority support',
              'Advanced analytics'
            ],
            buttonText: 'Try Pro for $6',
            buttonStyle: 'primary'
          },
          enterprise: {
            name: 'Enterprise',
            description: 'Full-scale solution',
            features: [
              'Unlimited AI queries',
              'All premium AI models', 
              'Video Agent Interface (Talvus)',
              'Custom integrations',
              'White-label solution',
              'Dedicated support'
            ],
            buttonText: 'Get Enterprise Demo',
            buttonStyle: 'premium'
          }
        },
        faqItems: [
          {
            question: 'Can I change my plan anytime?',
            answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.'
          },
          {
            question: 'What AI models are included?',
            answer: 'Free plan uses cost-optimized models. Pro includes GPT-4, Claude, and premium models. Enterprise gets access to all models including custom training.'
          },
          {
            question: 'Is there a free trial?',
            answer: 'Yes! Pro and Enterprise plans come with a 14-day free trial. No credit card required to start.'
          },
          {
            question: 'How does billing work?',
            answer: 'You\'re billed monthly or yearly based on your choice. Yearly plans save 20%. All payments are secure via Stripe.'
          }
        ]
      },
      ru: {
        title: 'Выберите план',
        subtitle: 'Улучшите свой опыт работы с ИИ',
        monthly: 'Ежемесячно',
        yearly: 'Ежегодно',
        save: 'Скидка 20%',
        popular: 'Популярный',
        currentPlan: 'Текущий план',
        upgrade: 'Обновить',
        getStarted: 'Начать',
        backToApp: 'Назад',
        features: 'Возможности',
        whatYouGet: 'Что вы получаете:',
        faq: 'Частые вопросы',
        contact: 'Связаться',
        freeTrial: '14-дневная пробная версия',
        noCommitment: 'Без обязательств',
        limitedOffer: 'Скидка 40% на первые 3 месяца',
        trustedBy: 'Нам доверяют более 10,000 профессионалов',
        reviews: '4.9/5 из более чем 500 отзывов',
        plans: {
          free: {
            name: 'Базовый',
            description: 'Для начала работы',
            features: [
              '50 запросов к ИИ в месяц',
              'Базовое сопоставление',
              'Стандартный интерфейс',
              'Поддержка сообщества',
              'Базовые инструменты'
            ],
            buttonText: 'Начать бесплатно',
            buttonStyle: 'secondary'
          },
          pro: {
            name: 'Профессиональный',
            description: 'Расширенные функции',
            features: [
              '1,500 запросов к ИИ в месяц',
              'Семантический поиск',
              'Умное сопоставление', 
              'Голосовой интерфейс',
              'Приоритетная поддержка',
              'Расширенная аналитика'
            ],
            buttonText: 'Попробовать за $6',
            buttonStyle: 'primary'
          },
          enterprise: {
            name: 'Корпоративный',
            description: 'Полное решение',
            features: [
              'Неограниченные запросы',
              'Все премиум модели',
              'Видео-интерфейс',
              'Интеграции',
              'White-label решение',
              'Выделенная поддержка'
            ],
            buttonText: 'Получить демо',
            buttonStyle: 'premium'
          }
        },
        faqItems: [
          {
            question: 'Могу ли я изменить план?',
            answer: 'Да, вы можете повысить или понизить свой план в любое время. Изменения вступают в силу немедленно.'
          },
          {
            question: 'Какие модели ИИ включены?',
            answer: 'Бесплатный план использует оптимизированные модели. Pro включает GPT-4, Claude и премиум модели. Enterprise получает доступ ко всем моделям.'
          },
          {
            question: 'Есть ли бесплатная пробная версия?',
            answer: 'Да! Планы Pro и Enterprise поставляются с 14-дневной бесплатной пробной версией. Кредитная карта не требуется.'
          },
          {
            question: 'Как работает биллинг?',
            answer: 'Вы платите ежемесячно или ежегодно. Годовые планы экономят 20%. Все платежи безопасны через Stripe.'
          }
        ]
      }
    };
    return texts[language as keyof typeof texts] || texts.en;
  };

  const texts = getTexts();

  const getYearlyPrice = (monthlyPrice: number) => {
    const yearlyPrice = monthlyPrice * 12 * 0.8; // 20% discount
    return Math.floor(yearlyPrice / 12);
  };

  const pricingPlans: PricingPlan[] = [
    {
      id: 'free',
      name: texts.plans.free.name,
      price: 0,
      period: billingPeriod === 'monthly' ? texts.monthly : texts.yearly,
      description: texts.plans.free.description,
      features: texts.plans.free.features,
      buttonText: texts.plans.free.buttonText,
      buttonStyle: 'secondary',
      limits: {
        queries: 50,
        aiModels: ['DeepSeek Free'],
        storage: '1GB',
        support: 'Community'
      }
    },
    {
      id: 'pro',
      name: texts.plans.pro.name,
      price: billingPeriod === 'monthly' ? 10 : getYearlyPrice(10),
      period: billingPeriod === 'monthly' ? texts.monthly : texts.yearly,
      originalPrice: billingPeriod === 'monthly' ? '$19' : '$15',
      discount: billingPeriod === 'monthly' ? 'First 3 months: $6/month (40% OFF)' : 'First year: $8/month (40% OFF)',
      description: texts.plans.pro.description,
      features: texts.plans.pro.features,
      badge: '⭐ ' + texts.popular,
      buttonText: texts.plans.pro.buttonText,
      buttonStyle: 'primary',
      highlighted: true,
      popular: true,
      stripePriceId: billingPeriod === 'monthly' ? 'price_pro_monthly' : 'price_pro_yearly',
      limits: {
        queries: 1500,
        aiModels: ['GPT-4', 'Claude-3.5', 'DeepSeek'],
        storage: '50GB',
        support: 'Email'
      }
    },
    {
      id: 'enterprise',
      name: texts.plans.enterprise.name,
      price: billingPeriod === 'monthly' ? 39 : getYearlyPrice(39),
      period: billingPeriod === 'monthly' ? texts.monthly : texts.yearly,
      originalPrice: billingPeriod === 'monthly' ? '$65' : '$52',
      discount: billingPeriod === 'monthly' ? 'First 3 months: $23/month (40% OFF)' : 'First year: $31/month (40% OFF)',
      description: texts.plans.enterprise.description,
      features: texts.plans.enterprise.features,
      badge: '🚀 Best Value',
      buttonText: texts.plans.enterprise.buttonText,
      buttonStyle: 'premium',
      stripePriceId: billingPeriod === 'monthly' ? 'price_enterprise_monthly' : 'price_enterprise_yearly',
      limits: {
        queries: 'unlimited',
        aiModels: ['All Models', 'Custom Training'],
        storage: 'Unlimited',
        support: 'Dedicated Manager'
      }
    }
  ];

  const handleUpgrade = async (planId: string) => {
    if (planId === 'free') return;
    
    setIsLoading(true);
    setSelectedPlan(planId);
    
    try {
      // Here you would integrate with Stripe
      // For now, we'll show a modal
      setShowModal(true);
    } catch (error) {
      console.error('Upgrade error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const goBackToApp = () => {
    window.location.href = '/';
  };

  if (!isHydrated || !clientInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const PricingCard = ({ plan }: { plan: PricingPlan }) => (
    <div className={`pricing-card ${plan.highlighted ? 'border-blue-400/30' : ''} ${plan.badge ? 'featured' : ''}`}>
      {/* Badge */}
      {plan.badge && (
        <div className="most-popular-badge">
          {plan.badge}
        </div>
      )}
      
      {/* Header */}
      <div className="card-header text-center mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">{plan.name}</h3>
        
        {/* Price */}
        <div className="price-section">
          {plan.originalPrice && (
            <div className="original-price text-gray-400 line-through text-xs mb-1">
              {plan.originalPrice}{plan.period}
            </div>
          )}
          <div className="current-price text-2xl font-bold text-white">
            ${plan.price}
            <span className="text-sm text-gray-400 font-normal">{plan.period}</span>
          </div>
          {plan.discount && (
            <div className="discount-offer text-green-400 text-xs mt-1 font-medium">
              🔥 {plan.discount}
            </div>
          )}
        </div>
        
        <p className="text-gray-300 text-xs mt-2">{plan.description}</p>
      </div>
      
      {/* Features */}
      <div className="features-list mb-4">
        {plan.features.map((feature, index) => (
          <div key={index} className="feature-item flex items-start gap-2 mb-1.5">
            <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
            <span className="text-gray-300 text-xs">{feature}</span>
          </div>
        ))}
      </div>
      
      {/* CTA Button */}
      <button
        onClick={() => handleUpgrade(plan.id)}
        disabled={isLoading && selectedPlan === plan.id}
        className={`cta-button w-full py-2 px-4 rounded-lg font-medium text-sm transition-all ${
          plan.buttonStyle === 'primary' 
            ? 'bg-blue-500 hover:bg-blue-600 text-white transform hover:scale-105' 
            : plan.buttonStyle === 'premium'
            ? 'bg-purple-500 hover:bg-purple-600 text-white'
            : 'bg-gray-700 hover:bg-gray-600 text-white'
        }`}
      >
        {isLoading && selectedPlan === plan.id ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto"></div>
        ) : (
          plan.buttonText
        )}
      </button>
      
      {/* Guarantee */}
      <div className="guarantee text-center mt-2">
        <span className="text-xs text-gray-400">
          {plan.price === 0 ? 'No credit card required' : '30-day money-back guarantee'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto main-content">
        {/* Hero Section */}
        <div className="relative py-2 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            {/* Back Button */}
            <button
              onClick={goBackToApp}
              className="inline-flex items-center space-x-2 text-white/70 hover:text-white transition-colors mb-2 group text-sm py-1 px-2"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>{texts.backToApp}</span>
            </button>

            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-1 bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                {texts.title}
              </h2>
              <p className="text-base text-white/80 mb-2 max-w-xl mx-auto">
                {texts.subtitle}
              </p>
            </div>

            {/* Pricing Options Row */}
            <div className="flex flex-wrap justify-between items-center mb-2">
              {/* Billing Toggle */}
              <div className="bg-slate-800/80 p-1 rounded-lg inline-flex">
                <button
                  onClick={() => setBillingPeriod('monthly')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all ${
                    billingPeriod === 'monthly'
                      ? 'bg-blue-500 text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {texts.monthly}
                </button>
                <button
                  onClick={() => setBillingPeriod('yearly')}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1 ${
                    billingPeriod === 'yearly'
                      ? 'bg-blue-500 text-white'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  {texts.yearly}
                  <span className="bg-green-500 text-white text-xs px-1 py-0.5 rounded text-[10px]">
                    {texts.save}
                  </span>
                </button>
              </div>

              {/* Limited Time Offer */}
              <div className="text-blue-400 text-sm font-medium">
                🔥 {texts.limitedOffer}
              </div>
            </div>

            {/* Pricing Cards */}
            <div className="pricing-container">
              {pricingPlans.map((plan) => (
                <PricingCard key={plan.id} plan={plan} />
              ))}
            </div>

            {/* Social Proof */}
            <div className="text-center mt-4">
              <p className="text-gray-400 mb-1 text-xs">{texts.trustedBy}</p>
              <div className="flex justify-center items-center gap-1">
                <span className="text-yellow-400 text-xs">⭐⭐⭐⭐⭐</span>
                <span className="text-gray-300 text-xs">{texts.reviews}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-8 px-4 sm:px-6 lg:px-8 bg-white/5">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-white text-center mb-6">{texts.whatYouGet}</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Advanced AI Models</h3>
                <p className="text-white/70 text-xs">Access to GPT-4, Claude, and other premium AI models for superior collaboration insights.</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Semantic Search</h3>
                <p className="text-white/70 text-xs">Vector-powered search that understands context and meaning, not just keywords.</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">Smart Chains</h3>
                <p className="text-white/70 text-xs">AI-powered project decomposition that breaks complex tasks into manageable steps.</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-xl font-bold text-white text-center mb-4">{texts.faq}</h2>
            <div className="space-y-3">
              {texts.faqItems.map((item, index) => (
                <div key={index} className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <h3 className="text-sm font-semibold text-white mb-1">{item.question}</h3>
                  <p className="text-white/70 text-xs">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />

      {/* Upgrade Modal */}
      {showModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" 
            onClick={() => setShowModal(false)}
          />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                  <Crown className="w-4 h-4 text-blue-400" />
                  <span>Upgrade to {pricingPlans.find(p => p.id === selectedPlan)?.name}</span>
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white/60 hover:text-white" />
                </button>
              </div>
              
              <div className="p-4">
                <div className="text-center mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-2">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <h4 className="text-base font-semibold text-white mb-1">Stripe Integration Required</h4>
                  <p className="text-white/70 text-xs">
                    To complete your upgrade, please configure your Stripe integration with your API keys.
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-3">
                    <h5 className="font-medium text-blue-400 text-xs mb-1">Next Steps:</h5>
                    <ol className="text-xs text-white/80 space-y-1">
                      <li>1. Set up your Stripe account</li>
                      <li>2. Configure API keys in environment</li>
                      <li>3. Create product pricing in Stripe</li>
                      <li>4. Return to complete upgrade</li>
                    </ol>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowModal(false)}
                      className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white rounded-lg transition-all text-xs"
                    >
                      Close
                    </button>
                    <a
                      href="https://bolt.new/setup/stripe"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-lg transition-all text-center font-medium text-xs"
                    >
                      Setup Stripe
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}