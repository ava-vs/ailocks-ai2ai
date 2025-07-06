import { useState, useRef } from 'react';
import { Send, Plus, Mic } from 'lucide-react';

interface MobileChatControlsProps {
  input: string;
  setInput: (value: string) => void;
  sendMessage: () => void;
  isStreaming: boolean;
  handleCreateIntentClick: () => void;
  placeholder: string;
  sessionId: string | null;
}

export default function MobileChatControls({
  input,
  setInput,
  sendMessage,
  isStreaming,
  handleCreateIntentClick,
  placeholder,
  sessionId
}: MobileChatControlsProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as content grows
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Reset height to auto to properly calculate the new height
    e.target.style.height = 'auto';
    
    // Set the height to scrollHeight to fit the content
    // Limit max height to prevent it from taking too much space
    const maxHeight = 100; // in pixels
    e.target.style.height = `${Math.min(e.target.scrollHeight, maxHeight)}px`;
  };

  return (
    <div className="px-3 pb-3 pt-2 bg-gradient-to-t from-slate-800/90 via-slate-800/90 to-transparent">
      <div className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={sessionId ? placeholder : "Initializing chat..."}
          className="w-full px-4 py-3 pr-24 bg-slate-800/50 border border-blue-500/30 
                    rounded-xl text-white placeholder-gray-400 text-base
                    focus:outline-none focus:border-blue-500 focus:bg-slate-800/80 resize-none transition-all"
          disabled={isStreaming}
          rows={1}
          style={{ minHeight: '132px', maxHeight: '200px' }}
        />

        {/* Input Actions */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <button
            onClick={handleCreateIntentClick}
            disabled={!input.trim() && !input.trim()}
            className="p-2 text-blue-400 hover:text-blue-300 disabled:text-blue-800 disabled:opacity-50"
            title="Create Intent"
          >
            <Plus className="w-5 h-5" />
          </button>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className={`p-2 rounded-lg ${
              input.trim() && !isStreaming
                ? 'bg-blue-500 text-white'
                : 'bg-blue-500/50 text-white/50'
            }`}
            title="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}