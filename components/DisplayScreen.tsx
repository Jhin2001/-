import React, { useState, useEffect, useRef, useMemo } from 'react';
import { QueueConfig, ZoneConfig, ContentType, QueueNumberStyle, Patient, HeaderConfig } from '../types';
import { WifiOff, Activity, PauseCircle } from 'lucide-react';
import { DEFAULT_CONFIG } from '../constants';

interface DisplayScreenProps {
  config: QueueConfig;
  isPreview?: boolean;
}

// --- ISOLATED CLOCK COMPONENT ---
// Performance Fix: Only this component re-renders every second, not the entire screen.
const Clock: React.FC<{ header: HeaderConfig; isLargeScreen: boolean; getSize: (px: number) => string }> = React.memo(({ header, isLargeScreen, getSize }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    return date.toLocaleDateString('zh-CN', options);
  };

  const formatTime = (date: Date, format: string) => {
    if (format === 'HH:mm') return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  };

  if (header.rightContentType !== 'time') return null;

  return (
    <div className="text-right">
      <div className="opacity-80 mb-[0.2em]" style={{ fontSize: getSize(12) }}>{formatDate(currentTime)}</div>
      <div className="font-mono font-bold leading-none tracking-widest" style={{ fontSize: getSize(header.height * 0.4) }}>
        {formatTime(currentTime, header.timeFormat)}
      </div>
    </div>
  );
});


// Hook for responsive checks
const useMediaQuery = (query: string) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return;
    }
    try {
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
          setMatches(media.matches);
        }
        const listener = () => setMatches(media.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    } catch (e) {
        return;
    }
  }, [matches, query]);

  return matches;
};

const DisplayScreen: React.FC<DisplayScreenProps> = ({ config, isPreview = false }) => {
  // Performance: Removed top-level currentTime state to prevent 1Hz full re-renders
  
  const theme = config.theme || DEFAULT_CONFIG.theme;
  const layout = config.layout || DEFAULT_CONFIG.layout;
  const header = config.header || DEFAULT_CONFIG.header;
  const system = config.system || DEFAULT_CONFIG.system;
  const speech = config.speech || DEFAULT_CONFIG.speech;
  const currentPatient = config.currentPatient || DEFAULT_CONFIG.currentPatient;
  const waitingList = config.waitingList || [];
  const passedList = config.passedList || [];

  // Threshold: 1024x600. Anything smaller is considered "Mobile/Small TV"
  const isLargeScreenRaw = useMediaQuery('(min-width: 1024px) and (min-height: 600px)');
  // If in preview mode, always treat as large screen (TV mode) because container is scaled
  const isLargeScreen = isPreview ? true : isLargeScreenRaw;
  
  const isHorizontal = layout.orientation === 'landscape';

  // --- RESPONSIVE HELPER ---
  const getSize = (px: number) => {
      if (isLargeScreen) return `${px}px`;
      return `${(px / 10.8).toFixed(2)}vh`;
  };

  const lastCalledRef = useRef<{id: string, ts: number} | null>((() => {
     if (config.currentPatient?.id) {
         const p = config.currentPatient;
         const ts = p.callTimestamp 
            ? (typeof p.callTimestamp === 'number' ? p.callTimestamp : new Date(p.callTimestamp).getTime()) 
            : 0;
         return { id: p.id, ts };
     }
     return null;
  })());

  const isStaticOnly = useMemo(() => {
    const zones = [layout.topLeft, layout.topRight, layout.bottomLeft, layout.bottomRight];
    const hasDynamicContent = zones.some(z => 
       z && (z.type === 'waiting-list' || z.type === 'current-call' || z.type === 'window-info' || z.type === 'passed-list')
    );
    return !hasDynamicContent;
  }, [layout]);

  const pollingStatus = useMemo(() => {
     if (config.dataSource?.pollingStrategy === 'smart' && isStaticOnly) {
        return 'paused';
     }
     return 'active';
  }, [config.dataSource?.pollingStrategy, isStaticOnly]);

  useEffect(() => {
    if (isPreview) return; // Don't hide cursor in preview mode

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
    cursorTimer = setTimeout(hideCursor, 3000);
    return () => {
      window.removeEventListener('mousemove', showCursor);
      window.removeEventListener('click', showCursor);
      window.removeEventListener('touchstart', showCursor);
      clearTimeout(cursorTimer);
      document.body.style.cursor = 'default';
    };
  }, [isPreview]);

  useEffect(() => {
    if (isPreview) return; // Don't speak in preview mode
    if (!system?.isRegistered) return;
    if (!speech?.enabled || !currentPatient.id) return;

    const p = currentPatient;
    const last = lastCalledRef.current;
    
    const currentTs = p.callTimestamp 
      ? (typeof p.callTimestamp === 'number' ? p.callTimestamp : new Date(p.callTimestamp).getTime()) 
      : 0;

    const isNewCall = !last || last.id !== p.id;
    const isRecall = last && last.id === p.id && currentTs > last.ts;

    if (isNewCall || isRecall) {
      if (speech.broadcastMode === 'local') {
         const pWinNum = p.windowNumber;
         const cWinNum = config.windowNumber;
         
         if (pWinNum && cWinNum) {
           if (pWinNum !== cWinNum) {
              lastCalledRef.current = { id: p.id, ts: currentTs };
              return; 
           }
         } else if (p.windowName && p.windowName !== config.windowName) {
           lastCalledRef.current = { id: p.id, ts: currentTs };
           return; 
         }
      }

      lastCalledRef.current = { id: p.id, ts: currentTs };
      
      const windowTarget = p.windowName || config.windowName;
      const textToSpeak = speech.template
        .replace(/{name}/g, p.name)
        .replace(/{number}/g, p.number)
        .replace(/{window}/g, windowTarget);

      speak(textToSpeak);
    }
  }, [currentPatient, speech, config.windowName, config.windowNumber, system?.isRegistered, isPreview]);

  const speak = (text: string) => {
    try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.volume = speech?.volume || 1; 
            utterance.rate = speech?.rate || 1;
            utterance.pitch = speech?.pitch || 1;
            utterance.lang = 'zh-CN';
            window.speechSynthesis.speak(utterance);
        }
    } catch (e) {}
  };

  if (system && !system.isRegistered && !isPreview) {
    return (
      <div className="fixed inset-0 w-screen h-screen bg-gray-900 flex flex-col items-center justify-center text-white overflow-hidden select-none">
        <div className="flex flex-col items-center gap-[2vh]">
            <div className="rounded-full bg-red-600 flex items-center justify-center animate-pulse shadow-lg shadow-red-900/50 shrink-0" 
                 style={{ width: '15vmin', height: '15vmin' }}>
               <WifiOff className="text-white" style={{ width: '8vmin', height: '8vmin' }} />
            </div>
            
            <div className="text-center">
               <h1 className="font-bold tracking-tight" style={{ fontSize: '5vmin', lineHeight: 1.2 }}>终端未注册</h1>
               <p className="text-gray-400" style={{ fontSize: '3vmin' }}>Unregistered Device</p>
            </div>
            
            <div className="bg-gray-800 rounded-xl border border-gray-700 w-[70vw] max-w-lg shadow-xl p-[3vmin]">
               <div className="grid grid-cols-1 gap-[1.5vmin]">
                  <div className="flex justify-between items-center border-b border-gray-700 pb-[1.5vmin]">
                      <div className="text-gray-500" style={{ fontSize: '3.5vmin' }}>Device ID</div>
                      <div className="text-right text-green-400 font-bold font-mono break-all" style={{ fontSize: '4.5vmin' }}>{system.deviceId}</div>
                  </div>
                  <div className="flex justify-between items-center pt-[0.5vmin]">
                      <div className="text-gray-500" style={{ fontSize: '3.5vmin' }}>IP Address</div>
                      <div className="text-right text-blue-400 break-all" style={{ fontSize: '3.5vmin' }}>{system.deviceIp || '---'}</div>
                  </div>
               </div>
            </div>

            <div className="text-gray-500 text-center px-4" style={{ fontSize: '2.5vmin' }}>
              请联系管理员在后台绑定此设备
            </div>
        </div>
      </div>
    );
  }

  const renderQueueNumber = (number: string, style: QueueNumberStyle, fontSize: string, isCurrent?: boolean) => {
    if (!config.showQueueNumber) return null;

    if (style === 'none') {
       return <span className={`font-bold ${isCurrent ? 'text-white' : 'text-teal-600'}`} style={{ fontSize }}>{number}</span>;
    }

    const baseClasses = "font-bold text-white flex items-center justify-center shadow-sm px-[0.4em] py-[0.1em]";
    const shapeClass = 
      style === 'circle' ? 'rounded-full aspect-square' :
      style === 'square' ? 'rounded-none' : 'rounded-lg';
    
    return (
      <span 
        className={`${baseClasses} ${shapeClass} ${isCurrent ? 'bg-orange-500' : 'bg-teal-500'}`}
        style={{ fontSize, minWidth: '2em' }}
      >
        {number}
      </span>
    );
  };

  const renderZoneContent = (zoneConfig: ZoneConfig) => {
    if (!zoneConfig || zoneConfig.type === 'hidden') return null;

    // --- APPLY ZONE CUSTOM COLORS OR FALLBACK TO THEME ---
    const customBg = zoneConfig.backgroundColor;
    const customText = zoneConfig.textColor;

    const wrapperClass = "w-full h-full shadow-lg relative overflow-hidden flex flex-col";
    
    // Default Style (Lists, Video, etc)
    const wrapperStyle = { 
        borderRadius: getSize(config.cardRounded),
        backgroundColor: customBg || theme.cardBackground || '#fff',
        color: customText || theme.textMain || '#111827'
    };

    switch (zoneConfig.type) {
      case 'window-info':
        // Logic: Use gradient by default, but solid color if customBg is set
        const windowStyle = {
            ...wrapperStyle,
            color: customText || '#fff', // Default window text is white
            background: customBg ? customBg : `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}dd 100%)`
        };

        return (
          <div className={wrapperClass} style={windowStyle}>
            
            <div className="flex-1 flex flex-col items-center justify-center p-[2vmin]">
               {(zoneConfig.showWindowNumber !== false) && (
                 <div className="relative mb-[1vmin]">
                  <div className="rounded-full bg-white bg-opacity-20 flex items-center justify-center backdrop-blur-sm shadow-sm"
                       style={{ 
                           width: getSize(128), // approx w-32
                           height: getSize(128) 
                       }}>
                    <span className="font-bold leading-none" style={{ fontSize: getSize(zoneConfig.windowNumberFontSize || config.windowNumberSize) }}>
                      {config.windowNumber}
                    </span>
                  </div>
                  <div className="text-center opacity-80 mt-[0.5vmin]" style={{ fontSize: getSize(16) }}>窗口</div>
                </div>
               )}
              
              {(zoneConfig.showWindowSubTitle !== false) && (
                <div 
                   className="mb-[0.5vmin] text-center"
                   style={{ fontSize: getSize(20) }}
                   dangerouslySetInnerHTML={{ __html: zoneConfig.windowSubTitleHtml || '<div style="opacity:0.9;">请排队 取号</div>' }}
                />
              )}
              
              <div className="font-bold text-center leading-tight" style={{ fontSize: getSize(zoneConfig.windowNameFontSize || config.windowNameSize) }}>
                {config.windowName}
              </div>
            </div>
          </div>
        );

      case 'current-call':
        const currentStyle = {
            ...wrapperStyle,
            color: customText || '#fff',
            background: customBg ? customBg : `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}dd 100%)`
        };

        return (
          <div className={wrapperClass} style={currentStyle}>
             <div className="flex-1 flex flex-col items-center justify-center p-[2vmin]">
                {(zoneConfig.showCurrentTitle !== false) && (
                  <div className="font-semibold opacity-90 mb-[2vmin]" style={{ fontSize: getSize(zoneConfig.currentTitleFontSize || 24) }}>
                     {zoneConfig.currentTitleText || '正在取药'}
                  </div>
                )}
                
                <div className="flex flex-col md:flex-row items-center gap-[2vmin] text-center">
                   <div className="font-bold" style={{ fontSize: getSize(zoneConfig.currentNameFontSize || 60) }}>
                      {currentPatient.name}
                   </div>
                   {config.showQueueNumber && config.queueNumberStyle === 'none' && (
                     <div className="font-bold text-teal-200" style={{ fontSize: getSize(zoneConfig.currentNumberFontSize || 40) }}>
                        {currentPatient.number}
                     </div>
                   )}
                </div>
                {config.showQueueNumber && config.queueNumberStyle !== 'none' && (
                  <div className={`mt-[3vmin] bg-teal-400 text-white px-[4vmin] py-[1vmin] font-bold shadow-md ${
                    config.queueNumberStyle === 'circle' ? 'rounded-full' : 
                    config.queueNumberStyle === 'square' ? 'rounded-none' : 'rounded-lg'
                  }`} style={{ fontSize: getSize(zoneConfig.currentNumberFontSize || 36) }}>
                    {currentPatient.number}
                  </div>
                )}
             </div>
          </div>
        );

      case 'waiting-list':
      case 'passed-list':
        const isPassedList = zoneConfig.type === 'passed-list';
        let displayList: (Patient & { isCurrent?: boolean; isPassed?: boolean })[] = isPassedList ? [...passedList] : [...waitingList];
        
        if (!isPassedList && zoneConfig.includeCurrent && currentPatient && currentPatient.id) {
           displayList = [{ ...currentPatient, isCurrent: true }, ...displayList];
        }
        if (!isPassedList && config.passedDisplayMode === 'wait-list-end') {
          const passedPatients = passedList.map(p => ({ ...p, isPassed: true }));
          displayList = [...displayList, ...passedPatients];
        }

        const rows = zoneConfig.gridRows || 3;
        const cols = zoneConfig.gridColumns || 1;
        const limit = rows * cols;
        const visibleList = displayList.slice(0, limit);

        const titleSize = getSize(zoneConfig.titleFontSize || 18);
        const contentSize = getSize(zoneConfig.contentFontSize || (isPassedList ? 20 : 24));
        const smallSize = getSize(12);

        // Header Background for List: Use Secondary for Passed, Primary for Waiting (unless overridden)
        // Note: The main card background is handled by `wrapperStyle`
        const headerBg = isPassedList ? theme.secondary : theme.primary;

        return (
          <div className={wrapperClass} style={wrapperStyle}>
             <div className="py-[1vmin] px-[2vmin] text-white font-bold flex justify-between items-center shrink-0" 
                  style={{ background: headerBg }}>
               <span style={{ fontSize: titleSize, color: zoneConfig.titleColor }}>
                 {zoneConfig.title || (isPassedList ? '过号患者' : '等待取药')}
               </span>
               {!isPassedList && <span className="bg-white bg-opacity-20 px-[1vmin] py-[0.5vmin] rounded" style={{ fontSize: smallSize }}>{displayList.length}人等待</span>}
             </div>
             <div 
                className="flex-1 p-[1vmin] overflow-hidden"
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${rows}, 1fr)`, // FORCE FIT HEIGHT
                  gap: getSize(12), // approx 0.75rem
                }}
             >
               {visibleList.map((patient: any) => {
                  const isGrayed = (patient.isPassed || isPassedList) && config.grayOutPassed;
                  const isCurrent = patient.isCurrent;
                  const isHighlighted = isCurrent && zoneConfig.highlightCurrent;

                  return (
                    <div 
                      key={patient.id} 
                      className={`border rounded-lg px-[1.5vmin] flex justify-between items-center shadow-sm w-full h-full`}
                      style={{
                        backgroundColor: isGrayed ? 'rgba(0,0,0,0.05)' : isHighlighted ? 'rgba(255, 165, 0, 0.1)' : 'transparent',
                        borderColor: isHighlighted ? 'rgba(255, 165, 0, 0.5)' : (customText ? `${customText}20` : (theme.textMain ? `${theme.textMain}20` : '#e5e7eb')),
                        color: isGrayed ? '#9ca3af' : (customText || theme.textMain || '#374151'),
                        gap: getSize(8)
                      }}
                    >
                      <div className="flex items-center min-w-0 flex-1 overflow-hidden" style={{ gap: getSize(8) }}>
                        <span 
                           className={`font-bold truncate ${isGrayed ? 'line-through' : ''}`} 
                           style={{ 
                               fontSize: contentSize,
                               color: isHighlighted ? '#c2410c' : 'inherit'
                           }}
                        >
                          {patient.name}
                        </span>
                        
                        {(isGrayed || isPassedList) && <span className="flex-shrink-0 bg-gray-200 text-gray-600 px-[0.5em] rounded whitespace-nowrap" style={{ fontSize: smallSize }}>过号</span>}
                        {isCurrent && isHighlighted && (
                           <span className="flex-shrink-0 bg-orange-200 text-orange-800 px-[0.5em] rounded font-bold animate-pulse whitespace-nowrap" style={{ fontSize: smallSize }}>正在叫号</span>
                        )}
                      </div>

                      <div className={`flex-shrink-0 ${isGrayed ? 'opacity-50 grayscale' : ''}`}>
                         {renderQueueNumber(patient.number, config.queueNumberStyle, getSize(16), isHighlighted)}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        );

      case 'static-text':
        return (
          <div className={wrapperClass} style={{ 
            ...wrapperStyle, 
            background: zoneConfig.staticBgColor || wrapperStyle.backgroundColor, // Fallback to new prop or theme
            color: zoneConfig.staticTextColor || wrapperStyle.color
          }}>
            <div className="flex-1 p-[2vmin] flex flex-col h-full overflow-hidden">
               <div 
                 className="w-full h-full overflow-y-auto"
                 style={{ fontSize: getSize(zoneConfig.staticTextSize || 24) }}
                 dangerouslySetInnerHTML={{ __html: zoneConfig.staticTextContent || '请输入文本...' }}
               />
            </div>
          </div>
        );

      case 'video':
        return (
            <div className={wrapperClass} style={{ ...wrapperStyle, backgroundColor: '#000' }}>
               {zoneConfig.videoUrl ? (
                   <video
                      src={zoneConfig.videoUrl}
                      className="w-full h-full"
                      style={{ objectFit: zoneConfig.videoFit || 'cover' }}
                      autoPlay
                      loop={zoneConfig.videoLoop !== false}
                      muted={zoneConfig.videoMuted !== false}
                      playsInline
                      controls={false}
                   />
               ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                      <p style={{ fontSize: getSize(16) }}>未设置视频源</p>
                   </div>
               )}
            </div>
        );
      
      default:
        return null;
    }
  };

  const hasLeft = layout.topLeft?.type !== 'hidden' || layout.bottomLeft?.type !== 'hidden';
  const hasRight = layout.topRight?.type !== 'hidden' || layout.bottomRight?.type !== 'hidden';
  
  const leftWidth = isHorizontal 
    ? (hasLeft && hasRight ? `${layout.splitRatio}%` : (hasLeft ? '100%' : '0%')) 
    : '100%';
  const rightWidth = isHorizontal 
    ? (hasLeft && hasRight ? `${100 - layout.splitRatio}%` : (hasRight ? '100%' : '0%')) 
    : '100%';

  let footerHtml = layout.footerText;
  if (config.passedDisplayMode === 'footer' && passedList.length > 0) {
    const passedNames = passedList.map(p => `${p.name}(${p.number})`).join('，');
    const passedHtml = `<span style="margin-left: 40px; color: #fbbf24; font-weight: bold;">[过号患者]：</span><span style="color: #fff;">${passedNames}</span>`;
    footerHtml += passedHtml;
  }

  // Header Height Calculation
  const headerHeightVal = isLargeScreen ? header.height : 12; // 12vh for small
  const headerHeightStyle = isLargeScreen ? `${headerHeightVal}px` : `${headerHeightVal}vh`;

  return (
    <div 
      className={`${isPreview ? 'absolute w-full h-full' : 'fixed inset-0 w-screen h-screen'} flex flex-col overflow-hidden select-none`}
      style={{ 
        backgroundColor: theme.background || '#e5e7eb',
        padding: getSize(layout.overscanPadding || 0)
      }}
    >
      {/* Hot Reload Status */}
      {config.configVersion && (
        <div 
          className="absolute z-50 pointer-events-none flex flex-col gap-1"
          style={{ 
            top: `calc(${getSize(layout.overscanPadding || 0)} + 4px)`, 
            left: `calc(${getSize(layout.overscanPadding || 0)} + 4px)` 
          }}
        >
           <div className="opacity-20 hover:opacity-100 transition-opacity">
               <span className="text-[10px] bg-black text-white px-1 rounded flex items-center gap-1">
                 <Activity size={8} className="animate-pulse" />
                 {config.configVersion}
               </span>
           </div>
           {pollingStatus === 'paused' && (
             <div className="animate-in slide-in-from-left duration-300">
               <span className="text-[10px] bg-yellow-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md font-bold opacity-80">
                 <PauseCircle size={10} />
                 暂停轮询
               </span>
             </div>
           )}
        </div>
      )}

      {/* --- HEADER --- */}
      {header.show && (
        <header 
          className="w-full flex justify-between items-center shadow-lg z-10 shrink-0"
          style={{ 
            background: theme.primary, 
            color: theme.textOnPrimary,
            height: headerHeightStyle,
            paddingLeft: getSize(24),
            paddingRight: getSize(24)
          }}
        >
          <div className="flex items-center flex-1 overflow-hidden" style={{ gap: getSize(16) }}>
            {header.logoType === 'default' && (
              <div className="rounded bg-white bg-opacity-20 flex items-center justify-center font-bold shadow-sm shrink-0"
                   style={{ height: '60%', aspectRatio: '1/1', fontSize: getSize(24) }}>
                U
              </div>
            )}
            {header.logoType === 'image' && header.logoUrl && (
              <img src={header.logoUrl} alt="Logo" className="h-[60%] w-auto object-contain" />
            )}
            
            <h1 className="font-bold leading-tight truncate" style={{ fontSize: getSize(header.hospitalNameSize) }}>
              {header.hospitalName}
            </h1>
          </div>

          {header.showCenterTitle && (
            <div className={`flex-1 text-center font-medium opacity-90 truncate px-2`} style={{ fontSize: getSize(header.centerTitleSize) }}>
              {header.centerTitle}
            </div>
          )}

          <div className="flex-1 flex justify-end">
             {/* PERFORMANCE FIX: Clock Logic extracted */}
             <Clock header={header} isLargeScreen={isLargeScreen} getSize={getSize} />
             
             {header.rightContentType === 'text' && (
               <div className="text-right font-bold opacity-90" style={{ fontSize: getSize(24) }}>
                 {header.rightTextContent}
               </div>
            )}
          </div>
        </header>
      )}

      {/* --- MAIN CONTENT (Dynamic Grid) --- */}
      <main 
        className={`flex-1 flex overflow-hidden ${isHorizontal ? 'flex-row' : 'flex-col'}`}
        style={{ 
            padding: getSize(layout.containerPadding), 
            gap: getSize(layout.gap) 
        }}
      >
        {hasLeft && (
          <div 
             className="flex flex-col transition-all duration-300" 
             style={{ 
               width: leftWidth, 
               gap: getSize(layout.gap),
               height: isHorizontal ? '100%' : 'auto', 
               flex: isHorizontal ? undefined : 1
             }}
          >
            {layout.topLeft?.type !== 'hidden' && (
              <div style={{ flex: layout.bottomLeft?.type === 'hidden' ? '1' : `${layout.leftSplitRatio ?? 50} 1 0%`, overflow: 'hidden', minHeight: 0 }}>
                {renderZoneContent(layout.topLeft)}
              </div>
            )}
            {layout.bottomLeft?.type !== 'hidden' && (
              <div style={{ flex: layout.topLeft?.type === 'hidden' ? '1' : `${100 - (layout.leftSplitRatio ?? 50)} 1 0%`, overflow: 'hidden', minHeight: 0 }}>
                {renderZoneContent(layout.bottomLeft)}
              </div>
            )}
          </div>
        )}

        {hasRight && (
          <div 
             className="flex flex-col transition-all duration-300"
             style={{ 
               width: rightWidth, 
               gap: getSize(layout.gap),
               height: isHorizontal ? '100%' : 'auto',
               flex: isHorizontal ? undefined : 1
             }}
          >
             {layout.topRight?.type !== 'hidden' && (
              <div style={{ flex: layout.bottomRight?.type === 'hidden' ? '1' : `${layout.rightSplitRatio ?? 50} 1 0%`, overflow: 'hidden', minHeight: 0 }}>
                {renderZoneContent(layout.topRight)}
              </div>
            )}
            {layout.bottomRight?.type !== 'hidden' && (
              <div style={{ flex: layout.topRight?.type === 'hidden' ? '1' : `${100 - (layout.rightSplitRatio ?? 50)} 1 0%`, overflow: 'hidden', minHeight: 0 }}>
                {renderZoneContent(layout.bottomRight)}
              </div>
            )}
          </div>
        )}
      </main>

      {/* --- FOOTER --- */}
      {layout.footerShow && (
        <footer 
          className="w-full text-center font-medium flex items-center justify-center shrink-0 z-10 overflow-hidden relative"
          style={{ 
              background: theme.secondary, 
              height: isLargeScreen ? `${layout.footerHeight}px` : '6vh', 
              color: '#fff',
              fontSize: getSize(20)
          }}
        >
          {layout.footerScroll ? (
            <div 
              className="whitespace-nowrap inline-block min-w-full"
              style={{ animation: `marquee ${layout.footerSpeed}s linear infinite`, willChange: 'transform' }}
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

export default React.memo(DisplayScreen);