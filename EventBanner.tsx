


import React, { useEffect } from 'react';
import { useGameDispatch } from '../engine/hooks/useGameState';
import { GameStateActionType } from '../types';

interface EventBannerProps {
    event: {
        name: string;
        description: string;
    };
}

const EventBanner: React.FC<EventBannerProps> = ({ event }) => {
    const dispatch = useGameDispatch();

    useEffect(() => {
        const timer = setTimeout(() => {
            dispatch({ type: GameStateActionType.CLEAR_EVENT_BANNER });
        }, 10000); 

        return () => clearTimeout(timer);
    }, [dispatch, event]);

    return (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-full max-w-2xl">
            <div className="panel p-4 rounded-lg text-center shadow-2xl border-t-4 border-b-4 border-yellow-500 animate-event-banner-in-out overflow-hidden"
                 style={{
                    backgroundImage: `url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAIoSURBVHhe7dLRasMwEIXB+P+Pdp8Kj/gQ6dIqlbJ2QO6QGclmwskc2Z0Tx3EeF0+Uv2Ysf+A/IQQQQghxFyIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiIQQgghbiL8xS8A08kS2+QY+yQJQQghxG1IIAQQQohbiEAIIfQv/P4v/w+EOIXYhQg0hBD6F0J/Qgj/hBC3EIEWQgh9/1c2/xBCiF2IQAkhhN/+s/h/CCHELkSgIYQQQnz/L38hhBB7IYLfQgj5S/kLIYTYhQhUCCGEv/n/QUIIsQMRuBBCiC3ELeYv5y8fF9c5jp8z2/z/8AAAAABJRU5ErkJggg==')`,
                    backgroundBlendMode: 'multiply',
                    backgroundColor: 'rgba(58, 46, 34, 0.85)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
                 }}
            >
                <h2 className="text-3xl font-heading text-yellow-300" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                    {event.name}
                </h2>
                <p className="text-md font-body mt-2 text-yellow-100" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}>
                    {event.description}
                </p>
            </div>
        </div>
    );
};

export default EventBanner;