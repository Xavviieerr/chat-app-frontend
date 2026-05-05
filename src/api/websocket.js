class WebSocketManager {
	constructor() {
		this.socket = null;
		this.listeners = new Set();
		this.token = null;
		this.reconnectTimeout = null;
		this.heartbeatInterval = null;
	}

	connect(token) {
		if (!token) {
			console.warn("⚠️ WebSocket: No token provided, skipping connection");
			return;
		}

		// Avoid redundant connections if token hasn't changed and socket is open/connecting
		if (this.socket && this.token === token && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
			return;
		}

		this.token = token;
		this.clearTimers();

		if (this.socket) {
			this.socket.close();
		}

		console.log("🔌 WebSocket: Connecting...");
		
		try {
			this.socket = new WebSocket(`wss://whisperbox.koyeb.app/ws?token=${encodeURIComponent(token)}`);

			this.socket.onopen = () => {
				console.log("✅ WebSocket: Connection established");
				this.startHeartbeat();
			};

			this.socket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					this.listeners.forEach((listener) => listener(data));
				} catch (e) {
					console.error("❌ WebSocket: Failed to parse message", e);
				}
			};

			this.socket.onclose = (event) => {
				console.log(`🔌 WebSocket: Connection closed (code: ${event.code})`);
				this.socket = null;
				this.stopHeartbeat();

				// Reconnect if not closed normally
				if (event.code !== 1000 && this.token) {
					console.log("🔄 WebSocket: Attempting to reconnect in 3s...");
					this.reconnectTimeout = setTimeout(() => this.connect(this.token), 3000);
				}
			};

			this.socket.onerror = (error) => {
				console.error("❌ WebSocket: Error detected", error);
			};
		} catch (err) {
			console.error("❌ WebSocket: Failed to create socket", err);
		}
	}

	startHeartbeat() {
		this.stopHeartbeat();
		// Send a heartbeat every 30 seconds to keep connection alive on Koyeb
		this.heartbeatInterval = setInterval(() => {
			if (this.socket && this.socket.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({ event: "ping" }));
			}
		}, 30000);
	}

	stopHeartbeat() {
		if (this.heartbeatInterval) {
			clearInterval(this.heartbeatInterval);
			this.heartbeatInterval = null;
		}
	}

	clearTimers() {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}
		this.stopHeartbeat();
	}

	send(data) {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify(data));
		} else {
			console.error(`❌ WebSocket: Cannot send message, socket is ${this.socket ? 'not open' : 'NULL'} (State: ${this.socket?.readyState ?? 'NULL'})`);
			
			// If we have a token but no socket, try to reconnect immediately
			if (this.token) {
				console.log("🔄 WebSocket: Attempting immediate recovery...");
				this.connect(this.token);
			}
		}
	}

	subscribe(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	disconnect() {
		console.log("🔌 WebSocket: Manually disconnecting...");
		this.token = null;
		this.clearTimers();
		if (this.socket) {
			this.socket.close(1000); // Normal closure
			this.socket = null;
		}
	}
}

const wsManager = new WebSocketManager();
export default wsManager;
