import React, { useState, useRef, useEffect } from 'react';
import { useWhiteboardStore } from '../store/whiteboardStore';
import { Send, Sparkles, Loader2, X, MessageSquare } from 'lucide-react';

export default function AIPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const { aiProcessing, aiMessages, sendAICommand } = useWhiteboardStore();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || aiProcessing) return;

    sendAICommand(input);
    setInput('');
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages]);

  const exampleCommands = [
    'Create a flowchart with 5 steps',
    'Draw a circle and a rectangle',
    'Create a mind map about AI',
    'Make a timeline from 2020 to 2024',
    'Draw an arrow from left to right'
  ];

  return (
    <>
      {/* Floating AI Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center z-50"
        title="AI Assistant"
      >
        {aiProcessing ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <Sparkles className="w-6 h-6" />
        )}
      </button>

      {/* AI Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              <h3 className="font-semibold">AI Assistant</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-white/20 rounded p-1 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {aiMessages.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p className="text-sm mb-4">
                  Tell me what you'd like to create on the whiteboard
                </p>
                <div className="text-left space-y-2">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Example commands:
                  </p>
                  {exampleCommands.map((cmd, index) => (
                    <button
                      key={index}
                      onClick={() => setInput(cmd)}
                      className="block w-full text-left text-xs text-gray-600 hover:text-purple-600 hover:bg-purple-50 p-2 rounded transition-colors"
                    >
                      • {cmd}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              aiMessages.map((message, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg ${
                    message.type === 'processing'
                      ? 'bg-blue-50 border border-blue-200'
                      : message.type === 'success'
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {message.type === 'processing' && (
                      <Loader2 className="w-4 h-4 animate-spin mt-1 flex-shrink-0 text-blue-600" />
                    )}
                    {message.type === 'success' && (
                      <Sparkles className="w-4 h-4 mt-1 flex-shrink-0 text-green-600" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{message.text}</p>
                      {message.actions && message.actions.length > 0 && (
                        <div className="mt-2 text-xs text-gray-600">
                          <p className="font-semibold mb-1">Actions performed:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {message.actions.map((action, idx) => (
                              <li key={idx}>
                                {action.tool.replace(/_/g, ' ')}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe what you want to create..."
                disabled={aiProcessing}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!input.trim() || aiProcessing}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {aiProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Powered by Claude Sonnet 4
            </p>
          </form>
        </div>
      )}
    </>
  );
}
