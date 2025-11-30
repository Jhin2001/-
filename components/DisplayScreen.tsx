
import React, { useState, useEffect, useRef } from 'react';
import { QueueConfig, ZoneConfig, ContentType, QueueNumberStyle, Patient } from '../types';
import { WifiOff, Activity } from 'lucide-react';

interface DisplayScreenProps {
  config: QueueConfig;
}

// Hook for responsive checks
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
};

const DisplayScreen: React.FC<DisplayScreenProps> = ({ config }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { theme, layout, header, system, speech } = config;
  
  // Responsive Check: TV/Desktop vs Mobile/Tablet
  const isLargeScreen = useMediaQuery('(min-width: 1024px)');

  // Track the last called ID and timestamp to handle deduplication and recalls
  const lastCalledRef = useRef<{id: string, ts: number} | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Speech Synthesis Logic ---
  useEffect(() => {
    if (!speech.enabled || !config.currentPatient.id) return;

    const p = config.currentPatient;
    const last = lastCalledRef.current;
    
    // Logic:
    // 1. New Call: Different ID from last
    // 2. Recall: Same ID but newer timestamp
    const isNewCall = !last || last.id !== p.id;
    const isRecall = last && last.id === p.id && (p.callTimestamp || 0) > last.ts;

    if (isNewCall || isRecall) {
      // Check Broadcast Mode
      if (speech.broadcastMode === 'local') {
         // If patient's assigned window doesn't match this screen's window name, don't speak
         if (p.windowName && p.windowName !== config.windowName) {
           // Skip audio, but update ref to avoid re-triggering loop
           lastCalledRef.current = { id: p.id, ts: p.callTimestamp || 0 };
           return; 
         }
      }

      // Update ref
      lastCalledRef.current = { id: p.id, ts: p.callTimestamp || 0 };
      
      // Prepare text
      const windowTarget = p.windowName || config.windowName;
      const textToSpeak = speech.template
        .replace(/{name}/g, p.name)
        .replace(/{number}/g, p.number)
        .replace(/{window}/g, windowTarget);

      speak(textToSpeak);
    }
  }, [config.currentPatient, speech, config.windowName]);

  const speak = (text: string) => {
    // Basic browser TTS
    if ('speechSynthesis' in window) {
      // Note: Browsers automatically queue calls to speak()
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = speech.volume; // 0 to 1
      utterance.rate = speech.rate;   // 0.1 to 10
      utterance.pitch = speech.pitch; // 0 to 2
      utterance.lang = 'zh-CN';
      
      window.speechSynthesis.speak(utterance);
    }
  };


  // --- Unregistered State Overlay ---
  if (system && !system.isRegistered) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-white p-8 space-y-8">
        <div className="w-24 h-24 rounded-full bg-red-600 flex items-center justify-center animate-pulse">
           <WifiOff size={48} />
        </div>
        <div className="text-center space-y-2">
           <h1 className="text-4xl font-bold">终端未注册 (Unregistered)</h1>
           <p className="text-xl text-gray-400">此设备尚未绑定任何窗口或预案</p>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 w-full max-w-lg">
           <div className="grid grid-cols-2 gap-4 text-sm font-mono">
              <div className="text-gray-500">Device IP:</div>
              <div className="text-right text-blue-400">{system.deviceIp}</div>
              <div className="text-gray-500">MAC Address:</div>
              <div className="text-right text-purple-400">{system.deviceMac}</div>
              <div className="text-gray-500">Device ID:</div>
              <div className="text-right text-green-400">{system.deviceId}</div>
           </div>
        </div>

        <div className="text-sm text-gray-500">
          请联系管理员在服务端配置此设备 IP 地址
        </div>
      </div>
    );
  }


  // --- Helper Functions ---

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    return date.toLocaleDateString('zh-CN', options);
  };

  const formatTime = (date: Date, format: string) => {
    if (format === 'HH:mm') return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  };

  const renderQueueNumber = (number: string, style: QueueNumberStyle, fontSizeClass: string = 'text-sm') => {
    if (!config.showQueueNumber) return null;

    if (style === 'none') {
       // Just colored text, no background box
       return <span className={`${fontSizeClass} ml-2 font-bold text-teal-600`}>{number}</span>;
    }

    // Badge Styles
    const baseClasses = "font-bold text-white flex items-center justify-center shadow-sm px-2 py-0.5";
    const shapeClass = 
      style === 'circle' ? 'rounded-full aspect-square' :
      style === 'square' ? 'rounded-none' : 'rounded-lg';
    
    return (
      <span 
        className={`${baseClasses} ${shapeClass} ${fontSizeClass} bg-teal-500`}
        style={{ minWidth: '2.5em' }}
      >
        {number}
      </span>
    );
  };

  // --- Component Factory ---
  const renderZoneContent = (zoneConfig: ZoneConfig) => {
    if (zoneConfig.type === 'hidden') return null;

    // Common Wrapper Style
    const wrapperClass = "w-full h-full shadow-lg relative overflow-hidden flex flex-col";
    const wrapperStyle = { borderRadius: `${config.cardRounded}px`, backgroundColor: '#fff' };

    switch (zoneConfig.type) {
      case 'window-info':
        return (
          <div className={wrapperClass} style={{ ...wrapperStyle, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}dd 100%)`, color: '#fff' }}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full transform translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
            <div className="flex-1 flex flex-col items-center justify-center p-4">
               {/* Window Number Section */}
               {(zoneConfig.showWindowNumber !== false) && (
                 <div className="relative mb-2">
                  <div className="w-32 h-32 rounded-full bg-white bg-opacity-20 flex items-center justify-center backdrop-blur-sm">
                    <span className="font-bold leading-none" style={{ fontSize: `${zoneConfig.windowNumberFontSize || config.windowNumberSize}px` }}>
                      {config.windowNumber}
                    </span>
                  </div>
                  <div className="text-center text-sm mt-1 opacity-80">窗口</div>
                </div>
               )}
              
              {/* Rich Text Subtitle */}
              <div 
                 className="mb-1 text-center"
                 dangerouslySetInnerHTML={{ __html: zoneConfig.windowSubTitleHtml || '<div class="text-lg opacity-90">请排队 取号</div>' }}
              />
              
              <div className="font-bold text-center" style={{ fontSize: `${zoneConfig.windowNameFontSize || config.windowNameSize}px` }}>
                {config.windowName}
              </div>
            </div>
          </div>
        );

      case 'current-call':
        return (
          <div className={wrapperClass} style={{ ...wrapperStyle, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}dd 100%)`, color: '#fff' }}>
             <div className="flex-1 flex flex-col items-center justify-center p-4">
                {(zoneConfig.showCurrentTitle !== false) && (
                  <div className="font-semibold opacity-90 mb-4" style={{ fontSize: `${zoneConfig.currentTitleFontSize || 24}px` }}>
                     {zoneConfig.currentTitleText || '正在取药'}
                  </div>
                )}
                
                <div className="flex flex-col md:flex-row items-center gap-4 text-center">
                   <div className="font-bold" style={{ fontSize: `${zoneConfig.currentNameFontSize || 60}px` }}>
                      {config.currentPatient.name}
                   </div>
                   {config.showQueueNumber && config.queueNumberStyle === 'none' && (
                     <div className="font-bold text-teal-200" style={{ fontSize: `${zoneConfig.currentNumberFontSize || 40}px` }}>
                        {config.currentPatient.number}
                     </div>
                   )}
                </div>
                {config.showQueueNumber && config.queueNumberStyle !== 'none' && (
                  <div className={`mt-6 bg-teal-400 text-white px-8 py-2 font-bold shadow-md ${
                    config.queueNumberStyle === 'circle' ? 'rounded-full' : 
                    config.queueNumberStyle === 'square' ? 'rounded-none' : 'rounded-lg'
                  }`} style={{ fontSize: `${zoneConfig.currentNumberFontSize || 36}px` }}>
                    {config.currentPatient.number}
                  </div>
                )}
             </div>
          </div>
        );

      case 'waiting-list':
        // Determine list content based on mode
        let displayList: (Patient & { isPassed?: boolean })[] = [...config.waitingList];
        
        if (config.passedDisplayMode === 'wait-list-end') {
          const passedPatients = config.passedList.map(p => ({ ...p, isPassed: true }));
          displayList = [...displayList, ...passedPatients];
        }

        // Calculate limit
        const waitLimit = (zoneConfig.gridColumns || 1) * (zoneConfig.gridRows || 3);
        const visibleWaiting = displayList.slice(0, waitLimit);

        return (
          <div className={wrapperClass} style={wrapperStyle}>
             <div className="py-2 px-4 text-white font-bold text-lg flex justify-between items-center shrink-0" style={{ background: theme.primary }}>
               <span style={{ fontSize: `${zoneConfig.titleFontSize || 18}px`, color: zoneConfig.titleColor }}>
                 {zoneConfig.title || '等待取药'}
               </span>
               <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded">{displayList.length}人等待</span>
             </div>
             <div 
                className="flex-1 p-3 content-start overflow-hidden"
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: `repeat(${zoneConfig.gridColumns || 1}, minmax(0, 1fr))`,
                  gridAutoRows: 'min-content',
                  gap: '0.75rem',
                  alignContent: 'start'
                }}
             >
               {visibleWaiting.map((patient) => {
                  const isGrayed = patient.isPassed && config.grayOutPassed;
                  return (
                    <div 
                      key={patient.id} 
                      className={`
                        border rounded-lg p-2 px-3 flex justify-between items-center shadow-sm h-fit relative
                        ${isGrayed ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-gray-50 border-gray-100'}
                      `}
                    >
                      <span className={`font-bold truncate ${isGrayed ? 'text-gray-400 decoration-slate-400' : 'text-gray-700'}`} style={{ fontSize: `${zoneConfig.contentFontSize || 24}px` }}>
                        {patient.name}
                      </span>
                      {isGrayed && <span className="absolute right-12 text-[10px] bg-gray-200 px-1 rounded">过号</span>}
                      <div className={isGrayed ? 'opacity-50 grayscale' : ''}>
                         {renderQueueNumber(patient.number, config.queueNumberStyle)}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        );

      case 'passed-list':
        const passLimit = (zoneConfig.gridColumns || 1) * (zoneConfig.gridRows || 3);
        const visiblePassed = config.passedList.slice(0, passLimit);

        return (
          <div className={wrapperClass} style={wrapperStyle}>
            <div className="py-2 px-4 text-white font-bold text-lg shrink-0" style={{ background: theme.secondary }}>
               <span style={{ fontSize: `${zoneConfig.titleFontSize || 18}px`, color: zoneConfig.titleColor }}>
                {zoneConfig.title || '过号患者'}
               </span>
            </div>
            <div 
                className="flex-1 p-3 content-start overflow-hidden"
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: `repeat(${zoneConfig.gridColumns || 1}, minmax(0, 1fr))`,
                  gridAutoRows: 'min-content',
                  gap: '0.75rem',
                  alignContent: 'start'
                }}
             >
              {visiblePassed.map((patient) => (
                <div key={patient.id} className="bg-gray-50 border border-gray-100 rounded-lg p-2 px-3 flex justify-between items-center shadow-sm h-fit">
                  <span className="font-bold text-gray-500 truncate" style={{ fontSize: `${zoneConfig.contentFontSize || 20}px` }}>
                    {patient.name}
                  </span>
                  {renderQueueNumber(patient.number, config.queueNumberStyle, 'text-xs')}
                </div>
              ))}
            </div>
          </div>
        );

      case 'static-text':
        return (
          <div className={wrapperClass} style={{ 
            ...wrapperStyle, 
            background: zoneConfig.staticBgColor || '#fff',
            color: zoneConfig.staticTextColor || '#333'
          }}>
            <div className="flex-1 p-4 flex flex-col h-full overflow-hidden">
               {/* Rich Text Block */}
               <div 
                 className="w-full h-full overflow-y-auto"
                 style={{ fontSize: `${zoneConfig.staticTextSize || 24}px` }}
                 dangerouslySetInnerHTML={{ __html: zoneConfig.staticTextContent || '请输入文本...' }}
               />
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  // Layout Logic Vars
  const hasLeft = layout.topLeft.type !== 'hidden' || layout.bottomLeft.type !== 'hidden';
  const hasRight = layout.topRight.type !== 'hidden' || layout.bottomRight.type !== 'hidden';
  
  // Calculate final widths based on visibility and screen size
  // On Mobile: Width is 100%
  // On Desktop: Width is determined by splitRatio
  const leftWidth = isLargeScreen 
    ? (hasLeft && hasRight ? `${layout.splitRatio}%` : (hasLeft ? '100%' : '0%')) 
    : '100%';
  
  const rightWidth = isLargeScreen 
    ? (hasLeft && hasRight ? `${100 - layout.splitRatio}%` : (hasRight ? '100%' : '0%')) 
    : '100%';

  // --- Footer Text Logic ---
  let footerHtml = layout.footerText;
  if (config.passedDisplayMode === 'footer' && config.passedList.length > 0) {
    const passedNames = config.passedList.map(p => `${p.name}(${p.number})`).join('，');
    const passedHtml = `<span style="margin-left: 40px; color: #fbbf24; font-weight: bold;">[过号患者]：</span><span style="color: #fff;">${passedNames}</span>`;
    footerHtml += passedHtml;
  }

  return (
    <div 
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{ backgroundColor: '#e5e7eb' }}
    >
      {/* --- Hot Reload Indicator (Simulated) --- */}
      {config.configVersion && (
        <div className="absolute top-0 right-0 p-1 opacity-20 hover:opacity-100 z-50 pointer-events-none transition-opacity">
           <span className="text-[10px] bg-black text-white px-1 rounded flex items-center gap-1">
             <Activity size={8} className="animate-pulse" />
             {config.configVersion}
           </span>
        </div>
      )}

      {/* --- HEADER --- */}
      {header.show && (
        <header 
          className="w-full flex justify-between items-center px-4 lg:px-6 shadow-lg z-10 shrink-0"
          style={{ 
            background: theme.primary, 
            color: theme.textOnPrimary,
            height: isLargeScreen ? `${header.height}px` : 'auto',
            minHeight: isLargeScreen ? 'auto' : '60px',
            paddingTop: isLargeScreen ? '0' : '8px',
            paddingBottom: isLargeScreen ? '0' : '8px',
          }}
        >
          {/* Left: Logo/Name */}
          <div className="flex items-center gap-2 lg:gap-4 flex-1">
            {header.logoType === 'default' && (
              <div className="w-8 h-8 lg:w-10 lg:h-10 rounded bg-white bg-opacity-20 flex items-center justify-center text-lg lg:text-xl font-bold shadow-sm shrink-0">
                U
              </div>
            )}
            {header.logoType === 'image' && header.logoUrl && (
              <img src={header.logoUrl} alt="Logo" className="h-8 lg:h-10 w-auto object-contain" />
            )}
            
            <h1 className="font-bold leading-tight truncate" style={{ fontSize: isLargeScreen ? `${header.hospitalNameSize}px` : '1.25rem' }}>
              {header.hospitalName}
            </h1>
          </div>

          {/* Center: Title */}
          {header.showCenterTitle && (
            <div className={`flex-1 text-center font-medium opacity-90 truncate px-2 ${!isLargeScreen ? 'hidden md:block' : ''}`} style={{ fontSize: isLargeScreen ? `${header.centerTitleSize}px` : '1rem' }}>
              {header.centerTitle}
            </div>
          )}

          {/* Right: Time or Text */}
          <div className="flex-1 flex justify-end">
            {header.rightContentType === 'time' && (
              <div className="text-right">
                <div className="text-xs opacity-80 mb-0.5">{formatDate(currentTime)}</div>
                <div className="font-mono font-bold leading-none tracking-widest text-lg lg:text-2xl">
                  {formatTime(currentTime, header.timeFormat)}
                </div>
              </div>
            )}
            {header.rightContentType === 'text' && (
               <div className="text-right font-bold text-lg lg:text-xl opacity-90">
                 {header.rightTextContent}
               </div>
            )}
          </div>
        </header>
      )}

      {/* --- MAIN CONTENT (Dynamic Grid) --- */}
      <main 
        className={`flex-1 flex overflow-hidden ${isLargeScreen ? 'flex-row' : 'flex-col'}`}
        style={{ padding: `${layout.containerPadding}px`, gap: `${layout.gap}px` }}
      >
        
        {/* Left Column */}
        {hasLeft && (
          <div 
             className="flex flex-col transition-all duration-300" 
             style={{ 
               width: leftWidth, 
               gap: `${layout.gap}px`,
               // On mobile, let flex handle height. On desktop, height is 100%
               height: isLargeScreen ? '100%' : 'auto', 
               flex: isLargeScreen ? undefined : 1
             }}
          >
            
            {/* Top Left */}
            {layout.topLeft.type !== 'hidden' && (
              <div 
                style={{ 
                  flex: layout.bottomLeft.type === 'hidden' ? '1' : `${layout.leftSplitRatio} 1 0%` 
                }}
              >
                {renderZoneContent(layout.topLeft)}
              </div>
            )}

            {/* Bottom Left */}
            {layout.bottomLeft.type !== 'hidden' && (
              <div 
                 style={{ 
                   flex: layout.topLeft.type === 'hidden' ? '1' : `${100 - layout.leftSplitRatio} 1 0%` 
                 }}
              >
                {renderZoneContent(layout.bottomLeft)}
              </div>
            )}
          </div>
        )}

        {/* Right Column */}
        {hasRight && (
          <div 
             className="flex flex-col transition-all duration-300"
             style={{ 
               width: rightWidth, 
               gap: `${layout.gap}px`,
               height: isLargeScreen ? '100%' : 'auto',
               flex: isLargeScreen ? undefined : 1
             }}
          >
            
             {/* Top Right */}
             {layout.topRight.type !== 'hidden' && (
              <div 
                style={{ 
                  flex: layout.bottomRight.type === 'hidden' ? '1' : `${layout.rightSplitRatio} 1 0%` 
                }}
              >
                {renderZoneContent(layout.topRight)}
              </div>
            )}

            {/* Bottom Right */}
            {layout.bottomRight.type !== 'hidden' && (
              <div 
                 style={{ 
                   flex: layout.topRight.type === 'hidden' ? '1' : `${100 - layout.rightSplitRatio} 1 0%` 
                 }}
              >
                {renderZoneContent(layout.bottomRight)}
              </div>
            )}
          </div>
        )}

      </main>

      {/* --- FOOTER --- */}
      {layout.footerShow && (
        <footer 
          className="w-full px-4 text-center font-medium flex items-center justify-center shrink-0 z-10 overflow-hidden relative"
          style={{ background: theme.secondary, height: `${layout.footerHeight}px`, color: '#fff' }}
        >
          {layout.footerScroll ? (
            <div 
              className="whitespace-nowrap inline-block min-w-full"
              style={{ 
                animation: `marquee ${layout.footerSpeed}s linear infinite`,
                willChange: 'transform'
              }}
              dangerouslySetInnerHTML={{ __html: footerHtml }}
            />
          ) : (
             <div className="overflow-hidden whitespace-nowrap w-full" dangerouslySetInnerHTML={{ __html: footerHtml }} />
          )}
        </footer>
      )}
    </div>
  );
};

export default DisplayScreen;
