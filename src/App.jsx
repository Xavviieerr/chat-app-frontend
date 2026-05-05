import React from "react";
import {
	BrowserRouter as Router,
	Routes,
	Route,
	Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ProtectedRoute = ({ children }) => {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div
				style={{
					height: "100vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					background: "var(--bg-primary)",
					color: "white",
				}}
			>
				<div className="animate-fade-in">Initializing Secure Session...</div>
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/login" />;
	}

	return children;
};

function App() {
	return (
		<AuthProvider>
			<Router>
				<Routes>
					<Route path="/login" element={<Login />} />
					<Route path="/register" element={<Register />} />
					<Route
						path="/"
						element={
							<ProtectedRoute>
								<Chat />
							</ProtectedRoute>
						}
					/>
					<Route path="*" element={<Navigate to="/" />} />
				</Routes>
			</Router>
			<ToastContainer 
				position="bottom-right"
				autoClose={3000}
				hideProgressBar={false}
				newestOnTop={false}
				closeOnClick
				rtl={false}
				pauseOnFocusLoss
				draggable
				pauseOnHover
				theme="dark"
			/>
		</AuthProvider>
	);
}

export default App;
