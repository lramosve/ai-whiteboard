import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import WhiteboardCanvas from './components/WhiteboardCanvas';
import Toolbar from './components/Toolbar';
import AIPanel from './components/AIPanel';
import { useWhiteboardStore } from './store/whiteboardStore';
import { supabase } from './services/supabase';

function AppContent() {
  const joinBoard = useWhiteboardStore((state) => state.joinBoard);
  const leaveBoard = useWhiteboardStore((state) => state.leaveBoard);
  const { user } = useAuth();

  useEffect(() => {
    const initBoard = async () => {
      const params = new URLSearchParams(window.location.search);
      let boardId = params.get('board');

      if (!boardId) {
        if (user) {
          // Create a real board for authenticated users
          const { data, error } = await supabase
            .from('boards')
            .insert({ name: 'Untitled Board', owner_id: user.id, is_public: true })
            .select()
            .single();

          if (!error && data) {
            boardId = data.id;
          }
        }

        if (!boardId) {
          boardId = crypto.randomUUID();
        }

        window.history.replaceState({}, '', `?board=${boardId}`);
      }

      await joinBoard(boardId);
    };

    initBoard();

    return () => {
      leaveBoard();
    };
  }, [user, joinBoard, leaveBoard]);

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-100">
      <Toolbar />
      <div className="pt-[72px] h-full">
        <WhiteboardCanvas />
      </div>
      <AIPanel />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
