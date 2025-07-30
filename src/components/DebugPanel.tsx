'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bug, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

interface DebugInfo {
  environment: {
    nodeEnv: string;
    supabaseUrl: string | undefined;
    supabaseKey: string | undefined;
  };
  supabase: {
    connected: boolean;
    error?: string;
  };
  browser: {
    userAgent: string;
    url: string;
  };
}

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  useEffect(() => {
    async function checkSupabase() {
      try {
        const { data, error } = await supabase.from('games').select('id').limit(1);
        return { connected: !error, error: error?.message };
      } catch (err) {
        return { connected: false, error: (err as Error).message };
      }
    }

    async function loadDebugInfo() {
      const supabaseStatus = await checkSupabase();
      
      setDebugInfo({
        environment: {
          nodeEnv: process.env.NODE_ENV || 'unknown',
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set (hidden)' : undefined,
        },
        supabase: supabaseStatus,
        browser: {
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
          url: typeof window !== 'undefined' ? window.location.href : 'Server-side',
        },
      });
    }

    if (isOpen) {
      loadDebugInfo();
    }
  }, [isOpen]);

  // Only show in development or if there's an error
  if (process.env.NODE_ENV === 'production' && (typeof window === 'undefined' || !window.location.search.includes('debug'))) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="outline"
        size="sm"
        className="mb-2"
      >
        <Bug className="h-4 w-4 mr-2" />
        Debug
        {isOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
      </Button>

      {isOpen && debugInfo && (
        <Card className="w-80 max-h-96 overflow-y-auto">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Debug Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div>
              <strong>Environment:</strong>
              <div className="ml-2 space-y-1">
                <div>Node Env: <Badge variant="outline">{debugInfo.environment.nodeEnv}</Badge></div>
                <div>
                  Supabase URL: {' '}
                  <Badge variant={debugInfo.environment.supabaseUrl ? 'default' : 'destructive'}>
                    {debugInfo.environment.supabaseUrl ? '✅ Set' : '❌ Missing'}
                  </Badge>
                </div>
                <div>
                  Supabase Key: {' '}
                  <Badge variant={debugInfo.environment.supabaseKey ? 'default' : 'destructive'}>
                    {debugInfo.environment.supabaseKey ? '✅ Set' : '❌ Missing'}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <strong>Supabase Connection:</strong>
              <div className="ml-2">
                <Badge variant={debugInfo.supabase.connected ? 'default' : 'destructive'}>
                  {debugInfo.supabase.connected ? '✅ Connected' : '❌ Failed'}
                </Badge>
                {debugInfo.supabase.error && (
                  <div className="text-red-600 mt-1">{debugInfo.supabase.error}</div>
                )}
              </div>
            </div>

            <div>
              <strong>Browser:</strong>
              <div className="ml-2 space-y-1">
                <div>URL: {debugInfo.browser.url}</div>
                <div>UA: {debugInfo.browser.userAgent.substring(0, 50)}...</div>
              </div>
            </div>

            <div className="pt-2 border-t">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => {
                  console.log('🔍 FULL DEBUG INFO:', debugInfo);
                  if (typeof window !== 'undefined') {
                    console.log('📊 WINDOW OBJECT:', window);
                  }
                }}
                className="w-full"
              >
                Log Full Debug Info
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}