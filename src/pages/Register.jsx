import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

const Register = () => {
	const [displayName, setDisplayName] = useState("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const { register } = useAuth();
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			await register(displayName, username, password);
			navigate("/");
		} catch (err) {
			console.error(
				err.response?.data?.detail ||
					"Registration failed. Username might be taken.",
			);
			setError(
				err.response?.data?.detail ||
					"Registration failed. Username might be taken.",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div
			className="auth-page"
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				height: "100vh",
				background: "radial-gradient(circle at bottom right, #1e293b, #0f172a)",
			}}
		>
			<div
				className="glass animate-fade-in"
				style={{
					padding: "2.5rem",
					borderRadius: "1.5rem",
					width: "100%",
					maxWidth: "450px",
					boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
				}}
			>
				<div style={{ textAlign: "center", marginBottom: "2rem" }}>
					<h1
						style={{
							fontSize: "2rem",
							fontWeight: "700",
							marginBottom: "0.5rem",
						}}
					>
						Join WhisperBox
					</h1>
					<p style={{ color: "var(--text-secondary)" }}>
						End-to-end encrypted messaging starts here.
					</p>
				</div>

				<form
					onSubmit={handleSubmit}
					style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}
				>
					<div>
						<label
							style={{
								display: "block",
								marginBottom: "0.5rem",
								fontSize: "0.875rem",
								color: "var(--text-secondary)",
							}}
						>
							Display Name
						</label>
						<input
							className="input"
							type="text"
							placeholder="Alice"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							required
						/>
					</div>
					<div>
						<label
							style={{
								display: "block",
								marginBottom: "0.5rem",
								fontSize: "0.875rem",
								color: "var(--text-secondary)",
							}}
						>
							Username
						</label>
						<input
							className="input"
							type="text"
							placeholder="alice_92"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							required
						/>
					</div>
					<div>
						<label
							style={{
								display: "block",
								marginBottom: "0.5rem",
								fontSize: "0.875rem",
								color: "var(--text-secondary)",
							}}
						>
							Password
						</label>
						<input
							className="input"
							type="password"
							placeholder="••••••••"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
						<p
							style={{
								fontSize: "0.75rem",
								color: "var(--text-muted)",
								marginTop: "0.5rem",
							}}
						>
							Used to encrypt your private key locally. Never shared.
						</p>
					</div>

					{error && (
						<p
							style={{
								color: "var(--danger)",
								fontSize: "0.875rem",
								textAlign: "center",
							}}
						>
							{error}
						</p>
					)}

					<button className="btn btn-primary" type="submit" disabled={loading}>
						{loading ? "Generating RSA Keys..." : "Create Account"}
					</button>
				</form>

				<p
					style={{
						textAlign: "center",
						marginTop: "1.5rem",
						fontSize: "0.875rem",
						color: "var(--text-secondary)",
					}}
				>
					Already have an account?{" "}
					<Link
						to="/login"
						style={{
							color: "var(--accent-primary)",
							fontWeight: "600",
							textDecoration: "none",
						}}
					>
						Log in
					</Link>
				</p>
			</div>
		</div>
	);
};

export default Register;
