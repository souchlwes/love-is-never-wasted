"use client";

import { useState, useRef } from "react";
import html2canvas from "html2canvas"; 

export default function MacMailer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sentLetter, setSentLetter] = useState(null); 
  
  const audioRef = useRef(null);
  const formRef = useRef(null);
  const letterRef = useRef(null); 

  const toggleMusic = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      // Check if file is larger than 4.5 MB (4.5 * 1024 * 1024 bytes)
      if (file.size > 4.5 * 1024 * 1024) {
        showToast("File is too large! Please choose an image under 4.5MB.");
        e.target.value = ""; // Clears the input
        setFileName("");
        return;
      }
      setFileName(file.name);
    } else {
      setFileName("");
    }
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(""), 5000); 
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSending(true);

    const formData = new FormData(formRef.current);
    
    // ✅ THE TIMEZONE FIX: Translates local time to UTC so Vercel understands it
    const rawTime = formData.get('send_time');
    if (rawTime) {
      const universalTime = new Date(rawTime).toISOString();
      formData.set('send_time', universalTime);
    }
    
    const letterData = {
      to: formData.get('to'),
      subject: formData.get('subject'),
      message: formData.get('message'),
      sendTime: formData.get('send_time') // Uses the updated universal time if scheduled
    };
    
    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();

      if (result.success) {
        if (letterData.sendTime) {
          const dateObj = new Date(letterData.sendTime);
          const formattedTime = dateObj.toLocaleString('en-US', { 
            month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true 
          });
          showToast(`Letter scheduled for ${formattedTime}`);
        } else {
          showToast("Your letter was sent successfully!");
        }
        
        setSentLetter(letterData);
        setFileName("");
      } else {
        showToast("Error sending message. Try again.");
      }
    } catch (error) {
      showToast("Network error. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const downloadImage = async () => {
    if (!letterRef.current) return;
    
    showToast("Developing your letter..."); 

    try {
      const canvas = await html2canvas(letterRef.current, {
        scale: 2, 
        useCORS: true, 
        backgroundColor: null,
        // ✅ THE BORDER FIX: Removes the black line ONLY in the screenshot
        onclone: (document, element) => {
          element.style.border = 'none';
        }
      });
      
      const image = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = image;
      link.download = "loves-never-wasted.png";
      link.click();
    } catch (error) {
      console.error("Image generation failed", error);
      showToast("Failed to save image. Please try again.");
    }
  };

  return (
    <main className="layout-container">
      
      {sentLetter ? (
        <div className="mac-window wide">
          <div className="mac-titlebar">Your Sent Letter</div>
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
              <div className="letter-body">
                {sentLetter.message}
              </div>
            </div>

            <div className="flex-between" style={{ marginTop: '20px' }}>
              <button onClick={() => setSentLetter(null)}>Write Another</button>
              <button onClick={downloadImage}>Save as Image</button>
            </div>
            
          </div>
        </div>
      ) : (
        <div className="mac-window">
          <div className="mac-titlebar">Notes</div>
          <div className="mac-content">
            <form ref={formRef} onSubmit={handleSubmit}>
              <label htmlFor="to">To:</label>
              <input type="email" id="to" name="to" placeholder="recipient@example.com" required />

              <label htmlFor="subject">Subject:</label>
              <input type="text" id="subject" name="subject" placeholder="Your subject" required />

              <label htmlFor="message">Message:</label>
              <textarea id="message" name="message" placeholder="Write your letter here..." required></textarea>

              <label htmlFor="send_time">Send At (optional):</label>
              <input type="datetime-local" id="send_time" name="send_time" />

              <label>Attach a file (optional):</label>
              <input type="file" id="attachment" name="attachment" style={{ display: "none" }} onChange={handleFileChange} />
              <button type="button" onClick={() => document.getElementById("attachment").click()}>
                Choose File
              </button>
              <span className="file-name-display">{fileName}</span>

              <div className="send-button-container">
                <button type="submit" disabled={isSending}>
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mac-window">
        <div className="mac-titlebar">a couple minutes...</div>
        <div className="mac-content">
          <div className="pixel-button" onClick={toggleMusic}>
            {isPlaying ? (
              <div className="pause-icon"><div></div><div></div></div>
            ) : (
              <div className="play-icon"></div>
            )}
          </div>
          <audio ref={audioRef} src="/acoupleminutes.mp3" loop />
        </div>
      </div>

      {toastMessage && (
        <div className="toast-container">
          {toastMessage}
        </div>
      )}
    </main>
  );
}