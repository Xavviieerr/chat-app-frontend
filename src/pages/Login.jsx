import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

const Login = () => {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const { login } = useAuth();
	const navigate = useNavigate();

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			await login(username, password);
			navigate("/");
		} catch (err) {
			setError(
				err.response?.data?.detail || "Login failed. Check your credentials.",
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
				background: "radial-gradient(circle at top left, #1e293b, #0f172a)",
			}}
		>
			<div
				className="glass animate-fade-in"
				style={{
					padding: "2.5rem",
					borderRadius: "1.5rem",
					width: "100%",
					maxWidth: "400px",
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
						WhisperBox
					</h1>
					<p style={{ color: "var(--text-secondary)" }}>
						Welcome back, secure your session.
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
							Username
						</label>
						<input
							className="input"
							type="text"
							placeholder="johndoe"
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
						{loading ? "Decrypting Session..." : "Login"}
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
					New to WhisperBox?{" "}
					<Link
						to="/register"
						style={{
							color: "var(--accent-primary)",
							fontWeight: "600",
							textDecoration: "none",
						}}
					>
						Create an account
					</Link>
				</p>
			</div>
		</div>
	);
};

export default Login;
