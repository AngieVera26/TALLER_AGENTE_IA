import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('nexus_chats');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
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
        setMessages(activeSession.messages || []);
      }
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  useEffect(() => {
    try {
      localStorage.setItem('nexus_chats', JSON.stringify(sessions));
    } catch (e) {
      console.error("Error al guardar en localStorage", e);
    }
  }, [sessions]);

  const createNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  const cleanFormat = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/^#+\s*/gm, '')
      .replace(/---+/g, '')
      .trim();
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    const userMessage = { text: userText, sender: 'user' };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    let activeId = currentSessionId;
    if (!activeId) {
      activeId = Date.now().toString();
      setCurrentSessionId(activeId);
    }

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("No se encontró la clave VITE_GEMINI_API_KEY");
      }

      const recentMessages = updatedMessages.slice(-6);
      const apiContents = recentMessages.map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text || '' }]
      }));

      apiContents[apiContents.length - 1].parts[0].text += 
        "\n\n(Instrucción de formato: Responde usando texto claro, listas ordenadas y saltos de línea sin usar asteriscos ni negritas)";

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: apiContents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2500,
            },
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Límite de solicitudes alcanzado. Espera unos segundos e intenta de nuevo.");
        }
        throw new Error(data.error?.message || 'Error al conectar con la IA');
      }

      const rawReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se obtuvo respuesta del modelo.";
      const cleanReply = cleanFormat(rawReply);

      const finalMessages = [...updatedMessages, { text: cleanReply, sender: 'model' }];
      setMessages(finalMessages);

      setSessions((prevSessions) => {
        const existingIndex = prevSessions.findIndex((s) => s.id === activeId);
        const title = userText.length > 25 ? userText.substring(0, 25) + '...' : userText;

        if (existingIndex >= 0) {
          const updated = [...prevSessions];
          updated[existingIndex] = {
            ...updated[existingIndex],
            messages: finalMessages,
          };
          return updated;
        } else {
          return [{ id: activeId, title, messages: finalMessages }, ...prevSessions];
        }
      });
    } catch (error) {
      console.error("Error en la llamada:", error);
      const fallbackText = error.message.includes("Límite de solicitudes")
        ? error.message
        : "Ocurrió un problema temporal con la consulta. Por favor intenta de nuevo.";

      setMessages((prev) => [
        ...prev,
        { text: fallbackText, sender: 'model' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, idx) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Error al copiar', err);
    }
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
            <h1 className="welcome-title">El micrófono es tuyo, Colega</h1>
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