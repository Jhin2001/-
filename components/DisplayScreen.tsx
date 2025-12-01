import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QueueConfig, ZoneConfig, ContentType, QueueNumberStyle, Patient } from '../types';
import { WifiOff, Activity, PauseCircle, RefreshCw } from 'lucide-react';
import { DEFAULT_CONFIG } from '../constants';

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
  // Default speech to DEFAULT_CONFIG.speech to prevent undefined access if config is partial
  const { theme, layout, header, system, speech = DEFAULT_CONFIG.speech } = config;
  
  // Responsive Check: TV/Desktop vs Mobile/Tablet
  const isLargeScreen = useMediaQuery('(min-width: 1024px)');

  // Determine Layout Mode
  const isHorizontal = layout.orientation === 'landscape' && isLargeScreen;

  // Track the last called ID and timestamp to handle deduplication and recalls
  const lastCalledRef = useRef<{id: string, ts: number} | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // --- Optimization Logic: Detect if current layout is Static Text Only ---
  const isStaticOnly = useMemo(() => {
    // Check all 4 zones
    const zones = [layout.topLeft, layout.topRight, layout.bottomLeft, layout.bottomRight];
    const hasDynamicContent = zones.some(z => 
       z.type === 'waiting-list' || 
       z.type === 'current-call' || 
       z.type === 'window-info' || // Often contains dynamic window number
       z.type === 'passed-list'
    );
    return !hasDynamicContent;
  }, [layout.topLeft.type, layout.topRight.type, layout.bottomLeft.type, layout.bottomRight.type]);

  const pollingStatus = useMemo(() => {
     if (config.dataSource?.pollingStrategy === 'smart' && isStaticOnly) {
        return 'paused';
     }
     return 'active';
  }, [config.dataSource?.pollingStrategy, isStaticOnly]);


  // --- TV Adaptation: Hide Cursor on Inactivity ---
  useEffect(() => {
    let cursorTimer: any;
    const hideCursor = () => document.body.style.cursor = 'none';
    const showCursor = () => {
      document.body.style.cursor = 'default';
      clearTimeout(cursorTimer);
      cursorTimer = setTimeout(hideCursor, 3000);
    };

    window.addEventListener('mousemove', showCursor);
    window.addEventListener('click', showCursor);
    window.addEventListener('touchstart', showCursor);

    // Initial timer
    cursorTimer = setTimeout(hideCursor, 3000);

    return () => {
      window.removeEventListener('mousemove', showCursor);
      window.removeEventListener('click', showCursor);
      window.removeEventListener('touchstart', showCursor);
      clearTimeout(cursorTimer);
      document.body.style.cursor = 'default';
    };
  }, []);


  // --- Speech Synthesis Logic ---
  useEffect(() => {
    if (!speech?.enabled || !config.currentPatient.id) return;

    const p = config.currentPatient;
    const last = lastCalledRef.current;
    
    // Helper to normalize timestamp to number
    const currentTs = p.callTimestamp 
      ? (typeof p.callTimestamp === 'number' ? p.callTimestamp : new Date(p.callTimestamp).getTime()) 
      : 0;

    // Logic:
    // 1. New Call: Different ID from last
    // 2. Recall: Same ID but newer timestamp
    const isNewCall = !last || last.id !== p.id;
    const isRecall = last && last.id === p.id && currentTs > last.ts;

    if (isNewCall || isRecall) {
      // Check Broadcast Mode
      if (speech.broadcastMode === 'local') {
         // Strict Check: Match Window Number (Preferred)
         const pWinNum = p.windowNumber;
         const cWinNum = config.windowNumber;
         
         if (pWinNum && cWinNum) {
           // If numbers are available, strict match
           if (pWinNum !== cWinNum) {
              lastCalledRef.current = { id: p.id, ts: currentTs };
              return;
           }
         } else if (p.windowName && p.windowName !== config.windowName) {
           // Fallback: If no number, check Window Name
           lastCalledRef.current = { id: p.id, ts: currentTs };
           return; 
         }
      }

      // Update ref
      lastCalledRef.current = { id: p.id, ts: currentTs };
      
      // Prepare text
      const windowTarget = p.windowName || config.windowName;
      const textToSpeak = speech.template
        .replace(/{name}/g, p.name)
        .replace(/{number}/g, p.number)
        .replace(/{window}/g, windowTarget);

      speak(textToSpeak);
    }
  }, [config.currentPatient, speech, config.windowName, config.windowNumber]);

  const speak = (text: string) => {
    // Basic browser TTS
    if ('speechSynthesis' in window) {
      // Note: Browsers automatically queue calls to speak()
      const utterance = new SpeechSynthesisUtterance(text);
      // Ensure speech object properties are accessed safely
      utterance.volume = speech?.volume || 1; 
      utterance.rate = speech?.rate || 1;
      utterance.pitch = speech?.pitch || 1;
      utterance.lang = 'zh-CN';
      
      window.speechSynthesis.speak(utterance);
    }
  };


  // --- Unregistered State Overlay ---
  if (system && !system.isRegistered) {
    return (
      <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center text-white p-8 space-y-8 select-none">
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

  const renderQueueNumber = (number: string, style: QueueNumberStyle, fontSizeClass: string = 'text-sm', isCurrent?: boolean) => {
    if (!config.showQueueNumber) return null;

    if (style === 'none') {
       // Just colored text, no background box
       return <span className={`${fontSizeClass} font-bold ${isCurrent ? 'text-white' : 'text-teal-600'}`}>{number}</span>;
    }

    // Badge Styles
    const baseClasses = "font-bold text-white flex items-center justify-center shadow-sm px-2 py-0.5";
    const shapeClass = 
      style === 'circle' ? 'rounded-full aspect-square' :
      style === 'square' ? 'rounded-none' : 'rounded-lg';
    
    return (
      <span 
        className={`${baseClasses} ${shapeClass} ${fontSizeClass} ${isCurrent ? 'bg-orange-500' : 'bg-teal-500'}`}
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
              {(zoneConfig.showWindowSubTitle !== false) && (
                <div 
                   className="mb-1 text-center"
                   dangerouslySetInnerHTML={{ __html: zoneConfig.windowSubTitleHtml || '<div class="text-lg opacity-90">请排队 取号</div>' }}
                />
              )}
              
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
        let displayList: (Patient & { isPassed?: boolean, isCurrent?: boolean })[] = [...config.waitingList];
        
        // --- Merge Current Patient Logic ---
        if (zoneConfig.includeCurrent && config.currentPatient && config.currentPatient.id) {
           displayList = [{ ...config.currentPatient, isCurrent: true }, ...displayList];
        }

        // --- Merge Passed Patient Logic ---
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
                  const isCurrent = patient.isCurrent;
                  
                  // Highlight logic only applies if enabled and isCurrent
                  const isHighlighted = isCurrent && zoneConfig.highlightCurrent;

                  return (
                    <div 
                      key={patient.id} 
                      className={`
                        border rounded-lg p-2 px-3 flex justify-between items-center shadow-sm h-fit gap-2
                        ${isGrayed ? 'bg-gray-100 border-gray-200 text-gray-400' : ''}
                        ${isHighlighted ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-200' : ''}
                        ${!isGrayed && !isHighlighted ? 'bg-gray-50 border-gray-100' : ''}
                      `}
                    >
                      {/* Name and Badges Container */}
                      <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <span className={`font-bold truncate ${isGrayed ? 'text-gray-400 decoration-slate-400' : isHighlighted ? 'text-orange-700' : 'text-gray-700'}`} style={{ fontSize: `${zoneConfig.contentFontSize || 24}px` }}>
                          {patient.name}
                        </span>
                        
                        {isGrayed && <span className="flex-shrink-0 text-[10px] bg-gray-200 px-1 rounded whitespace-nowrap">过号</span>}
                        {isCurrent && isHighlighted && (
                           <span className="flex-shrink-0 text-[10px] bg-orange-200 text-orange-800 px-1 rounded font-bold animate-pulse whitespace-nowrap">正在叫号</span>
                        )}
                      </div>

                      {/* Number Container (Right aligned) */}
                      <div className={`flex-shrink-0 ${isGrayed ? 'opacity-50 grayscale' : ''}`}>
                         {renderQueueNumber(patient.number, config.queueNumberStyle, 'text-sm', isHighlighted)}
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
  // If Portrait/Mobile: Width is 100%
  // If Landscape Large Screen: Width is determined by splitRatio
  const leftWidth = isHorizontal 
    ? (hasLeft && hasRight ? `${layout.splitRatio}%` : (hasLeft ? '100%' : '0%')) 
    : '100%';
  
  const rightWidth = isHorizontal 
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
      className="w-full h-full flex flex-col relative overflow-hidden select-none"
      style={{ 
        backgroundColor: '#e5e7eb',
        padding: layout.overscanPadding || 0
      }}
    >
      {/* --- Hot Reload & Polling Status Indicator --- */}
      {config.configVersion && (
        <div 
          className="absolute top-0 left-0 p-1 z-50 pointer-events-none flex flex-col gap-1"
          style={{ 
            top: (layout.overscanPadding || 0) + 4, 
            left: (layout.overscanPadding || 0) + 4 
          }}
        >
           {/* Version Badge */}
           <div className="opacity-20 hover:opacity-100 transition-opacity">
               <span className="text-[10px] bg-black text-white px-1 rounded flex items-center gap-1">
                 <Activity size={8} className="animate-pulse" />
                 {config.configVersion}
               </span>
           </div>
           
           {/* Smart Polling Indicator (Visible when Paused) */}
           {pollingStatus === 'paused' && (
             <div className="animate-in slide-in-from-left duration-300">
               <span className="text-[10px] bg-yellow-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md font-bold opacity-80">
                 <PauseCircle size={10} />
                 数据库轮询: 已暂停 (静态内容)
               </span>
             </div>
           )}
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
        className={`flex-1 flex overflow-hidden ${isHorizontal ? 'flex-row' : 'flex-col'}`}
        style={{ padding: `${layout.containerPadding}px`, gap: `${layout.gap}px` }}
      >
        
        {/* Left Column (or Top Section in Portrait) */}
        {hasLeft && (
          <div 
             className="flex flex-col transition-all duration-300" 
             style={{ 
               width: leftWidth, 
               gap: `${layout.gap}px`,
               // If horizontal: Height is 100%, flex is set by logic above
               // If vertical/mobile: Height is auto, or controlled by splitRatio if we wanted to enforce it
               height: isHorizontal ? '100%' : 'auto', 
               flex: isHorizontal ? undefined : 1
             }}
          >
            
            {/* Top Left */}
            {layout.topLeft.type !== 'hidden' && (
              <div 
                style={{ 
                  flex: layout.bottomLeft.type === 'hidden' ? '1' : `${layout.leftSplitRatio ?? 50} 1 0%`,
                  overflow: 'hidden',
                  minHeight: 0
                }}
              >
                {renderZoneContent(layout.topLeft)}
              </div>
            )}

            {/* Bottom Left */}
            {layout.bottomLeft.type !== 'hidden' && (
              <div 
                 style={{ 
                   flex: layout.topLeft.type === 'hidden' ? '1' : `${100 - (layout.leftSplitRatio ?? 50)} 1 0%`,
                   overflow: 'hidden',
                   minHeight: 0
                 }}
              >
                {renderZoneContent(layout.bottomLeft)}
              </div>
            )}
          </div>
        )}

        {/* Right Column (or Bottom Section in Portrait) */}
        {hasRight && (
          <div 
             className="flex flex-col transition-all duration-300"
             style={{ 
               width: rightWidth, 
               gap: `${layout.gap}px`,
               height: isHorizontal ? '100%' : 'auto',
               flex: isHorizontal ? undefined : 1
             }}
          >
            
             {/* Top Right */}
             {layout.topRight.type !== 'hidden' && (
              <div 
                style={{ 
                  flex: layout.bottomRight.type === 'hidden' ? '1' : `${layout.rightSplitRatio ?? 50} 1 0%`,
                  overflow: 'hidden',
                  minHeight: 0
                }}
              >
                {renderZoneContent(layout.topRight)}
              </div>
            )}

            {/* Bottom Right */}
            {layout.bottomRight.type !== 'hidden' && (
              <div 
                 style={{ 
                   flex: layout.topRight.type === 'hidden' ? '1' : `${100 - (layout.rightSplitRatio ?? 50)} 1 0%`,
                   overflow: 'hidden',
                   minHeight: 0
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