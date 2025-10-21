import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { AdminAuthProvider } from "./context/AdminAuthContext.jsx";
import { AdminProvider } from './context/AdminContext.jsx'
import { TeamProvider } from './context/TeamContext.jsx'
import { CourseProvider } from './context/CourseContext';
import { AdminTrainingProvider } from './context/AdminTrainingContext';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <AdminAuthProvider>
        <AdminProvider>
          <AdminTrainingProvider>
          <TeamProvider>
            <CourseProvider>
            <App />
            </CourseProvider>
          </TeamProvider>
          </AdminTrainingProvider>
        </AdminProvider>
      </AdminAuthProvider>
    </AuthProvider>
  </StrictMode>
)
