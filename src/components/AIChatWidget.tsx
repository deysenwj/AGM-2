// src/components/AIChatWidget.tsx
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { FILE_CONFIG, formatFileSize, isValidFileExtension } from '../config/fileConfig';

interface AttachmentInfo {
  id?: string;
  filename: string;
  mime_type: string;
  size: number;
  storage_url?: string;
}

interface Message {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  attachment?: AttachmentInfo;
}

const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface AGMAssistantMarkProps {
  className?: string;
  bubbleColor?: string;
  dotColor?: string;
}

const AGMAssistantMark: React.FC<AGMAssistantMarkProps> = ({ 
  className = "w-5 h-5",
  bubbleColor = "#0f172a",
  dotColor = "white"
}) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path 
      d="M12 3.5C6.477 3.5 2 7.082 2 11.5c0 2.53 1.463 4.78 3.737 6.286L4.8 21.2l3.858-1.286c1.037.382 2.164.586 3.342.586 5.523 0 10-3.582 10-8s-4.477-8-10-8z" 
      fill={bubbleColor}
    />
    <circle cx="8" cy="11.5" r="1.3" fill={dotColor} />
    <circle cx="12" cy="11.5" r="1.3" fill={dotColor} />
    <circle cx="16" cy="11.5" r="1.3" fill={dotColor} />
  </svg>
);

const getFileBadge = (filename: string): string => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'PDF';
  if (lower.endsWith('.docx')) return 'DOC';
  if (lower.endsWith('.csv')) return 'CSV';
  if (lower.endsWith('.xlsx')) return 'XLS';
  return 'TXT';
};

const AIChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatusText, setLoadingStatusText] = useState('Memproses');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationIdRef = useRef<string>(generateUuid());

  const handleJobCompleted = (status: string, responseText?: string, errorText?: string, source: 'Realtime' | 'Polling' = 'Realtime') => {
    console.log(`[AI ${source.toUpperCase()}] response received via ${source}. Status: ${status}`);
    setCurrentJobId(null);
    setIsLoading(false);
    setLoadingStatusText('Memproses');

    if (status === 'completed' && responseText) {
      setHistory(prev => prev.map(msg => 
        msg.text === 'AGM Assistant sedang memproses...' 
          ? { sender: 'ai', text: responseText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          : msg
      ));
    } else if (status === 'failed' && errorText) {
      const errorMessageText = `AI Error: ${errorText}`;
      setHistory(prev => prev.map(msg => 
        msg.text === 'AGM Assistant sedang memproses...' 
          ? { sender: 'ai', text: errorMessageText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
          : msg
      ));
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const channel = supabase.channel('ai_jobs_channel')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'ai_jobs' },
        (payload) => {
          const updatedJob = payload.new as any;
          if (updatedJob.id === currentJobId && updatedJob.status !== 'pending') {
            handleJobCompleted(updatedJob.status, updatedJob.response, updatedJob.error, 'Realtime');
          }
        }
      )
      .subscribe((status) => {
        console.log(`[REALTIME STATUS] ${status}`);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, currentJobId]);

  useEffect(() => {
    if (!isOpen || !isLoading || !currentJobId) return;

    const targetJobId = currentJobId;
    console.log(`[AI POLLING] started for job ${targetJobId}`);

    const intervalId = setInterval(async () => {
      console.log(`[AI POLLING] checking job ${targetJobId}`);
      try {
        const { data, error } = await supabase
          .from('ai_jobs')
          .select('id, status, response, error')
          .eq('id', targetJobId)
          .single();

        if (error) {
          console.error(`[AI POLLING] error checking job ${targetJobId}:`, error.message);
          return;
        }

        if (data) {
          console.log(`[AI POLLING] status: ${data.status}`);
          if (data.status === 'completed' || data.status === 'failed') {
            console.log(`[AI POLLING] response received`);
            handleJobCompleted(data.status, data.response, data.error, 'Polling');
            console.log(`[AI POLLING] stopped`);
            clearInterval(intervalId);
          }
        }
      } catch (err: any) {
        console.error(`[AI POLLING] exception polling job ${targetJobId}:`, err);
      }
    }, 2000);

    return () => {
      console.log(`[AI POLLING] stopped/cleanup interval for job ${targetJobId}`);
      clearInterval(intervalId);
    };
  }, [isOpen, isLoading, currentJobId]);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [history, isLoading]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. File Extension Validation
    if (!isValidFileExtension(file.name)) {
      alert('Format file tidak didukung. Gunakan PDF, DOCX, TXT, CSV, atau XLSX.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. File Size Validation
    if (file.size > FILE_CONFIG.MAX_FILE_SIZE_BYTES) {
      alert(`File terlalu besar. Maksimal ukuran file ${FILE_CONFIG.MAX_FILE_SIZE_MB}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const sendMessage = async (textToSend?: string) => {
    const queryText = (textToSend || message).trim();
    if ((!queryText && !selectedFile) || isLoading) return;

    const userMessageText = queryText || (selectedFile ? `Tolong analisis file ${selectedFile.name}` : '');
    const activeFile = selectedFile;
    
    // Optimistic User Turn Render
    const userMessage: Message = { 
      sender: 'user', 
      text: userMessageText, 
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachment: activeFile ? {
        filename: activeFile.name,
        mime_type: activeFile.type || 'application/octet-stream',
        size: activeFile.size
      } : undefined
    };

    setHistory(prev => [...prev, userMessage]);
    if (!textToSend) setMessage('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    setIsLoading(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || generateUuid();
      let uploadedAttachmentInfo: AttachmentInfo | undefined = undefined;

      // 1. If file attached, perform upload to backend Cloudinary endpoint first
      if (activeFile) {
        setLoadingStatusText('Memproses file');
        const base64Data = await convertFileToBase64(activeFile);
        
        const uploadResponse = await fetch('/api/ai/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            fileBase64: base64Data,
            filename: activeFile.name,
            mimeType: activeFile.type,
            conversationId: conversationIdRef.current
          }),
        });

        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadResult.success) {
          throw new Error(uploadResult.message || 'File tidak dapat diproses.');
        }

        uploadedAttachmentInfo = uploadResult.attachment;
      }

      setLoadingStatusText('Menyiapkan jawaban');

      // 2. Submit AI Job to /api/ai/chat
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ 
          message: userMessageText, 
          conversationId: conversationIdRef.current, 
          userId: userId,
          attachment: uploadedAttachmentInfo
        }),
      });

      const responseText = await response.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        throw new Error(`Invalid JSON from server (HTTP ${response.status}): ${responseText || 'Empty response'}`);
      }

      if (!response.ok || data.success === false) {
        throw new Error(data.message || `Failed to create AI job (HTTP ${response.status}).`);
      }

      setCurrentJobId(data.job_id);
      setHistory(prev => [...prev, { 
        sender: 'ai', 
        text: 'AGM Assistant sedang memproses...', 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);

    } catch (error: any) {
      const errorMessage: Message = { 
        sender: 'ai', 
        text: `Error: ${error.message}`, 
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      };
      setHistory(prev => [...prev, errorMessage]);
      setIsLoading(false);
      setLoadingStatusText('Memproses');
      setCurrentJobId(null);
      console.error('Error sending message to AI:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      sendMessage();
    }
  };

  const clearConversation = () => {
    setHistory([]);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    conversationIdRef.current = generateUuid();
    setCurrentJobId(null);
    setIsLoading(false);
    setLoadingStatusText('Memproses');
  };

  return (
    <>
      {/* Icon-Only Circular Launcher using exact user-provided logo icon */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 group flex items-center gap-2">
          <span className="hidden sm:inline-block opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-800 pointer-events-none select-none">
            AGM Assistant
          </span>
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Open AGM Assistant"
            className="bg-slate-900 text-white rounded-full w-12 h-12 sm:w-13 sm:h-13 shadow-xl hover:bg-slate-800 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 flex items-center justify-center border border-slate-700/80 focus:outline-none"
          >
            <AGMAssistantMark className="w-6 h-6" bubbleColor="white" dotColor="#0f172a" />
          </button>
        </div>
      )}

      {/* Floating Product Assistant Panel */}
      {isOpen && (
        <div 
          className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 z-50 w-[calc(100vw-24px)] max-w-[370px] sm:w-[420px] h-auto min-h-[340px] max-h-[min(490px,60vh)] sm:h-[min(620px,75vh)] sm:max-h-[620px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-fade-in mx-auto sm:mx-0"
          style={{ transition: 'opacity 180ms ease, transform 180ms ease' }}
        >
          {/* Header Bar - Light, Minimal, NO "Ready" */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 bg-white text-slate-900 select-none h-[52px] shrink-0">
            <div className="flex items-center gap-2">
              <AGMAssistantMark className="w-5 h-5" bubbleColor="#0f172a" dotColor="white" />
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight">AGM Assistant</h3>
            </div>

            {/* Header Action Controls */}
            <div className="flex items-center gap-1">
              <button 
                onClick={clearConversation} 
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                title="Clear conversation"
                aria-label="Clear conversation"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                title="Close AGM Assistant"
                aria-label="Close AGM Assistant"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Main Chat Canvas Area */}
          <div ref={chatWindowRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50 text-slate-800 text-sm min-h-0 flex flex-col justify-start">
            {history.length === 0 ? (
              /* Intentional Editorial Empty State */
              <div className="py-6 flex flex-col items-center justify-center text-center px-3 my-auto">
                <h4 className="font-semibold text-slate-900 text-sm tracking-tight mb-1">Apa yang ingin Anda cari?</h4>
                <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">
                  Saya dapat membantu menemukan produk, mengecek harga, stok, atau menganalisis file Anda (PDF, DOCX, TXT, CSV, XLSX).
                </p>

                {/* Subtle Text Actions */}
                <div className="mt-4 flex flex-wrap gap-2.5 justify-center items-center text-xs text-slate-600 font-medium">
                  {[
                    "Cari produk",
                    "Cek harga",
                    "Cek stok"
                  ].map((promptText, idx, arr) => (
                    <React.Fragment key={idx}>
                      <button
                        onClick={() => sendMessage(promptText)}
                        className="hover:text-slate-900 transition-colors cursor-pointer"
                      >
                        {promptText}
                      </button>
                      {idx < arr.length - 1 && <span className="text-slate-300 select-none">·</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              history.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'user' ? (
                    /* User Message Bubble */
                    <div className="max-w-[85%] bg-slate-900 text-white rounded-xl rounded-tr-xs px-3.5 py-2.5 text-xs sm:text-sm shadow-2xs font-normal border border-slate-800">
                      {msg.attachment && (
                        <div className="flex items-center gap-1.5 text-slate-300 border-b border-slate-700/80 pb-1.5 mb-1.5 text-xs">
                          <svg className="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <span className="font-medium truncate max-w-[160px]">{msg.attachment.filename}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(msg.attachment.size)})</span>
                        </div>
                      )}
                      <p className="leading-relaxed whitespace-pre-wrap break-words font-normal text-white">{msg.text}</p>
                      <span className="block text-[9px] text-right mt-1 font-mono text-slate-400 opacity-70">{msg.timestamp}</span>
                    </div>
                  ) : (
                    /* AI Message: Pure Open Editorial Content */
                    <div className="max-w-[92%] py-0.5">
                      {msg.text === 'AGM Assistant sedang memproses...' ? (
                        /* Subtle Thinking Indicator */
                        <div className="flex items-center gap-1.5 text-slate-500 py-1">
                          <span className="text-xs font-medium">{loadingStatusText}</span>
                          <div className="flex items-center gap-1">
                            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed break-words text-slate-800 text-xs sm:text-sm font-normal">
                          {msg.text}
                        </div>
                      )}
                      <span className="block text-[9px] text-slate-400 font-mono mt-1 opacity-60">{msg.timestamp}</span>
                    </div>
                  )}
                </div>
              ))
            )}

            {!isLoading && currentJobId && (
              <div className="flex justify-start">
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <p className="font-medium">AI server sedang offline atau job belum selesai.</p>
                  <span className="text-[9px] opacity-75 mt-0.5 block font-mono">Job ID: {currentJobId}</span>
                </div>
              </div>
            )}
          </div>

          {/* Integrated Unified Composer Container */}
          <div className="p-3 border-t border-slate-200/80 bg-white shrink-0">
            {/* Attachment Preview Bar */}
            {selectedFile && (
              <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 mb-2">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-semibold text-slate-800 px-1.5 py-0.5 bg-slate-200 rounded text-[10px]">
                    {getFileBadge(selectedFile.name)}
                  </span>
                  <span className="truncate max-w-[170px] font-medium text-slate-900">{selectedFile.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(selectedFile.size)})</span>
                </div>
                <button 
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }} 
                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
                  title="Remove attachment"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Input Row */}
            <div className="bg-slate-50 border border-slate-200 focus-within:border-slate-900 focus-within:bg-white rounded-xl px-3 py-1.5 flex items-center gap-2 transition-all">
              {/* Hidden File Input */}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept=".pdf,.txt,.docx,.csv,.xlsx" 
                className="hidden" 
              />
              
              {/* Attachment Paperclip Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach file (PDF, DOCX, TXT, CSV, XLSX)"
                aria-label="Attach file"
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-0.5 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={selectedFile ? "Tambahkan instruksi (opsional)..." : "Tanyakan sesuatu..."}
                aria-label="Send message input"
                className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                disabled={isLoading}
              />

              <button
                onClick={() => sendMessage()}
                disabled={isLoading || (!message.trim() && !selectedFile)}
                aria-label="Send message"
                className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 disabled:opacity-20 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatWidget;
