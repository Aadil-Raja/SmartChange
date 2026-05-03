import AppRoutes from "./routes";
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
      <AppRoutes />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '16px',
            background: '#1a1209',
            color: '#faf6ef',
            border: '1px solid rgba(245,130,32,0.18)',
            boxShadow: '0 18px 40px rgba(14,11,7,0.28)',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontSize: '14px',
          },
          success: {
            duration: 2800,
            iconTheme: {
              primary: '#f7953f',
              secondary: '#faf6ef',
            },
          },
        }}
      />
    </>
  );
}

export default App;