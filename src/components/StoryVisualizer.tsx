import React, { useRef } from 'react';
import { toPng } from 'html-to-image';
import { Download, Share2 } from 'lucide-react';

interface StoryVisualizerProps {
  text: string;
  authorId: string;
  onClose?: () => void;
}

export function StoryVisualizer({ text, authorId, onClose }: StoryVisualizerProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const downloadImage = async () => {
    if (cardRef.current === null) {
      return;
    }

    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        width: 1080,
        height: 1080,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }
      });
      
      const link = document.createElement('a');
      link.download = `storyspot-${authorId.slice(0, 5)}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download image', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl flex flex-col items-center gap-8">
        <div className="flex justify-between w-full items-center">
          <h3 className="text-lg font-serif italic text-[#5A5A40]">Visual Preview</h3>
          <button 
            onClick={onClose}
            className="text-[#1a1a1a]/40 hover:text-[#1a1a1a] transition-colors"
          >
            Close
          </button>
        </div>

        {/* The Card to be exported */}
        <div 
          ref={cardRef}
          className="w-[1080px] h-[1080px] bg-[#f5f5f0] flex flex-col items-center justify-center p-24 relative overflow-hidden"
          style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}
        >
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-full h-2 bg-[#5A5A40]/10" />
          <div className="absolute bottom-0 left-0 w-full h-2 bg-[#5A5A40]/10" />
          
          <div className="flex flex-col items-center text-center gap-12 max-w-[800px]">
            <div className="w-16 h-1 bg-[#5A5A40]/20 rounded-full" />
            
            <p className="text-5xl font-serif leading-relaxed text-[#1a1a1a]/80 italic">
              "{text}"
            </p>
            
            <div className="w-16 h-1 bg-[#5A5A40]/20 rounded-full" />
            
            <div className="mt-8 flex flex-col items-center gap-2">
              <span className="text-xl uppercase tracking-[0.3em] font-medium text-[#5A5A40]">StorySpot</span>
              <span className="text-sm uppercase tracking-widest text-[#1a1a1a]/30 italic">Anonymous Fragment</span>
            </div>
          </div>

          {/* Subtle texture or pattern could go here */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
               style={{ backgroundImage: 'radial-gradient(#5A5A40 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>

        {/* Visible Preview (Scaled down) */}
        <div className="w-full aspect-square bg-[#f5f5f0] rounded-2xl flex flex-col items-center justify-center p-12 relative overflow-hidden border border-[#5A5A40]/10 shadow-inner">
          <div className="flex flex-col items-center text-center gap-6 max-w-[80%]">
            <div className="w-8 h-0.5 bg-[#5A5A40]/20 rounded-full" />
            <p className="text-xl font-serif leading-relaxed text-[#1a1a1a]/80 italic line-clamp-6">
              "{text}"
            </p>
            <div className="w-8 h-0.5 bg-[#5A5A40]/20 rounded-full" />
            <div className="mt-4 flex flex-col items-center gap-1">
              <span className="text-xs uppercase tracking-[0.3em] font-medium text-[#5A5A40]">StorySpot</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4 w-full">
          <button
            onClick={downloadImage}
            className="flex-1 flex items-center justify-center gap-2 bg-[#5A5A40] text-white py-4 rounded-2xl hover:bg-[#4a4a35] transition-all font-medium shadow-lg shadow-[#5A5A40]/20"
          >
            <Download size={20} />
            <span>Download PNG</span>
          </button>
        </div>
        
        <p className="text-[10px] text-[#1a1a1a]/30 uppercase tracking-widest text-center">
          Optimized for Instagram, Twitter, and Threads
        </p>
      </div>
    </div>
  );
}
