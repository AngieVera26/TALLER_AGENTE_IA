import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const fileToGenerativePart = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          inlineData: {
            data: reader.result.split(',')[1],
            mimeType: file.type,
          },
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedFile) return;

    const userMessage = { text: input, file: selectedFile, sender: 'user' };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let imagePart = null;
      if (selectedFile) {
        imagePart = await fileToGenerativePart(selectedFile);
      }

      // Reemplazar con la llamada a la API de Gemini
      const responseText = "Respuesta de Nexus AI basada en tu consulta."; 
      
      setMessages((prev) => [...prev, { text: responseText, sender: 'model' }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { text: "Error al procesar tu solicitud.", sender: 'model' }]);
    } finally {
      setSelectedFile(null);
      setLoading(false);
    }
  };

  const handleClearSession = () => {
    setMessages([]);
    localStorage.removeItem('chat_history');
  };

  return (
    <div className="app-layout">
      {/* Sidebar fija estilo Gemini */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="btn-icon-new" onClick={() => setMessages([])} title="Nuevo Chat">
            <span className="plus-icon">+</span>
          </button>
        </div>

        <div className="history-list">
          {messages.length > 0 && (
            <div className="history-item active">Conversación actual</div>
          )}
        </div>

        <div className="sidebar-bottom">
          <button className="btn-delete-session" onClick={handleClearSession}>
            🗑️ Borrar sesión
          </button>
        </div>
      </aside>

      {/* Área principal */}
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
                  {msg.file && (
                    <div className="file-preview-tag">📎 {msg.file.name}</div>
                  )}
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
            {loading && <div className="message-row model"><p className="loading-text">Nexus AI está pensando...</p></div>}
          </div>
        )}

        {/* Input flotante centralizado */}
        <div className="input-container-wrapper">
          <div className="input-box">
            <label htmlFor="file-upload" className="file-upload-label" title="Adjuntar archivo o imagen">
              +
            </label>
            <input
              id="file-upload"
              type="file"
              style={{ display: 'none' }}
              onChange={(e) => setSelectedFile(e.target.files[0])}
            />

            <input
              type="text"
              className="main-input"
              placeholder="Pregunta a Nexus AI..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />

            {selectedFile && <span className="selected-file-badge">{selectedFile.name}</span>}

            <button className="btn-send-gemini" onClick={handleSend}>
              ➔
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
