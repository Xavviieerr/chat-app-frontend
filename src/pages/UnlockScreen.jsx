import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function UnlockScreen() {
	const { unlockPrivateKey, logout, user } = useAuth();
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleUnlock = async (e) => {
		e.preventDefault();
		if (!password.trim()) return;

		setLoading(true);
		setError("");

		try {
			const success = await unlockPrivateKey(password);
			if (!success) {
				setError("Incorrect password. Please try again.");
			}
		} catch (err) {
			setError("Unlock failed. Please check your connection.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="modal-overlay">
			<div className="modal-content glass animate-fade-in">
				<div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
					<div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🔐</div>
					<h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "0.5rem" }}>
						Unlock Messages
					</h2>
					<p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
						Hi <strong>{user?.display_name}</strong>, enter your password to decrypt your secure chat session.
					</p>
				</div>

				<form onSubmit={handleUnlock} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
					<div>
						<input
							type="password"
							placeholder="Your account password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="input"
							required
							autoFocus
						/>
					</div>

					{error && (
						<p style={{ color: "var(--danger)", fontSize: "0.875rem", textAlign: "center" }}>
							{error}
						</p>
					)}

					<button
						type="submit"
						disabled={loading}
						className="btn btn-primary"
						style={{ width: "100%" }}
					>
						{loading ? "Unlocking..." : "Unlock Session"}
					</button>

					<button
						type="button"
						onClick={logout}
						style={{ 
							background: "none", 
							border: "none", 
							color: "var(--text-muted)", 
							fontSize: "0.875rem", 
							cursor: "pointer",
							marginTop: "0.5rem",
							textDecoration: "underline"
						}}
					>
						Switch Account / Logout
					</button>
				</form>
			</div>
		</div>
	);
}