import { Bot, User } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  mode: string;
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

export default function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex space-x-4 ${isUser ? 'flex-row-reverse space-x-reverse' : ''} mb-6`}>
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser 
          ? 'bg-gradient-to-br from-gray-600 to-gray-700' 
          : 'bg-gradient-to-br from-blue-500 to-indigo-600'
      }`}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-3xl ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block p-4 rounded-2xl ${
          isUser 
            ? 'bg-blue-600 text-white rounded-br-md' 
            : 'bg-gray-700 text-gray-100 rounded-bl-md'
        } shadow-lg max-w-full relative`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
            {isStreaming && (
              <span className="inline-block w-2 h-4 bg-blue-400 ml-1 animate-pulse"></span>
            )}
          </p>
        </div>
        <div className={`text-xs text-gray-400 mt-2 flex items-center space-x-2 ${isUser ? 'justify-end' : ''}`}>
          <span>{message.timestamp.toLocaleTimeString()}</span>
          <span>•</span>
          <span className="capitalize">{message.mode} mode</span>
          {isStreaming && (
            <>
              <span>•</span>
              <span className="text-blue-400 animate-pulse">Streaming...</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}