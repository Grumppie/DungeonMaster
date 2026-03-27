# Duel Rules Corpus

## Scope

This corpus supports a strict D&D 5e 2014-style duel demo for two fixed level 3 characters. It is a local retrieval source for combat adjudication and narration, not a copied PHB text store.

## Core Combat Loop

- Roll initiative at the start of the duel.
- Only the active combatant may take a normal turn.
- The engine rolls attacks, damage, saves, death saves, and concentration checks.
- Damage updates HP immediately.
- Conditions are stored in mutable session state.

## Barbarian

- Alden Voss is a level 3 human barbarian with a greataxe.
- Rage is a bonus action, grants extra melee damage, and resists bludgeoning, piercing, and slashing while active.
- Reckless Attack grants advantage on Alden's melee attack for the turn and gives attackers advantage against Alden until his next turn.
- Danger Sense grants advantage on Dexterity saves against visible effects.

## Sorcerer

- Nyra Vale is a level 3 tiefling sorcerer with a dagger.
- Spell attack bonus is +5 and spell save DC is 13.
- Available combat spells are Fire Bolt, Ray of Frost, Magic Missile, Burning Hands, Scorching Ray, and Hold Person.
- Hold Person uses concentration and paralyzes a humanoid target on a failed Wisdom save.

## Conditions And State

- Paralyzed creatures lose their turn and attempt to break the effect with the required saving throw.
- A downed creature at 0 HP makes death saves if combat continues.
- Concentration breaks on a failed Constitution save after taking damage.
- Opportunity attacks trigger when a creature leaves melee reach without Disengage.

## Demo Constraints

- The duel starts at 20 feet with no cover and no map grid.
- Session state is reset to the initial seed after the duel ends.
- The log should capture every transcript, narration, and resolved rule event.
