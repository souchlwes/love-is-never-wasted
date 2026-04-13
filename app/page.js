"use client";

import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import Draggable from "react-draggable";

export default function MacMailer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState("");
  const [fileObj, setFileObj] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentLetter, setSentLetter] = useState(null);
  
  const [isMobile, setIsMobile] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  
  const [isZoomed, setIsZoomed] = useState(false);

  const [formValues, setFormValues] = useState({
    to: "", subject: "", message: "", send_time: ""
  });

  // Original Refs
  const audioRef = useRef(null);
  const letterRef = useRef(null);
  const editorRef = useRef(null); 

  // ✅ THE FIX: New Refs for the Draggable windows
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

  const formatText = (command) => {
    document.execCommand(command, false, null);
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
        if (editorRef.current) editorRef.current.innerHTML = "";
        localStorage.removeItem('macMailerDraft'); 
        setIsZoomed(false); 
      } else showToast("Error sending message. Try again.");
    } catch (error) { showToast("Network error. Please try again."); } 
    finally { setIsSending(false); }
  };

  const downloadImage = async () => {
    if (!letterRef.current) return;
    showToast("Developing your letter..."); 
    try {
      const canvas = await html2canvas(letterRef.current, {
        scale: 2, useCORS: true, backgroundColor: null,
        onclone: (document, element) => { element.style.border = 'none'; }
      });
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a"); link.href = image; link.download = "loves-never-wasted.png"; link.click();
    } catch (error) { showToast("Failed to save image. Please try again."); }
  };

  return (
    <main className="layout-container">
      
      {sentLetter ? (
        // ✅ Added nodeRef here
        <Draggable handle=".mac-titlebar" disabled={isMobile || isZoomed} nodeRef={sentWindowRef}>
          {/* ✅ Added ref here */}
          <div className="mac-window wide" ref={sentWindowRef}>
            <div className="mac-titlebar draggable-handle">Your Sent Letter</div>
            <div className="mac-content">
              
              <div className="letter-preview" ref={letterRef}>
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
              </div>

              <div className="flex-between" style={{ marginTop: '20px' }}>
                <button onClick={() => setSentLetter(null)}>Write Another</button>
                <button onClick={downloadImage}>Save as Image</button>
              </div>
              
            </div>
          </div>
        </Draggable>
      ) : (
        // ✅ Added nodeRef here
        <Draggable handle=".mac-titlebar" disabled={isMobile || isZoomed} nodeRef={notesWindowRef}>
          {/* ✅ Added ref here */}
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
                  <button type="button" onClick={() => formatText('bold')} style={{fontWeight: 'bold'}}>B</button>
                  <button type="button" onClick={() => formatText('italic')} style={{fontStyle: 'italic'}}>I</button>
                  <button type="button" onClick={() => formatText('underline')} style={{textDecoration: 'underline'}}>U</button>
                </div>
                
                <div
                  className="rich-editor"
                  contentEditable
                  spellCheck="false" // ✅ Fixes the "cross mark" issue
                  autoCorrect="off"
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

      {/* ✅ Added nodeRef here */}
      <Draggable handle=".mac-titlebar" disabled={isMobile || isZoomed} nodeRef={musicWindowRef}>
        {/* ✅ Added ref here */}
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
