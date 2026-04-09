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
import { AnnouncementProvider } from './context/AnnouncementContext.jsx'
import { ChatbotProvider } from './context/ChatbotContext';
import { NotificationProvider } from './context/NotificationContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AdminAuthProvider>
          <AdminProvider>
            <AdminTrainingProvider>
              <TeamProvider>
                <AnnouncementProvider>
                  <CourseProvider>
                    <ChatbotProvider>
                      <NotificationProvider>
                        <App />
                      </NotificationProvider>
                    </ChatbotProvider>
                  </CourseProvider>
                </AnnouncementProvider>
              </TeamProvider>
            </AdminTrainingProvider>
          </AdminProvider>
        </AdminAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
)
