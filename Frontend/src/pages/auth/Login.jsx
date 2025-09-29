import { useState } from "react";
import { useNavigate } from "react-router-dom";
// import { loginUser } from "../../services/authAPI";
// import { useAuth } from "../../hooks/useAuth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
//   const { setUser } = useAuth();

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setError("");

//     try {
//       const userData = await loginUser({ email, password });
//       setUser(userData); // update global context
//       navigate("/employee/dashboard"); // redirect
//     } catch (err) {
//       setError(err.message || "Invalid credentials");
//     }
//   };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow">
        <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {/* <form onSubmit={handleSubmit} className="space-y-4"> */}
          <input
            type="email"
            placeholder="Email"
            className="w-full border rounded p-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full border rounded p-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition"
          >
            Login
          </button>
        {/* </form> */}
      </div>
    </div>
  );
}
