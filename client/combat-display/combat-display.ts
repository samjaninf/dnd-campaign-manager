/// <reference path="../../typings/angular2-meteor.d.ts" />
/// <reference path="../../typings/meteor-accounts.d.ts" />

import {Component, View, NgFor, NgZone, FORM_DIRECTIVES} from 'angular2/angular2';

import {Router, RouteParams} from 'angular2/router';

import {simpleRoll} from 'lib/dice';

import {Battles} from 'collections/battles';

import {RequireUser} from 'meteor-accounts';

@Component({
	selector: 'combat-display'
})
@View({
	templateUrl: 'client/combat-display/combat-display.html',
	directives: [NgFor, FORM_DIRECTIVES]
})
@RequireUser()
export class CombatDisplay {
	// combat phases
	//-1 = not started
	// 0 = decide action
	// 1 = roll init
	// 2 = resolve round
	router: Router;
	
	battleId: string;
	campaign: any;

	battle: any;
	
	constructor(zone: NgZone, params: RouteParams, _router: Router) {
		this.battleId = params.get('battleId');
		console.log(this.battleId);
		this.router = _router;

		Tracker.autorun(() => zone.run(() => {
			this.campaign = Session.get('campaign');
			
			if (this.campaign) {
				Meteor.subscribe('battles', this.campaign._id);
				this.battle = Battles.findOne({ _id: this.battleId });
			}
			else
				this.router.parent.navigate(['/CampaignList']);
		}));
	}

	updateName() {
		this.updateBattle();
	}

	addCombatant(type) {
		var eName: HTMLInputElement =
			<HTMLInputElement>document.querySelector('.js-' + type);
		var eBonus: HTMLInputElement =
			<HTMLInputElement>document.querySelector('.js-bonus-' + type);
		var name = eName.value;
		var bonus = parseInt(eBonus.value);

		if (name) {
			this.battle.combatants.push({
				name: name,
				initiative: 0,
				bonus: bonus || 0,
				type: type,
				roundsOccupied: 0,
				action: '',
				actionSubmitted: false
			});
			this.updateBattle();
		}
	}

	removeCombatant(character) {
		var i = this.battle.combatants.indexOf(character);
		if (i > -1) {
			this.battle.combatants.splice(i, 1);
			this.updateBattle();
		}
	}

	startBattle() {
		if (this.battle.combatants.length > 1) {
			this.battle.combatPhase = 0;
			this.updateBattle();
		}
	}

	updateBattle() {
		Meteor.call('updateBattle', this.battle._id, this.battle);
	}

	submitAction(combatant, i) {
		//combat phase will be advanced on server if this is the last action 
		//we are waiting on
		if (!combatant.actionSubmitted) {
			let eAction: HTMLInputElement =
				<HTMLInputElement>document.querySelector('.js-action-' + i);

			if (eAction.value !== '') {
				combatant.action = eAction.value;
				combatant.actionSubmitted = true;
				eAction.value = '';
				this.updateBattle()
			}
		}
	}

	rollInitiative() {
		this.battle.combatants = this.battle.combatants
		.map((c) => { 
			c.initiative = (c.roundsOccupied > 0) ?
				0 : simpleRoll(100) + (c.bonus || 0);
			return c; 
		})
		.sort((a:any, b:any) => {
			if (a.initiative > b.initiative)
				return -1;
			else if (a.initiative < b.initiative)
				return 1;
			else
				return 0;
		});
		this.battle.combatPhase = 2;
		this.updateBattle();
	}

	resolveRound() {
		this.battle.combatPhase = 0;
		this.battle.combatants.forEach((c) => { 
			c.action = '';
			c.actionSubmitted = false; 
			c.initiative = 0;
			if(c.roundsOccupied > 0)
				c.roundsOccupied--;
		});
		this.updateBattle();
	}

	endBattle() {
		Meteor.call('finishBattle', this.battle._id);
	}
}