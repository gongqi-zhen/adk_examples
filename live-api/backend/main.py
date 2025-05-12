import asyncio
import websockets
import collections
import json
import logging
import sys
from websockets.protocol import State
from google.auth import default
from google.auth.transport import requests

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

HOST = 'us-central1-aiplatform.googleapis.com'
BACKEND_URL = f'wss://{HOST}/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent'
PROXY_HOST = 'localhost'
PROXY_PORT = 8080

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
        logging.info(f'Client connected: {client_websocket.remote_address}')


    def to_normal_json(self, message):
       return json.dumps(json.loads(message))


    def is_backend_alive(self):
        if self.backend_ws and self.backend_ws.state is State.OPEN:
            return True
        return False


    async def close_proxy_session(self):
        if self.exiting:
            return
        logging.info('Closing the proxy session.')
        self.exiting = True
        if self.client_ws.state is not State.CLOSED:
            logging.info(f'Closing the client: {self.client_ws.remote_address}')
            await self.client_ws.close()
        await self.close_backend_connection()
        for task in self.tasks:
            if not task.done():
                task.cancel()
        if self.reconnect_task and not self.reconnect_task.done():
            self.reconnect_task.cancel()


    async def close_backend_connection(self):
        if self.backend_ws and self.backend_ws.state is not State.CLOSED:
            logging.info('Closing the backend.')
            await self.backend_ws.close()
            self.backend_ws = None


    def may_reconnect_to_backend(self):
        if self.reconnect_task and not self.reconnect_task.done():
            return
        # Reconnect only if the client is still alive.
        if self.client_ws and self.client_ws.state is State.OPEN:
            self.reconnect_task = asyncio.create_task(self.connect_to_backend())


    async def connect_to_backend(self):
        logging.info(f'Connecting to the backend: {self.backend_url}')
        await self.close_backend_connection() # Close the current backend.

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
                # Send the live-api setup message
                if self.setup_message:
                    await self.backend_ws.send(
                        self.to_normal_json(self.setup_message)
                    )
                logging.info('Succeeded to connect to the backend.')
                self.reconnect_attempts = 0
                # Flush buffer
                await self.flush_buffer()
                return

            except Exception as e:
                logging.warning(f'Failed to connect to the bakcend: {e}')
                self.reconnect_attempts += 1
                await asyncio.sleep(delay)
        
        logging.error('Failed to connect to the backend, closining the client.')
        await self.close_proxy_session()


    async def flush_buffer(self):
        while self.message_buffer:
            message = self.message_buffer.popleft()
            try:
                await self.backend_ws.send(self.to_normal_json(message))
            except Exception as e:
                logging.error(f'Exception during flushing messages: {e}')
                self.message_buffer.appendleft(message)
                self.may_reconnect_to_backend()
                break


    async def handle_client_to_backend(self):
        try:
            async for message in self.client_ws:
                if not self.setup_message:
                    self.setup_message = message
                if self.is_backend_alive():
                    try:
                        await self.backend_ws.send(self.to_normal_json(message))
                    except Exception as e:
                        logging.error(f'Failed sending message to the backend: {e}')
                        logging.info('Start buffering.')
                        self.message_buffer.append(message)
                        self.may_reconnect_to_backend()
                else:
                    self.message_buffer.append(message)
                    self.may_reconnect_to_backend()
        except Exception as e:
            logging.error(f'Failed reciving from client: {e}')
        await self.close_proxy_session()


    async def handle_backend_to_client(self):
        while True:
            if self.backend_ws and self.backend_ws.state is not State.CLOSED:
                exception = False
                try:
                    message = await self.backend_ws.recv()
                    await self.client_ws.send(self.to_normal_json(message))
                except websockets.exceptions.ConnectionClosedOK:
                    logging.info('Backend has been closed.')
                    exception = True
                except Exception as e:
                    logging.errof(f'Exception during relaying backend to client: {e}')
                    exception = True
                if exception:
                    self.may_reconnect_to_backend()
                    await asyncio.sleep(0.1)
            else:
                await asyncio.sleep(0.5)
                if self.client_ws.state is State.CLOSED:
                    logging.info('Client has been closed.')
                    await self.close_proxy_session()
                    break


    async def run(self):
        try:
            # Wait for the first auth message from the client.
            await asyncio.wait_for(self.client_ws.recv(), timeout=5.0)
            await self.connect_to_backend()
            if self.is_backend_alive():
                self.tasks = [
                    asyncio.create_task(self.handle_client_to_backend()),
                    asyncio.create_task(self.handle_backend_to_client()),
                ]
                await asyncio.gather(*self.tasks)

        except Exception as e:
            logging.error(f'Exception in proxy handler: {e}')

        await self.close_proxy_session()
        logging.info(f'Exit from the proxy handler: {self.client_ws.remote_address}')


async def start_proxy_server():
    logging.info(f'Starting WebSocket proxy on {PROXY_HOST}:{PROXY_PORT}')
    async with websockets.serve(
        lambda ws: WebSocketProxy(ws).run(),
        PROXY_HOST,
        PROXY_PORT,
    ):
        await asyncio.Future() # Run forever.


if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    loop.run_until_complete(start_proxy_server())
