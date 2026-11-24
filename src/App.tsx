import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { CatalogPage } from './components/CatalogPage';
import { MaterialListBuilder } from './components/MaterialListBuilder';
import { SuppliersDirectoryPage } from './components/SuppliersDirectoryPage';
import { AuthPages } from './components/AuthPages';
import { CustomerWorkspace } from './components/CustomerWorkspace';
import { SupplierWorkspace } from './components/SupplierWorkspace';
import { AdminWorkspace } from './components/AdminWorkspace';
import { PublicInfoPages } from './components/PublicInfoPages';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';

function BuildMateShell() {
  const { view, bannerNotice } = useApp();

  const renderPage = () => {
    switch (view) {
      case 'home':
        return <HomePage />;
      case 'electrical':
        return <CatalogPage key="electrical" initialDomain="electrical" />;
      case 'plumbing':
        return <CatalogPage key="plumbing" initialDomain="plumbing" />;
      case 'builder':
        return <MaterialListBuilder />;
      case 'find-suppliers':
        return <SuppliersDirectoryPage />;
      case 'login':
        return <AuthPages initialMode="login" />;
      case 'register':
        return <AuthPages initialMode="register" />;
      case 'about':
      case 'how-it-works':
      case 'contact':
      case 'help':
      case 'privacy':
      case 'terms':
        return <PublicInfoPages page={view} />;
      case 'customer-dashboard':
      case 'customer-projects':
      case 'customer-lists':
      case 'customer-quotations':
      case 'compare-quotations':
      case 'customer-orders':
      case 'customer-notifications':
      case 'customer-profile':
        return <CustomerWorkspace activeTab={view} />;
      case 'supplier-dashboard':
      case 'supplier-profile':
      case 'supplier-products':
      case 'supplier-requests':
      case 'supplier-orders':
      case 'supplier-reports':
        return <SupplierWorkspace activeTab={view} />;
      case 'admin-dashboard':
        return <AdminWorkspace />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F8] text-[#1E293B]">
      <Navbar />
      {bannerNotice && (
        <div
          role="status"
          className={`px-4 py-2.5 text-xs font-semibold text-center no-print ${
            bannerNotice.type === 'error'
              ? 'bg-red-700 text-white'
              : 'bg-[#0F2942] text-white'
          }`}
        >
          {bannerNotice.text}
        </div>
      )}
      <main className="flex-1">{renderPage()}</main>
      <AiAssistantDrawer />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BuildMateShell />
    </AppProvider>
  );
}
