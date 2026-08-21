import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem('nexus_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    if (currentSessionId) {
      const activeSession = sessions.find((s) => s.id === currentSessionId);
      if (activeSession) {
        setMessages(activeSession.messages);
      }
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  useEffect(() => {
    localStorage.setItem('nexus_chats', JSON.stringify(sessions));
  }, [sessions]);

  const createNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  const formatText = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/---+/g, '');
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { text: input, sender: 'user' };
    const newMessages = [...messages, userMessage];

    setMessages(newMessages);
    const currentInput = input;
    setInput('');
    setLoading(true);

    let activeId = currentSessionId;
    if (!activeId) {
      activeId = Date.now().toString();
      setCurrentSessionId(activeId);
    }

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("No se encontró VITE_GEMINI_API_KEY");

      // Modelo corregido a gemini-1.5-flash
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Por favor responde de manera clara, estructurada y organizada usando saltos de línea. Pregunta: ${currentInput}`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 3000,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Error devuelto por Gemini:", data);
        throw new Error(data.error?.message || 'Error en la consulta');
      }

      const rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta del modelo.";
      const cleanReply = formatText(rawReply);

      const updatedMessages = [...newMessages, { text: cleanReply, sender: 'model' }];
      setMessages(updatedMessages);

      setSessions((prevSessions) => {
        const existingIndex = prevSessions.findIndex((s) => s.id === activeId);
        const title = currentInput.length > 25 ? currentInput.substring(0, 25) + '...' : currentInput;

        if (existingIndex >= 0) {
          const updated = [...prevSessions];
          updated[existingIndex].messages = updatedMessages;
          return updated;
        } else {
          return [{ id: activeId, title, messages: updatedMessages }, ...prevSessions];
        }
      });
    } catch (error) {
      console.error("Error en petición:", error);
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

  const deleteSession = (id, e) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== id);
    setSessions(filtered);
    if (currentSessionId === id) {
      createNewChat();
    }
  };

  const clearAllSessions = () => {
    setSessions([]);
    localStorage.removeItem('nexus_chats');
    createNewChat();
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="btn-icon-new" onClick={createNewChat} title="Nuevo Chat">
            +
          </button>
        </div>

        <div className="history-list">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`history-item ${session.id === currentSessionId ? 'active' : ''}`}
              onClick={() => setCurrentSessionId(session.id)}
            >
              <span className="history-title">{session.title}</span>
              <button
                className="btn-delete-item"
                onClick={(e) => deleteSession(session.id, e)}
                title="Eliminar chat"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="btn-delete-session" onClick={clearAllSessions} title="Borrar todo el historial">
            🗑️
          </button>
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
              <div key={idx} className={`message-row ${msg.sender}`}>
                <div className="message-content">
                  <div className="text-body">{msg.text}</div>
                  {msg.sender === 'model' && msg.text && (
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
                  <p className="thinking-indicator">
                    Pensando<span className="dots">...</span>
                  </p>
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
