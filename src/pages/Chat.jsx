import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import * as messagesApi from "../api/messages";
import * as usersApi from "../api/users";
import * as cryptoUtils from "../crypto/crypto";
import wsManager from "../api/websocket";
import UnlockScreen from "./UnlockScreen";
import { toast } from "react-toastify";

const Chat = () => {
	const { user, privateKey, logout, loading: authLoading } = useAuth();
	const [conversations, setConversations] = useState([]);
	const [activeChat, setActiveChat] = useState(null);
	const [messages, setMessages] = useState([]);
	const [newMessage, setNewMessage] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState([]);
	const [loading, setLoading] = useState(false);
	const messagesEndRef = useRef(null);

	// Load conversations
	useEffect(() => {
		const fetchConversations = async () => {
			try {
				const response = await messagesApi.getConversations();
				setConversations(response.data);
			} catch (err) {
				// Silently fail or handle UI-wise
			}
		};
		fetchConversations();
	}, []);

	// Load messages when active chat changes
	useEffect(() => {
		if (activeChat && privateKey) {
			const fetchMessages = async () => {
				setLoading(true);
				try {
					const response = await messagesApi.getMessages(
						activeChat.user_id || activeChat.id,
					);
					const encryptedMessages = response.data;

					const decryptedMessages = await Promise.all(
						encryptedMessages.map(async (msg) => {
							try {
								const plaintext = await cryptoUtils.decryptMessage(
									msg.payload,
									privateKey,
								);
								return { ...msg, plaintext };
							} catch (e) {
								return { ...msg, plaintext: "[Decryption Failed]" };
							}
						}),
					);

					setMessages(decryptedMessages.reverse());
				} catch (err) {
					// Silently fail
				} finally {
					setLoading(false);
				}
			};
			fetchMessages();
		}
	}, [activeChat, privateKey]);

	// WebSocket listener
	useEffect(() => {
		const unsubscribe = wsManager.subscribe(async (event) => {
			if (event.event === "message.receive") {
				if (
					activeChat &&
					(event.from_user_id === activeChat.user_id ||
						event.from_user_id === activeChat.id)
				) {
					try {
						const plaintext = await cryptoUtils.decryptMessage(
							event.payload,
							privateKey,
						);
						setMessages((prev) => [...prev, { ...event, plaintext }]);
						
						// Show toast if message is from another user
						if (event.from_user_id !== user.id) {
							toast.info(`New message from ${activeChat.display_name}`, {
								icon: "💬"
							});
						}
					} catch (e) {
						setMessages((prev) => [
							...prev,
							{ ...event, plaintext: "[Decryption Failed]" },
						]);
					}
				}

				const convResponse = await messagesApi.getConversations();
				setConversations(convResponse.data);
			}
		});
		return unsubscribe;
	}, [activeChat, privateKey]);

	// Scroll to bottom
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	// User search
	useEffect(() => {
		if (searchQuery.length > 2) {
			const delayDebounceFn = setTimeout(async () => {
				try {
					const response = await usersApi.searchUsers(searchQuery);
					setSearchResults(response.data);
				} catch (err) {
					// Silently fail
				}
			}, 300);
			return () => clearTimeout(delayDebounceFn);
		} else {
			setSearchResults([]);
		}
	}, [searchQuery]);

	const handleSendMessage = async (e) => {
		e.preventDefault();
		const trimmedMessage = newMessage.trim();
		if (!trimmedMessage || !activeChat || !privateKey) return;

		const recipientId = activeChat.user_id || activeChat.id;
		setNewMessage("");

		try {
			const keyResponse = await usersApi.getUserPublicKey(recipientId);
			const recipientPublicKey = await cryptoUtils.importPublicKey(
				keyResponse.data.public_key,
			);
			const senderPublicKey = await cryptoUtils.importPublicKey(
				user.public_key,
			);

			const payload = await cryptoUtils.encryptMessage(
				trimmedMessage,
				recipientPublicKey,
				senderPublicKey,
			);
			wsManager.send({
				event: "message.send",
				to: recipientId,
				payload: payload,
			});

			setMessages((prev) => [
				...prev,
				{
					id: Date.now().toString(),
					from_user_id: user.id,
					plaintext: trimmedMessage,
					created_at: new Date().toISOString(),
				},
			]);
		} catch (err) {
			toast.error("Failed to encrypt or send message.");
		}
	};

	// Conditional rendering MUST happen after all Hooks are called
	if (authLoading) return null;

	if (user && !privateKey) {
		return <UnlockScreen />;
	}

	return (
		<div className="app-container">
			{/* Sidebar */}
			<div
				className="sidebar glass"
				style={{
					display: "flex",
					flexDirection: "column",
					borderRight: "1px solid var(--glass-border)",
				}}
			>
				<div
					style={{
						padding: "1.5rem",
						borderBottom: "1px solid var(--glass-border)",
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							marginBottom: "1rem",
						}}
					>
						<h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>
							WhisperBox
						</h2>
						<button
							onClick={logout}
							className="btn"
							style={{ padding: "0.4rem", color: "var(--text-muted)" }}
						>
							Logout
						</button>
					</div>
					<input
						className="input"
						placeholder="Search users..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>

				<div style={{ flex: 1, overflowY: "auto" }}>
					{searchResults.length > 0 ? (
						<div>
							<p
								style={{
									padding: "0.75rem 1.5rem",
									fontSize: "0.75rem",
									color: "var(--text-muted)",
									textTransform: "uppercase",
								}}
							>
								Search Results
							</p>
							{searchResults.map((u) => (
								<div
									key={u.id}
									className="conv-item"
									onClick={() => {
										setActiveChat(u);
										setSearchQuery("");
									}}
									style={{
										padding: "1rem 1.5rem",
										cursor: "pointer",
										transition: "background 0.2s",
									}}
								>
									<div style={{ fontWeight: "600" }}>{u.display_name}</div>
									<div
										style={{
											fontSize: "0.875rem",
											color: "var(--text-secondary)",
										}}
									>
										@{u.username}
									</div>
								</div>
							))}
						</div>
					) : (
						<div>
							<p
								style={{
									padding: "0.75rem 1.5rem",
									fontSize: "0.75rem",
									color: "var(--text-muted)",
									textTransform: "uppercase",
								}}
							>
								Conversations
							</p>
							{conversations.map((c) => (
								<div
									key={c.user_id}
									className={`conv-item ${activeChat?.user_id === c.user_id ? "active" : ""}`}
									onClick={() => setActiveChat(c)}
									style={{
										padding: "1rem 1.5rem",
										cursor: "pointer",
										background:
											activeChat?.user_id === c.user_id ||
											activeChat?.id === c.user_id
												? "var(--bg-tertiary)"
												: "transparent",
										borderLeft:
											activeChat?.user_id === c.user_id ||
											activeChat?.id === c.user_id
												? "4px solid var(--accent-primary)"
												: "4px solid transparent",
									}}
								>
									<div
										style={{ display: "flex", justifyContent: "space-between" }}
									>
										<div style={{ fontWeight: "600" }}>{c.display_name}</div>
										<div
											style={{
												fontSize: "0.75rem",
												color: "var(--text-muted)",
											}}
										>
											{new Date(c.last_message_at).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</div>
									</div>
									<div
										style={{
											fontSize: "0.875rem",
											color: "var(--text-secondary)",
										}}
									>
										@{c.username}
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div
					style={{
						padding: "1rem",
						borderTop: "1px solid var(--glass-border)",
						display: "flex",
						alignItems: "center",
						gap: "0.75rem",
					}}
				>
					<div
						style={{
							width: "40px",
							height: "40px",
							borderRadius: "50%",
							background: "var(--accent-primary)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontWeight: "700",
						}}
					>
						{user?.display_name?.[0]}
					</div>
					<div>
						<div style={{ fontSize: "0.875rem", fontWeight: "600" }}>
							{user?.display_name}
						</div>
						<div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
							@{user?.username}
						</div>
					</div>
				</div>
			</div>

			{/* Chat Window */}
			<div
				className="chat-window"
				style={{
					display: "flex",
					flexDirection: "column",
					background: "var(--bg-primary)",
				}}
			>
				{activeChat ? (
					<>
						<div
							className="glass"
							style={{
								padding: "1rem 1.5rem",
								borderBottom: "1px solid var(--glass-border)",
								display: "flex",
								alignItems: "center",
								gap: "1rem",
							}}
						>
							<div
								style={{
									width: "40px",
									height: "40px",
									borderRadius: "50%",
									background: "var(--bg-tertiary)",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontWeight: "700",
								}}
							>
								{(activeChat.display_name || activeChat.username)[0]}
							</div>
							<div>
								<div style={{ fontWeight: "600" }}>
									{activeChat.display_name}
								</div>
								<div
									style={{
										fontSize: "0.75rem",
										color: "var(--text-secondary)",
									}}
								>
									Secure Channel • E2EE Active
								</div>
							</div>
						</div>

						<div
							style={{
								flex: 1,
								overflowY: "auto",
								padding: "1.5rem",
								display: "flex",
								flexDirection: "column",
								gap: "1rem",
							}}
						>
							{messages.map((msg) => {
								const isMe = msg.from_user_id === user?.id;
								return (
									<div
										key={msg.id}
										style={{
											alignSelf: isMe ? "flex-end" : "flex-start",
											maxWidth: "70%",
											display: "flex",
											flexDirection: "column",
											alignItems: isMe ? "flex-end" : "flex-start",
										}}
									>
										<div
											style={{
												padding: "0.75rem 1rem",
												borderRadius: "1rem",
												background: isMe
													? "var(--accent-primary)"
													: "var(--bg-secondary)",
												color: "white",
												fontSize: "0.9375rem",
												boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
											}}
										>
											{msg.plaintext}
										</div>
										<div
											style={{
												fontSize: "0.6875rem",
												color: "var(--text-muted)",
												marginTop: "0.25rem",
											}}
										>
											{new Date(msg.created_at).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</div>
									</div>
								);
							})}
							<div ref={messagesEndRef} />
						</div>

						<form
							onSubmit={handleSendMessage}
							style={{ padding: "1.5rem", background: "var(--bg-primary)" }}
						>
							<div style={{ display: "flex", gap: "0.75rem" }}>
								<input
									className="input"
									placeholder="Type a secure message..."
									value={newMessage}
									onChange={(e) => setNewMessage(e.target.value)}
								/>
								<button
									className="btn btn-primary"
									type="submit"
									style={{ padding: "0 1.5rem" }}
								>
									Send
								</button>
							</div>
						</form>
					</>
				) : (
					<div
						style={{
							flex: 1,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							flexDirection: "column",
							color: "var(--text-muted)",
						}}
					>
						<div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🔒</div>
						<h2 style={{ color: "var(--text-primary)" }}>
							WhisperBox Secure Messaging
						</h2>
						<p>Select a contact to start an encrypted conversation.</p>
					</div>
				)}
			</div>
		</div>
	);
};

export default Chat;
