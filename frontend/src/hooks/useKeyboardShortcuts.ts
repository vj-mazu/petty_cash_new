import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts if not in an input field or textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const { ctrlKey, shiftKey, key } = event;

      // Ctrl + T: Removed (was Add Transaction)

      // Ctrl + A: Anamath Entry
      if (ctrlKey && !shiftKey && key.toLowerCase() === 'a') {
        event.preventDefault();
        navigate('/transactions/create/anamath');
        return;
      }

      // Ctrl + C: Credit Transaction
      if (ctrlKey && !shiftKey && key.toLowerCase() === 'c') {
        event.preventDefault();
        navigate('/transactions/create/credit');
        return;
      }

      // Ctrl + D: Debit Transaction
      if (ctrlKey && !shiftKey && key.toLowerCase() === 'd') {
        event.preventDefault();
        navigate('/transactions/create/debit');
        return;
      }

      // Ctrl + L: Ledger Creation
      if (ctrlKey && !shiftKey && key.toLowerCase() === 'l') {
        event.preventDefault();
        navigate('/ledgers/create');
        return;
      }

      // Ctrl + M: Transaction Records
      if (ctrlKey && !shiftKey && key.toLowerCase() === 'm') {
        event.preventDefault();
        navigate('/transactions');
        return;
      }

      // Ctrl + Shift + A: Anamath Records
      if (ctrlKey && shiftKey && key.toLowerCase() === 'a') {
        event.preventDefault();
        navigate('/anamath');
        return;
      }

      // Ctrl + Shift + L: Ledgers Summary
      if (ctrlKey && shiftKey && key.toLowerCase() === 'l') {
        event.preventDefault();
        navigate('/ledgers?tab=summary');
        return;
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigate, location]);
};