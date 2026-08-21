import React, { useState } from 'react';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { text: input, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);

    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("No se encontró VITE_GEMINI_API_KEY");
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: currentInput }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 800,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Error en la respuesta');
      }

      const botReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta del modelo.";

      setMessages((prev) => [...prev, { text: botReply, sender: 'model' }]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        { text: "Ocurrió un error al consultar la IA. Intenta de nuevo.", sender: 'model' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, idx) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Error al copiar', err);
    }
    document.body.removeChild(textArea);
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <button className="btn-icon-new" onClick={() => setMessages([])} title="Nuevo Chat">
          +
        </button>
        <button className="btn-delete-session" onClick={() => setMessages([])} title="Borrar sesión">
          🗑️
        </button>
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
              <div key={idx} className={`message-row ${msg.sender}`}>
                <div className="message-content">
                  <p>{msg.text}</p>
                  {msg.sender === 'model' && (
                    <button className="btn-copy" onClick={() => handleCopy(msg.text, idx)}>
                      {copiedIndex === idx ? '✓ Copiado' : '📋 Copiar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="message-row model">
                <div className="message-content">
                  <p className="loading-text">Nexus AI está pensando...</p>
                </div>
              </div>
            )}
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
              onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
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
