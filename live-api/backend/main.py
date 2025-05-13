import asyncio
import websockets
import collections
import json
import logging
import sys
import uuid
from websockets.protocol import State
from google.auth import default
from google.auth.transport import requests
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(session_id)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

HOST = 'us-central1-aiplatform.googleapis.com'
BACKEND_URL = f'wss://{HOST}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent'

MAX_RECONNECT_ATTEMPTS = 10
INITIAL_RECONNECT_DELAY = 1 # sec

class WebSocketProxy:
    def __init__(self, client_websocket):
        self.client_ws = client_websocket
        self.backend_ws = None
        self.backend_url = BACKEND_URL
        self.message_buffer = collections.deque()
        self.reconnect_attempts = 0
        self.reconnect_task = None
        self.tasks = []
        self.setup_message = None
        self.exiting = False
        self.session_id = uuid.uuid4().hex[:8]
        self._log('info', f'Client connected: {client_websocket.client}')


    def _log(self, level, message, *args, **kwargs):
        if 'extra' in kwargs:
            kwargs['extra']['session_id'] = self.session_id
        else:
            kwargs['extra'] = {'session_id': self.session_id}

        if level == 'info':
            logging.info(message, *args, **kwargs)
        elif level == 'warning':
            logging.warning(message, *args, **kwargs)
        elif level == 'error':
            logging.error(message, *args, **kwargs)


    def to_normal_json(self, message):
        try:
            return json.dumps(json.loads(message))
        except json.JSONDecodeError:
            self._log('warning', f'Received non-JSON message: {message}')
            return message


    def is_backend_alive(self):
        if self.backend_ws and self.backend_ws.state is State.OPEN:
            return True
        return False


    def is_client_alive(self):
        if (self.client_ws
            and self.client_ws.client_state is WebSocketState.CONNECTED):
            return True
        return False


    async def close_proxy_session(self):
        if self.exiting:
            return
        self._log('info', 'Closing proxy session.')
        self.exiting = True
        if self.is_client_alive():
            await self.client_ws.close()
        await self.close_backend_connection()
        for task in self.tasks:
            if not task.done():
                task.cancel()
        if self.reconnect_task and not self.reconnect_task.done():
            self.reconnect_task.cancel()


    async def close_backend_connection(self):
        if self.backend_ws and self.backend_ws.state is not State.CLOSED:
            await self.backend_ws.close()
            self.backend_ws = None


    def may_reconnect_to_backend(self):
        if self.reconnect_task and not self.reconnect_task.done():
            return
        if self.is_client_alive(): # Reconnect only when client is alive.
            self.reconnect_task = asyncio.create_task(self.connect_to_backend())


    async def connect_to_backend(self):
        self._log('info', f'Connecting to backend: {self.backend_url}')
        await self.close_backend_connection()

        credentials, project_id = default()
        access_token = credentials.token
        if not access_token or credentials.expired:
            credentials.refresh(requests.Request())
            access_token = credentials.token
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
        }

        while self.reconnect_attempts < MAX_RECONNECT_ATTEMPTS:
            delay = INITIAL_RECONNECT_DELAY * (2 ** self.reconnect_attempts)
            delay = min(delay, 60)

            try:
                self.backend_ws = await websockets.connect(
                    self.backend_url,
                    additional_headers=headers,
                )
                if self.setup_message:
                    await self.backend_ws.send(
                        self.to_normal_json(self.setup_message)
                    )
                self._log('info', f'Backend connected: {self.backend_url}')
                self.reconnect_attempts = 0
                await self.flush_buffer()
                return

            except Exception as e:
                self._log('warning', f'Failed to connect backend: {e}')
                self.reconnect_attempts += 1
                await asyncio.sleep(delay)
        
        await self.close_proxy_session()


    async def flush_buffer(self):
        while self.message_buffer:
            message = self.message_buffer.popleft()
            try:
                await self.backend_ws.send(self.to_normal_json(message))
            except Exception as e:
                self._log('error', f'Exception during flushing messages: {e}')
                self.message_buffer.appendleft(message)
                self.may_reconnect_to_backend()
                break


    async def handle_client_to_backend(self):
        try:
            async for message in self.client_ws.iter_text():
                if not self.setup_message:
                    self.setup_message = message
                if self.is_backend_alive():
                    try:
                        await self.backend_ws.send(self.to_normal_json(message))
                    except Exception as e:
                        self._log('error', f'Failed sending message to backend: {e}')
                        self._log('info', 'Buffering started.')
                        self.message_buffer.append(message)
                        self.may_reconnect_to_backend()
                else:
                    self.message_buffer.append(message)
                    self.may_reconnect_to_backend()
        except WebSocketDisconnect:
            self._log('info', 'Client disconnected.')
        except Exception as e:
            self._log('error', f'Failed receiving from client: {e}')
        await self.close_proxy_session()


    async def handle_backend_to_client(self):
        while True:
            if self.backend_ws and self.backend_ws.state is not State.CLOSED:
                exception = False
                try:
                    message = await self.backend_ws.recv()
                    await self.client_ws.send_text(self.to_normal_json(message))
                except websockets.exceptions.ConnectionClosedOK:
                    self._log('info', 'Backend closed.')
                    exception = True
                except Exception as e:
                    self._log('error', f'Exception during relaying backend to client: {e}')
                    exception = True
                if exception:
                    self.may_reconnect_to_backend()
                    await asyncio.sleep(0.1)
            else:
                await asyncio.sleep(0.5)
                if self.client_ws.client_state is WebSocketState.DISCONNECTED:
                    self._log('info', 'Client closed.')
                    await self.close_proxy_session()
                    break


    async def run(self):
        try:
            # Wait for the first auth message from client.
            await asyncio.wait_for(self.client_ws.receive_text(), timeout=5.0)
            await self.connect_to_backend()
            if self.is_backend_alive():
                self.tasks = [
                    asyncio.create_task(self.handle_client_to_backend()),
                    asyncio.create_task(self.handle_backend_to_client()),
                ]
                await asyncio.gather(*self.tasks)
        except asyncio.CancelledError:
            self._log('info', f'Proxy task cancelled for client: {self.client_ws.client}')
        except Exception as e:
            self._log('error', f'Exception in proxy handler: {e}')

        await self.close_proxy_session()


app = FastAPI()

@app.websocket('/ws')
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    proxy = WebSocketProxy(websocket)
    await proxy.run()


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8080)
