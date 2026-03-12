import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const { toggleSidebar } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      // Cmd/Ctrl + B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }

      // Cmd/Ctrl + , to open settings
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
      }

      // Cmd/Ctrl + Shift + C to open chat
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        navigate('/chat');
      }

      // Cmd/Ctrl + Shift + M to open market
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        navigate('/market');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, toggleSidebar]);
}
