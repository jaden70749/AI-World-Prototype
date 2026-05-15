import { useEffect, useState } from 'react';
import { useGameStore } from '../lib/store';
import { textureUrls } from '../lib/textures';

const HEART_PIXELS = [
  "011000110",
  "122101331",
  "122313441",
  "133333441",
  "133333441",
  "013333410",
  "001333100",
  "000141000",
  "000010000"
];
const HEART_COLORS: Record<string, string> = {
  '0': 'transparent', '1': '#000000', '2': '#ff5555', '3': '#ff0000', '4': '#7f0000'
};

const HUNGER_PIXELS = [
  "000111000",
  "001432100",
  "014432210",
  "144432210",
  "134322100",
  "123221671",
  "012217671",
  "001101710",
  "000000100"
];
const HUNGER_COLORS: Record<string, string> = {
  '0': 'transparent', 
  '1': '#000000', 
  '2': '#792404', 
  '3': '#ba3a0c', 
  '4': '#fb6e46', 
  '6': '#d6a880', 
  '7': '#ffecd4'
};

function PixelArt({ pixels, colors, size=18 }: { pixels: string[], colors: Record<string, string>, size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 9 10" style={{ shapeRendering: 'crispEdges' }}>
      {pixels.map((row, y) => 
        row.split('').map((char, x) => 
          char !== '0' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colors[char]} /> : null
        )
      )}
    </svg>
  );
}

export function HUD() {
  const { hotbarIndex, inventory, inventoryOpen, setInventoryOpen } = useGameStore();
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow F3 or +/= to toggle debug info
      if (e.key === 'F3' || e.key === '+' || e.key === '=') {
        e.preventDefault();
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // HUD array uses exactly 36 elements
  const paddedInventory = inventory;

  const renderSlot = (item: {type: string, count: number}, isHotbar: boolean, index: number) => {
    const itemKey = item && item.count > 0 ? (item.type === 'grass' ? 'grass_side' : item.type === 'wood' ? 'wood_side' : item.type) : '';
    return (
      <div 
        key={`slot-${isHotbar ? 'h' : 'i'}-${index}`} 
        className={`w-10 h-10 relative flex justify-center items-center bg-[#8b8b8b]/80 border-t-[2px] border-l-[2px] border-b-[2px] border-r-[2px] border-t-[#333] border-l-[#333] border-b-[#f0f0f0] border-r-[#f0f0f0] hover:bg-[#a0a0a0]`}
      >
        {item && item.count > 0 && textureUrls[itemKey] && (
            <div className="absolute inset-0 flex flex-col justify-center items-center p-1 cursor-pointer">
              <img src={textureUrls[itemKey]} className="w-6 h-6 object-cover" style={{ imageRendering: 'pixelated' }} alt={item.type} />
              <div className="text-[10px] font-mono font-bold text-white textShadow-custom absolute bottom-0 right-1">{item.count}</div>
            </div>
        )}
        {isHotbar && index === hotbarIndex && !inventoryOpen && (
            <div className="absolute -inset-[3px] border-[3px] border-white z-20 pointer-events-none rounded-[1px]" />
        )}
      </div>
    );
  };

  return (
    <>
      {inventoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto">
          <div className="bg-[#c6c6c6] border-t-4 border-l-4 border-white border-b-4 border-r-4 border-[#555] p-2 select-none" style={{ imageRendering: 'pixelated' }}>
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="font-mono text-[#333] font-bold text-sm">Inventory</span>
              <button 
                onClick={() => setInventoryOpen(false)}
                className="w-6 h-6 bg-[#c6c6c6] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#555] flex items-center justify-center font-mono font-bold text-[#333] hover:bg-[#d6d6d6] active:border-t-[#555] active:border-l-[#555] active:border-b-white active:border-r-white"
              >
                X
              </button>
            </div>
            
            <div className="flex gap-4 mb-4">
              {/* Fake player preview */}
              <div className="w-24 h-32 bg-black/10 border-t-2 border-l-2 border-[#555] border-b-2 border-r-2 border-white flex justify-center items-center">
                 <div className="w-8 h-8 bg-[#c68f6e] mb-12"></div>
              </div>

              {/* Crafting Grid */}
              <div className="flex flex-col">
                <span className="font-mono text-[#333] text-xs mb-1">Crafting</span>
                <div className="flex gap-2 items-center">
                  <div className="grid grid-cols-2 gap-1 bg-[#8b8b8b] p-1 border-t-2 border-l-2 border-[#555] border-b-2 border-r-2 border-white">
                    {Array.from({ length: 4 }).map((_, i) => (
                       <div key={`craft-${i}`} className="w-10 h-10 bg-[#8b8b8b] border-t-2 border-l-2 border-[#333] border-b-2 border-r-2 border-white"></div>
                    ))}
                  </div>
                  <div className="text-[#333] font-mono font-bold text-xl px-2">➔</div>
                  <div className="w-12 h-12 bg-[#8b8b8b] border-t-2 border-l-2 border-[#333] border-b-2 border-r-2 border-white"></div>
                </div>
              </div>
            </div>

            {/* Main Inventory */}
            <div className="grid grid-cols-9 gap-1 mb-2">
              {paddedInventory.slice(9, 36).map((item, i) => renderSlot(item, false, i))}
            </div>

            {/* Hotbar in Inventory */}
            <div className="grid grid-cols-9 gap-1 mt-4">
              {paddedInventory.slice(0, 9).map((item, i) => renderSlot(item, true, i))}
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-end items-center pb-4 select-none">
        
        {/* Crosshair */}
        {!inventoryOpen && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mix-blend-difference">
            <div className="w-4 h-[2px] bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
            <div className="w-[2px] h-4 bg-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
          </div>
        )}

        {/* Bottom HUD - Hide when inventory open to match MC style */}
        {!inventoryOpen && (
        <div className="flex flex-col items-center gap-1">
          {/* Health and Hunger bars */}
          <div className="flex justify-between w-[370px]">
            {/* Hearts */}
            <div className="flex -gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <PixelArt key={`heart-${i}`} pixels={HEART_PIXELS} colors={HEART_COLORS} size={18} />
              ))}
            </div>
            {/* Hunger */}
            <div className="flex -gap-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <PixelArt key={`hunger-${i}`} pixels={HUNGER_PIXELS} colors={HUNGER_COLORS} size={18} />
              ))}
            </div>
          </div>

          {/* Hotbar */}
          <div className="flex bg-[#8b8b8b]/40 p-[2px] gap-[2px] border-2 border-[#111] shadow-[0_0_4px_rgba(0,0,0,0.5)] pointer-events-auto">
            {paddedInventory.slice(0, 9).map((item, i) => renderSlot(item, true, i))}
          </div>
          {!document.pointerLockElement && (
              <div className="fixed top-4 bg-black/60 px-4 py-2 rounded text-white font-mono text-sm border border-white/20">
                Hint: If you can't look around, open the app in a new tab ↗️
              </div>
          )}
        </div>
        )}
      </div>
      <div 
        id="coords-overlay" 
        className={`fixed top-2 left-2 z-50 text-white font-mono text-sm bg-black/30 p-2 pointer-events-none whitespace-pre-wrap drop-shadow-md ${showDebug ? 'block' : 'hidden'}`}
        style={{ textShadow: "1px 1px 0px #3f3f3f" }}
      ></div>
    </>
  );
}
