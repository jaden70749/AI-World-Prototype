import { useGameStore } from '../lib/store';

export function Settings() {
  const { settingsOpen, setSettingsOpen, creativeMode, setCreativeMode, renderDistance, setRenderDistance, language, setLanguage } = useGameStore();

  if (!settingsOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center font-mono"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Repeating Dirt Background */}
      <div 
        className="absolute inset-0 bg-[#5c3a18]" 
        style={{
          backgroundImage: `url('data:image/svg+xml;utf8,<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" fill="%23604531" /><rect x="0" y="0" width="16" height="16" fill="%2373563c" /><rect x="16" y="16" width="16" height="16" fill="%23856345" /><rect x="0" y="16" width="16" height="16" fill="%23553d2a" /></svg>')`,
          backgroundSize: '128px',
          imageRendering: 'pixelated',
          opacity: 0.95
        }}
      ></div>

      <div className="relative z-10 w-full max-w-2xl px-8 flex flex-col items-center h-full py-10">
        <h1 className="text-white text-[20px] font-bold mb-10 tracking-widest textShadow-custom">설정</h1>

        <div className="grid grid-cols-2 gap-[10px] w-full mb-10">
          <Button onClick={() => setRenderDistance(renderDistance === 8 ? 12 : 8)}>
            시야 범위: {renderDistance === 8 ? '보통' : '넓음'}
          </Button>
          <Button>Realms 알림: 켜짐</Button>
        </div>

        <div className="grid grid-cols-2 gap-[10px] w-full mb-14">
          <Button>스킨 사용자 지정...</Button>
          <Button>음악 및 소리...</Button>
          <Button className="border-[#333333] !border-4 bg-blue-400 hover:bg-blue-300">비디오 설정...</Button>
          <Button>조작...</Button>
          <Button onClick={() => setLanguage(language === 'English' ? 'Korean' : 'English')}>
            언어...
          </Button>
          <Button>대화 설정...</Button>
          <Button>리소스 팩...</Button>
          <Button>기기정보 수집 설정...</Button>
        </div>

        <div className="mt-auto pb-10 w-full flex justify-center">
          <Button className="w-[400px]" onClick={() => {
              setSettingsOpen(false);
              setTimeout(() => document.body.requestPointerLock(), 100);
          }}>완료</Button>
        </div>
      </div>
      
      {/* Basic Text shadow util style */}
      <style>{`
        .textShadow-custom {
            text-shadow: 2px 2px 0px #333;
        }
      `}</style>
    </div>
  );
}

function Button({ children, className = '', onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`
        bg-[#777] text-white text-lg font-bold py-3 px-4
        border-t-4 border-l-4 border-zinc-400
        border-b-4 border-r-4 border-zinc-800
        hover:bg-[#888] hover:border-blue-300
        active:border-t-zinc-800 active:border-l-zinc-800 active:border-b-zinc-400 active:border-r-zinc-400
        textShadow-custom tracking-wider flex items-center justify-center
        ${className}
      `}
    >
      {children}
    </button>
  );
}
