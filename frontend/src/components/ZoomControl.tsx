import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useZoom, ZoomLevel } from '../contexts/ZoomContext';
import { ZoomIn, ChevronUp, ChevronDown } from 'lucide-react';

const ZOOM_OPTIONS: { level: ZoomLevel; label: string }[] = [
  { level: 'fit', label: 'Fit' },
  { level: '110', label: '110%' },
  { level: '130', label: '130%' },
  { level: '150', label: '150%' },
];

const ZoomControl: React.FC = () => {
  const { zoomLevel, setZoomLevel } = useZoom();
  const [isOpen, setIsOpen] = useState(false);

  const currentLabel = ZOOM_OPTIONS.find(o => o.level === zoomLevel)?.label || 'Fit';

  return (
    <div className="fixed bottom-4 left-4 lg:left-[17rem] z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            {ZOOM_OPTIONS.map((option) => (
              <button
                key={option.level}
                onClick={() => {
                  setZoomLevel(option.level);
                  setIsOpen(false);
                }}
                className={`block w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                  zoomLevel === option.level
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-full px-4 py-2 shadow-lg hover:shadow-xl transition-shadow text-sm font-medium text-gray-700 dark:text-gray-300"
        title="Adjust zoom level"
      >
        <ZoomIn className="w-4 h-4" />
        <span>{currentLabel}</span>
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
      </motion.button>
    </div>
  );
};

export default ZoomControl;
