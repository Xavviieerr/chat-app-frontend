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
import {
	saveToSecureStorage,
	getFromSecureStorage,
	clearSecureStorage,
} from "../utils/storage";
import { toast } from "react-toastify";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
	const [user, setUser] = useState(null);
	const [privateKey, setPrivateKey] = useState(null);
	const [publicKey, setPublicKey] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);

	const register = async (displayName, username, password) => {
		try {
			setError(null);
			const { publicKey: pubKey, privateKey: privKey } =
				await generateRSAKeyPair();

			const salt = generateSalt();
			const wrappingKey = await deriveWrappingKey(password, salt);
			const wrappedPrivateKey = await wrapPrivateKey(privKey, wrappingKey);
			const publicKeyBase64 = await exportPublicKey(pubKey);

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

			// Persist user data locally
			await saveToSecureStorage("cached_user", userData);

			setPrivateKey(privKey);
			setPublicKey(pubKey);
			setUser(userData);
			wsManager.connect(access_token);

			toast.success("Welcome to WhisperBox!");
			return userData;
		} catch (err) {
			const errMsg = err.response?.data?.detail || err.message || "Registration failed";
			setError(errMsg);
			toast.error(errMsg);
			throw err;
		}
	};

	const login = async (username, password) => {
		try {
			setError(null);
			const res = await authApi.login({ username, password });
			const { access_token, refresh_token, user: userData } = res.data;

			localStorage.setItem("access_token", access_token);
			localStorage.setItem("refresh_token", refresh_token);

			// Persist user data locally
			await saveToSecureStorage("cached_user", userData);

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

			toast.success(`Welcome back, ${userData.display_name}!`);
			return userData;
		} catch (err) {
			const errMsg = err.response?.data?.detail || err.message || "Login failed";
			setError(errMsg);
			toast.error(errMsg);
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
			// Ignore logout errors
		}

		localStorage.removeItem("access_token");
		localStorage.removeItem("refresh_token");
		await clearSecureStorage();

		setUser(null);
		setPrivateKey(null);
		setPublicKey(null);
		setError(null);
		wsManager.disconnect();
		toast.info("Logged out safely.");
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
			// Try loading from cache first for instant UI
			const cachedUser = await getFromSecureStorage("cached_user");
			if (cachedUser) {
				setUser(cachedUser);
				wsManager.connect(token);
				setLoading(false);
			}

			// Verify session in background
			const res = await authApi.getMe();
			const latestUser = res.data;
			
			setUser(latestUser);
			await saveToSecureStorage("cached_user", latestUser);
			
			if (!wsManager.socket || wsManager.socket.readyState !== WebSocket.OPEN) {
				wsManager.connect(localStorage.getItem("access_token"));
			}
		} catch (err) {
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

			const saltBuffer = base64ToArrayBuffer(user.pbkdf2_salt);
			const wrappingKey = await deriveWrappingKey(password, saltBuffer);
			const unwrappedKey = await unwrapPrivateKey(
				user.wrapped_private_key,
				wrappingKey,
			);

			setPrivateKey(unwrappedKey);
			toast.success("Messages decrypted successfully!");
			return true;
		} catch (err) {
			toast.error("Invalid password. Decryption failed.");
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
