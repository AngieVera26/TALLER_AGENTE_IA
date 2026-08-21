import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';
import './App.css';

/* ============================================================
   CLIENTES EXTERNOS
   ============================================================ */
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const SYSTEM_INSTRUCTION =
  'Eres Nexus AI, un asistente técnico experto. Responde usando Markdown';

const STORAGE_KEY = 'nexus_ai_chats';

/* ============================================================
   HELPERS
   ============================================================ */
const createEmptyChat = () => ({
  id: crypto.randomUUID(),
  title: 'Nuevo Chat',
  createdAt: Date.now(),
  messages: [], // { id, role: 'user' | 'model', text }
});

const loadChatsFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error leyendo localStorage:', err);
    return [];
  }
};

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export default function App() {
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  const currentChat = chats.find((c) => c.id === currentChatId) || null;

  /* ---------- Carga inicial desde localStorage ---------- */
  useEffect(() => {
    const stored = loadChatsFromStorage();
    if (stored.length > 0) {
      setChats(stored);
      setCurrentChatId(stored[0].id);
    } else {
      const fresh = createEmptyChat();
      setChats([fresh]);
      setCurrentChatId(fresh.id);
    }
  }, []);

  /* ---------- Persistencia en localStorage ---------- */
  useEffect(() => {
    if (chats.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
    }
  }, [chats]);

  /* ---------- Auto-scroll al final del chat ---------- */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat?.messages, isLoading]);

  /* ---------- Configuración de Web Speech API ---------- */
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, []);

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      alert('Tu navegador no soporta reconocimiento de voz.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  /* ---------- Gestión de chats ---------- */
  const handleNewChat = () => {
    const fresh = createEmptyChat();
    setChats((prev) => [fresh, ...prev]);
    setCurrentChatId(fresh.id);
    setInput('');
  };

  const handleSelectChat = (id) => {
    setCurrentChatId(id);
    setInput('');
  };

  const handleClearSession = () => {
    const confirmed = window.confirm(
      '¿Seguro que deseas borrar todo el historial de chats? Esta acción no se puede deshacer.'
    );
    if (!confirmed) return;

    localStorage.removeItem(STORAGE_KEY);
    const fresh = createEmptyChat();
    setChats([fresh]);
    setCurrentChatId(fresh.id);
  };

  /* ---------- Copiar respuesta al portapapeles ---------- */
  const handleCopy = async (text, messageId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  /* ---------- Guardar en Supabase ---------- */
  const saveConversation = async (chatId, pregunta, respuesta) => {
    try {
      const { error } = await supabase.from('conversaciones').insert([
        {
          chat_id: chatId,
          pregunta,
          respuesta,
        },
      ]);
      if (error) console.error('Error guardando en Supabase:', error.message);
    } catch (err) {
      console.error('Error inesperado con Supabase:', err);
    }
  };

  /* ---------- Envío de mensaje a Gemini ---------- */
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || !currentChat || isLoading) return;

    const userMessage = { id: crypto.randomUUID(), role: 'user', text: trimmed };

    // Actualiza el título del chat si es el primer mensaje
    const isFirstMessage = currentChat.messages.length === 0;

    setChats((prev) =>
      prev.map((c) =>
        c.id === currentChatId
          ? {
              ...c,
              title: isFirstMessage ? trimmed.slice(0, 30) : c.title,
              messages: [...c.messages, userMessage],
            }
          : c
      )
    );

    setInput('');
    setIsLoading(true);

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        systemInstruction: SYSTEM_INSTRUCTION,
      });

      // Construye historial en el formato que espera el SDK
      const history = currentChat.messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

      const chatSession = model.startChat({ history });
      const result = await chatSession.sendMessage(trimmed);
      const responseText = result.response.text();

      const modelMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: responseText,
      };

      setChats((prev) =>
        prev.map((c) =>
          c.id === currentChatId
            ? { ...c, messages: [...c.messages, modelMessage] }
            : c
        )
      );

      await saveConversation(currentChatId, trimmed, responseText);
    } catch (err) {
      console.error('Error llamando a Gemini:', err);
      const errorMessage = {
        id: crypto.randomUUID(),
        role: 'model',
        text: '⚠️ Ocurrió un error al generar la respuesta. Intenta de nuevo.',
      };
      setChats((prev) =>
        prev.map((c) =>
          c.id === currentChatId
            ? { ...c, messages: [...c.messages, errorMessage] }
            : c
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, currentChat, currentChatId, isLoading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="app-container">
      {/* ---------- SIDEBAR ---------- */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1 className="logo">⚡ Nexus AI</h1>
          <button className="btn-new-chat" onClick={handleNewChat}>
            + Nuevo Chat
          </button>
        </div>

        <div className="chat-history">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`history-item ${
                chat.id === currentChatId ? 'active' : ''
              }`}
              onClick={() => handleSelectChat(chat.id)}
            >
              {chat.title}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="btn-clear-session" onClick={handleClearSession}>
            🗑️ Borrar sesión
          </button>
        </div>
      </aside>

      {/* ---------- CHAT PRINCIPAL ---------- */}
      <main className="chat-area">
        <div className="chat-messages">
          {currentChat?.messages.length === 0 && (
            <div className="empty-state">
              <p>Empieza una conversación con Nexus AI 🤖</p>
            </div>
          )}

          {currentChat?.messages.map((msg) => (
            <div key={msg.id} className={`message-row ${msg.role}`}>
              <div className="message-bubble">
                {msg.role === 'model' ? (
                  <>
                    <div className="markdown-content">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                    <button
                      className="btn-copy"
                      onClick={() => handleCopy(msg.text, msg.id)}
                    >
                      {copiedId === msg.id ? '✅ Copiado' : '📋 Copiar'}
                    </button>
                  </>
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="message-row model">
              <div className="message-bubble typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* ---------- INPUT ---------- */}
        <div className="chat-input-container">
          <button
            className={`btn-mic ${isListening ? 'listening' : ''}`}
            onClick={handleMicClick}
            title="Dictar mensaje"
          >
            🎤
          </button>

          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu mensaje..."
            rows={1}
          />

          <button
            className="btn-send"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
          >
            ➤
          </button>
        </div>
      </main>
    </div>
  );
}
