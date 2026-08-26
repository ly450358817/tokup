import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { RechargeProvider } from './contexts/RechargeContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AppLayout from './components/Layout/AppLayout';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import KeysPage from './pages/KeysPage';
import TransactionsPage from './pages/TransactionsPage';
import SettingsPage from './pages/SettingsPage';
import PricingPage from './pages/PricingPage';
import DocsPage from './pages/DocsPage';
import IntegrationPage from './pages/IntegrationPage';
import TransferStationPage from './pages/TransferStationPage';
import MonitorPage from './pages/MonitorPage';
import CompliancePage from './pages/CompliancePage';
import TermsPage from './pages/TermsPage';
import UsagePage from './pages/UsagePage';
import InvitePage from './pages/InvitePage';
import AnalyticsPage from './pages/AnalyticsPage';
import OnboardingPage from './pages/OnboardingPage';
import AnnouncementPopup from './components/AnnouncementPopup';
import TermsNoticePopup from './components/TermsNoticePopup';
import AdminConversationsPage from './pages/AdminConversationsPage';
import ModelAnalyticsPage from './pages/ModelAnalyticsPage';

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
        style: {background:'#13131D', color: '#EF4444', padding: 40, fontFamily: 'monospace', fontSize: 14, whiteSpace: 'pre-wrap', height: '100vh', overflow: 'auto'}
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
  const isNewUser = localStorage.getItem('tokup_new_registration') === 'true';
  if (isAuth) return <Navigate to={isNewUser ? "/guide" : "/dashboard"} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<PublicRoute><LoginPage defaultMode="register" /></PublicRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/keys" element={<ProtectedRoute><KeysPage /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/pricing" element={<ProtectedRoute><PricingPage /></ProtectedRoute>} />
      <Route path="/docs" element={<ProtectedRoute><DocsPage /></ProtectedRoute>} />
      <Route path="/integration" element={<ProtectedRoute><IntegrationPage /></ProtectedRoute>} />
      <Route path="/monitor" element={<ProtectedRoute><MonitorPage /></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
      <Route path="/guide" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/transfer-station" element={<ProtectedRoute><TransferStationPage /></ProtectedRoute>} />
      <Route path="/compliance" element={<CompliancePage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<TermsPage />} />
      <Route path="/admin/conversations" element={<ProtectedRoute><AdminConversationsPage /></ProtectedRoute>} />
      <Route path="/usage" element={<ProtectedRoute><UsagePage /></ProtectedRoute>} />
      <Route path="/model-analytics" element={<ProtectedRoute><ModelAnalyticsPage /></ProtectedRoute>} />
      <Route path="/invite" element={<ProtectedRoute><InvitePage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <ThemeProvider>
              <AnnouncementPopup />
              <TermsNoticePopup />
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
