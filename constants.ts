import { FactionName } from './types';

export const MAP_IMAGE_URL = ''; // Replace with your map image
export const MAP_WIDTH = 1419;
export const MAP_HEIGHT = 1064;

export const NODE_RADIUS = 8;
export const UNIT_ICON_SIZE = 24;

export const TEAM_COLORS: { [key: string]: string } = {
    Licht: '#90CAF9', // Light Blue
    Schatten: '#F48FB1', // Light Red/Pink
};

export const FACTION_COLORS: { [key: string]: string } = {
    'Gondor/Rohan': '#60a5fa', // blue-400
    'Elben': '#facc15', // yellow-400
    'Zwerge': '#4ade80', // green-400
    'Mordor': '#ef4444', // red-500
    'Isengard': '#a16207', // yellow-700 (brownish)
    'Angmar': '#c084fc', // purple-400
};

export const TERRAIN_COLORS: { [key: string]: string } = {
    Wald: 'rgba(34, 197, 94, 0.7)',
    Berge: 'rgba(107, 114, 128, 0.7)',
    Sümpfe: 'rgba(132, 204, 22, 0.7)',
    Felder: 'rgba(234, 179, 8, 0.5)',
    Default: 'rgba(200, 200, 200, 0.5)',
};

export const CONFIG = {
    DEFAULT_SEED: 'ringkrieg',
    TEAM_AP_POOL: 30,
    MOVEMENT_AP_COST: 1,
    ATTACK_AP_COST: 1,
    DEFAULT_DEPLOY_AP_COST: 2,
    CASTLE_UPGRADE_COST_BASE: 5,
    CASTLE_UPGRADE_COST_FACTOR: 1.8,
    CASTLE_AP_BONUS: 1, // AP per level above 1
    CASTLE_SUPPORT_BONUS: 1, // DEF bonus per level for units within range
    CASTLE_SUPPORT_RANGE: 2,
};

// --- UI THEMES ---

export const DEFAULT_THEME = {
    className: '',
    vars: {
        '--color-primary': '#8a6538',
        '--color-secondary': '#110f0d',
        '--color-panel': 'rgba(20, 16, 12, 0.75)',
        '--color-text': '#e0dcd3',
        '--color-text-accent': '#e5a935',
        '--color-bg': '#1a1612',
        '--color-border': '#4a4033',
        '--color-primary-text': '#FFFFFF',
    }
};

export const FACTION_THEMES: { [key in FactionName]: typeof DEFAULT_THEME } = {
    'Gondor/Rohan': {
        className: '',
        vars: { ...DEFAULT_THEME.vars, '--color-primary': '#6c7a89', '--color-text-accent': '#a9bcd0' } // Steel Blue & Silver
    },
    'Elben': { 
        className: '',
        vars: { ...DEFAULT_THEME.vars, '--color-primary': '#2e7d32', '--color-text-accent': '#a5d6a7' } // Forest Green & Light Green
    },
    'Zwerge': {
        className: '',
        vars: { ...DEFAULT_THEME.vars, '--color-primary': '#4e342e', '--color-text-accent': '#bcaaa4' } // Deep Brown & Stone
    },
    'Mordor': { 
        className: '',
        vars: { ...DEFAULT_THEME.vars, '--color-primary': '#bf360c', '--color-text-accent': '#ff8a65' } // Deep Orange & Fire
    },
    'Isengard': { 
        className: '',
        vars: { ...DEFAULT_THEME.vars, '--color-primary': '#424242', '--color-text-accent': '#9e9e9e' } // Dark Grey & Iron
    },
    'Angmar': {
        className: '',
        vars: { ...DEFAULT_THEME.vars, '--color-primary': '#4a148c', '--color-text-accent': '#ba68c8' } // Deep Purple & Amethyst
    }
};