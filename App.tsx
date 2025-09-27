



import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GameStateProvider, useGameState, useGameDispatch } from './engine/hooks/useGameState';
import SetupScreen from './components/SetupScreen';
import GameOverScreen from './components/GameOverScreen';
import { NotificationManager } from './components/NotificationManager';
import CombatModal from './components/CombatModal';
import { GameStateActionType, GamePhase, Unit, Castle, NodeData, SpecializationPath, FactionName, Faction, Team, UnitStats, LogEntry, CombatLogEntry, CombatRoll } from './types';
import { getNextAIAction } from './baseline';
import { FACTION_THEMES, DEFAULT_THEME, CONFIG, FACTION_COLORS } from './constants';
import MapView from './components/MapView';
import TurnBanner from './components/TurnBanner';
import EventBanner from './components/EventBanner';
import SkillTreeModal from './components/PromotionModal';
import BottomHUD from './components/BottomHUD';
import TurnTimerHUD from './components/TurnTimerHUD';
import { RecruitPanel } from './components/Sidebar';
import MapFilterPanel from './components/MapFilterPanel';
import { FactionIcon } from './components/Icons';

const RoundSummaryDashboard: React.FC = () => {
    const dispatch = useGameDispatch();
    const { ui } = useGameState();
    const summary = ui.roundStartSummary;
    const [activeTab, setActiveTab] = useState<'übersicht' | 'logbuch'>('übersicht');

    useEffect(() => {
        const timer = setTimeout(() => {
            dispatch({ type: GameStateActionType.CLEAR_ROUND_SUMMARY });
        }, 20000); // Close after 20 seconds

        return () => clearTimeout(timer);
    }, [dispatch]);

    if (!summary) return null;

    const { previousPlayerName, standings, lastTurn, round, uncontrolledNodesCount, totalMapNodes, globalArmyValue, lastRoundLog, currentPlayerFactionName } = summary;

    const teamLicht = standings.filter(s => s.team === Team.Licht).sort((a,b) => b.armyValue - a.armyValue);
    const teamSchatten = standings.filter(s => s.team === Team.Schatten).sort((a,b) => b.armyValue - a.armyValue);

    const teamLichtTotals = teamLicht.reduce((acc, s) => ({
        nodes: acc.nodes + s.controlledNodes,
        army: acc.army + s.armyValue,
    }), { nodes: 0, army: 0 });
    
    const teamSchattenTotals = teamSchatten.reduce((acc, s) => ({
        nodes: acc.nodes + s.controlledNodes,
        army: acc.army + s.armyValue,
    }), { nodes: 0, army: 0 });

    const StatGridItem: React.FC<{ icon: string, label: string, value: React.ReactNode, title: string }> = ({ icon, label, value, title }) => (
        <div className="flex items-baseline gap-1.5 p-1.5 bg-black/30 rounded" title={title}>
            <span className="text-lg">{icon}</span>
            <span className="text-xs text-gray-400">{label}</span>
            <span className="font-bold text-white ml-auto">{value}</span>
        </div>
    );

    const FactionStandingCard: React.FC<{ standing: typeof teamLicht[0]; rank: number; }> = ({ standing, rank }) => {
        const nodePercent = totalMapNodes > 0 ? (standing.controlledNodes / totalMapNodes) * 100 : 0;
        const armyPercent = globalArmyValue > 0 ? (standing.armyValue / globalArmyValue) * 100 : 0;
        const { totalStats } = standing;

        return (
            <div className="p-4 bg-black/30 rounded-lg border border-themed/60 flex items-start gap-4 transition-all hover:bg-black/50 hover:border-themed">
                <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-black/30 border-2 border-themed flex items-center justify-center">
                        <span className="text-2xl font-bold text-accent">{rank}.</span>
                    </div>
                </div>
                <div className="flex-grow space-y-3">
                    <h4 className="text-xl font-bold flex items-center gap-2">
                        <FactionIcon factionName={standing.factionName} size={24} />
                        {standing.factionName}
                    </h4>
                    <div className="space-y-2 text-sm">
                        <div>
                            <div className="flex justify-between items-baseline text-gray-300 mb-1">
                                <span>Gebiete</span>
                                <span className="font-bold text-white">{standing.controlledNodes} von {totalMapNodes} ({Math.round(nodePercent)}%)</span>
                            </div>
                            <div className="w-full bg-black/50 rounded-full h-2.5 shadow-inner">
                                <div className="bg-gradient-to-r from-blue-600 to-blue-400 h-2.5 rounded-full" style={{ width: `${nodePercent}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between items-baseline text-gray-300 mb-1">
                                <span>Armeewert</span>
                                <span className="font-bold text-white">{standing.armyValue} von {globalArmyValue} ({Math.round(armyPercent)}%)</span>
                            </div>
                            <div className="w-full bg-black/50 rounded-full h-2.5 shadow-inner">
                                <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 h-2.5 rounded-full" style={{ width: `${armyPercent}%` }}></div>
                            </div>
                        </div>
                    </div>
                     {totalStats && (
                        <div className="mt-3 pt-3 border-t border-themed/30">
                            <h5 className="text-sm font-bold text-center text-gray-400 mb-2">Armeestatistik</h5>
                            <div className="grid grid-cols-2 gap-2">
                                <StatGridItem icon="⚔️" label="ANG" value={totalStats.ANG} title="Angriff" />
                                <StatGridItem icon="🛡️" label="DEF" value={totalStats.DEF} title="Verteidigung" />
                                <StatGridItem icon="🐴" label="LOG" value={totalStats.LOG} title="Logistik" />
                                <StatGridItem icon="🏹" label="RW-A" value={totalStats.RW_A} title="Angriffsreichweite" />
                                <StatGridItem icon="📢" label="RW-U" value={totalStats.RW_U} title="Unterstützungsreichweite" />
                                <StatGridItem icon="❤️" label="HP" value={totalStats.HP} title="Lebenspunkte (Summe aktuell)" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const LogbuchTab: React.FC = () => {
        const formatRolls = (rolls: CombatRoll[]) => {
            if (!rolls || rolls.length === 0) return '0';
            return rolls.map((roll, index) => (
                <React.Fragment key={index}>
                    {roll.success ? <strong className="font-bold text-white">{roll.value}</strong> : roll.value}
                    {index < rolls.length - 1 && ', '}
                </React.Fragment>
            ));
        };

        return (
            <div className="space-y-2 pr-2">
                {[...lastRoundLog].reverse().map((entry: LogEntry) => {
                    const isRelevant = entry.faction === currentPlayerFactionName || 
                                     (entry.type === 'attack' && (
                                         (entry as CombatLogEntry).attackerFactionName === currentPlayerFactionName || 
                                         (entry as CombatLogEntry).defenderFactionName === currentPlayerFactionName
                                     ));

                    return (
                        <div key={entry.id} className={`p-2 rounded-md text-sm transition-colors ${isRelevant ? 'bg-yellow-900/30 border-l-4 border-yellow-500' : 'bg-black/30'}`}>
                             <p>
                                <span className="font-bold mx-1" style={{color: FACTION_COLORS[entry.faction]}}>[{entry.faction}]</span>
                                {entry.message}
                            </p>
                            {entry.type === 'attack' && (
                                <div className="text-xs pl-4 opacity-80 mt-1">
                                    <p>⚔️ Würfel: [A: {formatRolls(entry.dice.attack)}] vs [V: {formatRolls(entry.dice.defense)}]</p>
                                    <p>💥 Schaden: {entry.result.damage}, Konter: {entry.result.counterDamage}</p>
                                    {entry.mods.length > 0 && <p>✨ Mods: {entry.mods.join(', ')}</p>}
                                    {entry.result.defenderDestroyed && <p className="text-red-400 font-bold">💀 {entry.defenderName} wurde zerstört!</p>}
                                </div>
                            )}
                        </div>
                    );
                })}
                 {lastRoundLog.length === 0 && <p className="text-center text-gray-500 p-4">Keine Ereignisse in der letzten Runde.</p>}
            </div>
        );
    };

    const TabButton: React.FC<{ tabName: 'übersicht' | 'logbuch', children: React.ReactNode }> = ({ tabName, children }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`flex-1 py-3 text-lg font-bold border-b-4 transition-colors ${activeTab === tabName ? 'border-accent text-accent' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
            {children}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm">
            <div className="p-8 panel rounded-lg w-full max-w-6xl max-h-[90vh] flex flex-col bg-[var(--color-panel)] text-[var(--color-text)] border-2 border-[var(--color-border)] animate-fade-in-down">
                <h1 className="text-4xl font-bold font-heading text-center text-accent mb-2 flex-shrink-0">
                    Lagebericht
                </h1>
                <p className="text-center text-gray-400 mb-4 flex-shrink-0">
                    Runde {round} - Nach dem Zug von <span style={{ color: FACTION_COLORS[previousPlayerName] }}>{previousPlayerName}</span> - <span className="text-accent">{uncontrolledNodesCount}</span> unkontrollierte Gebiete
                </p>
                
                <div className="flex border-b border-themed mb-4 flex-shrink-0">
                    <TabButton tabName="übersicht">Übersicht</TabButton>
                    <TabButton tabName="logbuch">Runden-Logbuch</TabButton>
                </div>

                <div className="flex-grow overflow-y-auto pr-2">
                    {activeTab === 'übersicht' && (
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                            {/* Left Column: Standings */}
                            <div className="md:col-span-3">
                                <h2 className="text-3xl font-bold font-heading text-center mb-4">Fraktionsstatus</h2>
                                {/* Team Licht */}
                                <div className="mb-6 p-4 bg-black/20 border-2 border-green-500/30 rounded-lg">
                                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-green-500/20">
                                        <h3 className="text-2xl font-bold text-green-400">Team Licht</h3>
                                        <div className="text-right">
                                            <p className="font-bold text-lg">{teamLichtTotals.nodes} <span className="text-sm text-gray-400">Gebiete</span></p>
                                            <p className="font-bold text-lg">{teamLichtTotals.army} <span className="text-sm text-gray-400">Armeewert</span></p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {teamLicht.map((s, i) => (
                                            <FactionStandingCard key={s.factionName} standing={s} rank={i+1} />
                                        ))}
                                    </div>
                                </div>
                                {/* Team Schatten */}
                                <div className="p-4 bg-black/20 border-2 border-red-500/30 rounded-lg">
                                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-red-500/20">
                                        <h3 className="text-2xl font-bold text-red-400">Team Schatten</h3>
                                        <div className="text-right">
                                            <p className="font-bold text-lg">{teamSchattenTotals.nodes} <span className="text-sm text-gray-400">Gebiete</span></p>
                                            <p className="font-bold text-lg">{teamSchattenTotals.army} <span className="text-sm text-gray-400">Armeewert</span></p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {teamSchatten.map((s, i) => (
                                            <FactionStandingCard key={s.factionName} standing={s} rank={i+1} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Highlights */}
                            <div className="md:col-span-2">
                                <h2 className="text-3xl font-bold font-heading text-center mb-4">Highlights der Runde</h2>
                                <div className="space-y-4">
                                    {lastTurn.mostSignificantAttack && (
                                        <div className="p-4 bg-black/20 rounded-lg border border-themed/50">
                                            <h4 className="font-bold text-accent mb-2 flex items-center gap-2 text-lg">⚔️ Wichtigster Angriff</h4>
                                            <p>
                                                <span className="font-semibold" style={{color: FACTION_COLORS[lastTurn.mostSignificantAttack.attackerFactionName]}}>{lastTurn.mostSignificantAttack.attackerName}</span> griff
                                                <span className="font-semibold" style={{color: FACTION_COLORS[lastTurn.mostSignificantAttack.defenderFactionName]}}> {lastTurn.mostSignificantAttack.defenderName} </span> an
                                                und verursachte <span className="font-bold text-red-500 text-lg">{lastTurn.mostSignificantAttack.damage}</span> Schaden.
                                                {lastTurn.mostSignificantAttack.destroyed && <span className="font-bold text-red-500 flex items-center gap-1 mt-1">💀 Ziel zerstört!</span>}
                                            </p>
                                        </div>
                                    )}

                                    <div className="p-3 bg-black/20 rounded-lg border border-themed/50">
                                        <h4 className="font-bold text-green-400 mb-2 flex items-center gap-2 text-lg">💥 Zerstörte Einheiten</h4>
                                        {lastTurn.unitsDestroyed.length > 0 ? (
                                            <ul className="text-sm space-y-2">
                                                {lastTurn.unitsDestroyed.map((u, i) => 
                                                    <li key={i} className="flex items-center gap-2">
                                                        <FactionIcon factionName={u.factionName} size={16} />
                                                        <span className="flex-grow">{u.name}</span>
                                                        <span style={{color: FACTION_COLORS[u.factionName]}} className="font-semibold text-xs">({u.factionName})</span>
                                                    </li>
                                                )}
                                            </ul>
                                        ) : <p className="text-sm text-gray-500">Keine</p>}
                                    </div>
                                    <div className="p-3 bg-black/20 rounded-lg border border-themed/50">
                                        <h4 className="font-bold text-red-400 mb-2 flex items-center gap-2 text-lg">🛡️ Verlorene Einheiten</h4>
                                        {lastTurn.unitsLost.length > 0 ? (
                                            <ul className="text-sm space-y-2">
                                                {lastTurn.unitsLost.map((u, i) => 
                                                    <li key={i} className="flex items-center gap-2">
                                                        <FactionIcon factionName={u.factionName} size={16} />
                                                        <span className="flex-grow">{u.name}</span>
                                                        <span style={{color: FACTION_COLORS[u.factionName]}} className="font-semibold text-xs">({u.factionName})</span>
                                                    </li>
                                                )}
                                            </ul>
                                        ) : <p className="text-sm text-gray-500">Keine</p>}
                                    </div>
                                    {(lastTurn.researchUnlocked.length > 0 || lastTurn.itemsBought.length > 0) && (
                                        <div className="p-4 bg-black/20 rounded-lg border border-themed/50">
                                            <h4 className="font-bold text-accent mb-2 flex items-center gap-2 text-lg">🔬 Forschung & Akquisitionen</h4>
                                            {lastTurn.researchUnlocked.length > 0 && (
                                                <div className="mb-3">
                                                    <h5 className="text-sm font-semibold text-gray-300 mb-1">Forschung freigeschaltet:</h5>
                                                    <ul className="text-sm space-y-1">
                                                        {lastTurn.researchUnlocked.map((r, i) => (
                                                            <li key={`res-${i}`} className="flex items-center gap-2">
                                                                <span className="text-lg">{r.icon}</span>
                                                                <span>{r.name}</span>
                                                                <span className="ml-auto text-xs font-semibold" style={{color: FACTION_COLORS[r.factionName]}}>({r.factionName})</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {lastTurn.itemsBought.length > 0 && (
                                                <div>
                                                    <h5 className="text-sm font-semibold text-gray-300 mb-1">Gekaufte Gegenstände:</h5>
                                                    <ul className="text-sm space-y-1">
                                                        {lastTurn.itemsBought.map((item, i) => (
                                                            <li key={`item-${i}`} className="flex items-center gap-2">
                                                                <span className="text-lg">{item.icon}</span>
                                                                <span>{item.name}</span>
                                                                <span className="ml-auto text-xs font-semibold" style={{color: FACTION_COLORS[item.factionName]}}>({item.factionName})</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'logbuch' && <LogbuchTab />}
                </div>

                <div className="mt-6 text-center flex-shrink-0">
                    <button
                        onClick={() => dispatch({ type: GameStateActionType.CLEAR_ROUND_SUMMARY })}
                        className="btn-primary px-8 py-3 text-lg font-bold rounded-lg"
                    >
                        Weiter
                    </button>
                </div>
            </div>
        </div>
    );
};


const PauseOverlay = () => (
    <div className="absolute top-4 left-4 bg-yellow-500/80 text-black font-bold text-lg px-4 py-2 rounded-md z-40 shadow-lg pointer-events-none">
        PAUSIERT
    </div>
);

const CastleSVG: React.FC<{ level: number; specialization: SpecializationPath | null; factionColor: string; size?: number; }> = ({ level, specialization, factionColor, size = 160 }) => {
    let specBannerColor = '#9CA3AF'; // gray-400
    if (specialization === SpecializationPath.Wirtschaft) specBannerColor = '#FBBF24'; // amber-400
    if (specialization === SpecializationPath.Verteidigung) specBannerColor = '#60A5FA'; // blue-400
    if (specialization === SpecializationPath.Offensive) specBannerColor = '#F87171'; // red-400

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
             <svg viewBox="-60 -60 120 120" className="w-full h-full">
                <defs>
                    <filter id="castle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="3" dy="5" stdDeviation="4" floodColor="#000" floodOpacity="0.6" />
                    </filter>
                </defs>
                <g filter="url(#castle-shadow)">
                    {/* Level 2: Wall */}
                    {level >= 2 && (
                        <g>
                            <circle cx="0" cy="0" r="36" fill="none" stroke="#4B5563" strokeWidth="6" />
                            <circle cx="0" cy="0" r="33" fill="none" stroke="#374151" strokeWidth="1" />
                            <circle cx="0" cy="0" r="39" fill="none" stroke="#374151" strokeWidth="1" />
                        </g>
                    )}
                    {/* Level 3: Towers */}
                    {level >= 3 && [0, 1, 2, 3].map(i => {
                        const angle = (Math.PI / 4) + (i * Math.PI / 2);
                        const towerX = Math.cos(angle) * 36;
                        const towerY = Math.sin(angle) * 36;
                        return (
                            <g key={i}>
                                <circle cx={towerX} cy={towerY} r="10" fill="#4B5563" stroke="#1F2937" strokeWidth="1" />
                                <path d={`M ${towerX} ${towerY-15} L ${towerX-10} ${towerY+5} L ${towerX+10} ${towerY+5} Z`} fill="#374151" />
                            </g>
                        );
                    })}
                    {/* Level 1: Keep */}
                    <rect x="-20" y="-20" width="40" height="40" fill="#4B5563" stroke="#1F2937" strokeWidth="2" />
                    {[...Array(4)].map((_, i) => <rect key={i} x={-20 + i * 10} y="-24" width="5" height="4" fill="#6B7280" />)}
                    
                    {/* Level 4: Top Keep */}
                    {level >= 4 && (
                        <g>
                            <rect x="-15" y="-35" width="30" height="15" fill="#6B7280" stroke="#1F2937" strokeWidth="1.5" />
                            <path d="M -17 -35 L 0 -45 L 17 -35 Z" fill="#374151" stroke="#1F2937" strokeWidth="1.5" />
                        </g>
                    )}
                    {/* Gate */}
                    <g>
                        <path d={`M -10 20 A 10 10 0 0 1 10 20 L 10 25 L -10 25 Z`} fill={factionColor} stroke="black" strokeWidth="1.5" />
                    </g>
                </g>
                {/* Level 5 Banner (no shadow) */}
                {level >= 5 && specialization && (
                    <g>
                        <line x1="0" y1="-45" x2="0" y2="-58" stroke="#2a2a2a" strokeWidth="2" />
                        <rect x="0" y="-58" width="15" height="10" fill={specBannerColor} stroke="black" strokeWidth="1" />
                    </g>
                )}
            </svg>
             <span className="absolute -bottom-2 text-5xl font-bold text-accent font-heading z-10" style={{ textShadow: '2px 2px 4px black' }}>
                {level}
            </span>
        </div>
    );
};


const CastleDashboard: React.FC<{ castleNodeId: number, onClose: () => void }> = ({ castleNodeId, onClose }) => {
    const state = useGameState();
    const dispatch = useGameDispatch();

    const currentTurnFaction = state.factions.find(f => f.name === state.turnOrder[state.currentFactionTurnIndex]);
    const castleOwnerFaction = state.factions.find(f => f.castles.some(c => c.nodeId === castleNodeId));
    
    // Determine if the castle belongs to the current player to set the default tab.
    const isOwnCastle = !!(currentTurnFaction && castleOwnerFaction && castleOwnerFaction.name === currentTurnFaction.name);

    // Default to the 'recruit' tab for own castles, otherwise 'overview'.
    const [activeTab, setActiveTab] = useState<'übersicht' | 'rekrutieren'>(
        isOwnCastle ? 'rekrutieren' : 'übersicht'
    );
    
    const castle = castleOwnerFaction?.castles.find(c => c.nodeId === castleNodeId);

    useEffect(() => {
        if (!castleOwnerFaction || !castle || !currentTurnFaction) {
            onClose();
        }
    }, [castle, castleOwnerFaction, currentTurnFaction, onClose]);

    if (!castleOwnerFaction || !castle || !currentTurnFaction) {
        return null;
    }

    const canAfford = isOwnCastle && currentTurnFaction.ap >= castle.upgradeCost;

    const handleUpgrade = () => {
        dispatch({ type: GameStateActionType.UPGRADE_CASTLE, payload: { nodeId: castleNodeId } });
        onClose();
    };
    
    const handleSpecializeAndUpgrade = (path: SpecializationPath) => {
        dispatch({ type: GameStateActionType.CHOOSE_CASTLE_SPECIALIZATION, payload: { nodeId: castleNodeId, path } });
        onClose();
    };

    const specializationDetails = {
        [SpecializationPath.Wirtschaft]: {
            icon: '💰',
            title: 'Wirtschaft',
            description: "Fokus auf Wachstum & Einheitenqualität.",
            bonuses: ["Lvl 2: Stabile Wirtschaft (+1 AP/Runde)", "Lvl 3: Elitetraining (Rekruten starten mit 50 XP)", "Lvl 4: Meisterhafte Rüstmeister ('Gut ausgerüstet'-Aura ignoriert 1. Schaden)", "Lvl 5: Schatzkammer (+1 globale AP & Rekruten starten auf Lvl 2)"],
            style: "border-yellow-500/80 hover:bg-yellow-900/40"
        },
        [SpecializationPath.Verteidigung]: {
            icon: '🛡️',
            title: 'Verteidigung',
            description: "Fokus auf Kontrolle & Widerstandsfähigkeit.",
            bonuses: ["Lvl 2: Verstärkte Garnison (+1 extra DEF-Aura)", "Lvl 3: Verstärkte Mauern (Benötigt 4 statt 3 Eroberungspunkte)", "Lvl 4: Feldreparaturen (Heilt Einheiten in Aura um 1 HP/Runde)", "Lvl 5: Unnachgiebige Festung (Erzeugt Garnison & 'Standhaft'-Aura)"],
            style: "border-blue-500/80 hover:bg-blue-900/40"
        },
        [SpecializationPath.Offensive]: {
            icon: '⚔️',
            title: 'Offensive',
            description: "Fokus auf Aggression & Durchbruchskraft.",
            bonuses: ["Lvl 2: Kriegstrommeln (+1 ANG-Aura)", "Lvl 3: Belagerungsmeister (+2 ANG auf Burgen in Aura)", "Lvl 4: In Wut geschmiedet ('Kritischer Treffer'-Aura, Wurf von 6 zählt doppelt)", "Lvl 5: Überwältigende Macht (Aura ignoriert 1 DEF des Ziels)"],
            style: "border-red-500/80 hover:bg-red-900/40"
        }
    };
    
    const SpecializationCard: React.FC<{
        path: SpecializationPath,
        icon: string,
        title: string,
        description: string,
        bonuses: string[],
        style: string,
    }> = ({ path, icon, title, description, bonuses, style }) => (
        <div className={`flex flex-col p-4 bg-black/30 rounded-lg border-2 transition-all duration-300 shadow-lg h-full ${style}`}>
            <div className="text-center">
                <span className="text-5xl">{icon}</span>
                <h4 className="text-xl font-bold font-heading mt-2">{title}</h4>
                <p className="text-sm text-gray-400 min-h-[40px]">{description}</p>
            </div>
            <ul className="text-xs space-y-1 mt-4 list-disc list-inside flex-grow text-left mx-auto">
                {bonuses.map((bonus, i) => <li key={i}>{bonus}</li>)}
            </ul>
            <button
                onClick={() => handleSpecializeAndUpgrade(path)}
                disabled={!canAfford}
                className="mt-4 w-full btn-primary py-2 rounded-lg text-md font-bold"
            >
                Wählen & Ausbauen ({castle.upgradeCost} AP)
            </button>
        </div>
    );
    
    const getActiveBonuses = (targetCastle: Castle, ownerFaction: Faction) => {
        const bonuses: {icon: string, text: string}[] = [];
        if (targetCastle.level > 1) {
            bonuses.push({icon: '🛡️', text: `Basis-Aura: +${targetCastle.level - 1} DEF`});
        }
        if (targetCastle.specializationPath) {
            switch(targetCastle.specializationPath) {
                case SpecializationPath.Wirtschaft:
                    if (targetCastle.level >= 2) bonuses.push({icon: '💰', text: "+1 AP/Runde"});
                    if (targetCastle.level >= 3) bonuses.push({icon: '🎓', text: "Rekruten +50 XP"});
                    if (targetCastle.level >= 4) bonuses.push({icon: '🛠️', text: "Aura: Gut ausgerüstet"});
                    if (targetCastle.level >= 5) bonuses.push({icon: '🌍', text: "+1 globale AP & Lvl 2 Rekruten"});
                    break;
                case SpecializationPath.Verteidigung:
                    const extraDef = targetCastle.level >= 4 ? 2 : (targetCastle.level >= 2 ? 1 : 0);
                    if (extraDef > 0) bonuses.push({icon: '🧱', text: `Aura: +${extraDef} extra DEF`});
                    if (targetCastle.level >= 3) bonuses.push({icon: '🔒', text: "Schwerer eroberbar"});
                    if (targetCastle.level >= 4) bonuses.push({icon: '✚', text: "Aura: Heilt 1 HP/Runde"});
                    if (targetCastle.level >= 5) bonuses.push({icon: '💂', text: "Erzeugt Garnison & Standhaft-Aura"});
                    break;
                case SpecializationPath.Offensive:
                    if (targetCastle.level >= 2) bonuses.push({icon: '⚔️', text: "Aura: +1 ANG"});
                    if (targetCastle.level >= 3) bonuses.push({icon: '🎯', text: "Aura: Belagerungsmeister"});
                    if (targetCastle.level >= 4) bonuses.push({icon: '💥', text: "Aura: Kritischer Treffer"});
                    if (targetCastle.level >= 5) bonuses.push({icon: '🔥', text: "Aura: Überwältigend"});
                    break;
            }
        }
        return bonuses;
    };

    const activeBonuses = getActiveBonuses(castle, castleOwnerFaction);

    const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }> = ({ active, onClick, children, disabled }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex-1 py-2 text-center font-bold border-b-4 transition-colors ${
                active 
                ? 'border-[var(--color-primary)] text-[var(--color-text-accent)]' 
                : 'border-transparent text-[var(--color-text)] opacity-60 hover:opacity-100'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
            {children}
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in backdrop-blur-sm" onClick={onClose}>
            <div className="p-8 panel rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col bg-[var(--color-panel)] text-[var(--color-text)] border-2 border-[var(--color-border)]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <div>
                        <h3 className="text-3xl font-bold font-heading">Burg bei Feld {castle.nodeId}</h3>
                        <p className="text-gray-400">Besitzer: <span style={{color: FACTION_COLORS[castleOwnerFaction.name]}}>{castleOwnerFaction.name}</span></p>
                    </div>
                    <button onClick={onClose} className="opacity-75 hover:opacity-100 text-3xl leading-none">&times;</button>
                </div>
                
                <div className="flex border-b border-[var(--color-border)] mb-4 flex-shrink-0">
                    <TabButton active={activeTab === 'übersicht'} onClick={() => setActiveTab('übersicht')}>Übersicht</TabButton>
                    <TabButton active={activeTab === 'rekrutieren'} onClick={() => setActiveTab('rekrutieren')} disabled={!isOwnCastle}>Rekrutieren</TabButton>
                </div>

                <div className="flex-grow overflow-y-auto pr-2">
                    {activeTab === 'übersicht' && (
                        <>
                             {/* Current Status */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-4 bg-black/20 rounded-lg border border-black/50">
                                <div className="col-span-1 flex flex-col items-center justify-center min-h-[160px]">
                                    <CastleSVG level={castle.level} specialization={castle.specializationPath} factionColor={FACTION_COLORS[castleOwnerFaction.name]} />
                                </div>
                                <div className="col-span-1 md:col-span-2">
                                    <h4 className="text-xl font-bold mb-2 text-center md:text-left">Aktive Boni</h4>
                                    <div className="bg-black/20 p-3 rounded-md min-h-[100px]">
                                        {activeBonuses.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                {activeBonuses.map((bonus, i) => (
                                                    <div key={i} className="flex items-center gap-2 bg-black/20 p-2 rounded">
                                                        <span className="text-2xl">{bonus.icon}</span>
                                                        <span className="text-sm">{bonus.text}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 text-center pt-8">Keine aktiven Boni auf Level 1.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Upgrade/Specialization Section */}
                            {isOwnCastle && (
                                <div>
                                    {castle.level === 1 && (
                                        <div>
                                            <h4 className="text-2xl font-bold text-center mb-1">Wähle eine Spezialisierung für Level 2</h4>
                                            <p className="text-center text-gray-400 mb-6">Die Wahl bestimmt den zukünftigen Ausbaupfad dieser Burg.</p>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                {(Object.values(SpecializationPath)).map(path => (
                                                    <SpecializationCard key={path} path={path} {...specializationDetails[path]} />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {castle.level > 1 && castle.level < 5 && (
                                        <div className="text-center">
                                            <div className="inline-block p-4 bg-black/20 rounded-lg mb-6">
                                                <span className="text-6xl">{specializationDetails[castle.specializationPath!].icon}</span>
                                                <h4 className="text-2xl font-bold mt-2 font-heading">Spezialisierung: {castle.specializationPath}</h4>
                                            </div>
                                            <button onClick={handleUpgrade} disabled={!canAfford} className="mt-2 w-full max-w-md mx-auto block btn-primary py-4 rounded-lg text-xl font-bold">
                                                Auf Level {castle.level + 1} ausbauen ({castle.upgradeCost} AP)
                                            </button>
                                        </div>
                                    )}
                                    {castle.level >= 5 && (
                                        <div className="text-center p-6 bg-black/20 rounded-lg">
                                            <h4 className="text-2xl font-bold text-accent">Maximale Stufe erreicht!</h4>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                    {activeTab === 'rekrutieren' && isOwnCastle && (
                        <RecruitPanel spawnNodeId={castleNodeId} onUnitSelect={onClose} />
                    )}
                </div>
            </div>
        </div>
    );
};


type Panel = "rekrutieren" | "logbuch" | "optionen" | "forschung" | "shop" | null;

const Game = () => {
    const state = useGameState();
    const dispatch = useGameDispatch();
    const [skillTreeUnitId, setSkillTreeUnitId] = useState<string | null>(null);
    const [dashboardCastleNodeId, setDashboardCastleNodeId] = useState<number | null>(null);
    const [openPanel, setOpenPanel] = useState<Panel>(null);
    const [isPanelClosing, setIsPanelClosing] = useState(false);
    const allFactionNames = useMemo(() => state.factions.map(f => f.name), [state.factions]);
    const [mapFilters, setMapFilters] = useState({
        region: 'all',
        factionControl: allFactionNames,
        area: 'all',
    });

    useEffect(() => {
        // Initialize faction control to all factions once they are loaded
        setMapFilters(prev => ({ ...prev, factionControl: allFactionNames }));
    }, [allFactionNames]);
    
    const currentFaction = state.factions.find(f => f.name === state.turnOrder[state.currentFactionTurnIndex]);
    const selectedUnit = state.units.find(u => u.id === state.ui.selectedUnitId);

    const filterOptions = useMemo(() => {
        const regions = new Set<string>();
        const areas = new Set<string>();
        state.nodes.forEach(node => {
            if (node.region) regions.add(node.region);
            if (node.area) areas.add(node.area);
        });
        return {
            regions: ['all', ...Array.from(regions).sort()],
            factions: ['all', 'none', ...state.factions.map(f => f.name).sort()],
            areas: ['all', ...Array.from(areas).sort()],
        };
    }, [state.nodes, state.factions]);

    const handleFilterChange = (filterType: keyof typeof mapFilters, value: string) => {
        if (filterType === 'factionControl') {
            setMapFilters(prev => {
                const currentSelection = prev.factionControl;
                if (value === 'all') {
                    return { ...prev, factionControl: allFactionNames };
                }
                if (value === 'none') {
                    return { ...prev, factionControl: [] };
                }
                const newSelection = currentSelection.includes(value as FactionName)
                    ? currentSelection.filter(name => name !== value)
                    : [...currentSelection, value as FactionName];
                return { ...prev, factionControl: newSelection };
            });
        } else {
            setMapFilters(prev => ({ ...prev, [filterType]: value }));
        }
    };
    
    const handleResetFilters = () => {
        setMapFilters({ region: 'all', factionControl: allFactionNames, area: 'all' });
    };

    const handleClosePanel = () => {
        if (isPanelClosing || !openPanel) return;
        setIsPanelClosing(true);
        setTimeout(() => {
            setOpenPanel(null);
            setIsPanelClosing(false);
        }, 400); // Duration of the closing animation
    };
    
    const handleOpenPanel = (panel: Panel) => {
        if (openPanel === panel) {
            handleClosePanel();
        } else {
            if(openPanel) {
                // If another panel is open, close it first, then open the new one
                setIsPanelClosing(true);
                setTimeout(() => {
                    setIsPanelClosing(false);
                    setOpenPanel(panel);
                }, 400);
            } else {
                setOpenPanel(panel);
            }
        }
    }

    const handleCycleUnit = (direction: 'prev' | 'next') => {
        if (!currentFaction) return;
        const factionUnits = state.units.filter(u => u.factionName === currentFaction.name);
        if (factionUnits.length === 0) return;

        const currentIndex = state.ui.selectedUnitId 
            ? factionUnits.findIndex(u => u.id === state.ui.selectedUnitId) 
            : -1;

        let nextIndex;
        if (direction === 'next') {
            nextIndex = (currentIndex + 1) % factionUnits.length;
        } else {
            nextIndex = (currentIndex - 1 + factionUnits.length) % factionUnits.length;
        }
        
        const nextUnit = factionUnits[nextIndex];
        if (nextUnit) {
            dispatch({ type: GameStateActionType.SELECT_UNIT, payload: { unitId: nextUnit.id } });
        }
    };

    // ESC schließt Panel
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClosePanel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [openPanel]);

    // Effect to handle UI Theming
    useEffect(() => {
        const root = document.documentElement;
        const currentFactionName = state.turnOrder[state.currentFactionTurnIndex];
        const currentFaction = state.factions.find(f => f.name === currentFactionName);

        const theme = (currentFaction && state.phase === GamePhase.PLAYING)
            ? FACTION_THEMES[currentFaction.name]
            : DEFAULT_THEME;
        
        Object.entries(theme.vars).forEach(([key, value]) => {
            root.style.setProperty(key, value as string);
        });

    }, [state.currentFactionTurnIndex, state.factions, state.phase, state.turnOrder]);

    // Effect to handle AI turns
    useEffect(() => {
        const currentFaction = state.factions.find(f => f.name === state.turnOrder[state.currentFactionTurnIndex]);
        
        if (currentFaction?.aiEnabled && state.phase === GamePhase.PLAYING && !state.ui.combatSimulation?.isActive && !state.ui.preCombat && !state.ui.aiSkillUpgradeInProgress) {
            let executionTimeoutId: ReturnType<typeof setTimeout>;
            const thinkingTimeoutId = setTimeout(() => {
                const aiAction = getNextAIAction(state);
                if (aiAction) {
                    dispatch({
                        type: GameStateActionType.SET_AI_THOUGHT, 
                        payload: { 
                            thought: aiAction.description, 
                            highlight: aiAction.objectiveHighlight 
                        }
                    });
                    executionTimeoutId = setTimeout(() => {
                        dispatch(aiAction.action);
                    }, 1125);
                }
            }, 750); 

            return () => {
                clearTimeout(thinkingTimeoutId);
                clearTimeout(executionTimeoutId);
            };
        }
    }, [state.currentFactionTurnIndex, state.factions, state.units, state.phase, dispatch, state.turnOrder, state.activeCards, state.ui.combatSimulation?.isActive, state.ui.preCombat, state.ui.aiSkillUpgradeInProgress]);

    // Effect to handle the visual delay for AI skill upgrades
    useEffect(() => {
        if (state.ui.aiSkillUpgradeInProgress) {
            // Open the modal, which will also pause the main AI loop
            setSkillTreeUnitId(state.ui.aiSkillUpgradeInProgress.unitId);
            
            const timer = setTimeout(() => {
                // Dispatch the action to actually apply the skill and reset the flag
                dispatch({
                    type: GameStateActionType.APPLY_AI_SKILL_UNLOCK,
                    payload: {
                        unitId: state.ui.aiSkillUpgradeInProgress!.unitId,
                        skillId: state.ui.aiSkillUpgradeInProgress!.skillId,
                    }
                });
            }, 3500); // 3.5 second delay

            return () => clearTimeout(timer);
        } else {
            // When the process is finished (flag is null), ensure the modal is closed
            // This unpauses the main AI loop for the next action
            setSkillTreeUnitId(null);
        }
    }, [state.ui.aiSkillUpgradeInProgress, dispatch]);


    // Effect to handle cleanup of "dying" units after their animation
    useEffect(() => {
        if (state.phase === GamePhase.PAUSED) return;
        const dyingUnits = state.units.filter(u => u.isDying);
        if (dyingUnits.length > 0) {
            const timer = setTimeout(() => {
                dispatch({ type: GameStateActionType.CLEANUP_DESTROYED_UNITS });
            }, 1500); 
            return () => clearTimeout(timer);
        }
    }, [state.units, dispatch, state.phase]);

    // Effect to handle combat zoom timing
    useEffect(() => {
        if (state.phase === GamePhase.PAUSED) return;
        if (state.ui.preCombat) {
            const timer = setTimeout(() => {
                dispatch({ type: GameStateActionType.START_COMBAT_SIMULATION });
            }, 4500); 

            return () => clearTimeout(timer);
        }
    }, [state.ui.preCombat, dispatch, state.phase]);
    
    // --- Event Handlers for MapView ---
    const handleNodeClick = (nodeId: number) => {
        // Deselection by clicking empty space
        if (nodeId === -1) {
            dispatch({ type: GameStateActionType.CLEAR_SELECTION });
            return;
        }
    
        const { selectedUnitId, placementUnitName, highlightedNodes } = state.ui;
        
        // If placing a unit, that takes top priority
        if (placementUnitName && state.phase !== GamePhase.PAUSED) {
            if (highlightedNodes.place.includes(nodeId)) {
                dispatch({ type: GameStateActionType.PLACE_UNIT_EXECUTE, payload: { unitName: placementUnitName, nodeId } });
            } else {
                dispatch({ type: GameStateActionType.CLEAR_SELECTION });
            }
            return;
        }
            
        // If a unit is selected, try to perform an action
        if (selectedUnitId && state.phase !== GamePhase.PAUSED) {
            if (highlightedNodes.move.includes(nodeId)) {
                dispatch({ type: GameStateActionType.MOVE_UNIT, payload: { unitId: selectedUnitId, targetNodeId: nodeId } });
            } else if (highlightedNodes.attack.includes(nodeId)) {
                const targetUnit = state.units.find(u => u.nodeId === nodeId && !u.isDying);
                if (targetUnit) {
                    dispatch({ type: GameStateActionType.ATTACK_UNIT, payload: { attackerId: selectedUnitId, defenderId: targetUnit.id } });
                }
            }
            // If the clicked node is not a valid move or attack target, we do nothing.
            // This prevents accidental deselection. The user must click empty space or the unit itself to deselect.
            return; // Exit here to prevent falling through to castle/node selection
        }
        
        // If no unit action was taken, check for other interactions like opening a castle dashboard
        const castleOnNode = state.factions.flatMap(f => f.castles).find(c => c.nodeId === nodeId);
        if (castleOnNode) {
            setDashboardCastleNodeId(nodeId);
            return;
        }
    
        // Fallback: If nothing else was clicked, select the node itself.
        // This will only be reached if no unit is selected.
        dispatch({ type: GameStateActionType.SELECT_NODE, payload: { nodeId } });
    };

    const handleUnitClick = (unitId: string) => {
        const clickedUnit = state.units.find(u => u.id === unitId);
        if (!clickedUnit) return;
    
        if (state.phase === GamePhase.PAUSED) {
            // If paused, just handle selection for viewing info.
            if (unitId === state.ui.selectedUnitId) {
                dispatch({ type: GameStateActionType.CLEAR_SELECTION });
            } else {
                dispatch({ type: GameStateActionType.SELECT_UNIT, payload: { unitId } });
            }
            return;
        }
    
        // --- Gameplay Clicks ---
        const { selectedUnitId, highlightedNodes } = state.ui;
        const selectedUnit = state.units.find(u => u.id === selectedUnitId);
    
        // Case 1: A unit is selected, and we click a *different* unit. This could be an attack.
        if (selectedUnit && selectedUnit.id !== clickedUnit.id) {
            // Check if it's a valid attack target
            if (highlightedNodes.attack.includes(clickedUnit.nodeId)) {
                const selectedUnitFaction = state.factions.find(f => f.name === selectedUnit.factionName)!;
                const clickedUnitFaction = state.factions.find(f => f.name === clickedUnit.factionName)!;
    
                // This check is technically redundant if highlighting is correct, but it's a safe guard.
                if (selectedUnitFaction.team !== clickedUnitFaction.team) {
                    dispatch({ type: GameStateActionType.ATTACK_UNIT, payload: { attackerId: selectedUnitId!, defenderId: unitId } });
                    return; // Attack action taken, so we exit.
                }
            }
            
            // If it wasn't a valid attack, the click is treated as simply selecting the new unit.
            dispatch({ type: GameStateActionType.SELECT_UNIT, payload: { unitId } });
            return;
        }
    
        // Case 2: No unit is selected, OR we clicked the same unit again.
        if (unitId === selectedUnitId) {
            // Clicked the same unit again, so deselect.
            dispatch({ type: GameStateActionType.CLEAR_SELECTION });
        } else {
            // No unit was selected, so select this one.
            dispatch({ type: GameStateActionType.SELECT_UNIT, payload: { unitId } });
        }
    };


    const handleUnitHover = (unitId: string | null) => {
        dispatch({ type: GameStateActionType.HOVER_UNIT, payload: { unitId } });
    };



    const handleNodeHover = (nodeId: number | null) => {
        dispatch({ type: GameStateActionType.HOVER_NODE, payload: { nodeId } });
    };
    
    const mapView = (
        <MapView 
            mapImageUrl={state.mapImageUrl}
            nodes={state.nodes}
            edges={state.edges}
            units={state.units}
            factions={state.factions}
            onNodeClick={handleNodeClick}
            onUnitClick={handleUnitClick}
            onNodeHover={handleNodeHover}
            onUnitHover={handleUnitHover}
            selectedUnit={selectedUnit}
            highlightedNodes={state.ui.highlightedNodes}
            hoveredNodeId={state.ui.hoveredNodeId}
            damagePreview={state.ui.damagePreview}
            lastAIActionHighlight={state.ui.lastAIActionHighlight}
            objectiveHighlight={state.ui.objectiveHighlight}
            combatSimulation={state.ui.combatSimulation}
            lastMovePath={state.ui.lastMovePath}
            preCombat={state.ui.preCombat}
            cameraResetTimestamp={state.ui.cameraResetTimestamp}
            cameraPanRequest={state.ui.cameraPanRequest}
            onCameraPanFinish={() => dispatch({ type: GameStateActionType.FINISH_CAMERA_PAN })}
            showCoordinates={state.ui.showCoordinates}
            onSkillTreeClick={(unit) => setSkillTreeUnitId(unit.id)}
            onPopupClose={() => dispatch({ type: GameStateActionType.CLEAR_SELECTION })}
            lastLevelUp={state.ui.lastLevelUp}
            maxLevelReached={state.ui.maxLevelReached}
            currentFactionName={currentFaction?.name as FactionName | undefined}
            selectedNodeId={state.ui.selectedNodeId}
            mapFilters={mapFilters}
            nodeControl={state.nodeControl}
            phase={state.phase}
            unitActions={state.unitActions}
            lastMoverFactionNameForTerritory={state.ui.lastMoverFactionNameForTerritory}
        />
    );
    
    const modals = (
        <>
            {state.ui.roundStartSummary && <RoundSummaryDashboard />}
            {state.ui.combatSimulation?.isActive && <CombatModal />}
            {skillTreeUnitId && <SkillTreeModal unitId={skillTreeUnitId} onClose={() => setSkillTreeUnitId(null)} />}
            {dashboardCastleNodeId !== null && <CastleDashboard castleNodeId={dashboardCastleNodeId} onClose={() => setDashboardCastleNodeId(null)} />}
        </>
    );
    
    const navItems = [
        { id: "rekrutieren", label: "Rekrutieren", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /> },
        { id: "forschung", label: "Forschung", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /> },
        { id: "shop", label: "Shop", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5 8v11a2 2 0 002 2h10a2 2 0 002-2V8M10 12h4M3 8h18M6 8a4 4 0 014-4h4a4 4 0 014 4" /> },
        { id: "logbuch", label: "Logbuch", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 5v14a2 2 0 002 2h14M7 3h10a2 2 0 012 2v14" /> },
        { id: "optionen", label: "Optionen", icon: <>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
        </> }
    ];

    if (state.phase === GamePhase.SETUP) {
        return <SetupScreen />;
    }

    if (state.phase === GamePhase.ENDED) {
        return <GameOverScreen winner={state.winner} />;
    }
    
    const theme = (currentFaction && state.phase === GamePhase.PLAYING)
            ? FACTION_THEMES[currentFaction.name]
            : DEFAULT_THEME;

    return (
        <div className={`w-screen h-screen bg-[var(--color-bg)] text-[var(--color-text)] flex overflow-hidden font-body relative ${theme.className}`}>
            <NotificationManager />

            {/* Main Content */}
            <main className="flex-grow h-full relative">
                {state.phase === GamePhase.PLAYING && (
                    <MapFilterPanel
                        filters={mapFilters}
                        options={filterOptions}
                        onFilterChange={handleFilterChange}
                        onReset={handleResetFilters}
                    />
                )}
                {mapView}
                <TurnTimerHUD />
                {state.phase === GamePhase.PLAYING && <TurnBanner key={`${state.round}-${state.currentFactionTurnIndex}`} round={state.round} factionName={currentFaction!.name} team={currentFaction!.team} />}
                {state.ui.currentEventBanner && <EventBanner event={state.ui.currentEventBanner} />}
                {state.phase === GamePhase.PAUSED && <PauseOverlay />}
                <BottomHUD 
                    onEndTurn={() => dispatch({ type: GameStateActionType.END_TURN })} 
                    onCycleUnit={handleCycleUnit} 
                    onUndo={() => dispatch({ type: GameStateActionType.UNDO_LAST_ACTION })}
                    navItems={navItems}
                    openPanel={openPanel}
                    onOpenPanel={handleOpenPanel}
                    isPanelClosing={isPanelClosing}
                    onClosePanel={handleClosePanel}
                />
            </main>
            
            {/* Modals */}
            {modals}
        </div>
    );
};

const App = () => (
    <GameStateProvider>
        <Game />
    </GameStateProvider>
);

export default App;