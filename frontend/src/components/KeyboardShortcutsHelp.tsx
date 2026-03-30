import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcut {
  keys: string;
  description: string;
  category: string;
}

const shortcuts: KeyboardShortcut[] = [
  { keys: 'Ctrl + A', description: 'Add Anamath Entry', category: 'Navigation' },
  { keys: 'Ctrl + C', description: 'Add Credit Transaction', category: 'Navigation' },
  { keys: 'Ctrl + D', description: 'Add Debit Transaction', category: 'Navigation' },
  { keys: 'Ctrl + L', description: 'Create Ledger', category: 'Navigation' },
  { keys: 'Ctrl + M', description: 'View Transaction Records', category: 'Navigation' },
  { keys: 'Ctrl + Shift + A', description: 'View Anamath Records', category: 'Navigation' },
  { keys: 'Ctrl + Shift + L', description: 'Ledgers Summary', category: 'Navigation' },
];

const KeyboardShortcutsHelp: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const categorizedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, KeyboardShortcut[]>);

  return (
    <>
      {/* Floating Help Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-40"
        title="Keyboard Shortcuts (Press to view)"
      >
        <Keyboard className="w-5 h-5" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                    <Keyboard className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                    Keyboard Shortcuts
                  </h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="space-y-4">
                  {Object.entries(categorizedShortcuts).map(([category, shortcuts]) => (
                    <div key={category}>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                        {category}
                      </h3>
                      <div className="space-y-2">
                        {shortcuts.map((shortcut, index) => (
                          <div key={index} className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                            <span className="text-sm text-gray-700 dark:text-gray-300">{shortcut.description}</span>
                            <kbd className="px-2 py-1 text-xs font-mono bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded shadow-sm dark:text-gray-200">
                              {shortcut.keys}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/30 rounded">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    💡 <strong>Tip:</strong> Shortcuts work from any page except when typing in input fields.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default KeyboardShortcutsHelp;