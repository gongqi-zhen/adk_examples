import { useState, useRef, useEffect } from "react";
import TextChat from "components/TextChat";
import { GeminiLiveAPI } from "lib/gemini-live-api";

export default function WebConsole() {

  const PROXY_URL = "ws://websocket-proxy-xxxxxxxx.us-central1.run.app/ws"
  const PROJECT_ID = "xxxxxxx";
  const MODEL = "gemini-2.0-flash-live-preview-04-09";
  const API_HOST = "us-central1-aiplatform.googleapis.com"; 

  const _geminiLiveApi = useRef(
	  new GeminiLiveAPI(PROXY_URL, PROJECT_ID, MODEL, API_HOST)
  );

  const geminiLiveApi = _geminiLiveApi.current

  const [newModelMessage, setNewModelMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");

  geminiLiveApi.onErrorMessage = (message) => {
    console.log(message);
    setConnectionStatus("disconnected");
  };


  const connect = () => {
    geminiLiveApi.responseModalities = ["TEXT"];
    geminiLiveApi.systemInstructions = "Talk in Japanese";
    geminiLiveApi.onConnectionStarted = () => {
        setConnectionStatus("connected");
//        startAudioInput();
    };
    geminiLiveApi.setProjectId(PROJECT_ID);
    geminiLiveApi.connect(""); // Access token is not required.
  };

  const disconnect = () => {
    setConnectionStatus("disconnected");
    geminiLiveApi.disconnect();
  // stopAudioInput();
  };

  geminiLiveApi.onReceiveResponse = (messageResponse) => {
    if (messageResponse.type == "AUDIO") {
 //       liveAudioOutputManager.playAudioChunk(messageResponse.data);
    } else if (messageResponse.type == "TEXT") {
        const message = messageResponse.data;
        console.log("Gemini said: ", message);
        setNewModelMessage(message); // Realy the message to child components.
    }
  };

  const sendTextMessage = (message) => {
    console.log("Sending text to live API: ", message)
    geminiLiveApi.sendTextMessage(message);
  };

  let connectButton;
  if (connectionStatus == "connected") {
    connectButton = (
      <button className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
              onClick={disconnect}>Disconnect</button>
    );
  } else {
    connectButton = (
      <button className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
              onClick={connect}>Connect</button>
    );
  }

  const element = (
    <>
      <div className="flex flex-col h-screen">
        <header className="bg-blue-200 p-4 shadow-md z-10 flex-shrink-0">
          <div className="text-2xl font-bold text-gray-800">Gemini Live API Web Console</div>
	  <br/>
	  {connectButton}

        </header>

        <div className="flex-grow overflow-y-auto p-6 bg-gray-50">
            <TextChat
	      sendTextMessage={sendTextMessage}
              newModelMessage={newModelMessage}
              setNewModelMessage={setNewModelMessage}
              connectionStatus={connectionStatus}	    
	    />
        </div>
      </div>
    </>
  );

  return element;
}
