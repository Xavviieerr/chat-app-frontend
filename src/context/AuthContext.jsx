import React, {
	createContext,
	useContext,
	useState,
	useEffect,
	useRef,
} from "react";
import * as authApi from "../api/auth";
import wsManager from "../api/websocket";
import {
	generateRSAKeyPair,
	generateSalt,
	deriveWrappingKey,
	wrapPrivateKey,
	exportPublicKey,
	importPublicKey,
	base64ToArrayBuffer,
	arrayBufferToBase64,
	unwrapPrivateKey,
} from "../crypto/crypto";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
	// --------- State ---------
	const [user, setUser] = useState(null);
	const [privateKey, setPrivateKey] = useState(null);
	const [publicKey, setPublicKey] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	// REGISTER
	const register = async (displayName, username, password) => {
		try {
			setError(null);
			console.log("📝 REGISTER: Step 1 — Generating RSA-OAEP keypair...");
			const { publicKey: pubKey, privateKey: privKey } =
				await generateRSAKeyPair();

			console.log("📝 REGISTER: Step 2 — Generating PBKDF2 salt...");
			const salt = generateSalt();

			console.log("📝 REGISTER: Step 3 — Deriving wrapping key...");
			const wrappingKey = await deriveWrappingKey(password, salt);

			console.log("📝 REGISTER: Step 4 — Wrapping private key...");
			const wrappedPrivateKey = await wrapPrivateKey(privKey, wrappingKey);

			console.log("📝 REGISTER: Step 5 — Exporting public key...");
			const publicKeyBase64 = await exportPublicKey(pubKey);

			console.log("📝 REGISTER: Step 6 — Sending to server...");
			const res = await authApi.register({
				display_name: displayName,
				username,
				password,
				public_key: publicKeyBase64,
				wrapped_private_key: wrappedPrivateKey,
				pbkdf2_salt: arrayBufferToBase64(salt),
			});

			const { access_token, refresh_token, user: userData } = res.data;

			localStorage.setItem("access_token", access_token);
			localStorage.setItem("refresh_token", refresh_token);

			setPrivateKey(privKey);
			setPublicKey(pubKey);
			setUser(userData);
			wsManager.connect(access_token);

			console.log("✅ Registration successful");
			return userData;
		} catch (err) {
			console.error("❌ Registration failed:", err);
			setError(
				err.response?.data?.detail || err.message || "Registration failed",
			);
			throw err;
		}
	};

	// LOGIN
	const login = async (username, password) => {
		try {
			setError(null);
			console.log("🔓 LOGIN: Step 1 — Authenticating...");
			const res = await authApi.login({ username, password });
			const { access_token, refresh_token, user: userData } = res.data;

			localStorage.setItem("access_token", access_token);
			localStorage.setItem("refresh_token", refresh_token);

			console.log("🔓 LOGIN: Step 2 — Restoring session...");
			const saltBuffer = base64ToArrayBuffer(userData.pbkdf2_salt);
			const wrappingKey = await deriveWrappingKey(password, saltBuffer);
			const unwrappedPrivateKey = await unwrapPrivateKey(
				userData.wrapped_private_key,
				wrappingKey,
			);

			const publicKeyObj = await importPublicKey(userData.public_key);

			setPrivateKey(unwrappedPrivateKey);
			setPublicKey(publicKeyObj);
			setUser(userData);
			wsManager.connect(access_token);

			console.log("✅ Login successful");
			return userData;
		} catch (err) {
			console.error("❌ Login failed:", err);
			setError(err.response?.data?.detail || err.message || "Login failed");
			throw err;
		}
	};

	const logout = async () => {
		const refreshToken = localStorage.getItem("refresh_token");
		try {
			if (refreshToken) {
				await authApi.logout(refreshToken);
			}
		} catch (e) {
			console.warn("Logout API call failed:", e);
		}

		localStorage.removeItem("access_token");
		localStorage.removeItem("refresh_token");

		setUser(null);
		setPrivateKey(null);
		setPublicKey(null);
		setError(null);
		wsManager.disconnect();
		console.log("✅ Logout complete");
	};

	const isCheckingAuth = useRef(false);
	const checkAuth = async () => {
		if (isCheckingAuth.current) return;

		const token = localStorage.getItem("access_token");
		if (!token) {
			setLoading(false);
			return;
		}

		isCheckingAuth.current = true;
		try {
			console.log("🔍 AUTH_CHECK: Verifying access token...");
			const res = await authApi.getMe();
			setUser(res.data);

			const latestToken = localStorage.getItem("access_token");
			wsManager.connect(latestToken);

			console.log("✅ Auth check passed");
		} catch (err) {
			console.error("❌ Auth check failed:", err);
			await logout();
		} finally {
			setLoading(false);
			isCheckingAuth.current = false;
		}
	};

	useEffect(() => {
		checkAuth();
	}, []);

	const refreshAccessToken = async () => {
		const refreshToken = localStorage.getItem("refresh_token");
		if (!refreshToken) throw new Error("No refresh token available");

		try {
			const res = await authApi.refreshToken(refreshToken);
			const { access_token } = res.data;
			localStorage.setItem("access_token", access_token);
			wsManager.connect(access_token);
			return access_token;
		} catch (err) {
			await logout();
			throw err;
		}
	};

	const unlockPrivateKey = async (password) => {
		try {
			if (!user) throw new Error("No user loaded");
			console.log("🔓 UNLOCK: Restoring private key...");

			const saltBuffer = base64ToArrayBuffer(user.pbkdf2_salt);
			const wrappingKey = await deriveWrappingKey(password, saltBuffer);
			const unwrappedKey = await unwrapPrivateKey(
				user.wrapped_private_key,
				wrappingKey,
			);

			setPrivateKey(unwrappedKey);
			console.log("✅ Private key restored to memory");
			return true;
		} catch (err) {
			console.error("❌ Unlock failed:", err);
			return false;
		}
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				privateKey,
				publicKey,
				loading,
				error,
				register,
				login,
				logout,
				refreshAccessToken,
				unlockPrivateKey,
				isAuthenticated: !!user,
				hasPrivateKey: !!privateKey,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
};

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (!context) throw new Error("useAuth must be used within an AuthProvider");
	return context;
};
