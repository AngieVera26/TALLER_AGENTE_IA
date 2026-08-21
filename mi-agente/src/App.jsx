import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatBottomRef = useRef(null);

  // Auto-scroll al final de la conversación
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', parts: [{ text: input }] };
    const updatedHistory = [...messages, userMessage];

    setMessages(updatedHistory);
    setInput('');
    setLoading(true);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        { role: 'model', parts: [{ text: "Error: No se encontró la API Key en el entorno." }] },
      ]);
      setLoading(false);
      return;
    }

    try {
      // 1. Historial conversacional completo (Memoria de contexto)
      const formattedContents = updatedHistory.map((msg) => ({
        role: msg.role,
        parts: msg.parts,
      }));

      // 2. Transmisión en tiempo real (Streaming Endpoint)
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: formattedContents }),
        }
      );

      if (!response.ok) throw new Error("Error en la llamada a la API");

      // Añadir mensaje vacío inicial para el modelo
      setMessages((prev) => [...prev, { role: 'model', parts: [{ text: '' }] }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      // 3. Procesamiento del Stream SSE
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.replace('data: ', ''));
              const textChunk = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
              accumulatedText += textChunk;

              // Actualización incremental del mensaje del modelo
              setMessages((prev) => {
                const newHistory = [...prev];
                newHistory[newHistory.length - 1] = {
                  role: 'model',
                  parts: [{ text: accumulatedText }],
                };
                return newHistory;
              });
            } catch (e) {
              // Ignorar líneas incompletas de transmisión
            }
          }
        }
      }
    } catch (error) {
      console.error("Error en streaming:", error);
      setMessages((prev) => [
        ...prev,
        { role: 'model', parts: [{ text: "Ocurrió un error al procesar la respuesta." }] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = () => {
    setMessages([]);
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="btn-icon-new" onClick={handleClearSession} title="Nuevo Chat">+</button>
        </div>
        <div className="history-list">
          {messages.length > 0 && <div className="history-item active">Chat activo</div>}
        </div>
        <div className="sidebar-bottom">
          <button className="btn-delete-session" onClick={handleClearSession} title="Borrar sesión">🗑️</button>
        </div>
      </aside>

      <main className="chat-container">
        {messages.length === 0 ? (
          <div className="welcome-screen">
            <h1 className="welcome-title">El micrófono es tuyo, Angie</h1>
            <p className="welcome-subtitle">¿En qué puedo ayudarte hoy?</p>
          </div>
        ) : (
          <div className="messages-wrapper">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.role}`}>
                <div className="message-content">
                  {/* 4. Renderizado avanzado con Markdown, LaTeX y Sintaxis de Código */}
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.parts[0]?.text || ''}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
        )}

        <div className="input-container-wrapper">
          <div className="input-box">
            <input
              type="text"
              className="main-input"
              placeholder="Pregunta a Nexus AI..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <button className="btn-send-gemini" onClick={handleSend} disabled={loading}>
              ➔
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
