import React, { useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import WhiteboardCanvas from './components/WhiteboardCanvas';
import Toolbar from './components/Toolbar';
import AIPanel from './components/AIPanel';
import { useWhiteboardStore } from './store/whiteboardStore';
import { supabase } from './services/supabase';

function AppContent() {
  const joinBoard = useWhiteboardStore((state) => state.joinBoard);
  const leaveBoard = useWhiteboardStore((state) => state.leaveBoard);
  const { user } = useAuth();
  const boardIdRef = useRef(null);

  // Board initialization - runs when user changes but skips if already on a board
  useEffect(() => {
    const initBoard = async () => {
      if (boardIdRef.current) return;

      const params = new URLSearchParams(window.location.search);
      let boardId = params.get('board');

      if (!boardId) {
        if (!user) return; // Need auth to create a board

        const { data, error } = await supabase
          .from('boards')
          .insert({
            name: 'Untitled Board',
            owner_id: user.id,
            is_public: true
          })
          .select()
          .single();

        if (!error && data) {
          boardId = data.id;
          window.history.replaceState({}, '', `?board=${boardId}`);
        } else {
          console.error('Failed to create board:', error);
          return;
        }
      }

      boardIdRef.current = boardId;
      await joinBoard(boardId);
    };

    initBoard();
  }, [user, joinBoard]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      leaveBoard();
    };
  }, [leaveBoard]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-100">
      <Toolbar />
      <div className="pt-[72px] h-full">
        <ErrorBoundary>
          <WhiteboardCanvas />
        </ErrorBoundary>
      </div>
      <AIPanel />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
