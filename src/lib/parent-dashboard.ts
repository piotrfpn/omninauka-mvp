import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { ParentChildData } from '../types';

export function useParentDashboard() {
  const [childrenData, setChildrenData] = useState<ParentChildData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChildren = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_parent_children');
      
      if (rpcError) {
        throw rpcError;
      }
      
      setChildrenData(data || []);
    } catch (err: any) {
      console.error('Failed to load parent dashboard data:', err);
      setError('Wystąpił błąd podczas pobierania danych z panelu rodzica. Spróbuj ponownie później.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChildren();
  }, []);

  return {
    childrenData,
    isLoading,
    error,
    refresh: fetchChildren
  };
}
