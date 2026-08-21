import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Referencia para scroll automático al último mensaje
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    const currentInput = input;
    const currentFile = selectedFile;

    setInput('');
    setSelectedFile(null);
    setLoading(true);

    try {
      // 1. Verificar API Key
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key no configurada. Verifica tu archivo .env");
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      let responseText = "";

      if (currentFile) {
        const filePart = await fileToGenerativePart(currentFile);
        const prompt = currentInput.trim() ? currentInput : "Analiza esta imagen/archivo.";
        // Nota: Los archivos se envían en un array
        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        responseText = response.text();
      } else {
        // Enviar solo texto
        const result = await model.generateContent(currentInput);
        const response = await result.response;
        responseText = response.text();
      }

      setMessages((prev) => [...prev, { text: responseText, sender: 'model' }]);
    } catch (error) {
      console.error("Error detallado:", error);
      
      // Mensaje de error más descriptivo para ayudarte a debugear
      let errorMessage = "Ocurrió un error de conexión.";
      if (error.message.includes("API Key")) errorMessage = "Error: API Key no encontrada.";
      if (error.message.includes("403")) errorMessage = "Error: API Key inválida o sin permisos.";
      
      setMessages((prev) => [
        ...prev,
        { text: errorMessage, sender: 'model' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <button className="btn-icon-new" onClick={() => setMessages([])} title="Nuevo Chat">
            <span>+</span>
          </button>
          <p style={{fontSize: '10px', color: 'var(--text-secondary)', marginTop: '5px'}}>Conversación</p>
        </div>

        <div className="history-list">
          {/* Aquí podrías mapear un historial real */}
        </div>

        <div className="sidebar-bottom">
          <button className="btn-delete-session" onClick={() => setMessages([])}>
            🗑️ Borrar
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
                  {msg.file && (
                    <div style={{fontSize: '0.8rem', color: '#a8c7fa', marginBottom: '5px'}}>
                      📎 {msg.file.name}
                    </div>
                  )}
                  <p>{msg.text}</p>
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
            <div ref={messagesEndRef} />
          </div>
        )}

        <div className="input-container-wrapper">
          <div className="input-box">
            <label htmlFor="file-upload" className="file-upload-label">
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
