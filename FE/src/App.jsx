import { useState } from "react";
import axios from "axios";

export default function App() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const askQuestion = async () => {
    if (!query.trim()) return;

    const userMsg = { role: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);

    setLoading(true);

    try {
      const res = await axios.post("http://localhost:3000/ask", {
        query,
      });

      const aiMsg = {
        role: "ai",
        text: res.data.answer,
      };
      console.log("📥 Received from backend:", res.data);
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "❌ Error fetching answer" },
      ]);
    }

    setQuery("");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
      
      {/* Main Container */}
      <div className="w-full max-w-3xl h-[85vh] bg-white/70 backdrop-blur-lg shadow-xl rounded-2xl flex flex-col border border-gray-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-white/50 rounded-t-2xl">
          <h1 className="text-lg font-semibold text-gray-800">
            📄 PageIndex Chat
          </h1>
          <span className="text-xs text-gray-500">
            Vectorless RAG
          </span>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {messages.length === 0 && (
            <div className="text-center text-gray-400 mt-10">
              Ask something about your PDF...
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`px-4 py-2 rounded-xl max-w-[75%] text-sm shadow-sm ${
                  msg.role === "user"
                    ? "bg-black text-white"
                    : "bg-gray-200 text-gray-800"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="text-sm text-gray-500 animate-pulse">
              ⏳ Thinking...
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 bg-white/50 rounded-b-2xl">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && askQuestion()}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black/50 bg-white"
              placeholder="Ask something about the PDF..."
            />
            <button
              onClick={askQuestion}
              disabled={loading}
              className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              Ask
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}