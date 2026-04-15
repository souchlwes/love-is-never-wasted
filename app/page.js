"use client";

import { useState, useRef, useEffect } from "react";
import { toPng } from 'html-to-image';
import Draggable from "react-draggable";

// Safari Security Bypass function.
const getBase64Resource = async (url) => {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to load resource:", url, e);
    return null;
  }
};

export default function MacMailer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileObj, setFileObj] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentLetter, setSentLetter] = useState(null);
  
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [isMobile, setIsMobile] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  
  const [isZoomed, setIsZoomed] = useState(false);

  // Track the chosen paper format
  const [paperFormat, setPaperFormat] = useState("receipt");

  // Track active formatting toggles
  const [activeStyles, setActiveStyles] = useState({
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: true,
    justifyCenter: false,
    justifyRight: false,
    justifyFull: false
  });

  const [formValues, setFormValues] = useState({
    to: "", subject: "", message: "", send_time: ""
  });

  const audioRef = useRef(null);
  const letterRef = useRef(null);
  const editorRef = useRef(null); 

  const sentWindowRef = useRef(null);
  const notesWindowRef = useRef(null);
  const musicWindowRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const savedDraft = localStorage.getItem('macMailerDraft');
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        setFormValues(parsedDraft);
        if (editorRef.current && parsedDraft.message) {
          editorRef.current.innerHTML = parsedDraft.message;
        }
      } catch (e) { console.error("Failed to parse draft"); }
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleMusic = () => {
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 5000); 
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newValues = { ...formValues, [name]: value };
    setFormValues(newValues);
    localStorage.setItem('macMailerDraft', JSON.stringify(newValues));
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData ? e.clipboardData.getData("text/plain") : "";
    document.execCommand("insertText", false, text);
  };

  const formatText = (command) => {
    document.execCommand(command, false, null);
    
    if (['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'].includes(command)) {
      setActiveStyles(prev => ({
        ...prev,
        justifyLeft: command === 'justifyLeft',
        justifyCenter: command === 'justifyCenter',
        justifyRight: command === 'justifyRight',
        justifyFull: command === 'justifyFull',
      }));
    } else {
      setActiveStyles(prev => ({
        ...prev,
        [command]: !prev[command]
      }));
    }

    if (editorRef.current) {
      editorRef.current.focus();
      handleInputChange({ target: { name: 'message', value: editorRef.current.innerHTML } });
    }
  };

  const handleEditorInput = (e) => {
    handleInputChange({ target: { name: 'message', value: e.currentTarget.innerHTML } });
  };

  const processFile = (file) => {
    if (file) {
      if (file.size > 4.5 * 1024 * 1024) {
        showToast("File is too large! Please choose an image under 4.5MB.");
        setFileName(""); setFileObj(null); return;
      }
      setFileName(file.name); setFileObj(file);
    } else {
      setFileName(""); setFileObj(null);
    }
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);

  const handleDragOver = (e) => { e.preventDefault(); setIsDraggingFile(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDraggingFile(false); };
  const handleDrop = (e) => {
    e.preventDefault(); setIsDraggingFile(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0]);
  };

  const handleTouchStart = (e) => setTouchStart(e.touches[0].clientX);
  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    if (Math.abs(touchStart - e.changedTouches[0].clientX) > 50) setToastMessage(""); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValues.message || formValues.message.trim() === "") {
        showToast("Please write a message first!");
        return;
    }
    
    setIsSending(true);

    const formData = new FormData();
    formData.append('to', formValues.to);
    formData.append('subject', formValues.subject);
    formData.append('message', formValues.message);

    if (formValues.send_time) formData.append('send_time', new Date(formValues.send_time).toISOString());
    if (fileObj) formData.append('attachment', fileObj);
    
    const letterData = {
      to: formValues.to, subject: formValues.subject, message: formValues.message,
      sendTime: formValues.send_time ? new Date(formValues.send_time).toISOString() : null
    };
    
    try {
      const response = await fetch('/api/send', { method: 'POST', body: formData });
      const result = await response.json();

      if (result.success) {
        if (letterData.sendTime) {
          const dateObj = new Date(letterData.sendTime);
          const formattedTime = dateObj.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
          showToast(`Letter scheduled for ${formattedTime}`);
        } else showToast("Your letter was sent successfully!");
        
        setSentLetter(letterData);
        setFileName(""); setFileObj(null);
        setFormValues({ to: "", subject: "", message: "", send_time: "" });
        
        setActiveStyles({ bold: false, italic: false, underline: false, justifyLeft: true, justifyCenter: false, justifyRight: false, justifyFull: false });
        
        if (editorRef.current) editorRef.current.innerHTML = "";
        localStorage.removeItem('macMailerDraft'); 
        setIsZoomed(false); 
      } else showToast("Error sending message. Try again.");
    } catch (error) { showToast("Network error. Please try again."); } 
    finally { setIsSending(false); }
  };

  const downloadImage = async () => {
    if (!letterRef.current) return;
    
    setIsDownloading(true);
    showToast("Developing your letter..."); 

    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      await document.fonts.ready;

      const font1742 = await getBase64Resource('/1742.ttf');
      const font1545 = await getBase64Resource('/1545.ttf');
      const fontDotGothic = await getBase64Resource('/dotgothic16.ttf'); 

      let injectedCss = '';
      if (font1742) injectedCss += `@font-face { font-family: '1742'; src: url('${font1742}') format('truetype'); }\n`;
      if (font1545) injectedCss += `@font-face { font-family: '1545'; src: url('${font1545}') format('truetype'); }\n`;
      if (fontDotGothic) injectedCss += `@font-face { font-family: 'DotGothic16'; src: url('${fontDotGothic}') format('truetype'); }\n`;

      const targetNode = letterRef.current;

      const options = {
        quality: 1,
        pixelRatio: 2,
        width: targetNode.offsetWidth, 
        fontEmbedCSS: injectedCss,
        style: {
          margin: '0',
          boxShadow: 'none'
        }
      };

      await toPng(targetNode, options);
      const dataUrl = await toPng(targetNode, options);
      
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "loves-never-wasted.png";
      link.click();
    } catch (error) { 
      console.error("Canvas error:", error);
      showToast("Failed to save image. Please try again."); 
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <main className="layout-container">
      
      {sentLetter ? (
        <Draggable handle=".mac-titlebar" disabled={isMobile || isZoomed} nodeRef={sentWindowRef}>
          <div className={`mac-window ${paperFormat === 'letter' ? 'extra-wide' : 'wide'}`} ref={sentWindowRef}>
            <div className="mac-titlebar draggable-handle">Your Sent Letter</div>
            <div className="mac-content">
              
              <div 
                className={`letter-preview ${paperFormat}`} 
                ref={letterRef}
                style={{ border: isDownloading ? 'none' : '2px solid #000' }}
              >
                
                {/* ✅ THE FIX: Separate rendering logic for US Letter vs Receipt */}
                {paperFormat === 'letter' ? (
                  <>
                    <div className="letter-top-banner">
                      <div className="letter-catchphrase">TU PEUX LACHER PRISE</div>
                    </div>
                    <div className="letter-header">
                      <div>To: {sentLetter.to}</div>
                      <div>Subject: {sentLetter.subject}</div>
                      <div>
                        Sent: {sentLetter.sendTime 
                          ? new Date(sentLetter.sendTime).toLocaleString('en-US', { hour12: true }) 
                          : new Date().toLocaleString('en-US', { hour12: true })}
                      </div>
                    </div>
                    <div className="letter-body" dangerouslySetInnerHTML={{ __html: sentLetter.message }}></div>
                  </>
                ) : (
                  /* ✅ THE FIX: Custom Receipt Layout exactly matching the photo */
                  <>
                    <div className="receipt-header-info">
                      <div>TO: {sentLetter.to}</div>
                      <div>SUBJECT: {sentLetter.subject}</div>
                      <div>
                        SENT: {sentLetter.sendTime 
                          ? new Date(sentLetter.sendTime).toLocaleString('en-US', { hour12: true }).toUpperCase() 
                          : new Date().toLocaleString('en-US', { hour12: true }).toUpperCase()}
                      </div>
                    </div>
                    
                    <div className="letter-body" dangerouslySetInnerHTML={{ __html: sentLetter.message }}></div>

                    <div className="receipt-bottom-banner">
                      <div className="receipt-catchphrase">TU PEUX LACHER PRISE</div>
                    </div>
                  </>
                )}
                
              </div>

              <div className="flex-between" style={{ marginTop: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <button onClick={() => setSentLetter(null)}>Write Another</button>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ fontWeight: 'bold', margin: 0 }}>Format:</label>
                  <div className="retro-select-wrapper">
                    <select 
                      className="format-selector"
                      value={paperFormat} 
                      onChange={(e) => setPaperFormat(e.target.value)}
                    >
                      <option value="receipt">Receipt (Narrow)</option>
                      <option value="letter">US Letter (Wide)</option>
                    </select>
                  </div>
                </div>

                <button onClick={downloadImage}>Save as Image</button>
              </div>
              
            </div>
          </div>
        </Draggable>
      ) : (
        <Draggable handle=".mac-titlebar" disabled={isMobile || isZoomed} nodeRef={notesWindowRef}>
          <div className={`mac-window ${isZoomed ? 'zoomed-window' : ''}`} ref={notesWindowRef}>
            
            <div className="mac-titlebar flex-between draggable-handle">
              <span>Notes</span>
              <button 
                type="button" 
                className="mac-zoom-button" 
                onClick={() => setIsZoomed(!isZoomed)}
                title="Zoom Window"
              ></button>
            </div>

            <div 
              className={`mac-content drop-zone ${isDraggingFile ? 'dragging' : ''}`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            >
              <form onSubmit={handleSubmit}>
                <label htmlFor="to">To:</label>
                <input type="email" id="to" name="to" value={formValues.to} onChange={handleInputChange} placeholder="recipient@example.com" required />

                <label htmlFor="subject">Subject:</label>
                <input type="text" id="subject" name="subject" value={formValues.subject} onChange={handleInputChange} placeholder="Your subject" required />

                <label>Message:</label>
                
                <div className="editor-toolbar">
                  <button type="button" onClick={() => formatText('bold')} className={activeStyles.bold ? 'active' : ''} style={{fontWeight: 'bold'}}>B</button>
                  <button type="button" onClick={() => formatText('italic')} className={activeStyles.italic ? 'active' : ''} style={{fontStyle: 'italic'}}>I</button>
                  <button type="button" onClick={() => formatText('underline')} className={activeStyles.underline ? 'active' : ''} style={{textDecoration: 'underline'}}>U</button>
                  
                  <div className="toolbar-divider"></div>
                  
                  <button type="button" onClick={() => formatText('justifyLeft')} className={activeStyles.justifyLeft ? 'active' : ''}>Left</button>
                  <button type="button" onClick={() => formatText('justifyCenter')} className={activeStyles.justifyCenter ? 'active' : ''}>Center</button>
                  <button type="button" onClick={() => formatText('justifyRight')} className={activeStyles.justifyRight ? 'active' : ''}>Right</button>
                  <button type="button" onClick={() => formatText('justifyFull')} className={activeStyles.justifyFull ? 'active' : ''}>Justify</button>
                </div>
                
                <div
                  className="rich-editor"
                  contentEditable
                  spellCheck="false" 
                  autoCorrect="off"
                  onPaste={handlePaste}
                  ref={editorRef}
                  onInput={handleEditorInput}
                  placeholder="Write your letter here..."
                ></div>

                <label htmlFor="send_time">Send At (optional):</label>
                <input type="datetime-local" id="send_time" name="send_time" value={formValues.send_time} onChange={handleInputChange} />

                <label>Attach a file (or drag & drop):</label>
                <input type="file" id="attachment" name="attachment" style={{ display: "none" }} onChange={handleFileChange} />
                <button type="button" onClick={() => document.getElementById("attachment").click()}>Choose File</button>
                <span className="file-name-display">{fileName}</span>

                <div className="send-button-container">
                  <button type="submit" disabled={isSending}>
                    {isSending ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Draggable>
      )}

      <Draggable handle=".mac-titlebar" disabled={isMobile || isZoomed} nodeRef={musicWindowRef}>
        <div className="mac-window" ref={musicWindowRef}>
          <div className="mac-titlebar draggable-handle">a couple minutes...</div>
          <div className="mac-content">
            <div className="pixel-button" onClick={toggleMusic}>
              {isPlaying ? <div className="pause-icon"><div></div><div></div></div> : <div className="play-icon"></div>}
            </div>
            <audio ref={audioRef} src="/acoupleminutes.mp3" loop />
          </div>
        </div>
      </Draggable>

      {toastMessage && (
        <div className="toast-container" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {toastMessage}
        </div>
      )}
    </main>
  );
}
