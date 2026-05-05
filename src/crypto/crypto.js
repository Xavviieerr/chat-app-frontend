/**
 * crypto.js - WhisperBox Client-Side Encryption Utilities
 */

// --- Base64 Helpers ---

export function arrayBufferToBase64(buffer) {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
}

export function base64ToArrayBuffer(base64) {
	const binary = window.atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

// --- Key Generation ---

export async function generateRSAKeyPair() {
	return await window.crypto.subtle.generateKey(
		{
			name: "RSA-OAEP",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		["encrypt", "decrypt"],
	);
}

// --- Key Derivation ---

export async function deriveWrappingKey(password, saltBuffer) {
	const enc = new TextEncoder();
	const keyMaterial = await window.crypto.subtle.importKey(
		"raw",
		enc.encode(password),
		"PBKDF2",
		false,
		["deriveKey"],
	);

	return await window.crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: saltBuffer,
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-GCM", length: 256 },
		false,
		["encrypt", "decrypt"],
	);
}

// --- Key Wrapping ---

export async function wrapPrivateKey(privateKey, aesGcmKey) {
	const pkcs8 = await window.crypto.subtle.exportKey("pkcs8", privateKey);
	const iv = window.crypto.getRandomValues(new Uint8Array(12));
	
	const encrypted = await window.crypto.subtle.encrypt(
		{ name: "AES-GCM", iv: iv },
		aesGcmKey,
		pkcs8,
	);

	const combined = new Uint8Array(iv.length + encrypted.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(encrypted), iv.length);

	return arrayBufferToBase64(combined);
}

export async function unwrapPrivateKey(wrappedBase64, wrappingKey) {
	const combined = new Uint8Array(base64ToArrayBuffer(wrappedBase64));
	
	if (combined.length < 12) {
		throw new Error("Invalid wrapped key format");
	}

	const iv = combined.slice(0, 12);
	const ciphertext = combined.slice(12);

	const pkcs8Buffer = await window.crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: iv },
		wrappingKey,
		ciphertext
	);

	return await window.crypto.subtle.importKey(
		"pkcs8",
		pkcs8Buffer,
		{
			name: "RSA-OAEP",
			hash: "SHA-256",
		},
		true,
		["decrypt"],
	);
}

// --- Public Key Export/Import ---

export async function exportPublicKey(publicKey) {
	const spki = await window.crypto.subtle.exportKey("spki", publicKey);
	return arrayBufferToBase64(spki);
}

export async function importPublicKey(publicKeyBase64) {
	const spki = base64ToArrayBuffer(publicKeyBase64);
	return await window.crypto.subtle.importKey(
		"spki",
		spki,
		{ name: "RSA-OAEP", hash: "SHA-256" },
		true,
		["encrypt"],
	);
}

// --- Message Encryption/Decryption ---

export async function encryptMessage(plaintext, recipientPublicKey, senderPublicKey) {
	const enc = new TextEncoder();
	
	const aesKey = await window.crypto.subtle.generateKey(
		{ name: "AES-GCM", length: 256 },
		true,
		["encrypt", "decrypt"],
	);
	const iv = window.crypto.getRandomValues(new Uint8Array(12));

	const ciphertext = await window.crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		aesKey,
		enc.encode(plaintext),
	);

	const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);

	const encryptedKey = await window.crypto.subtle.encrypt(
		{ name: "RSA-OAEP" },
		recipientPublicKey,
		rawAesKey,
	);

	const encryptedKeyForSelf = await window.crypto.subtle.encrypt(
		{ name: "RSA-OAEP" },
		senderPublicKey,
		rawAesKey,
	);

	return {
		ciphertext: arrayBufferToBase64(ciphertext),
		iv: arrayBufferToBase64(iv),
		encryptedKey: arrayBufferToBase64(encryptedKey),
		encryptedKeyForSelf: arrayBufferToBase64(encryptedKeyForSelf),
	};
}

export async function decryptMessage(payload, privateKey) {
	const { ciphertext, iv, encryptedKey, encryptedKeyForSelf } = payload;

	let rawAesKey;
	try {
		rawAesKey = await window.crypto.subtle.decrypt(
			{ name: "RSA-OAEP" },
			privateKey,
			base64ToArrayBuffer(encryptedKey)
		);
	} catch (e) {
		rawAesKey = await window.crypto.subtle.decrypt(
			{ name: "RSA-OAEP" },
			privateKey,
			base64ToArrayBuffer(encryptedKeyForSelf)
		);
	}

	const aesKey = await window.crypto.subtle.importKey(
		"raw",
		rawAesKey,
		{ name: "AES-GCM" },
		false,
		["decrypt"]
	);

	const decrypted = await window.crypto.subtle.decrypt(
		{ name: "AES-GCM", iv: base64ToArrayBuffer(iv) },
		aesKey,
		base64ToArrayBuffer(ciphertext),
	);

	return new TextDecoder().decode(decrypted);
}

// --- Helpers ---

export function generateSalt() {
	return window.crypto.getRandomValues(new Uint8Array(16));
}

export function generateIV() {
	return window.crypto.getRandomValues(new Uint8Array(12));
}
