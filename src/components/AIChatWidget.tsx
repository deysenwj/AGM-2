import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { FILE_CONFIG, formatFileSize, isValidFileExtension } from '../config/fileConfig';
import type { FurnitureDesignState } from '../types/furniture';
import { DesignSummaryCard } from './DesignSummaryCard';
import { AGMAssistantMark } from './AGMAssistantMark';

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
  designState?: FurnitureDesignState;
}

const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const getFileBadge = (filename: string): string => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'PDF';
  if (lower.endsWith('.docx')) return 'DOC';
  if (lower.endsWith('.csv')) return 'CSV';
  if (lower.endsWith('.xlsx')) return 'XLS';
  return 'TXT';
};

const parseDesignStateFromAiText = (rawText: string): { cleanText: string; designState?: FurnitureDesignState } => {
  const jsonBlockRegex = /```json_design_state\s*([\s\S]*?)\s*```/;
  const match = rawText.match(jsonBlockRegex);
  
  if (!match) {
    return { cleanText: rawText };
  }

  try {
    const parsedObj = JSON.parse(match[1]);
    const cleanText = rawText.replace(jsonBlockRegex, '').trim();
    
    return {
      cleanText: cleanText || 'Berikut adalah draf spesifikasi furniture sesuai kebutuhan Anda:',
      designState: {
        version: parsedObj.version || 1,
        category: parsedObj.category || 'furniture',
        subcategory: parsedObj.subcategory,
        style: parsedObj.style,
        dimensions: {
          width: parsedObj.dimensions?.width ?? parsedObj.width,
          depth: parsedObj.dimensions?.depth ?? parsedObj.depth,
          height: parsedObj.dimensions?.height ?? parsedObj.height,
          unit: parsedObj.dimensions?.unit || 'cm'
        },
        material: parsedObj.material,
        color: parsedObj.color,
        finish: parsedObj.finish,
        capacity: parsedObj.capacity,
        leg: parsedObj.leg,
        sections: parsedObj.sections,
        notes: parsedObj.notes,
        status: parsedObj.status || 'draft',
        visualization: parsedObj.visualization || { status: 'none' }
      }
    };
  } catch (err) {
    console.warn('Failed parsing json_design_state block from AI:', err);
    return { cleanText: rawText };
  }
};


const AIChatWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [history, setHistory] = useState<Message[]>([]);
  const [activeDesignState, setActiveDesignState] = useState<FurnitureDesignState | null>(null);
  const [isSubmittingCustomReq, setIsSubmittingCustomReq] = useState(false);
  const [isSubmittedCustomReq, setIsSubmittedCustomReq] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatusText, setLoadingStatusText] = useState('Sedang memproses...');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationIdRef = useRef<string>(generateUuid());

  const handleJobCompleted = (status: string, responseText?: string, errorText?: string, source: 'Realtime' | 'Polling' = 'Realtime') => {
    console.log(`[AI ${source.toUpperCase()}] response received via ${source}. Status: ${status}`);
    setCurrentJobId(null);
    setIsLoading(false);
    setLoadingStatusText('Sedang memproses...');

    if (status === 'completed' && responseText) {
      const { cleanText, designState } = parseDesignStateFromAiText(responseText);
      
      if (designState) {
        setActiveDesignState(designState);
      }

      setHistory(prev => prev.map(msg => 
        msg.text === 'AGM Assistant sedang memproses...' 
          ? { 
              sender: 'ai', 
              text: cleanText, 
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              designState: designState
            }
          : msg
      ));
    } else if (status === 'failed' && errorText) {
      const errorMessageText = `Terjadi kesalahan: ${errorText}`;
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
  }, [history, isLoading, activeDesignState]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidFileExtension(file.name)) {
      alert('Format file tidak didukung. Gunakan PDF, DOCX, TXT, CSV, atau XLSX.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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

      if (activeFile) {
        setLoadingStatusText('Memproses file...');
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

      setLoadingStatusText('Menyiapkan rekomendasi...');

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
          attachment: uploadedAttachmentInfo,
          currentDesignState: activeDesignState
        }),
      });

      const responseText = await response.text();
      let data: any = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        throw new Error(`Server response error (HTTP ${response.status})`);
      }

      if (!response.ok || data.success === false) {
        throw new Error(data.message || `Gagal mengirim permintaan.`);
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
      setLoadingStatusText('Sedang memproses...');
      setCurrentJobId(null);
      console.error('Error sending message:', error);
    }
  };

  const submitCustomRequestToAdmin = async () => {
    if (!activeDesignState || isSubmittingCustomReq) return;
    setIsSubmittingCustomReq(true);

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id || generateUuid();

      const res = await fetch('/api/ai/custom-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId
        },
        body: JSON.stringify({
          conversationId: conversationIdRef.current,
          designState: activeDesignState
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gagal mengajukan spesifikasi ke Admin.');
      }

      setIsSubmittedCustomReq(true);
      setHistory(prev => [
        ...prev,
        {
          sender: 'ai',
          text: 'Spesifikasi custom furniture Anda telah berhasil dikirim ke Admin AGM. Tim kami akan memeriksa dan memberikan penawaran resmi secepatnya.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

    } catch (err: any) {
      alert(`Gagal mengirim pengajuan: ${err.message}`);
    } finally {
      setIsSubmittingCustomReq(false);
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
    setActiveDesignState(null);
    setIsSubmittedCustomReq(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    conversationIdRef.current = generateUuid();
    setCurrentJobId(null);
    setIsLoading(false);
    setLoadingStatusText('Sedang memproses...');
  };

  return (
    <>
      {/* 52px Circular Launcher with AGMAssistantMark (Dark Variant) */}
      {!isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
          <button
            onClick={() => setIsOpen(true)}
            aria-label="AGM Assistant"
            title="AGM Assistant"
            className="bg-slate-900 text-white rounded-full w-13 h-13 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center border border-slate-700 focus:outline-none cursor-pointer"
          >
            <AGMAssistantMark variant="dark" className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* Floating Commerce Consultation Panel */}
      {isOpen && (
        <div 
          className="fixed bottom-0 left-0 right-0 sm:bottom-6 sm:right-6 sm:left-auto z-50 w-full sm:w-[440px] h-[85vh] sm:h-[640px] max-h-[100dvh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in mx-auto sm:mx-0 font-sans"
        >
          {/* Header Bar - Ultra Minimal */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white text-slate-900 select-none h-[52px] shrink-0">
            <div className="flex items-center gap-2">
              <AGMAssistantMark variant="light" className="w-5 h-5 text-slate-900" />
              <h3 className="font-semibold text-slate-900 text-sm tracking-tight">AGM Assistant</h3>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={clearConversation} 
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                title="Hapus percakapan"
                aria-label="Hapus percakapan"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded transition-colors cursor-pointer"
                title="Tutup AGM Assistant"
                aria-label="Tutup AGM Assistant"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Canvas Area */}
          <div ref={chatWindowRef} className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50 text-slate-900 text-xs sm:text-sm min-h-0 flex flex-col justify-start font-sans">
            {history.length === 0 ? (
              /* Intentional Editorial Commerce Layout Empty State */
              <div className="py-6 flex flex-col items-start justify-center px-2 my-auto max-w-sm">
                <AGMAssistantMark variant="light" className="w-7 h-7 text-slate-900 mb-3" />
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug mb-2">
                  Cari furniture, tentukan ukuran,<br />atau rancang furniture custom Anda.
                </h2>
                <p className="text-xs text-slate-600 mb-5 leading-relaxed">
                  Saya dapat membantu Anda menemukan produk yang sesuai atau menyusun spesifikasi furniture sesuai kebutuhan.
                </p>

                {/* Editorial Primary Actions */}
                <div className="w-full space-y-2">
                  <button
                    onClick={() => sendMessage('Saya ingin mencari produk furniture dari katalog AGM')}
                    className="w-full py-2.5 px-3.5 bg-slate-900 text-white rounded font-medium text-xs text-left hover:bg-slate-800 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>Cari dari katalog</span>
                    <span>→</span>
                  </button>
                  <button
                    onClick={() => sendMessage('Saya ingin mulai desain custom furniture')}
                    className="w-full py-2.5 px-3.5 bg-white border border-slate-300 text-slate-900 rounded font-medium text-xs text-left hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span>Rancang furniture custom</span>
                    <span>→</span>
                  </button>
                </div>
              </div>
            ) : (
              history.map((msg, index) => (
                <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender === 'user' ? (
                    <div className="max-w-[85%] bg-slate-900 text-white rounded px-3.5 py-2.5 text-xs sm:text-sm font-normal border border-slate-800">
                      {msg.attachment && (
                        <div className="flex items-center gap-1.5 text-slate-300 border-b border-slate-800 pb-1.5 mb-1.5 text-xs">
                          <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                          <span className="font-medium truncate max-w-[160px]">{msg.attachment.filename}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({formatFileSize(msg.attachment.size)})</span>
                        </div>
                      )}
                      <p className="leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                      <span className="block text-[9px] text-right mt-1 font-mono text-slate-400">{msg.timestamp}</span>
                    </div>
                  ) : (
                    <div className="max-w-[95%] py-0.5 w-full">
                      {msg.text === 'AGM Assistant sedang memproses...' ? (
                        <div className="text-xs text-slate-500 font-medium py-1 animate-pulse">
                          {loadingStatusText}
                        </div>
                      ) : (
                        <div>
                          <div className="whitespace-pre-wrap leading-relaxed break-words text-slate-900 text-xs sm:text-sm font-normal">
                            {msg.text}
                          </div>

                          {msg.designState && (
                            <DesignSummaryCard
                              design={msg.designState}
                              onUpdateDesign={() => {
                                setMessage("Saya ingin mengubah spesifikasi desain ini: ");
                              }}
                              onSubmitToAdmin={submitCustomRequestToAdmin}
                              isSubmitting={isSubmittingCustomReq}
                              isSubmitted={isSubmittedCustomReq}
                            />
                          )}
                        </div>
                      )}
                      <span className="block text-[9px] text-slate-400 font-mono mt-1">{msg.timestamp}</span>
                    </div>
                  )}
                </div>
              ))
            )}

            {!isLoading && currentJobId && (
              <div className="flex justify-start">
                <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <p className="font-medium">Layanan sedang sibuk atau offline.</p>
                  <span className="text-[9px] opacity-75 mt-0.5 block font-mono">Job ID: {currentJobId}</span>
                </div>
              </div>
            )}
          </div>

          {/* Unified Composer Container */}
          <div className="p-3 border-t border-slate-200 bg-white shrink-0">
            {selectedFile && (
              <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-700 mb-2">
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
                  className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Remove attachment"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-300 focus-within:border-slate-900 focus-within:bg-white rounded px-3 py-2 flex items-center gap-2 transition-all">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                accept=".pdf,.txt,.docx,.csv,.xlsx" 
                className="hidden" 
              />
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Tambahkan foto atau file"
                aria-label="Tambahkan foto atau file"
                className="text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-0.5 shrink-0 cursor-pointer"
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
                placeholder={selectedFile ? "Tambahkan instruksi (opsional)..." : "Jelaskan kebutuhan furniture Anda..."}
                aria-label="Send message input"
                className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none font-sans"
                disabled={isLoading}
              />

              <button
                onClick={() => sendMessage()}
                disabled={isLoading || (!message.trim() && !selectedFile)}
                aria-label="Kirim pesan"
                className="w-7 h-7 rounded bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 disabled:opacity-20 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all shrink-0 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
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
