


import { GameState, GameAction, GameStateActionType, Unit, Faction, UnitTemplate, Castle, SpecializationPath, TerrainType, ResearchNode, ShopItem } from '../types';
// FIX: AdjacencyList is defined in engine/graph, not types.
import { AdjacencyList } from '../engine/graph';
import { createGraph, findDistance } from '../engine/graph';
import { getEffectiveStats } from '../engine/rules';
import { findReachableNodes, reconstructPath } from '../engine/pathfinding';
import { CONFIG } from '../constants';
import { SKILL_TREES } from '../data/skillTrees';

export interface ScoredAction {
    action: GameAction;
    score: number;
    description: string;
    objectiveHighlight?: GameState['ui']['objectiveHighlight'];
}

enum AIStance {
    AGGRESSIVE = 'Aggressiv',
    DEFENSIVE = 'Defensiv',
    EXPANSIVE = 'Expansiv',
    Zermürbung = 'Zermürbung',
    DESPERATE_DEFENSE = 'Verzweifelte Verteidigung',
}

enum AIObjective {
    DEFEND_BASE = 'Verteidigung der Heimatbasis',
    CONSOLIDATE = 'Konsolidierung & Verstärkung',
    ESTABLISH_FRONTLINE = 'Errichte eine Frontlinie',
    EXPLOIT_WEAKNESS = 'Suche nach Schwachstellen',
    PURSUE_BREAKTHROUGH = 'Durchbruch erzwingen',
    SECURE_FLANKS = 'Sichere Flanken',
    UPGRADE_UNIT = 'Einheit verbessern',
    UPGRADE_CASTLE = 'Burg ausbauen',
    UNLOCK_RESEARCH = 'Forschung betreiben',
    BUY_SHOP_ITEM = 'Gegenstand kaufen',
    CAPTURE_CASTLE = 'Burg erobern',
    HARASS_AND_WEAKEN = 'Schwächen & Zermürben',
    SURVIVE_AND_DELAY = 'Überleben & Verzögern',
}

interface ObjectiveInfo {
    objective: AIObjective;
    targetId?: number; // e.g., nodeId of a castle or unit
}

const predictImminentDefeat = (state: GameState, currentFaction: Faction, graph: AdjacencyList): boolean => {
    const TURNS_TO_PREDICT = 3;
    let simUnits: Unit[] = JSON.parse(JSON.stringify(state.units));
    const enemyUnits = simUnits.filter(u => state.factions.find(f => f.name === u.factionName)?.team !== currentFaction.team);

    if (simUnits.filter(u => u.factionName === currentFaction.name).length === 0) return true;

    for (let turn = 0; turn < TURNS_TO_PREDICT; turn++) {
        // Simulate all enemy attacks for one round
        for (const enemy of enemyUnits) {
            if (enemy.isDying) continue;
            
            const myUnits = simUnits.filter(u => u.factionName === currentFaction.name && !u.isDying);
            if (myUnits.length === 0) break;

            const enemyNode = state.nodes.find(n => n.id === enemy.nodeId)!;
            const { effectiveStats: enemyStats } = getEffectiveStats(enemy, enemyNode, state, graph);
            
            // Find best target for this enemy
            const potentialTargets = myUnits
                .map(target => {
                    const distance = findDistance(enemy.nodeId, target.nodeId, graph);
                    if (distance > enemyStats.RW_A) return null;
                    const targetNode = state.nodes.find(n => n.id === target.nodeId)!;
                    const { effectiveStats: targetStats } = getEffectiveStats(target, targetNode, state, graph, { opponent: enemy, distance });
                    const avgDamage = Math.max(0, (enemyStats.ANG * 3.5) - (targetStats.DEF * 3.5));
                    return { target, avgDamage };
                })
                .filter(t => t !== null)
                .sort((a, b) => b!.avgDamage - a!.avgDamage);

            if (potentialTargets.length > 0) {
                const bestTarget = potentialTargets[0]!;
                const targetIndex = simUnits.findIndex(u => u.id === bestTarget.target.id);
                if (targetIndex !== -1) {
                    simUnits[targetIndex].currentHP -= bestTarget.avgDamage;
                    if (simUnits[targetIndex].currentHP <= 0) {
                        simUnits[targetIndex].isDying = true;
                    }
                }
            }
        }

        if (simUnits.filter(u => u.factionName === currentFaction.name && !u.isDying).length === 0) {
            return true; // Predicted defeat
        }
    }

    return false; // Survived simulation
};


const determineStance = (state: GameState, currentFaction: Faction, factionUnits: Unit[], enemyUnits: Unit[], graph: AdjacencyList): AIStance => {
    // --- Priority 0: Check for imminent defeat ---
    if (predictImminentDefeat(state, currentFaction, graph)) {
        return AIStance.DESPERATE_DEFENSE;
    }

    // --- Priority 1: Defend Home Base ---
    const isHomeThreatened = currentFaction.startNodes.some(sn => 
        enemyUnits.some(enemy => findDistance(sn, enemy.nodeId, graph) <= 4)
    );
    if (isHomeThreatened && factionUnits.length < enemyUnits.filter(e => currentFaction.startNodes.some(sn => findDistance(sn, e.nodeId, graph) <= 4)).length * 1.5) {
        return AIStance.DEFENSIVE;
    }

    // --- Calculate Advantage Score (Team-wide Power) ---
    const getPowerScore = (faction: Faction, units: Unit[], state: GameState): number => {
        const factionUnits = units.filter(u => u.factionName === faction.name);
        const unitPower = factionUnits.reduce((total, unit) => {
            const template = state.unitTemplates.find(t => t.name === unit.templateName);
            const cost = template?.deployCostAP || 3;
            return total + (cost * (unit.currentHP / unit.baseStats.HP));
        }, 0);
        const castlePower = faction.castles.reduce((total, castle) => total + (castle.level * castle.level * 2), 0);
        return unitPower + castlePower;
    };

    let myTeamPower = 0;
    state.factions.filter(f => f.team === currentFaction.team).forEach(f => {
        myTeamPower += getPowerScore(f, state.units, state);
    });

    let enemyTeamPower = 0;
    state.factions.filter(f => f.team !== currentFaction.team).forEach(f => {
        enemyTeamPower += getPowerScore(f, state.units, state);
    });
    
    const advantageScore = myTeamPower / (enemyTeamPower || 1);

    if (advantageScore > 0.85 && advantageScore < 1.15 && state.round > 7) {
        return AIStance.Zermürbung;
    }

    if (advantageScore > 1.2) return AIStance.AGGRESSIVE;
    if (advantageScore < 0.8) return AIStance.EXPANSIVE;
    return AIStance.DEFENSIVE; // Default to a safer stance
};


const determineObjective = (state: GameState, currentFaction: Faction, factionUnits: Unit[], enemyUnits: Unit[], graph: AdjacencyList, stance: AIStance): ObjectiveInfo => {
    if (stance === AIStance.DESPERATE_DEFENSE) {
        return { objective: AIObjective.SURVIVE_AND_DELAY };
    }
    
    const homeNodeIds = currentFaction.startNodes;
    
    // High priority: Upgrade available units
    if (factionUnits.some(u => u.promotionsAvailable > 0)) {
        return { objective: AIObjective.UPGRADE_UNIT };
    }

    // High priority: Defend base if threatened
    const threateningEnemy = enemyUnits.find(enemy => homeNodeIds.some(sn => findDistance(sn, enemy.nodeId, graph) <= 5));
    if (threateningEnemy) {
        return { objective: AIObjective.DEFEND_BASE, targetId: threateningEnemy.nodeId };
    }
    
    // High priority: Capture vulnerable castles
    const findVulnerableCastle = () => {
        const enemyCastles = state.factions
            .filter(f => f.team !== currentFaction.team)
            .flatMap(f => f.castles);
        if (enemyCastles.length === 0) return null;

        return enemyCastles
            .map(castle => {
                const defenders = enemyUnits.filter(u => u.nodeId === castle.nodeId);
                const defenderPower = defenders.reduce((sum, u) => sum + u.currentHP, 0);
                const nearestAttacker = findNearestUnit(castle.nodeId, factionUnits, graph);
                return { castle, defenderPower, distance: nearestAttacker?.distance ?? Infinity };
            })
            .filter(c => c.distance < 10) // Must be reasonably reachable
            .sort((a, b) => {
                if (a.defenderPower !== b.defenderPower) return a.defenderPower - b.defenderPower;
                return a.distance - b.distance;
            })[0];
    };

    const vulnerableCastle = findVulnerableCastle();
    if (vulnerableCastle && stance !== AIStance.DEFENSIVE) {
        return { objective: AIObjective.CAPTURE_CASTLE, targetId: vulnerableCastle.castle.nodeId };
    }
    
    if (stance === AIStance.Zermürbung) {
        // Find a vulnerable, high-value target to harass
        const harassTarget = enemyUnits
            .filter(e => e.currentHP < e.baseStats.HP * 0.75 || e.tags.includes('Bogen') || e.tags.includes('Unterstützung')) // Prioritize damaged or squishy units
            .map(e => ({ unit: e, distance: findNearestUnit(e.nodeId, factionUnits, graph)?.distance ?? Infinity }))
            .filter(t => t.distance < 10)
            .sort((a, b) => a.distance - b.distance)[0]; // Closest vulnerable target

        if (harassTarget) {
            return { objective: AIObjective.HARASS_AND_WEAKEN, targetId: harassTarget.unit.nodeId };
        }
    }

    // Mid priority: Upgrade castles
    const upgradableCastle = currentFaction.castles.find(c => c.upgradeCost <= currentFaction.ap && c.level < 5);
    if (upgradableCastle) {
        return { objective: AIObjective.UPGRADE_CASTLE, targetId: upgradableCastle.nodeId };
    }

    // Mid priority: Recruit if needed
    const canRecruit = currentFaction.startNodes.some(sn => !state.units.some(u => u.nodeId === sn));
    if (factionUnits.length < 5 && currentFaction.ap >= CONFIG.DEFAULT_DEPLOY_AP_COST && canRecruit) {
        return { objective: AIObjective.CONSOLIDATE };
    }

    // General objectives
    const findEngageableIsolatedEnemy = () => enemyUnits.find(enemy => {
        const nearestAlly = findNearestUnit(enemy.nodeId, enemyUnits.filter(e => e.id !== enemy.id), graph);
        const isIsolated = nearestAlly === null || nearestAlly.distance > 4;
        const canEngage = factionUnits.some(myUnit => findDistance(myUnit.nodeId, enemy.nodeId, graph) < 8);
        return isIsolated && canEngage;
    });

    const isolatedEnemy = findEngageableIsolatedEnemy();
    if (isolatedEnemy) {
        return { objective: AIObjective.EXPLOIT_WEAKNESS, targetId: isolatedEnemy.nodeId };
    }

    return { objective: AIObjective.ESTABLISH_FRONTLINE };
};

const findNearestUnit = (fromNodeId: number, units: Unit[], graph: AdjacencyList): { unit: Unit, distance: number } | null => {
    if (units.length === 0) return null;
    let closestUnit: Unit | null = units[0];
    let minDistance = findDistance(fromNodeId, units[0].nodeId, graph);

    for (let i = 1; i < units.length; i++) {
        const distance = findDistance(fromNodeId, units[i].nodeId, graph);
        if (distance < minDistance) {
            minDistance = distance;
            closestUnit = units[i];
        }
    }
    return { unit: closestUnit!, distance: minDistance };
};

const scoreAttack = (attacker: Unit, defender: Unit, stance: AIStance, objectiveInfo: ObjectiveInfo, state: GameState, graph: AdjacencyList): number => {
    const distance = findDistance(attacker.nodeId, defender.nodeId, graph);
    const attackerNode = state.nodes.find(n => n.id === attacker.nodeId)!;
    const defenderNode = state.nodes.find(n => n.id === defender.nodeId)!;

    const { effectiveStats: attackerStats } = getEffectiveStats(attacker, attackerNode, state, graph, { opponent: defender, distance });
    const { effectiveStats: defenderStats } = getEffectiveStats(defender, defenderNode, state, graph, { opponent: attacker, distance });
    
    const avgDamage = Math.max(0, (attackerStats.ANG * 3.5) - (defenderStats.DEF * 3.5));
    const willDestroy = avgDamage >= defender.currentHP;
    let score = avgDamage * 5 + (willDestroy ? 50 : 0);
    
    if (attackerStats.RW_A > 1 && defenderStats.RW_A <= 1) score += 20;

    if (stance === AIStance.Zermürbung) {
        score *= 1.1; // General incentive to attack
        if (defender.currentHP < defender.baseStats.HP) {
            score += 40; // High bonus for finishing off or weakening damaged units
        }
        if (attackerStats.RW_A > 1 && distance > 1 && defenderStats.RW_A <= 1) {
            score += 60; // Very high bonus for safe ranged attacks
        }
        // Heavily penalize attacking strong, healthy defenders, especially in unfavorable trades
        if (defender.currentHP === defender.baseStats.HP && defender.deployCostAP >= attacker.deployCostAP) {
            score *= 0.2;
        }
    }

    if (objectiveInfo.objective === AIObjective.CAPTURE_CASTLE && defender.nodeId === objectiveInfo.targetId) {
        score += 80; // High bonus for clearing the target castle
    }
    
    if(objectiveInfo.objective === AIObjective.DEFEND_BASE) {
        const distanceToBase = Math.min(...state.factions.find(f => f.name === attacker.factionName)!.startNodes.map(sn => findDistance(defender.nodeId, sn, graph)));
        score += Math.max(0, 40 - (distanceToBase * 5));
    }

    if (stance === AIStance.AGGRESSIVE) score *= 1.2;
    if (stance === AIStance.DEFENSIVE && avgDamage < defender.currentHP / 3) score *= 0.5;
    if (stance === AIStance.DESPERATE_DEFENSE) {
        // Only attack if it's a kill shot on a threatening unit
        if (willDestroy) {
            score += 200;
        } else {
            score *= 0.1;
        }
    }

    return score;
};

const scoreMove = (unit: Unit, targetNodeId: number, stance: AIStance, objectiveInfo: ObjectiveInfo, state: GameState, factionUnits: Unit[], enemyUnits: Unit[], graph: AdjacencyList): number => {
    let score = 5;
    const currentFaction = state.factions.find(f => f.name === unit.factionName)!;

    const nearestEnemyToTarget = findNearestUnit(targetNodeId, enemyUnits, graph);
    const nearestFriendToTarget = findNearestUnit(targetNodeId, factionUnits.filter(u => u.id !== unit.id), graph);

    if (stance === AIStance.DESPERATE_DEFENSE) {
        const nearestEnemyToCurrent = findNearestUnit(unit.nodeId, enemyUnits, graph);
        if (nearestEnemyToCurrent && nearestEnemyToTarget && nearestEnemyToTarget.distance > nearestEnemyToCurrent.distance) {
            score += 150; // Big bonus for running away
        }
        const targetNode = state.nodes.find(n => n.id === targetNodeId)!;
        if (targetNode.terrain === TerrainType.Berge || targetNode.terrain === TerrainType.Wald) {
            score += 50; // Bonus for moving to defensive terrain
        }
        if (nearestFriendToTarget && nearestFriendToTarget.distance <= 2) {
            score += 30; // Huddle together
        }
        return score;
    }

    // General desire to move towards enemies and group with friends
    if (nearestEnemyToTarget) score += Math.max(0, 30 - (nearestEnemyToTarget.distance * 5));
    if (nearestFriendToTarget) score += Math.max(0, 15 - (nearestFriendToTarget.distance * 4));
    
    // Avoid over-extending
    if (nearestEnemyToTarget && nearestFriendToTarget && nearestEnemyToTarget.distance < nearestFriendToTarget.distance - 2) {
        score -= 40;
    }

    if (objectiveInfo.objective === AIObjective.HARASS_AND_WEAKEN) {
        // Calculate threat level at target node
        const node = state.nodes.find(n => n.id === targetNodeId)!;
        let threatLevel = 0;
        enemyUnits.forEach(enemy => {
            const enemyNode = state.nodes.find(n => n.id === enemy.nodeId)!;
            const distance = findDistance(targetNodeId, enemy.nodeId, graph);
            const { effectiveStats: enemyStats } = getEffectiveStats(enemy, enemyNode, state, graph);
            if(distance <= enemyStats.RW_A) {
                threatLevel += enemyStats.ANG;
            }
        });
        
        // Penalize moving into high threat areas
        score -= threatLevel * 8;

        // Bonus for moving to a position where a weak enemy can be attacked
        const { effectiveStats: myStats } = getEffectiveStats(unit, node, state, graph);
        const attackableEnemies = enemyUnits.filter(e => findDistance(targetNodeId, e.nodeId, graph) <= myStats.RW_A);
        const weakAttackable = attackableEnemies.filter(e => e.currentHP < e.baseStats.HP || e.deployCostAP < unit.deployCostAP);
        if (weakAttackable.length > 0) {
            score += weakAttackable.length * 30;
        }
    }

    switch(objectiveInfo.objective) {
        case AIObjective.CAPTURE_CASTLE:
            const currentDistToCastle = findDistance(unit.nodeId, objectiveInfo.targetId!, graph);
            const targetDistToCastle = findDistance(targetNodeId, objectiveInfo.targetId!, graph);
            if (targetDistToCastle < currentDistToCastle) {
                score += 80 + (currentDistToCastle - targetDistToCastle) * 10; // Massive bonus for getting closer
            }
            break;
        case AIObjective.DEFEND_BASE:
            const currentMinDistToBase = Math.min(...currentFaction.startNodes.map(sn => findDistance(unit.nodeId, sn, graph)));
            const targetMinDistToBase = Math.min(...currentFaction.startNodes.map(sn => findDistance(targetNodeId, sn, graph)));
            if (targetMinDistToBase < currentMinDistToBase) score += 60;
            break;
        case AIObjective.ESTABLISH_FRONTLINE:
             if (nearestFriendToTarget && nearestFriendToTarget.distance < 4 && nearestEnemyToTarget && nearestEnemyToTarget.distance > 3) {
                score += 30; // Form a defensive line
            }
            break;
    }
    
    // Discourage moving off an enemy castle unless necessary
    const isUnitOnEnemyCastle = state.factions.some(f => f.team !== currentFaction.team && f.castles.some(c => c.nodeId === unit.nodeId));
    if (isUnitOnEnemyCastle) {
        score -= 100;
    }

    return score;
};

const getArmyComposition = (units: Unit[]): Record<string, number> => {
    const composition: Record<string, number> = { Ranged: 0, Frontline: 0, Cavalry: 0, Support: 0, Elite: 0, Total: units.length };
    units.forEach(u => {
        if (u.tags.includes('Bogen') || u.tags.includes('Armbrust')) composition.Ranged++;
        if (u.tags.includes('Linie') || u.tags.includes('Schild') || u.tags.includes('Axt')) composition.Frontline++;
        if (u.tags.includes('Kavallerie')) composition.Cavalry++;
        if (u.tags.includes('Banner') || u.tags.includes('Unterstützung')) composition.Support++;
        if (u.tags.includes('Elite') || u.tags.includes('Troll')) composition.Elite++;
    });
    return composition;
}

const scoreRecruit = (unitTemplate: UnitTemplate, objectiveInfo: ObjectiveInfo, currentFaction: Faction, factionUnits: Unit[], stance: AIStance): number => {
    if (currentFaction.ap < unitTemplate.deployCostAP) return 0;

    if (stance === AIStance.DESPERATE_DEFENSE) {
        // Prioritize cheap, defensive units
        let score = 50;
        score += unitTemplate.baseStats.HP * 5;
        score += unitTemplate.baseStats.DEF * 4;
        score -= unitTemplate.deployCostAP * 10; // Very cost-sensitive
        return Math.max(0, score);
    }

    if (stance === AIStance.Zermürbung) {
        let score = 30;
        // Prioritize units with high mobility and/or range
        score += unitTemplate.baseStats.LOG * 6;
        score += unitTemplate.baseStats.RW_A * 10;
        // Cost is still a factor
        score -= unitTemplate.deployCostAP * 5;
        return Math.max(0, score);
    }
    
    const currentComposition = getArmyComposition(factionUnits);
    const { Total } = currentComposition;
    
    let targetRatios = { Frontline: 0.5, Ranged: 0.3, Cavalry: 0.2 }; // Default balanced
    if (objectiveInfo.objective === AIObjective.DEFEND_BASE) targetRatios = { Frontline: 0.6, Ranged: 0.4, Cavalry: 0.0 };
    if (objectiveInfo.objective === AIObjective.CAPTURE_CASTLE) targetRatios = { Frontline: 0.4, Ranged: 0.2, Cavalry: 0.4 };

    const needs: Record<string, number> = {
        Frontline: (targetRatios.Frontline * (Total + 1)) - currentComposition.Frontline,
        Ranged: (targetRatios.Ranged * (Total + 1)) - currentComposition.Ranged,
        Cavalry: (targetRatios.Cavalry * (Total + 1)) - currentComposition.Cavalry,
    };
    
    let score = 20;
    if (Total < 3) score += 50;

    let unitRoleScore = 0;
    if (unitTemplate.tags.includes('Bogen') || unitTemplate.tags.includes('Armbrust')) unitRoleScore = needs.Ranged;
    else if (unitTemplate.tags.includes('Kavallerie')) unitRoleScore = needs.Cavalry;
    else if (unitTemplate.tags.some(t => ['Linie', 'Schild', 'Axt', 'Speer'].includes(t))) unitRoleScore = needs.Frontline;
    
    score += unitRoleScore * 50;
    score -= unitTemplate.deployCostAP * 3;

    return Math.max(0, score);
};

const scoreSkillUnlock = (unit: Unit, skillId: string, stance: AIStance): number => {
    const skillTree = SKILL_TREES[unit.templateName];
    if (!skillTree) return 0;
    const skill = skillTree.nodes.find(s => s.id === skillId);
    if (!skill) return 0;
    
    let score = 100;
    
    skill.effects.forEach(effect => {
        if (effect.stat === 'ANG') score += 20 * (effect.value || 0) * (stance === AIStance.AGGRESSIVE ? 1.5 : 1);
        if (effect.stat === 'DEF') score += 15 * (effect.value || 0) * (stance === AIStance.DEFENSIVE || stance === AIStance.DESPERATE_DEFENSE ? 1.5 : 1);
        if (effect.stat === 'HP') score += 10 * (effect.value || 0);
        if (effect.ability) {
            if (effect.ability.name.includes("Standhaft")) score += (stance === AIStance.DEFENSIVE ? 40 : 20);
        }
    });

    return score;
};

const scoreResearch = (research: ResearchNode, stance: AIStance, currentFaction: Faction): number => {
    let score = 50 - research.costAP * 2; // Base score adjusted by cost

    research.effects.forEach(effect => {
        if (effect.type === 'unlock') score += 100; // Unlocking new units is very valuable
        if (effect.type === 'special') {
            if (effect.target.includes('cost')) score += 80; // Cost reduction is great
            if (effect.target.includes('shop_tier')) score += 70; // New shop tier is good
        }
        if (effect.type === 'stat') {
            const statValue = (effect.value as number || 0);
            if (effect.target === 'ANG') score += statValue * 15 * (stance === AIStance.AGGRESSIVE ? 1.5 : 1);
            if (effect.target === 'DEF') score += statValue * 12 * (stance === AIStance.DEFENSIVE ? 1.5 : 1);
            if (effect.target === 'HP') score += statValue * 8;
        }
    });

    return Math.max(0, score);
};

const scoreShopItem = (item: ShopItem, stance: AIStance): number => {
    let score = 20 - item.costAP;
    item.effects.forEach(effect => {
        if (effect.type === 'special' && effect.target === 'permanent_ap_increase') {
            score += 500; // This is the best item, always prioritize it
        }
        if (effect.type === 'stat' && item.duration) { // Temporary stat boosts
            score += (effect.value as number) * item.duration * 5;
            if (effect.target === 'ANG' && stance === AIStance.AGGRESSIVE) score += 30;
            if (effect.target === 'DEF' && stance === AIStance.DEFENSIVE) score += 30;
        }
    });
    return Math.max(0, score);
};


const generateCastleUpgradeActions = (state: GameState, currentFaction: Faction, stance: AIStance, objectiveInfo: ObjectiveInfo, graph: AdjacencyList): ScoredAction[] => {
    const actions: ScoredAction[] = [];
    const enemyUnits = state.units.filter(u => state.factions.find(f => f.name === u.factionName)?.team !== currentFaction.team);
    const friendlyUnits = state.units.filter(u => u.factionName === currentFaction.name);

    currentFaction.castles.forEach(castle => {
        if (currentFaction.ap >= castle.upgradeCost && castle.level < 5) {
            let score = 80;
            if (stance === AIStance.DESPERATE_DEFENSE) {
                score *= 0.5; // Upgrading is less important than immediate survival
            }

            const isFrontline = enemyUnits.some(enemy => findDistance(castle.nodeId, enemy.nodeId, graph) <= 8);

            if (castle.level === 1) { // Choosing specialization is a big step
                const SUPPORT_DISTANCE = 5;
                const localFriendlyUnits = friendlyUnits.filter(u => findDistance(castle.nodeId, u.nodeId, graph) <= SUPPORT_DISTANCE);
                const localFriendlyPower = localFriendlyUnits.reduce((sum, u) => sum + u.deployCostAP, 0);

                const nearbyEnemyUnits = enemyUnits.filter(enemy => findDistance(castle.nodeId, enemy.nodeId, graph) <= 8);
                const localEnemyPower = nearbyEnemyUnits.reduce((sum, u) => sum + u.deployCostAP, 0);

                const paths = [SpecializationPath.Wirtschaft, SpecializationPath.Verteidigung, SpecializationPath.Offensive];
                paths.forEach(path => {
                    let pathScore = score; 

                    switch (path) {
                        case SpecializationPath.Verteidigung:
                            pathScore += 10; // Slight default preference for defense
                            if (isFrontline) pathScore += 50;
                            if (localEnemyPower > localFriendlyPower) pathScore += 30;
                            if (stance === AIStance.DEFENSIVE || stance === AIStance.DESPERATE_DEFENSE) pathScore += 20;
                            break;
                        
                        case SpecializationPath.Offensive:
                            if (isFrontline && localFriendlyPower > 0) pathScore += 40;
                            if (localFriendlyPower > localEnemyPower) pathScore += 20;
                            if (localFriendlyUnits.length > 2) pathScore += 20; // Good for staging attacks
                            if (stance === AIStance.AGGRESSIVE) pathScore += 30;
                            break;
                        
                        case SpecializationPath.Wirtschaft:
                            if (!isFrontline) pathScore += 60;
                            if (friendlyUnits.length < 5) pathScore += 20;
                            if (isFrontline) pathScore -= 50; // Risky to build eco on the front
                            if (stance === AIStance.EXPANSIVE) pathScore += 20;
                            break;
                    }

                    actions.push({
                        action: { type: GameStateActionType.CHOOSE_CASTLE_SPECIALIZATION, payload: { nodeId: castle.nodeId, path } },
                        score: pathScore,
                        description: `[${stance}][${AIObjective.UPGRADE_CASTLE}] Spezialisiert Burg ${castle.nodeId} auf ${path}.`,
                        objectiveHighlight: { nodes: [castle.nodeId], type: 'target' }
                    });
                });
            } else { // Normal upgrade
                score += castle.level * 10;
                
                if(castle.specializationPath === SpecializationPath.Verteidigung && isFrontline) score += 20;
                if(castle.specializationPath === SpecializationPath.Offensive && friendlyUnits.some(u => findDistance(castle.nodeId, u.nodeId, graph) <= 5)) score += 20;
                if(castle.specializationPath === SpecializationPath.Wirtschaft && !isFrontline) score += 30;

                actions.push({
                    action: { type: GameStateActionType.UPGRADE_CASTLE, payload: { nodeId: castle.nodeId } },
                    score,
                    description: `[${stance}][${AIObjective.UPGRADE_CASTLE}] Baut Burg ${castle.nodeId} auf Level ${castle.level + 1} aus.`,
                    objectiveHighlight: { nodes: [castle.nodeId], type: 'target' }
                });
            }
        }
    });
    return actions;
};

const generateResearchActions = (state: GameState, currentFaction: Faction, stance: AIStance): ScoredAction[] => {
    const actions: ScoredAction[] = [];
    const researchTree = state.researchTrees.find(rt => rt.factionName === currentFaction.name);
    if (!researchTree) return actions;

    researchTree.nodes.forEach(node => {
        const isUnlocked = currentFaction.unlockedResearch.includes(node.id);
        if (isUnlocked) return;

        const canAfford = currentFaction.ap >= node.costAP;
        const prereqsMet = node.prerequisites.every(p => currentFaction.unlockedResearch.includes(p));

        let conditionMet = true;
        if (node.unlockCondition) {
            const { type, target, value } = node.unlockCondition;
            let progress = 0;
            if (type === 'round') {
                progress = state.round;
            } else {
                const key = `${type}_${target}`;
                progress = currentFaction.researchProgress?.[key] || 0;
            }
            conditionMet = progress >= value;
        }

        if (canAfford && prereqsMet && conditionMet) {
            actions.push({
                action: { type: GameStateActionType.UNLOCK_RESEARCH, payload: { researchId: node.id } },
                score: scoreResearch(node, stance, currentFaction),
                description: `[${stance}][${AIObjective.UNLOCK_RESEARCH}] Erforscht ${node.name}.`
            });
        }
    });
    return actions;
};

const generateShopActions = (state: GameState, currentFaction: Faction, stance: AIStance): ScoredAction[] => {
    const actions: ScoredAction[] = [];
    state.shopItems.forEach(item => {
        if (item.tier <= (currentFaction.shopTiersUnlocked || 1) && currentFaction.ap >= item.costAP) {
            actions.push({
                action: { type: GameStateActionType.BUY_SHOP_ITEM, payload: { itemId: item.id } },
                score: scoreShopItem(item, stance),
                description: `[${stance}][${AIObjective.BUY_SHOP_ITEM}] Kauft ${item.name} im Shop.`
            });
        }
    });
    return actions;
};

export const getNextAIAction = (state: GameState): ScoredAction | null => {
    const currentFaction = state.factions.find(f => f.name === state.turnOrder[state.currentFactionTurnIndex]);
    if (!currentFaction || !currentFaction.aiEnabled) return null;

    const graph = createGraph(state.edges);
    const factionUnits = state.units.filter(u => u.factionName === currentFaction.name);
    const enemyUnits = state.units.filter(u => state.factions.find(f => f.name === u.factionName)?.team !== currentFaction.team);
    
    const allPossibleActions: ScoredAction[] = [];
    
    const stance = determineStance(state, currentFaction, factionUnits, enemyUnits, graph);
    const objectiveInfo = determineObjective(state, currentFaction, factionUnits, enemyUnits, graph, stance);

    // --- Generate All Possible Actions ---

    // 0. Skill Unlocks (Highest priority)
    factionUnits.forEach(unit => {
        if (unit.promotionsAvailable > 0) {
            const skillTree = SKILL_TREES[unit.templateName];
            if (!skillTree) return;
            const unlockedSet = new Set(unit.unlockedSkills);
            const unlockableSkillIds: string[] = [];
            
            if (unlockedSet.size === 0) {
                if (!unlockedSet.has(skillTree.startNodeId)) unlockableSkillIds.push(skillTree.startNodeId);
            } else {
                skillTree.edges.forEach(({ from, to }) => {
                    if (unlockedSet.has(from) && !unlockedSet.has(to)) unlockableSkillIds.push(to);
                    if (unlockedSet.has(to) && !unlockedSet.has(from)) unlockableSkillIds.push(from);
                });
            }
            const uniqueUnlockableIds = [...new Set(unlockableSkillIds)];
            uniqueUnlockableIds.forEach(skillId => {
                const skill = skillTree.nodes.find(n => n.id === skillId);
                if (skill) {
                    const score = scoreSkillUnlock(unit, skill.id, stance);
                    allPossibleActions.push({
                        action: { type: GameStateActionType.UNLOCK_SKILL, payload: { unitId: unit.id, skillId: skill.id } },
                        score: score + 200, // High base score to prioritize free upgrades
                        description: `[${stance}][${AIObjective.UPGRADE_UNIT}] ${unit.name} schaltet '${skill.name}' frei.`,
                        objectiveHighlight: { nodes: [unit.nodeId], type: 'target' }
                    });
                }
            });
        }
    });

    // 1. Strategic Investments
    allPossibleActions.push(...generateCastleUpgradeActions(state, currentFaction, stance, objectiveInfo, graph));
    allPossibleActions.push(...generateResearchActions(state, currentFaction, stance));
    allPossibleActions.push(...generateShopActions(state, currentFaction, stance));

    // 2. Tactical Actions
    factionUnits.forEach(unit => {
        // FIX: Updated unitActions initialization to use `attacksMade: 0` to match the current type definition.
        const unitActions = state.unitActions[unit.id] || { moved: false, attacksMade: 0 };
        const node = state.nodes.find(n => n.id === unit.nodeId)!;
        const { maxAttacks } = getEffectiveStats(unit, node, state, graph);
        
        // Attacks
        // FIX: Updated the condition to check `attacksMade` against `maxAttacks` instead of the obsolete `attacked` property.
        if (unitActions.attacksMade < maxAttacks && currentFaction.ap >= CONFIG.ATTACK_AP_COST) {
            enemyUnits.forEach(enemy => {
                const distance = findDistance(unit.nodeId, enemy.nodeId, graph);
                const { effectiveStats } = getEffectiveStats(unit, node, state, graph, { opponent: enemy, distance });
                if (distance <= effectiveStats.RW_A) {
                    const score = scoreAttack(unit, enemy, stance, objectiveInfo, state, graph);
                    allPossibleActions.push({
                        action: { type: GameStateActionType.ATTACK_UNIT, payload: { attackerId: unit.id, defenderId: enemy.id } },
                        score,
                        description: `[${stance}][${objectiveInfo.objective}] ${unit.name} greift ${enemy.name} an.`,
                        objectiveHighlight: { nodes: [enemy.nodeId], type: 'target' }
                    });
                }
            });
        }
        
        // Moves
        if (!unitActions.moved && currentFaction.ap >= CONFIG.MOVEMENT_AP_COST) {
            const { effectiveStats } = getEffectiveStats(unit, node, state, graph);
            // FIX: findReachableNodes expects a Unit object as the first argument and the factions array as the fifth argument.
            const { distances: moveDistances, paths } = findReachableNodes(unit, effectiveStats.LOG, graph, state.units, state.factions);
            moveDistances.forEach((dist, nodeId) => {
                if (nodeId === unit.nodeId) return;
                const score = scoreMove(unit, nodeId, stance, objectiveInfo, state, factionUnits, enemyUnits, graph);
                const path = reconstructPath(nodeId, paths);
                allPossibleActions.push({
                    action: { type: GameStateActionType.MOVE_UNIT, payload: { unitId: unit.id, targetNodeId: nodeId } },
                    score,
                    description: `[${stance}][${objectiveInfo.objective}] ${unit.name} bewegt sich zu Feld ${nodeId}.`,
                    objectiveHighlight: { nodes: path, type: 'path' }
                });
            });
        }
    });

    // 3. Recruit Actions
    const availableStartNodes = currentFaction.startNodes.filter(sn => !state.units.some(u => u.nodeId === sn));
    if (availableStartNodes.length > 0) {
        const allUnlockableUnits = new Set<string>();
        state.researchTrees.forEach(tree => {
            tree.nodes.forEach(node => {
                node.effects.forEach(effect => {
                    if (effect.type === 'unlock') allUnlockableUnits.add(effect.target as string);
                });
            });
        });

        const availableTemplates = state.unitTemplates.filter(ut => {
            if (ut.factionName !== currentFaction.name || ut.deployCostAP <= 0) return false;
            if (allUnlockableUnits.has(ut.name)) {
                const researchTree = state.researchTrees.find(rt => rt.factionName === currentFaction.name);
                return researchTree ? currentFaction.unlockedResearch.some(resId => researchTree.nodes.find(n => n.id === resId)?.effects.some(e => e.type === 'unlock' && e.target === ut.name)) : false;
            }
            return true;
        });

        if (availableTemplates.length > 0) {
            const bestRecruitOption = availableTemplates
                .map(template => ({ template, score: scoreRecruit(template, objectiveInfo, currentFaction, factionUnits, stance) }))
                .sort((a, b) => b.score - a.score)[0];

            if (bestRecruitOption && bestRecruitOption.score > 0) {
                const targetNode = availableStartNodes[0]; // Simple placement for now
                allPossibleActions.push({
                    action: { type: GameStateActionType.PLACE_UNIT_EXECUTE, payload: { unitName: bestRecruitOption.template.name, nodeId: targetNode } },
                    score: bestRecruitOption.score,
                    description: `[${stance}][${objectiveInfo.objective}] Rekrutiert ${bestRecruitOption.template.name}.`,
                    objectiveHighlight: { nodes: [targetNode], type: 'target' }
                });
            }
        }
    }

    if (allPossibleActions.length === 0) {
        return {
            action: { type: GameStateActionType.END_TURN },
            score: 1,
            description: `[${stance}][${objectiveInfo.objective}] Keine Aktionen möglich, beende den Zug.`,
        };
    }

    allPossibleActions.sort((a, b) => b.score - a.score);
    return allPossibleActions[0];
};