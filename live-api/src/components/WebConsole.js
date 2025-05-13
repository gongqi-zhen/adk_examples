import { useState, useRef, useEffect } from "react";
import TextChat from "components/TextChat";
import ToggleSwitch from "components/ToggleSwitch";
import { GeminiLiveAPI } from "lib/gemini-live-api";
import { LiveAudioOutputManager } from "lib/live-media-manager";

export default function WebConsole() {

  const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL;
  const PROJECT_ID = process.env.NEXT_PUBLIC_PROJECT_ID;
  const MODEL = "gemini-2.0-flash-live-preview-04-09";
  const API_HOST = "us-central1-aiplatform.googleapis.com"; 

  const [newModelMessage, setNewModelMessage] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [responseModality, setResponseModality] = useState("Text");
  const [audioInput, setAudioInput] = useState("Mic-off");

  const isNotDisconnected = () => {
    return (connectionStatus !== "disconnected");
  };

  const _geminiLiveApi = useRef(
    new GeminiLiveAPI(PROXY_URL, PROJECT_ID, MODEL, API_HOST)
  );
  const geminiLiveApi = _geminiLiveApi.current;

  const _liveAudioOutputManager = useRef(
    new LiveAudioOutputManager()
  );
  const liveAudioOutputManager = _liveAudioOutputManager.current;

  geminiLiveApi.onErrorMessage = (message) => {
    console.log(message);
    setConnectionStatus("disconnected");
  };

  const connect = () => {
    geminiLiveApi.responseModalities = responseModality.toUpperCase();
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
      liveAudioOutputManager.playAudioChunk(messageResponse.data);
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
          <div className="text-2xl font-bold text-gray-800">
	    Gemini Live API Web Console
          </div>
	  <br/>
	  <div>{connectButton}</div>
	  <br/>
          <div><ToggleSwitch
            id="responseModality"    
            labelLeft="Text" labelRight="Audio"
            setValue={setResponseModality}
	    disabled={isNotDisconnected}
          /></div>
	  <br/>
          <div><ToggleSwitch
            id="audioInput"    
            labelLeft="Mic-on" labelRight="Mic-off"
            setValue={setAudioInput}
	    disabled={() => {return false}}
          /></div>

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
