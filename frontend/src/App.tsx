import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { RechargeProvider } from './contexts/RechargeContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AppLayout from './components/Layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import KeysPage from './pages/KeysPage';
import TransactionsPage from './pages/TransactionsPage';
import SettingsPage from './pages/SettingsPage';
import PricingPage from './pages/PricingPage';
import DocsPage from './pages/DocsPage';
import IntegrationPage from './pages/IntegrationPage';
import TransferStationPage from './pages/TransferStationPage';
import MonitorPage from './pages/MonitorPage';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return React.createElement('div', {
        style: {background:'#0A0A0F', color: '#EF4444', padding: 40, fontFamily: 'monospace', fontSize: 14, whiteSpace: 'pre-wrap', height: '100vh', overflow: 'auto'}
      }, String(this.state.error?.stack || this.state.error?.message || this.state.error));
    }
    return this.props.children;
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuth, loading } = useAuth();
  if (loading) return <div style={{color:'#fff',padding:40}}>Loading...</div>;
  if (!isAuth) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuth, loading } = useAuth();
  if (loading) return <div style={{color:'#fff',padding:40}}>Loading...</div>;
  if (isAuth) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#0A0A0F'}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
          <div style={{width:'24px',height:'24px',border:'2px solid rgba(16,185,129,0.3)',borderTopColor:'#10B981',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />
          <span style={{fontSize:'12px',color:'rgba(255,255,255,0.3)'}}>Loading TokUp...</span>
        </div>
      </div>
    }>
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/keys" element={<ProtectedRoute><KeysPage /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/pricing" element={<ProtectedRoute><PricingPage /></ProtectedRoute>} />
      <Route path="/docs" element={<ProtectedRoute><DocsPage /></ProtectedRoute>} />
      <Route path="/integration" element={<ProtectedRoute><IntegrationPage /></ProtectedRoute>} />
      <Route path="/monitor" element={<ProtectedRoute><MonitorPage /></ProtectedRoute>} />
      <Route path="/transfer-station" element={<ProtectedRoute><TransferStationPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <ThemeProvider>
            <RechargeProvider>
              <AppRoutes />
            </RechargeProvider>
          </ThemeProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
