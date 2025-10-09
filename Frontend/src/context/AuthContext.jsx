import { createContext, useState, useEffect } from 'react';
import {
    loginWithPassword,
    requestLoginCode,
    verifyLoginCode,
    signup as signupAPI,
    verifyCode as verifyCodeAPI,
    requestCode as requestCodeAPI,
    requestPasswordReset as requestPasswordResetAPI,  // ADD
    confirmPasswordReset as confirmPasswordResetAPI,
    firebaseLogin   // ADD
} from '../services/authAPI';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Check if user is authenticated on mount
    useEffect(() => {
        if (token) {
            // You can add a function to verify token validity here
            // For now, just set a basic user object
            setUser({ authenticated: true });
        }
    }, [token]);

    // Login with password
    const login = async (email, password) => {
        setLoading(true);
        setError(null);
        try {
            const res = await loginWithPassword(email, password);
            if (res.success) {
                if (res.requiresCode) {
                    return { requiresCode: true };
                } else {
                    setToken(res.token);
                    setUser({ email, authenticated: true });
                    localStorage.setItem('token', res.data.access_token);
                    return { success: true };
                }
            } else {
                setError(res.message || 'Login failed');
                return { success: false, message: res.message };
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Server error';
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    // Request login code
    const requestCode = async (email) => {
        try {
            const res = await requestLoginCode(email);
            return { success: true, message: res.message || 'Code sent' };
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            return { success: false, message: errorMsg };
        }
    };

    // Verify login code
    const verifyCode = async (email, code) => {
        setLoading(true);
        setError(null);
        try {
            const res = await verifyLoginCode(email, code);
            if (res.success) {
                setToken(res.token);
                localStorage.setItem('token', res.token);
                setUser({ email, authenticated: true });
                return { success: true };
            } else {
                setError(res.message || 'Invalid code');
                return { success: false, message: res.message };
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    // Signup
    const signup = async (email, password, fullName) => {
        setLoading(true);
        setError(null);
        try {
            const res = await signupAPI(email, password, fullName);
            if (res.data.success) {
                return { success: true };
            } else {
                setError(res.data.message || 'Signup failed');
                return { success: false, message: res.data.message };
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Server error';
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    // Verify signup code
    const verifySignupCode = async (email, code) => {
        setLoading(true);
        setError(null);
        try {
            const res = await verifyCodeAPI(email, code);
            if (res.data.success) {
                return { success: true };
            } else {
                setError(res.data.message || 'Invalid code');
                return { success: false, message: res.data.message };
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    // Resend signup code
    const resendSignupCode = async (email) => {
        try {
            const res = await requestCodeAPI(email);
            return { success: true, message: res.message || 'Code resent' };
        } catch (err) {
            return { success: false, message: err.message };
        }
    };
    
    const loginWithGoogle = async (idToken) => {
        setLoading(true);
        setError(null);
        try {
            const res = await firebaseLogin(idToken);

            if (res.success) {
                // Backend returns: { success: true, data: { access_token, token_type } }
                const token = res.data.access_token;

                setToken(token);
                localStorage.setItem('token', token);
                setUser({ authenticated: true }); // Backend doesn't return user object in this response

                return { success: true };
            } else {
                setError(res.message || 'Firebase login failed');
                return { success: false, message: res.message };
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message || 'Server error';
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    // Logout
    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
    };



    // Request Password Reset
    const requestPasswordReset = async (email) => {
        setLoading(true);
        setError(null);
        try {
            const res = await requestPasswordResetAPI(email);
            return { success: true, message: res.message || 'Reset link sent' };
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    // Confirm Password Reset
    const confirmPasswordReset = async (token, newPassword) => {
        setLoading(true);
        setError(null);
        try {
            const res = await confirmPasswordResetAPI(token, newPassword);
            if (res.success) {
                return { success: true, message: res.message || 'Password reset successful' };
            } else {
                setError(res.message || 'Password reset failed');
                return { success: false, message: res.message };
            }
        } catch (err) {
            const errorMsg = err.response?.data?.message || err.message;
            setError(errorMsg);
            return { success: false, message: errorMsg };
        } finally {
            setLoading(false);
        }
    };

    const value = {
        user,
        token,
        loading,
        error,
        login,
        requestCode,
        verifyCode,
        signup,
        verifySignupCode,
        resendSignupCode,
        requestPasswordReset,      // ADD
        confirmPasswordReset,
        loginWithGoogle,     // ADD
        logout,
        setError
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};