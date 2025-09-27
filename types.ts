


export enum Team {
    Licht = 'Licht',
    Schatten = 'Schatten',
}

export type FactionName = 'Gondor/Rohan' | 'Elben' | 'Zwerge' | 'Mordor' | 'Isengard' | 'Angmar';

export enum TerrainType {
    Wald = 'Wald',
    Berge = 'Berge',
    Sümpfe = 'Sümpfe',
    Felder = 'Felder',
    Default = 'Default'
}

export interface NodeData {
    id: number;
    x: number;
    y: number;
    terrain: TerrainType;
    area: string;
    region?: string;
}

export interface EdgeData {
    source: number;
    target: number;
}

export interface UnitStats {
    ANG: number;
    DEF: number;
    LOG: number;
    RW_A: number;
    RW_U: number;
    HP: number;
}

export interface Ability {
    name: string;
    description: string;
}

export interface DotEffect {
    source: string;
    damage: number;
    duration: number; // in rounds
}

export interface Unit {
    id: string;
    name: string;
    templateName: string; // The original template name for skill tree lookup
    factionName: FactionName;
    baseStats: UnitStats;
    currentHP: number;
    tags: string[];
    nodeId: number;
    state: string[]; // e.g., ['versorgt', 'erschöpft']
    deployCostAP: number;
    isDying?: boolean;
    level: number;
    xp: number;
    promotionsAvailable: number;
    abilities: Ability[];
    unlockedSkills: string[];
    dotEffects: DotEffect[];
    // New stats for tracking
    kills: number;
    damageTaken: number;
    combatsFought: number;
    damageDealt: number;
}

export interface UnitTemplate extends Omit<Unit, 'id' | 'currentHP' | 'nodeId' | 'state' | 'level' | 'xp' | 'promotionsAvailable' | 'unlockedSkills' | 'templateName' | 'kills' | 'damageTaken' | 'combatsFought' | 'damageDealt' | 'dotEffects'> {
    description: string;
    promotions?: string[];
}

// --- New Skill Tree System ---
export interface SkillEffect {
    stat?: keyof UnitStats;
    value?: number;
    ability?: Ability;
    addTags?: string[];
    description: string; // e.g. "+1 ANG", "Erhält Fähigkeit 'Schildwall'"
}

export interface SkillNode {
    id: string; // e.g., "gi_start", "gi_str_1"
    name: string;
    description?: string;
    icon: string; // emoji
    effects: SkillEffect[];
    x: number; // position in the graph
    y: number;
    isNotable?: boolean; // for larger, more important skills
}

export interface SkillEdge {
    from: string;
    to: string;
}

export interface SkillGraph {
    startNodeId: string;
    nodes: SkillNode[];
    edges: SkillEdge[];
}

export type SkillTree = Record<string, SkillGraph>; // Map base unit name to its graph


export enum SpecializationPath {
    Wirtschaft = 'Wirtschaft',
    Verteidigung = 'Verteidigung',
    Offensive = 'Offensive',
}

export interface Castle {
    nodeId: number;
    level: number;
    upgradeCost: number;
    specializationPath: SpecializationPath | null;
    conquestProgress?: {
        byFaction: FactionName;
        points: number;
    };
}

export interface Faction {
    name: FactionName;
    team: Team;
    aiEnabled: boolean;
    ap: number;
    apBonus: number; // For permanent shop upgrades
    startNodes: number[];
    castles: Castle[];
    unlockedResearch: string[];
    researchProgress: Record<string, number>; // e.g. { 'kill_tag_Ork': 5 }
    shopTiersUnlocked: number;
}

interface LogEntryBase {
    id: string;
    round: number;
    faction: FactionName;
    message: string;
}

export interface BaseLogEntry extends LogEntryBase {
    type: 'system' | 'move' | 'place' | 'regen' | 'event' | 'promote' | 'upgrade_castle' | 'research' | 'shop';
}

export interface CombatRoll {
    value: number;
    success: boolean;
}

export interface CombatLogEntry extends LogEntryBase {
    type: 'attack';
    attackerId: string;
    defenderId: string;
    attackerName: string;
    defenderName: string;
    attackerFactionName: FactionName;
    defenderFactionName: FactionName;
    mods: string[];
    dice: { attack: CombatRoll[], defense: CombatRoll[] };
    result: { damage: number, counterDamage: number, defenderDestroyed: boolean };
}

export type LogEntry = BaseLogEntry | CombatLogEntry;


export interface HighlightedNodes {
    move: number[];
    attack: number[];
    place: number[];
}

export enum GamePhase {
    SETUP = 'SETUP',
    PLAYING = 'PLAYING',
    ENDED = 'ENDED',
    PAUSED = 'PAUSED',
}

export type CardDuration = 'bis Rundenende' | 'permanent';

export interface Card {
    id: string;
    type: 'Wetter' | 'Taktik';
    text: string;
    duration: CardDuration;
    priority: number;
}

export interface Notification {
    id: string;
    type: 'info' | 'success' | 'danger';
    message: string;
}

export interface CombatSimulationState {
    isActive: boolean;
    attacker: Unit;
    defender: Unit;
    attackerRolls: CombatRoll[];
    defenderRolls: CombatRoll[];
    damageDealt: number;
    counterDamage: number;
    defenderDestroyed: boolean;
    attackerDestroyed: boolean;
    distance: number;
    mods: string[];
}

export interface PreCombatState extends Omit<CombatSimulationState, 'isActive'> {
    historyState: GameState;
}

// --- New Modifier and Event System Types ---

export type StatModificationType = 'add' | 'set' | 'multiply';

export interface Modifier {
    source: string; // e.g., "Event: Schattenbann", "Gelände: Wald"
    stat: keyof UnitStats;
    type: StatModificationType;
    value: number;
    duration?: number; // in rounds
    // Optional condition for when this modifier applies
    condition?: (unit: Unit, state: GameState, context?: { opponent?: Unit; distance?: number; }) => boolean;
}

export interface GameEventTrigger {
    id: string;
    name: string;
    description: string;
    condition: (state: GameState) => boolean;
    apply: (state: GameState) => Partial<GameState> & { 
        permanentModifiers?: Modifier[]; 
        temporaryModifiers?: Modifier[];
        unitsToSpawn?: { unitName: string; nodeId: number; factionName: FactionName; }[];
    };
}

export interface FactionRoundStats {
    name: FactionName;
    ap: number;
    unitCount: number;
    unitsDestroyed: number;
}

// --- New Faction Research System ---
export enum ResearchCategory {
    Offensive = 'Offensive',
    Defensive = 'Defensive',
    Tactical = 'Tactical',
}

export interface ResearchEffect {
    type: 'stat' | 'ability' | 'unlock' | 'special';
    target: keyof UnitStats | string; // Stat name, ability name, unit name
    value: number | Ability;
    conditionTag?: string; // e.g., 'Infanterie', 'Kavallerie'
    description: string;
}

export type ResearchUnlockConditionType = 'kill_tag' | 'round' | 'capture_node';
export interface ResearchUnlockCondition {
    type: ResearchUnlockConditionType;
    target: string; // tag name or node id
    value: number; // rounds or kill count
    description: string; // e.g. "Töte 5 Orks"
}

export interface ResearchNode {
    id: string;
    name: string;
    icon: string;
    description: string;
    costAP: number;
    prerequisites: string[];
    category: ResearchCategory;
    effects: ResearchEffect[];
    unlockCondition: ResearchUnlockCondition | null;
    unlocksShopTier: number | null;
    x: number;
    y: number;
}

export interface FactionResearchTree {
    factionName: FactionName;
    nodes: ResearchNode[];
}

// --- New Shop System ---
export interface ShopItem {
    id: string;
    name: string;
    icon: string;
    description: string;
    costAP: number;
    tier: number;
    duration?: number; // in rounds, for temporary effects
    effects: ResearchEffect[];
}


export interface GameState {
    phase: GamePhase;
    previousPhase: GamePhase | null;
    winner: Team | null;
    mapImageUrl: string | null;
    nodes: NodeData[];
    edges: EdgeData[];
    units: Unit[];
    factions: Faction[];
    unitTemplates: UnitTemplate[];
    researchTrees: FactionResearchTree[];
    shopItems: ShopItem[];
    teams: { [key in Team]: { apPool: number, unitsDeployed: number, unitsDestroyed: number } };
    log: LogEntry[];
    round: number;
    turnOrder: FactionName[];
    currentFactionTurnIndex: number;
    rngSeed: string;
    activeCards: Card[];
    cardDeck: Card[];
    cardDiscard: Card[];
    activeModifiers: Modifier[]; 
    temporaryRoundModifiers: Modifier[];
    triggeredEvents: Set<string>; 
    unitActions: { [unitId: string]: { moved: boolean, attacksMade: number } };
    actionsTakenThisTurn: string[]; 
    notifications: Notification[];
    history: GameState[];
    historyStats: { round: number, factions: FactionRoundStats[] }[];
    turnStartTime: number;
    turnTimeStats: Record<FactionName, { totalTime: number; turnCount: number; }>;
    devModeEnabled: boolean;
    nodeControl: Record<number, FactionName | undefined>;
    ui: {
        highlightedNodes: HighlightedNodes;
        selectedUnitId: string | null;
        selectedNodeId: number | null;
        placementUnitName: string | null;
        supplyView: boolean;
        showCoordinates: boolean;
        hoveredUnitId: string | null;
        hoveredNodeId: number | null;
        damagePreview: { targetUnitId: string, damage: number } | null;
        aiThought: string | null;
        objectiveHighlight: {
            nodes: number[];
            type: 'path' | 'area' | 'target';
        } | null;
        combatSimulation: CombatSimulationState | null;
        preCombat: PreCombatState | null;
        currentEventBanner: { name: string, description: string } | null;
        cameraResetTimestamp: number | null;
        cameraPanRequest: { targetX: number, targetY: number, timestamp: number } | null;
        stagnationCounter: number;
        lastAIActionHighlight: { unitId: string, targetId: string | number, timestamp: number } | null;
        lastMovePath: { unitId: string, path: number[], moveDuration: number } | null;
        lastLevelUp: { unitId: string, timestamp: number } | null;
        maxLevelReached: { unitId: string, timestamp: number } | null;
        aiSkillUpgradeInProgress: { unitId: string, skillId: string } | null;
        lastMoverFactionNameForTerritory: FactionName | null;
        roundStartSummary: {
            currentPlayerFactionName: FactionName;
            previousPlayerName: FactionName;
            round: number;
            uncontrolledNodesCount: number;
            totalMapNodes: number;
            globalArmyValue: number;
            lastRoundLog: LogEntry[];
            
            standings: {
                factionName: FactionName;
                team: Team;
                controlledNodes: number;
                armyValue: number;
                totalStats: UnitStats;
            }[];
            
            lastTurn: {
                unitsLost: { name: string, factionName: FactionName }[];
                unitsDestroyed: { name: string, factionName: FactionName }[];
                researchUnlocked: { name: string, icon: string, factionName: FactionName }[];
                itemsBought: { name: string, icon: string, factionName: FactionName }[];
                mostSignificantAttack: {
                    attackerName: string;
                    attackerFactionName: FactionName;
                    defenderName: string;
                    defenderFactionName: FactionName;
                    damage: number;
                    destroyed: boolean;
                } | null;
            };
        } | null;
    };
}


export enum GameStateActionType {
    NEW_GAME = 'NEW_GAME',
    FINISH_SETUP = 'FINISH_SETUP',
    SET_FACTIONS_FOR_GAME = 'SET_FACTIONS_FOR_GAME',
    
    SELECT_UNIT = 'SELECT_UNIT',
    SELECT_NODE = 'SELECT_NODE',
    CLEAR_SELECTION = 'CLEAR_SELECTION',
    HOVER_UNIT = 'HOVER_UNIT',
    HOVER_NODE = 'HOVER_NODE',

    MOVE_UNIT = 'MOVE_UNIT',
    ATTACK_UNIT = 'ATTACK_UNIT',
    PLACE_UNIT_START = 'PLACE_UNIT_START',
    PLACE_UNIT_EXECUTE = 'PLACE_UNIT_EXECUTE',
    UNLOCK_SKILL = 'UNLOCK_SKILL',
    APPLY_AI_SKILL_UNLOCK = 'APPLY_AI_SKILL_UNLOCK',
    UNLOCK_RESEARCH = 'UNLOCK_RESEARCH',
    BUY_SHOP_ITEM = 'BUY_SHOP_ITEM',

    START_COMBAT_SIMULATION = 'START_COMBAT_SIMULATION',
    CLEAR_COMBAT_SIMULATION = 'CLEAR_COMBAT_SIMULATION',
    CLEANUP_DESTROYED_UNITS = 'CLEANUP_DESTROYED_UNITS',
    
    UPGRADE_CASTLE = 'UPGRADE_CASTLE',
    CHOOSE_CASTLE_SPECIALIZATION = 'CHOOSE_CASTLE_SPECIALIZATION',
    
    END_TURN = 'END_TURN',
    UNDO_LAST_ACTION = 'UNDO_LAST_ACTION',
    
    ADD_NOTIFICATION = 'ADD_NOTIFICATION',
    REMOVE_NOTIFICATION = 'REMOVE_NOTIFICATION',

    CHECK_GAME_EVENTS = 'CHECK_GAME_EVENTS',
    CLEAR_EVENT_BANNER = 'CLEAR_EVENT_BANNER',
    CLEAR_ROUND_SUMMARY = 'CLEAR_ROUND_SUMMARY',

    SET_AI_THOUGHT = 'SET_AI_THOUGHT',

    TOGGLE_SUPPLY_VIEW = 'TOGGLE_SUPPLY_VIEW',
    TOGGLE_COORDINATES = 'TOGGLE_COORDINATES',
    TOGGLE_DEV_MODE = 'TOGGLE_DEV_MODE',
    
    FINISH_CAMERA_RESET = 'FINISH_CAMERA_RESET',
    FINISH_CAMERA_PAN = 'FINISH_CAMERA_PAN',
    
    PAUSE_GAME = 'PAUSE_GAME',
    RESUME_GAME = 'RESUME_GAME',
    
    SAVE_GAME = 'SAVE_GAME',
    LOAD_GAME = 'LOAD_GAME',
}

export type GameAction =
    | { type: GameStateActionType.NEW_GAME }
    | { type: GameStateActionType.FINISH_SETUP, payload: { mapImageUrl: string } }
    | { type: GameStateActionType.SET_FACTIONS_FOR_GAME, payload: { factions: Faction[] } }
    | { type: GameStateActionType.SELECT_UNIT, payload: { unitId: string } }
    | { type: GameStateActionType.SELECT_NODE, payload: { nodeId: number } }
    | { type: GameStateActionType.CLEAR_SELECTION }
    | { type: GameStateActionType.HOVER_UNIT, payload: { unitId: string | null } }
    | { type: GameStateActionType.HOVER_NODE, payload: { nodeId: number | null } }
    | { type: GameStateActionType.MOVE_UNIT, payload: { unitId: string, targetNodeId: number } }
    | { type: GameStateActionType.ATTACK_UNIT, payload: { attackerId: string, defenderId: string } }
    | { type: GameStateActionType.PLACE_UNIT_START, payload: { unitName: string } }
    | { type: GameStateActionType.PLACE_UNIT_EXECUTE, payload: { unitName: string, nodeId: number } }
    | { type: GameStateActionType.UNLOCK_SKILL, payload: { unitId: string, skillId: string } }
    | { type: GameStateActionType.APPLY_AI_SKILL_UNLOCK, payload: { unitId: string, skillId: string } }
    | { type: GameStateActionType.UNLOCK_RESEARCH, payload: { researchId: string } }
    | { type: GameStateActionType.BUY_SHOP_ITEM, payload: { itemId: string } }
    | { type: GameStateActionType.START_COMBAT_SIMULATION }
    | { type: GameStateActionType.CLEAR_COMBAT_SIMULATION }
    | { type: GameStateActionType.CLEANUP_DESTROYED_UNITS }
    | { type: GameStateActionType.UPGRADE_CASTLE, payload: { nodeId: number } }
    | { type: GameStateActionType.CHOOSE_CASTLE_SPECIALIZATION, payload: { nodeId: number, path: SpecializationPath } }
    | { type: GameStateActionType.END_TURN }
    | { type: GameStateActionType.UNDO_LAST_ACTION }
    | { type: GameStateActionType.ADD_NOTIFICATION, payload: { type: 'info' | 'success' | 'danger', message: string } }
    | { type: GameStateActionType.REMOVE_NOTIFICATION, payload: { id: string } }
    | { type: GameStateActionType.CHECK_GAME_EVENTS }
    | { type: GameStateActionType.CLEAR_EVENT_BANNER }
    | { type: GameStateActionType.CLEAR_ROUND_SUMMARY }
    | { type: GameStateActionType.SET_AI_THOUGHT, payload: { thought: string, highlight?: GameState['ui']['objectiveHighlight'] } }
    | { type: GameStateActionType.TOGGLE_SUPPLY_VIEW }
    | { type: GameStateActionType.TOGGLE_COORDINATES }
    | { type: GameStateActionType.TOGGLE_DEV_MODE }
    | { type: GameStateActionType.FINISH_CAMERA_RESET }
    | { type: GameStateActionType.FINISH_CAMERA_PAN }
    | { type: GameStateActionType.PAUSE_GAME }
    | { type: GameStateActionType.RESUME_GAME }
    | { type: GameStateActionType.SAVE_GAME }
    | { type: GameStateActionType.LOAD_GAME };