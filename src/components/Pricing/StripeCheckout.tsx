import { useState } from 'react';
import { Crown, Loader2, CreditCard, Shield } from 'lucide-react';

interface StripeCheckoutProps {
  planId: string;
  planName: string;
  price: number;
  onClose: () => void;
}

export default function StripeCheckout({ planId, planName, price, onClose }: StripeCheckoutProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');

  const handleCheckout = async () => {
    setIsLoading(true);
    
    try {
      // Here you would integrate with Stripe Checkout
      // For now, we'll simulate the process
      
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          email,
          successUrl: window.location.origin + '/success',
          cancelUrl: window.location.origin + '/pricing',
        }),
      });

      if (response.ok) {
        const { url } = await response.json();
        window.location.href = url;
      } else {
        throw new Error('Failed to create checkout session');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Checkout failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white p-6 rounded-t-2xl">
        <div className="flex items-center space-x-3">
          <Crown className="w-6 h-6" />
          <div>
            <h3 className="text-xl font-semibold">Upgrade to {planName}</h3>
            <p className="text-blue-100">${price}/month</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        {/* Security Notice */}
        <div className="flex items-start space-x-3 mb-6 p-4 bg-gray-50 rounded-lg">
          <Shield className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900">Secure Payment</p>
            <p className="text-xs text-gray-600">
              Your payment is processed securely by Stripe. We never store your card details.
            </p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleCheckout}
            disabled={!email || isLoading}
            className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-3 rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                <span>Continue to Payment</span>
              </>
            )}
          </button>
        </div>

        {/* Terms */}
        <p className="text-xs text-gray-500 text-center mt-4">
          By continuing, you agree to our Terms of Service and Privacy Policy.
          You can cancel your subscription at any time.
        </p>
      </div>
    </div>
  );
}