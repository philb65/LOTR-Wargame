
import React from 'react';
import { useGameState } from '../engine/hooks/useGameState';
import { GamePhase, FactionName } from '../types';
import Tooltip from './components/Tooltip';
import { FactionIcon } from './components/Icons';

type Panel = "aktion" | "rekrutieren" | "logbuch" | "optionen" | null;

interface TurnHUDProps {
    onEndTurn: () => void;
    onCycleUnit: (direction: 'prev' | 'next') => void;
    onUndo: () => void;
    navItems: { id: string, label: string, icon: React.ReactNode }[];
    openPanel: Panel;
    onOpenPanel: (panel: Panel) => void;
}

const TurnHUD: React.FC<TurnHUDProps> = ({ onEndTurn, onCycleUnit, onUndo, navItems, openPanel, onOpenPanel }) => {
    const state = useGameState();
    const currentFaction = state.factions.find(f => f.name === state.turnOrder[state.currentFactionTurnIndex]);

    if (!currentFaction) {
        return null;
    }
    
    const isPlayersTurn = !currentFaction.aiEnabled;
    const canAct = isPlayersTurn && !state.ui.preCombat && state.phase !== GamePhase.PAUSED;

    return (
        <div className="absolute top-4 left-4 z-20 panel p-2 rounded-lg w-72">
            {/* Faction Info */}
            <div className="flex justify-between items-center p-1">
                <div className="flex items-center gap-2">
                    <FactionIcon factionName={currentFaction.name} size={40}/>
                    <div>
                        <div className="text-xs text-gray-400">Am Zug</div>
                        <div className="font-bold font-heading text-lg leading-tight" style={{ color: `var(--color-text-accent)` }}>{currentFaction.name}</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="font-bold text-3xl text-accent -mb-1">{currentFaction.ap}</div>
                    <div className="text-xs text-gray-400">AP</div>
                </div>
            </div>

            <hr className="border-[var(--color-border)]/50 my-1" />

            {/* Panel Toggles */}
            <div className="grid grid-cols-4 gap-1.5 p-1">
                {navItems.map(item => (
                    <Tooltip key={item.id} content={item.label}>
                        <button 
                            onClick={() => onOpenPanel(item.id as Panel)} 
                            className={`flex items-center justify-center h-10 rounded-md transition-colors text-sm font-bold ${openPanel === item.id ? 'bg-[var(--color-primary)] text-[var(--color-primary-text)]' : 'bg-black/40 hover:bg-black/60'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                {item.icon}
                            </svg>
                        </button>
                    </Tooltip>
                ))}
            </div>
            
            <hr className="border-[var(--color-border)]/50 my-1" />
            
            {/* Main Actions */}
            <div className="flex gap-2 p-1">
                <Tooltip content="Macht die letzte Aktion rückgängig">
                    <button
                        onClick={onUndo}
                        disabled={!canAct || state.history.length === 0}
                        className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-md text-xl font-bold btn-press-feedback disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l4-4m-4 4l4 4"/></svg>
                    </button>
                </Tooltip>

                <div className="flex-shrink-0 flex gap-1 bg-black/40 rounded-md p-0.5">
                     <Tooltip content="Vorherige Einheit">
                         <button onClick={() => onCycleUnit('prev')} disabled={!canAct} className="w-8 h-8 flex items-center justify-center hover:bg-black/60 rounded-md text-xl font-bold btn-press-feedback disabled:opacity-50">‹</button>
                     </Tooltip>
                     <Tooltip content="Nächste Einheit">
                         <button onClick={() => onCycleUnit('next')} disabled={!canAct} className="w-8 h-8 flex items-center justify-center hover:bg-black/60 rounded-md text-xl font-bold btn-press-feedback disabled:opacity-50">›</button>
                    </Tooltip>
                </div>

                <Tooltip content="Beendet den aktuellen Zug für diese Fraktion">
                    <button
                        onClick={onEndTurn}
                        disabled={!canAct}
                        className="h-10 px-3 flex-grow btn-primary font-bold rounded-md text-sm btn-press-feedback disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Zug Beenden
                    </button>
                </Tooltip>
            </div>
        </div>
    );
};

export default TurnHUD;