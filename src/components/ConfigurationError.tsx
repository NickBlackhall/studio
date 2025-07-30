'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';

interface ConfigurationErrorProps {
  title?: string;
  message?: string;
  details?: string[];
}

export default function ConfigurationError({ 
  title = "Configuration Error",
  message = "The game is not properly configured.",
  details = []
}: ConfigurationErrorProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Settings className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <CardTitle className="text-orange-600">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{message}</p>
          
          {details.length > 0 && (
            <div className="bg-orange-50 p-3 rounded border">
              <strong className="text-sm">Missing Configuration:</strong>
              <ul className="text-xs mt-2 space-y-1">
                {details.map((detail, index) => (
                  <li key={index} className="flex items-center">
                    <AlertTriangle className="h-3 w-3 text-orange-500 mr-2 flex-shrink-0" />
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="bg-gray-50 p-3 rounded text-xs">
            <strong>For Developers:</strong>
            <br />1. Check Netlify environment variables
            <br />2. Ensure NEXT_PUBLIC_SUPABASE_URL is set
            <br />3. Ensure NEXT_PUBLIC_SUPABASE_ANON_KEY is set
            <br />4. Check browser console for detailed errors
          </div>
          
          <Button 
            onClick={() => window.location.reload()} 
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
          
          <p className="text-xs text-gray-500 text-center">
            If you're a player and see this, please contact the game administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}