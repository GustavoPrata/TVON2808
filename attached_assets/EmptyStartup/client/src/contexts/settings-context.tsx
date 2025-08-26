import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SettingsContextType {
  showPhotosChat: boolean;
  showPhotosClientes: boolean;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/whatsapp/settings'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const showPhotosChat = settings?.showProfilePhotosChat ?? true;
  const showPhotosClientes = settings?.showProfilePhotosClientes ?? true;

  return (
    <SettingsContext.Provider value={{ showPhotosChat, showPhotosClientes, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}