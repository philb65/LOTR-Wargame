import React from 'react';
import { Team, FactionName } from '../types';
import { FactionIcon } from './components/Icons';

interface TurnBannerProps {
    round: number;
    factionName: FactionName;
    team: Team;
}

const TurnBanner: React.FC<TurnBannerProps> = ({ round, factionName, team }) => {
    const teamColor = team === Team.Licht ? 'text-green-400' : 'text-red-400';

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-full max-w-xl animate-turn-banner-in-out">
            <div 
                className="panel p-2 text-center relative overflow-hidden"
                style={{
                    background: 'linear-gradient(to bottom, rgba(40, 35, 30, 0.85), rgba(20, 15, 10, 0.95))',
                    borderWidth: '2px',
                }}
            >
                 <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-[var(--color-text-accent)] to-transparent opacity-70" />
                 <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-[var(--color-text-accent)] to-transparent opacity-70" />

                <div className="text-sm font-body text-[var(--color-text-accent)] opacity-80">Runde {round}</div>
                <div className={`text-3xl font-heading mt-1 flex items-center justify-center gap-3 ${teamColor}`} style={{textShadow: '0 1px 3px rgba(0,0,0,0.7)'}}>
                    <FactionIcon factionName={factionName} size={36} />
                    <span>{factionName}</span>
                </div>
            </div>
        </div>
    );
};

export default TurnBanner;