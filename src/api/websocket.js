class WebSocketManager {
	constructor() {
		this.socket = null;
		this.listeners = new Set();
		this.token = null;
		this.reconnectTimeout = null;
		this.heartbeatInterval = null;
	}

	connect(token) {
		if (!token) return;

		if (
			this.socket &&
			this.token === token &&
			(this.socket.readyState === WebSocket.OPEN ||
				this.socket.readyState === WebSocket.CONNECTING)
		) {
			return;
		}

		this.token = token;
		this.clearTimers();

		if (this.socket) {
			this.socket.close();
		}

		try {
			this.socket = new WebSocket(
				`${import.meta.env.VITE_WS_URL}?token=${encodeURIComponent(token)}`,
			);

			this.socket.onopen = () => {
				this.startHeartbeat();
			};

			this.socket.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					this.listeners.forEach((listener) => listener(data));
				} catch (e) {
					// Handle parse error
				}
			};

			this.socket.onclose = (event) => {
				this.socket = null;
				this.stopHeartbeat();

				if (event.code !== 1000 && this.token) {
					this.reconnectTimeout = setTimeout(
						() => this.connect(this.token),
						3000,
					);
				}
			};

			this.socket.onerror = () => {
				// Handle error
			};
		} catch (err) {
			// Handle creation error
		}
	}

	startHeartbeat() {
		this.stopHeartbeat();
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
		} else if (this.token) {
			this.connect(this.token);
		}
	}

	subscribe(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	disconnect() {
		this.token = null;
		this.clearTimers();
		if (this.socket) {
			this.socket.close(1000);
			this.socket = null;
		}
	}
}

const wsManager = new WebSocketManager();
export default wsManager;
