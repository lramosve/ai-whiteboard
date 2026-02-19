import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { useWhiteboardStore } from '../store/whiteboardStore';
import {
  Square, Circle, Type, ArrowRight, MousePointer, StickyNote,
  Trash2, Users, Wifi, WifiOff, LogIn, LogOut, User, Frame, Copy
} from 'lucide-react';

const tools = [
  { id: 'select', icon: MousePointer, label: 'Select' },
  { id: 'rectangle', icon: Square, label: 'Rectangle' },
  { id: 'circle', icon: Circle, label: 'Circle' },
  { id: 'text', icon: Type, label: 'Text' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { id: 'sticky_note', icon: StickyNote, label: 'Sticky Note' },
  { id: 'frame', icon: Frame, label: 'Frame' }
];

export default function Toolbar() {
  const {
    tool,
    setTool,
    selectedObjectIds,
    objects,
    addObject,
    deleteObject,
    users,
    connected
  } = useWhiteboardStore();

  const { user, logout } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin');

  const handleDelete = () => {
    selectedObjectIds.forEach(id => deleteObject(id));
  };

  const handleDuplicate = () => {
    objects
      .filter(o => selectedObjectIds.includes(o.id))
      .forEach(o => {
        addObject({
          type: o.object_type || o.type,
          position: { x: (o.position?.x || 0) + 20, y: (o.position?.y || 0) + 20 },
          properties: { ...o.properties },
        });
      });
  };

  const handleAuthClick = (mode) => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const activeUserCount = Object.keys(users).length;

  return (
    <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-40">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">W</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">AI Whiteboard</h1>
            <p className="text-xs text-gray-500">Collaborative Drawing</p>
          </div>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-2 bg-gray-100 p-2 rounded-lg">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={`p-2 rounded transition-all ${
                  tool === t.id
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
                title={t.label}
                aria-label={`${t.label} tool`}
                aria-pressed={tool === t.id}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </button>
            );
          })}

          {/* Delete button */}
          <div className="w-px h-6 bg-gray-300 mx-1" />
          <button
            onClick={handleDuplicate}
            disabled={selectedObjectIds.length === 0}
            className={`p-2 rounded transition-all ${
              selectedObjectIds.length > 0
                ? 'bg-white text-gray-700 hover:bg-gray-50'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Duplicate (Ctrl+D)"
            aria-label="Duplicate selected objects"
          >
            <Copy className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            onClick={handleDelete}
            disabled={selectedObjectIds.length === 0}
            className={`p-2 rounded transition-all ${
              selectedObjectIds.length > 0
                ? 'bg-white text-red-600 hover:bg-red-50'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
            title="Delete (Del)"
            aria-label="Delete selected objects"
          >
            <Trash2 className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-4">
          {/* Active users */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="w-4 h-4" />
            <span>{activeUserCount} active</span>
          </div>

          {/* Connection status */}
          <div className={`flex items-center gap-2 text-sm ${
            connected ? 'text-green-600' : 'text-red-600'
          }`}>
            {connected ? (
              <>
                <Wifi className="w-4 h-4" />
                <span>Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                <span>Disconnected</span>
              </>
            )}
          </div>

          {/* Auth status */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1 bg-purple-50 rounded-lg">
                  <User className="w-4 h-4 text-purple-600" />
                  <span className="text-sm text-purple-700">{user.displayName || user.email}</span>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleAuthClick('signin')}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
                <button
                  onClick={() => handleAuthClick('signup')}
                  className="px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
      />
    </div>
  );
}
