import React, { Component } from 'react';
import { connect } from "react-redux";


import '../styles/Grid.css';

import {setRewards} from './helpers/rewards';
import {constructGrid, getStateFromPos, getPosFromState, initValuesToZero, randomizeValues, getRandomState, printQ, printStatesActionsAllReturns, print2DArray, getMaxArray} from './helpers/general';
import { randomizePolicy, setStatesTransitionsToUniform, clearPolicy, setStatesTransitionsToDeterministic, setStatesTransitionsToWindy, editSingleStatePolicy, epsilonSoftAction } from './helpers/policy';
import { bellman_loop_actions, bellman_single_action } from './helpers/algorithms';
import { addAction, resetAction } from '../redux/actions';

const sleep = (ms) => { return new Promise(resolve => setTimeout(resolve, ms))};
let ITERATION_STR = '';

class Grid extends Component {

  constructor (props) {
    super(props);
    // Construct Grid and get state
    let state = constructGrid(props.width, props.height, props.startPos, props.goalPos, props.holePos, props.wallsPos, 0);

    // Create some references
    this.gammaInput = React.createRef();
    this.stepCostInput = React.createRef();
    this.randomizePolicyRadio = React.createRef();
    this.uniformizePolicyRadio = React.createRef();
    this.dimensionsRadio = React.createRef();
    this.positionsRadio = React.createRef();
    this.customizePolicyRadio = React.createRef();
    this.widthInput = React.createRef();
    this.heightInput = React.createRef();
    this.gridTable = React.createRef();
    this.evaluatePolicyBtn = React.createRef();
    this.nbrEpisodesInput = React.createRef();


    // Add some other state properties
    state = {
      ...state, 
      gridContent: 'agent',
      gamma: 0.9,              // Discount Factor
      windy: false,
      converged: false,
      working: false,
      contextMenuVisible: false,
      selectedGridState: '',   // Selected Cell on Table when editing
      tableIsEditable: false, // Positions of Goals and States
      policyEditable: false, // Customize policy
      algorithms: 'dynamicprogramming' // to control which buttons appear (DP, MC ...)
    }

    this.state = state;
  }

  componentWillReceiveProps(nextProps) {

    let w = this.props.width, h = this.props.height;
    let start_pos = this.props.startPos;
    let goal_pos = this.props.goalPos;
    let hole_pos = this.props.holePos;
    let walls_pos = this.props.wallsPos; 

    const dimensionsChanged = nextProps.width !== this.props.width || nextProps.height !== this.props.height;
    const positionsChanged = (nextProps.startPos !== start_pos) || (nextProps.goalPos !== goal_pos) || (nextProps.holePos !== hole_pos) || (nextProps.wallsPos !== walls_pos);

    if (!dimensionsChanged && !positionsChanged) {
      return;
    }

    if (dimensionsChanged) {
      //alert('new Dimenstions');
      // Reconstruct Grid
      w = parseInt(nextProps.width, 10);
      h = parseInt(nextProps.height, 10);
      if (isNaN(w) || isNaN(h)) {
          return;
      }
    }
    if (positionsChanged) {
      //alert ('new Positions')
      start_pos = nextProps.startPos;
      goal_pos = nextProps.goalPos;
      hole_pos = nextProps.holePos;
      walls_pos = nextProps.wallsPos;
    }

    this.setState(constructGrid(w, h, start_pos, goal_pos, hole_pos, walls_pos, this.state.stepCost ));

  }

  onTableClick = (ev) => {
    if (this.positionsRadio.current.checked || this.customizePolicyRadio.current.checked) {
      const s = ev.target.dataset.state;
      
      this.setState({
        ...this.state,
        contextMenuVisible: this.state.tableIsEditable && !this.state.policyEditable ? true : false,
        selectedGridState: s
      });

      if (this.state.policyEditable) {
        document.addEventListener('keypress', this.onDocumentKeyPress);
      }

    }
  };

  onDocumentKeyPress = (ev) => {
    const codes_to_actions_map = new Map();
    codes_to_actions_map.set(114, 'R'); // R
    codes_to_actions_map.set(108, 'L'); // L
    codes_to_actions_map.set(117, 'U'); // U
    codes_to_actions_map.set(100, 'D'); // D
    //alert('key ' + ev.keyCode);
    const keyPressedIsPermitted = codes_to_actions_map.has(ev.keyCode);
    const selectedStateIsNormal = this.state.selectedGridState !== this.state.goalState && this.state.selectedGridState !== this.state.holeState && !this.state.wallStates.includes(this.state.selectedGridState);
    if (keyPressedIsPermitted && selectedStateIsNormal) {
      const newPol = editSingleStatePolicy(this.state.policy, this.state.allowedMoves, this.state.selectedGridState, codes_to_actions_map.get(ev.keyCode))
      this.setState({
        ...this.state,
        policy: newPol
      })
    }
  }

  onContextMenuItemClick = (ev) => {
    const action = ev.target.dataset.action;
    let changed = false;
    let sp = this.props.startPos, gp = this.props.goalPos, hp = this.props.holePos, wps = this.props.wallsPos;
    switch (action) {
      case 'start':
        if (this.state.startState !== this.state.selectedGridState) {
          sp = getPosFromState(this.state.selectedGridState);
          changed = true;
        }
        break;
      case 'goal':
        if (this.state.goalState !== this.state.selectedGridState) {
          gp = getPosFromState(this.state.selectedGridState);
          changed = true;
        }
        break;
      case 'hole':
        if (this.state.holeState !== this.state.selectedGridState) {
          hp = getPosFromState(this.state.selectedGridState);
          changed = true;
        }
        break;
      case 'wall':
        if (!this.state.wallStates.includes(this.state.selectedGridState)) {
          let newWall = getPosFromState(this.state.selectedGridState);
          wps = Array.from(wps);
          wps.push(newWall);
          changed = true;
        }
        break;
      case 'unwall':
        if (this.state.wallStates.includes(this.state.selectedGridState)) {
          const pos_to_unwall = getPosFromState(this.state.selectedGridState);
          wps = wps.filter(e => !(e[0] === pos_to_unwall[0] && e[1] === pos_to_unwall[1]));
          changed = true;
        }
        break;
      default:
        break;
    }
    if (changed) {
      this.props.changePosFunc(sp, gp, hp, wps);
    }
    this.setState({
      ...this.state,
      contextMenuVisible: false,
      selectedGridState: '',
    });
  }

  getCurrentState = () => {
    return getStateFromPos(this.state.currentI, this.state.currentJ);
  }

  // returns next state
  moveAgent = (action, changeCurrentPos=true, from_pos=[this.state.currentI, this.state.currentJ]) => { 
    let newPos = [];
    if (from_pos.length !== 2) {
      return null;
    }
    let s = getStateFromPos(from_pos[0], from_pos[1]);
    if (this.state.allowedMoves.get(s).includes(action)) {
        if (action === 'U') {
          newPos[0] = from_pos[0] - 1;
          newPos[1] = from_pos[1];
        } else if (action === 'D') {
          newPos[0] = from_pos[0] + 1;
          newPos[1] = from_pos[1];
        } else if (action === 'L') {
          newPos[0] = from_pos[0];
          newPos[1] = from_pos[1] - 1;
        } else if (action === 'R') {
          newPos[0] = from_pos[0];
          newPos[1] = from_pos[1] + 1;
        }
    } else {
      return '';
    }
    if (changeCurrentPos && newPos.length === 2) { // if we did move
      // update currentI and currentJ
      this.setState({
        ...this.state,
        currentI: newPos[0],
        currentJ: newPos[1],
        currentState: getStateFromPos(newPos[0], newPos[1]),
      });
    }
    return newPos.length === 2 ? getStateFromPos(newPos[0], newPos[1]) : null;
  }

  gridContentOptionChange = (ev) => {
    let v = ev.target.value;
    if (v === 'agent' || v === 'rewards' || v === 'values' || v === 'policy') {
      this.setState({
        ...this.state,
        gridContent: v,
        contextMenuVisible: false,
        tableIsEditable: false,
        policyEditable: false,
        selectedGridState: '',
      });
    } else {
      alert('Unknown Mode clicked');
    }
  }

  gridTypeOptionChange = (ev) => {
    let new_states_transitions;
    if (ev.target.name === 'grid-type') {
      if (ev.target.value === 'standard') {
          new_states_transitions = setStatesTransitionsToDeterministic(this.state.statesTransitions);
      } else if (ev.target.value === 'windy') {
          new_states_transitions = setStatesTransitionsToWindy(this.state.statesTransitions, this.state.policy);
      } else {
        return;
      }
      this.setState({
        ...this.state,
        windy: ev.target.value === 'windy',
        statesTransitions: new_states_transitions,
        tableIsEditable: false,
        policyEditable: false,
      });
    } else if (ev.target.name === 'grid-edit') {
      if (ev.target.value === 'positions') {
        this.gridTable.current.addEventListener('click', this.onTableClick);
        this.setState({
          ...this.state,
          tableIsEditable: true,
          policyEditable: false,
          contextMenuVisible: false,
          selectedGridState: '',
        });
      } else {
        this.gridTable.current.removeEventListener('click', this.onTableClick);
        this.setState({
          ...this.state,
          tableIsEditable: false,
          policyEditable: false,
          contextMenuVisible: false,
          selectedGridState: '',
        });
      }
    }
  }

  onDimInputFocus = (ev) => {
    this.dimensionsRadio.current.click();
  }

  onDimInputChange = (ev) => {
    const permitted_vals = ['width', 'height'];
    if (permitted_vals.includes(ev.target.name)) {
      let new_val = parseInt(ev.target.value, 10);
      if (!isNaN(new_val))  {
        let w = parseInt(this.widthInput.current.value, 10);
        let h = parseInt(this.heightInput.current.value, 10);
        this.props.changeDimFunc(w,h);
      }
    }
  }

  rewardTypeOptionChange = (ev) => {
    let newStepCost;

    if (ev.target.value === 'standard') {
      newStepCost = 0;
    } else if (ev.target.value === 'negative') {
      newStepCost = -0.1;
    }
    let newRewards = setRewards(this.state.rewards, this.state.goalState, this.state.goalReward, this.state.holeState, this.state.holeReward, this.state.wallStates, newStepCost);
    this.stepCostInput.current.value = newStepCost;
    this.setState({
      ...this.state, 
      rewards :  newRewards,
      stepCost:  newStepCost,
    });
  };

  stepCostInputChange = (ev) => {
    let newStepCost = parseFloat(ev.target.value);
    if (!isNaN(newStepCost) && newStepCost < 0) {
      let newRewards = setRewards(this.state.rewards, this.state.goalState, this.state.goalReward, this.state.holeState, this.state.holeReward, this.state.wallStates, newStepCost);
      //this.stepCostInput.current.value = newStepCost;
      this.setState({
        ...this.state, 
        rewards: newRewards,
        stepCost: newStepCost,
      });
    }
  };

  policyTypeOptionChange = (ev) => {
    let v = ev.target.value;
    let new_pol;
    let new_states_transitions;
    document.removeEventListener('keypress', this.onDocumentKeyPress);
    this.gridTable.current.removeEventListener('click', this.onTableClick);
    if (v === 'uniform') {
      new_pol = clearPolicy(this.state.states);
      new_states_transitions = setStatesTransitionsToUniform(this.state.statesTransitions, this.state.allowedMoves);
      this.setState({
        ...this.state,
        policy: new_pol,
        statesTransitions: new_states_transitions,
        tableIsEditable: false,
        policyEditable: false,
        selectedGridState: '',
        converged: false,
      });
    } else if (v === 'random') {
      new_pol = randomizePolicy(this.state.allowedMoves);
      if (this.state.windy) {
        new_states_transitions = setStatesTransitionsToWindy(this.state.statesTransitions, new_pol);
      } else {
        new_states_transitions = setStatesTransitionsToDeterministic(this.state.statesTransitions);
      }
      this.setState({
        ...this.state,
        policy: new_pol,
        statesTransitions: new_states_transitions,
        tableIsEditable: false,
        policyEditable: false,
        selectedGridState: '',
        converged: false,
      });
    } else if (v === 'custom') {
      this.setState({
        ...this.state,
        tableIsEditable: true,
        policyEditable: true,
        selectedGridState: '',
      });
      this.gridTable.current.addEventListener('click', this.onTableClick);
    }
    console.log('state transitions', new_states_transitions)
  }


  onAlgorithmsRadioChange = (ev) => {
    if (ev.target.value === 'dynamicprogramming' || ev.target.value === 'montecarlo' || ev.target.value === 'temporaldifference') {
      this.setState({
        ...this.state,
        algorithms: ev.target.value,
      });
    }
  }

  evaluatePolicyClick = async (ev) => {

    // reinitialize V(s) to zero
    this.setState({
      ...this.state,
      values: initValuesToZero(this.state.values),
      gamma:  parseFloat(this.gammaInput.current.value), // get Gamma from input
      converged: false,
      working: true,
    });
    await sleep(200);
    
    this.props.resetAction();

    let old_val, new_val, state_transitions, pr_trans, delta, threshold = 1e-3, problem=false, posOfState, a;
    let new_values_map;
    let pol_ev_count = 0;

        this.props.addAction(null, '(Policy Evaluation Start !)', 'string', 0);
        while (true) {
          pol_ev_count += 1;
          ITERATION_STR = pol_ev_count.toString();

          new_values_map = new Map(this.state.values);
          this.props.addAction(null, new_values_map, '2D', 1);
          delta = 0;
          if (problem) {
            break;
          }
          for (let s of this.state.states) {
            state_transitions = this.state.statesTransitions.get(s);
            if (state_transitions.length > 0) {
              old_val = new_values_map.get(s);
              a = this.state.policy.get(s);
              posOfState = getPosFromState(s);
              new_val = 0;
              console.log(`State ${s} (${a})`);
              this.props.addAction('', `State ${s} (${a})`, 'string', 1);
              // if uniform : policies are empty
              if (a === '' || this.state.windy) {
                new_val = bellman_loop_actions(posOfState, state_transitions, this.moveAgent, this.state.gamma, this.state.rewards, new_values_map, this.props.addAction);
              } else { // if state transitions are deterministic
                // Get pr of transition
                for (let e of state_transitions) {
                  if (e[0] === a) {
                    pr_trans = e[1];
                    break;
                  }
                }
                new_val = bellman_single_action(posOfState, a, pr_trans, this.moveAgent, this.state.gamma, this.state.rewards, new_values_map, this.props.addAction);
              }
              if (isNaN(new_val)) {
                console.error('new_val is NaN');
                problem = true;
                break;
              }
              console.log(`new_val = ${new_val}`);
              this.props.addAction('', `new_val = ${new_val}`, 'string', 1);
              new_values_map.set(s, new_val);
              delta = Math.max(delta, Math.abs(old_val-new_val));
            }
          }
          this.setState({...this.state, values: new_values_map});
          await sleep(400);
          if (delta < threshold) {
            console.info('policy evaluation has converged !');
            this.props.addAction(null, `(Policy Evaluation Converged ! (${pol_ev_count} iterations))`, 'string', 0);
            this.setState({
              ...this.state,
              converged: true,
              working: false,
            });
            break;
          }
        }
        this.props.addAction(null, this.state.values, '2D', 0);
          

  };

  policyIterationClick = async (ev) => {

    // reinitialize V(s) to zero and randomize policy
    if (!this.randomizePolicyRadio.current.checked) {
      alert('please randomize policy first');
      return;
    }
    this.setState({
      ...this.state,
      policy: (this.randomizePolicyRadio.current.checked && this.state.converged) ? randomizePolicy(this.state.allowedMoves) : this.state.policy,
      values: initValuesToZero(this.state.values),
      //values: randomizeValues(this.state.values, [this.state.goalState, this.state.holeState, ...this.state.wallStates]),
      gamma: parseFloat(this.gammaInput.current.value), // get Gamma from input
      converged: false,
      working: true,
    });
    await sleep(200);

    this.props.resetAction();

    let old_val, new_val, state_transitions, pr_trans, delta, threshold = 1e-3, problem=false, posOfState, a, a2;
    let new_values_map;
    let new_policy_map, new_states_transitions_map, policy_converged, old_a, new_a, best_val, new_state_transitions;

    let pol_ev_counts = [], pol_iteration_count = 0, pol_ev_count=0; // counters

    this.props.addAction('Start Policy Iteration', null, null, 0);
    while (true) {
      pol_iteration_count += 1;
      ITERATION_STR = pol_iteration_count.toString();
      pol_ev_count = 0;

      this.props.addAction(null, `Iteration ${pol_iteration_count}:`, 'string', 0);
      this.props.addAction(null, this.state.policy, '2D', 0 );


      // Step 1: policy evaluation
      this.props.addAction(null, '(Policy Evaluation Step Start !)', 'string', 0);
      while (true) {
        pol_ev_count += 1;
        new_values_map = new Map(this.state.values);
        this.props.addAction(null, new_values_map, '2D', 1);
        delta = 0;
        if (problem) {
          break;
        }
        for (let s of this.state.states) {
          state_transitions = this.state.statesTransitions.get(s);
          if (state_transitions.length > 0) {
            old_val = new_values_map.get(s);
            a = this.state.policy.get(s);
            posOfState = getPosFromState(s);
            new_val = 0;
            console.log(`State ${s} (${a})`);
            this.props.addAction('', `State ${s} (${a})`, 'string', 1);
            // if uniform : policies are empty
            if (a === '' || this.state.windy) {
              new_val = bellman_loop_actions(posOfState, state_transitions, this.moveAgent, this.state.gamma, this.state.rewards, new_values_map, this.props.addAction);
            } else { // if state transitions are deterministic
              // Get pr of transition
              for (let e of state_transitions) {
                if (e[0] === a) {
                  pr_trans = e[1];
                  break;
                }
              }
              new_val = bellman_single_action(posOfState, a, pr_trans, this.moveAgent, this.state.gamma, this.state.rewards, new_values_map, this.props.addAction);
            }
            if (isNaN(new_val)) {
              console.error('new_val is NaN');
              problem = true;
              break;
            }
            console.log(`new_val = ${new_val}`);
            this.props.addAction('', `new_val = ${new_val}`, 'string', 1);
            new_values_map.set(s, new_val);
            delta = Math.max(delta, Math.abs(old_val-new_val));
          }
        }
        this.setState({...this.state, values: new_values_map});
        await sleep(400);
        if (delta < threshold) {
          console.info('policy evaluation has converged !');
          this.props.addAction(null, `(Policy Evaluation Converged ! (${pol_ev_count} iterations))`, 'string', 0);
          break;
        }
      }
      pol_ev_counts.push(pol_ev_count);
      this.props.addAction(null, this.state.values, '2D', 0);
      

      // Step 2: policy improvement
      console.info('Start Policy improvement');
      this.props.addAction(null, '(Policy Improvement Step Start !)', 'string', 0);

      new_policy_map = new Map(this.state.policy);
      new_states_transitions_map = new Map(this.state.statesTransitions);
      policy_converged = true;

      for (let s of this.state.states) {
        state_transitions = new_states_transitions_map.get(s);
        if (state_transitions.length > 0) {
          posOfState = getPosFromState(s);
          old_a  = new_policy_map.get(s);
          new_a = undefined;
          best_val = Number.NEGATIVE_INFINITY;
          console.info(`State ${s} (${old_a})`);
          this.props.addAction('', `State ${s} (${old_a})`, 'string', 1);

          for (let e of state_transitions) { // chosen action
            a = e[0];
            new_val = 0;

            if (this.state.windy) {
              console.log(` accumulating over action ${a} ... `);
              // loop through all actions because it's windy, and we can land in those other actins
              for (let e2 of state_transitions) {
                a2 = e2[0];
                if (a === a2) {
                  pr_trans = 0.5;
                } else {
                  pr_trans = 0.5/3;
                }
                new_val += bellman_single_action(posOfState, a2, pr_trans, this.moveAgent, this.state.gamma, this.state.rewards, new_values_map, this.props.addAction);
              }
              this.props.addAction('', `Total (${a}) = ${new_val}`, 'string', 2);
            } else {
              pr_trans = e[1];
              new_val = bellman_single_action(posOfState, a, pr_trans, this.moveAgent, this.state.gamma, this.state.rewards, new_values_map, this.props.addAction);
            }

            console.log(` New Val => ${new_val}`);
            if (new_val > best_val) {
              new_a = a;
              best_val = new_val;
            }

          }

          console.log(`Best Val for current state :  ${best_val} and belongs to action ${new_a}`);
          this.props.addAction('', `Best Val for current state :  ${best_val} and belongs to action ${new_a}`, 'string', 1);
          if (old_a !== new_a) {
            console.info(`Changing to New Action : ${new_a} =>  ${best_val}`);
            this.props.addAction('', `Changing to New Action : ${new_a} =>  ${best_val}`, 'string', 1);
            policy_converged = false;
            new_policy_map.set(s, new_a);
            // when policy changes, and it's windy, I need to update the state transitions of the state, and set 0.5 to the main action, and 0.5/3 to the others
            if (this.state.windy) {
              console.info('Updating state transitions because its windy');
              new_state_transitions = Array.from(new_states_transitions_map.get(s));
              for (let e of new_state_transitions) {
                if (e[0] === new_a) {
                  e[1] = 0.5;
                } else {
                  e[1] = 0.5/3;
                }
              }
              new_states_transitions_map.set(s, new_state_transitions);
            }
          } else {
            console.info(`Action stays ${old_a}`);
          }

        }
      }

      console.log('Policy Improvement has finished');
      this.props.addAction(null, '(Policy Improvement Converged !)', 'string', 0);
      this.setState({
        ...this.state,
        policy: new_policy_map,
        statesTransitions: new_states_transitions_map
      });
      await sleep(400);

      if (policy_converged) {
        this.props.addAction(`Policy Iteration Converged ! ${pol_iteration_count} Iterations with respectively ${pol_ev_counts} Policy Evaluation Iterations each`, null, null, 0);
        this.setState({
          ...this.state,
          converged: true,
          working: false
        });
        break;
      }

    }

  }

  valueIterationClick = async (ev) => {
    // reinitialize V(s) to zero and randomize policy
    if (!this.randomizePolicyRadio.current.checked) {
      alert('please randomize policy first');
      return;
    }
    this.setState({
      ...this.state,
      policy: (this.randomizePolicyRadio.current.checked && this.state.converged) ? randomizePolicy(this.state.allowedMoves) : this.state.policy,
      values: initValuesToZero(this.state.values),
      //values: randomizeValues(this.state.values, [this.state.goalState, this.state.holeState, ...this.state.wallStates]),
      gamma: parseFloat(this.gammaInput.current.value), // get Gamma from input
      converged: false,
      working: true,
    });
    await sleep(200);

    this.props.resetAction();


    this.props.addAction('Start Value Iteration', null, null, 0);

    // First Step
    console.log('Starting First Step');
    this.props.addAction(null, '(Step 1 Start !)', 'string', 0);
    this.props.addAction(null, this.state.policy, '2D', 0);
  
    let old_val, v, new_val, delta, new_values_map , threshold = 1e-3;
    let new_a,  best_val;
    let state_transitions, posOfState, pr_trans, a, a2, new_policy_map;
    let step_one_count = 0;
    while (true) {
      step_one_count += 1;
      ITERATION_STR = step_one_count.toString();
      new_values_map = new Map(this.state.values);
      this.props.addAction(null, this.state.values, '2D', 0);
      delta = 0;
      for (let s of this.state.states) {
        state_transitions = this.state.statesTransitions.get(s);
        if (state_transitions.length > 0) {  // not terminal state
          console.log(`State ${s} (${this.state.policy.get(s)})`);
          this.props.addAction('', `State ${s} (${this.state.policy.get(s)})`, 'string', 1);
          posOfState = getPosFromState(s);
          old_val = new_values_map.get(s);
          new_val = Number.NEGATIVE_INFINITY;
          for (let e of state_transitions) {
            a = e[0];
            v = 0;
            if (this.state.windy) {
              for (let e2 of state_transitions) {
                a2 = e2[0];
                if ( a2 ===  a) {
                  pr_trans = 0.5;
                } else {
                  pr_trans = 0.5/3;
                }
                v += bellman_single_action(posOfState, a2, pr_trans, this.moveAgent, this.state.gamma, this.state.rewards, new_values_map, this.props.addAction);
              }
            } else {
              pr_trans = e[1];
              v = bellman_single_action(posOfState, a, pr_trans, this.moveAgent, this.state.gamma, this.state.rewards, this.state.values, this.props.addAction);
            }
            if (v > new_val) {
              new_val = v;
            }
          }
          console.log(`new_val = ${new_val}`);
          this.props.addAction('', `new_val = ${new_val}`, 'string', 1);
          new_values_map.set(s, new_val);
          delta = Math.max(delta, Math.abs(old_val - new_val))
        }
      }
      this.setState({
        ...this.state,
        values: new_values_map
      });
      await sleep(300);

      if ( delta < threshold ) {
        console.log('First Step converged !');
        break;
      }

    }

    // Second Step
    console.log('Starting Second Step');
    this.props.addAction(null, '(Step 2 Start !)', 'string', 0);
    
    new_policy_map = new Map(this.state.policy);
    let new_states_transitions_map = new Map(this.state.statesTransitions);
    let new_state_transitions;
    let old_a;
    for (let s of this.state.states) {
      state_transitions = this.state.statesTransitions.get(s);
      if (state_transitions.length > 0) {
        console.log(`State ${s} (${a})`);
        this.props.addAction('', `State ${s} (${a})`, 'string', 1);
        posOfState = getPosFromState(s);
        old_a  = new_policy_map.get(s);
        best_val = Number.NEGATIVE_INFINITY;
        for (let e of state_transitions) {
          a = e[0];
          v = 0;
          if (this.state.windy) {
            for (let e2 of state_transitions) {
              a2 = e2[0];
              if ( a2 ===  a) {
                pr_trans = 0.5;
              } else {
                pr_trans = 0.5/3;
              }
              v += bellman_single_action(posOfState, a2, pr_trans, this.moveAgent, this.state.gamma, this.state.rewards, new_values_map, this.props.addAction);
            }
          } else {
            pr_trans = e[1];
            v = bellman_single_action(posOfState, a, pr_trans, this.moveAgent, this.state.gamma, this.state.rewards, this.state.values, this.props.addAction);
          }
          if (v > best_val) {
            new_a = a;
            best_val = v;
          }
        }
        console.log(`Best Val for current state :  ${best_val} and belongs to action ${new_a}`);
        this.props.addAction('', `Best Val for current state :  ${best_val} and belongs to action ${new_a}`, 'string', 1);
        if (old_a !== new_a) {
          console.info(`Changing to New Action : ${new_a} =>  ${best_val}`);
          this.props.addAction('', `Changing to New Action : ${new_a} =>  ${best_val}`, 'string', 1);
          new_policy_map.set(s, new_a);
          // when policy changes, and it's windy, I need to update the state transitions of the state, and set 0.5 to the main action, and 0.5/3 to the others
          if (this.state.windy) {
            console.info('Updating state transitions because its windy');
            new_state_transitions = Array.from(new_states_transitions_map.get(s));
            for (let e of new_state_transitions) {
              if (e[0] === new_a) {
                e[1] = 0.5;
              } else {
                e[1] = 0.5/3;
              }
            }
            new_states_transitions_map.set(s, new_state_transitions);
          }
        }
      }
    }

    this.props.addAction(`Value Iteration Converged ! ${step_one_count} Iterations in First Step`, null, null, 0);
    this.props.addAction(null, new_policy_map, '2D', 0);
    this.setState({
      ...this.state,
      policy: new_policy_map,
      statesTransitions: new_states_transitions_map,
      converged: true,
      working: false
    });
    await sleep(200);
  
  }

  monteCarloPredictionClick = async (ev) => {

    this.setState({
      ...this.state,
      values: initValuesToZero(this.state.values),
      gamma: parseFloat(this.gammaInput.current.value), // get Gamma from input
      converged: false,
      working: true,
    });
    await sleep(200);
  
    // Reset Log
    this.props.resetAction();

    const NBR_EPISODES = parseInt(this.nbrEpisodesInput.current.value, 10);
    let game_over = false, action, next_state, reward;
    let states_rewards, states_returns, states_all_returns = new Map(), seen_states,  init_state, init_pos, first_iteration;
    let G, s, ret, j;
    let log_str;
    let sum_rewards;
    for (let i = 0 ; i < NBR_EPISODES ; i++) {

      ITERATION_STR = (i + 1).toString();

      // Begining of each episode set the agent position to a random position
      init_state = getRandomState(this.state.states, [this.state.goalState, this.state.holeState, ...this.state.wallStates]);
      init_pos = getPosFromState(init_state);
      log_str = `Start Episode ${i} : (Start State ${init_state})`;
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 0);

      this.setState({
        ...this.state,
        currentI: init_pos[0],
        currentJ: init_pos[1],
        currentState: init_state,
      });
      await sleep(200);

      // Play the Episode and store list of states and their rewards
      game_over = false;
      states_rewards = [[this.state.currentState, 0]];
      while (!game_over) {
        action = this.state.policy.get(this.state.currentState);
        if (this.state.windy) {
          // another action than the one chosen can occur with pr 0.5/3
          if (Math.random() >= 0.5) {
              let all_actions = ['R','L','D','U'];
              all_actions.splice(all_actions.indexOf(action), 1);
              action = all_actions[Math.floor(Math.random()*all_actions.length)];
              //alert(`Random action for state ${this.state.currentState} : ${action}`)
          }
        }
        if (this.state.allowedMoves.get(this.state.currentState).includes(action)) {
          next_state = this.moveAgent(action, true, [this.state.currentI, this.state.currentJ]);
        } else {
          //alert('Stays in current state');
          next_state = this.state.currentState;
        }
        await sleep(100);
        reward = this.state.rewards.get(next_state);
        states_rewards.push([next_state, reward]);
        game_over = this.state.currentState === this.state.goalState || this.state.currentState === this.state.holeState;
      }
      log_str = `Visited States : `;
      for (let e of states_rewards) {
        log_str += ` (${e[0]},${e[1]}) `;
      }
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 1);

      // Loop through the list of states-rewards backward and compute the Returns
      states_rewards.reverse();
      states_returns = [];
      first_iteration = true;
      G = 0;
      sum_rewards = 0;
      j = 0;
      for (let e of states_rewards) {
        s = e[0]; 
        reward = e[1];
        if (first_iteration) { // last terminal state (G = 0)
          first_iteration = false;
        } else {
          G = sum_rewards * (this.state.gamma**j);
          states_returns.push([s, G]);
          j++;
        }
        sum_rewards += reward;
      }

      // Take the states_returns and store all returns of each state
      seen_states = [];
      for (let e of states_returns) {
        s = e[0];
        ret = e[1];
        if (!seen_states.includes(s)) {
          seen_states.push(s);
          if (states_all_returns.has(s)) {
            states_all_returns.get(s).push(ret);
          } else {
            states_all_returns.set(s, [ret]);
          }
        }
      }

    }


    let new_values = new Map(this.state.values);
    let new_v;
    const sum_reducer = (acc, val) => acc + val;
    for (let [s, rets] of states_all_returns) {
      log_str = `Returns [${s}] :  ${rets}`;
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 2);
      new_v = rets.reduce(sum_reducer) / rets.length;
      new_values.set(s, new_v);
    }

    this.setState({
      ...this.state,
      values: new_values,
      converged: true,
      working: false,
    });

  }

  monteCarloControlClick = async (ev) => {


    this.setState({
      ...this.state,
      values: initValuesToZero(this.state.values),
      gamma: parseFloat(this.gammaInput.current.value), // get Gamma from input
      converged: false,
      working: true,
    });
    await sleep(200);
  
    // Reset Log
    this.props.resetAction();

    const NBR_EPISODES = parseInt(this.nbrEpisodesInput.current.value, 10);
    const all_actions = ['R', 'D', 'U', 'L'];
    const sum_reducer = (acc, val) => acc + val;
    
    let game_over = false, action, next_state, reward;
    let states_actions_rewards, states_actions_returns, states_actions_all_returns = new Map(), seen_states, seen_states_actions = [],  init_state, init_pos, first_iteration;
    let G, s, j, episode_step;
    let log_str;
    let sum_rewards, max_q, newPol;
    
    // Init all Q[s][a] = 0
    let Q = [];
    for (let s of this.state.states) {
      Q[s] = {};
      for (let a of all_actions) {
        Q[s][a] = 0;
      }
    }
    // Init Map states_actions_all_returns.get(s)[action] to empty arrays for all s,a
    for (let s of this.state.states) {
      states_actions_all_returns.set(s,{});
      for (let a of all_actions) {
        states_actions_all_returns.get(s)[a] = []; // will store all returns, we will take their mean after
      }
    }

    for (let i = 0 ; i < NBR_EPISODES ; i++) {

      ITERATION_STR = (i + 1).toString();

      // Begining of each episode set the agent position to a random position
      init_state = getRandomState(this.state.states, [this.state.goalState, this.state.holeState, ...this.state.wallStates]);
      init_pos = getPosFromState(init_state);
      log_str = `Start Episode ${i} : (Start State ${init_state})`;
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 0);

      this.setState({
        ...this.state,
        currentI: init_pos[0],
        currentJ: init_pos[1],
        currentState: init_state,
      });
      await sleep(200);

      // Play the Episode and store list of states ,actions and rewards
      game_over = false;
      episode_step = 0;
      
      
      action = all_actions[Math.floor(Math.random() * all_actions.length)]; // First Action is Random
      states_actions_rewards = [[this.state.currentState, action, 0], ];
      seen_states = [this.state.currentState,];
      
      while (true) {
        episode_step += 1;

        // Wall bump ?
        if (this.state.allowedMoves.get(this.state.currentState).includes(action)) {
          next_state = this.moveAgent(action, true, getPosFromState(this.state.currentState));
          await sleep(60);
          if (seen_states.includes(next_state)) { // avoid infinte loop
            reward = -10/episode_step;
            game_over = true;
          } else {
            reward = this.state.rewards.get(next_state);
            game_over = this.state.currentState === this.state.goalState || this.state.currentState === this.state.holeState;
          }
        } else {
          // Bumped a wall, stays at the same state. we end episode;
          next_state = this.state.currentState;
          reward = -50;
          game_over = true;
        }

        log_str = `Pushing (${next_state}, ${action}, ${reward})`;
        console.log(log_str);
        this.props.addAction(null, log_str, 'string', 2);

        states_actions_rewards.push([next_state, action, reward]);
        seen_states.push(next_state);


        // Next Action
        action = this.state.policy.get(this.state.currentState);
        if (this.state.windy) {
          // another action than the one chosen can occur with pr 0.5/3
          if (Math.random() >= 0.5) {
              let all_actions = ['R','L','D','U'];
              all_actions.splice(all_actions.indexOf(action), 1);
              action = all_actions[Math.floor(Math.random()*all_actions.length)];
              //alert(`Random action for state ${this.state.currentState} : ${action}`)
          }
        }
        if (game_over) {
          break;
        }

      }
      log_str = print2DArray(states_actions_rewards, '[States,Actions,Rewards]')
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 1);
      
      // Compute Returns
      log_str = 'Computing Returns ...';
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 1);
      states_actions_rewards.reverse();
      states_actions_returns = [];
      sum_rewards = 0;
      j = 0;
      first_iteration = true;
      for (let e of states_actions_rewards) {
        s = e[0];
        action = e[1];
        reward = e[2];
        if (first_iteration) {
          first_iteration = false;
        } else {
          G = sum_rewards * (this.state.gamma**j);
          states_actions_returns.push([s,action,G]);
          j++;
        }
        sum_rewards += reward;
      }
      log_str = print2DArray(states_actions_rewards, '[States, Actions, Returns]');
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 2);

      // Store all Returns of each State
      log_str = 'Storing Returns and updating Q';
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 1);
      seen_states_actions = []; // just of the current episode
      for (let e of states_actions_returns) {
        s = e[0];
        action = e[1];
        G = e[2];
        if (!seen_states_actions.includes(`${s}${action}`)) {
          seen_states_actions.push(`${s}${action}`);
          states_actions_all_returns.get(s)[action].push(G);
          Q[s][action] = states_actions_all_returns.get(s)[action].reduce(sum_reducer) / states_actions_all_returns.get(s)[action].length; 
        }
      }
      log_str = printStatesActionsAllReturns(states_actions_all_returns);
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 2);


      // Policy Improvement
      log_str = 'Policy Improvement';
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 1);
      log_str = printQ(Q);
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 2);
      newPol = new Map(this.state.policy);
      for (let s of this.state.states) {
        max_q = Number.NEGATIVE_INFINITY;
        action = '';
        for(let a in Q[s]) {
          //console.log(`Q[${s}][${a}] = ${Q[s][a]}`);
          if (Q[s][a] > max_q) {
            max_q = Q[s][a];
            action = a;
          }
        }
        newPol.set(s, action);
      }

      this.setState({
        ...this.state,
        policy: newPol,
      });
      await sleep(200);
    }

    let newVals = new Map(this.state.values);
    for (let s of this.state.states) {
      max_q = Number.NEGATIVE_INFINITY;
      for (let a in Q[s]) {
        if (Q[s][a] > max_q) {
          max_q = Q[s][a];
        }
      }
      newVals.set(s, max_q);
    }

    this.setState({
      ...this.state,
      values: newVals,
      converged: true,
      working: false,
    });

  }

  tdZeroClick = async (ev) => {

    this.setState({
      ...this.state,
      values: initValuesToZero(this.state.values),
      gamma: parseFloat(this.gammaInput.current.value), // get Gamma from input
      converged: false,
      working: true,
    });
    await sleep(200);
  
    // Reset Log
    this.props.resetAction();


    const NBR_EPISODES = parseInt(this.nbrEpisodesInput.current.value, 10);
    const ALPHA = 0.1;
    let states_rewards, game_over, new_state, action, reward, reward_t1, sr_t0, sr_t1, new_v, old_v_t0, v_t1;
    let newValues = new Map(this.state.values);


    for (let i = 0 ; i < NBR_EPISODES ; i++) {

      ITERATION_STR = (i + 1).toString();

      states_rewards = [];
      game_over = false;
      this.setState({
        ...this.state,
        currentI: this.props.startPos[0],
        currentJ: this.props.startPos[1],
        currentState: this.state.startState,
        values: newValues,
      });
      await sleep(60);

      // Play Episode and store (state,reward) couples
      while (!game_over) {
        action = this.state.policy.get(this.state.currentState);
        if (this.state.windy) {
          // another action than the one chosen can occur with pr 0.5/3
          if (Math.random() >= 0.5) {
              let all_actions = ['R','L','D','U'];
              all_actions.splice(all_actions.indexOf(action), 1);
              action = all_actions[Math.floor(Math.random()*all_actions.length)];
              //alert(`Random action for state ${this.state.currentState} : ${action}`)
          }
        }
        new_state = this.moveAgent(action, true, [this.state.currentI, this.state.currentJ]);
        await sleep(60);
        reward = this.state.rewards.get(new_state);
        states_rewards.push([new_state, reward]);

        game_over = this.state.currentState === this.state.goalState || this.state.currentState === this.state.holeState;

      }
      console.log('Visited States/Rewards', states_rewards);

      // Calculate V(s)
      for (let j = 0 ; j < states_rewards.length-1 ; j++) {
        sr_t0 = states_rewards[j]; // we update the V of this state based on reward and V of next state 
        sr_t1 = states_rewards[j+1];

        old_v_t0 = this.state.values.get(sr_t0[0]);
        v_t1 = this.state.values.get(sr_t1[0]);
        reward_t1 = sr_t1[1];
        new_v = old_v_t0 + ALPHA * (reward_t1 + this.state.gamma*v_t1 - old_v_t0);

        newValues.set(sr_t0[0], new_v);

      }

    }


    this.setState({
      ...this.state,
      converged: true,
      working: false,
      values: newValues
    });

  }

  sarsaClick = async (ev) => {

    this.setState({
      ...this.state,
      values: initValuesToZero(this.state.values),
      gamma: parseFloat(this.gammaInput.current.value), // get Gamma from input
      converged: false,
      working: true,
    });
    await sleep(200);

    // Reset Log
    this.props.resetAction();

    const NBR_EPISODES = parseInt(this.nbrEpisodesInput.current.value, 10);
    const ALL_ACTIONS = ['R', 'D', 'U', 'L'];
    const ALPHA = 0.1;
    let game_over, a1, a2, s1, s2, alpha, reward, t = 1;
    let log_str;
    
    // Init all Q[s][a] = 0 and update_count_sa to 1
    let Q = [], update_count_sa = [];
    for (let s of this.state.states) {
      Q[s] = {};
      update_count_sa[s] = {};
      for (let a of ALL_ACTIONS ) {
        Q[s][a] = 0;
        update_count_sa[s][a] = 1.0;
      }
    }
    log_str = printQ(Q);
    console.log(log_str);
    this.props.addAction(null, log_str, 'string', 2);


    for (let i = 0 ; i < NBR_EPISODES ; i++) {

      ITERATION_STR = (i + 1).toString();

      log_str = `Episode ${i} :`;
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 1);

      // return to start position
      this.setState({
        ...this.state,
        currentI: this.props.startPos[0],
        currentJ: this.props.startPos[1],
        currentState: this.state.startState,
      });
      await sleep(60);

      if (i % 100 === 0) {
        t += 1e-2;
      }

      // play episode
      game_over = false;
      // choose next first action by argmaxing from Q[s] with soft epsilon
      a1 = getMaxArray(Q[this.state.currentState])[0];
      a1 = epsilonSoftAction(a1, 0.5/t, ALL_ACTIONS);


      s1 = this.state.currentState;

      while (!game_over) {

        if (this.state.windy) {
          // another action than the one chosen can occur with pr 0.5/3
          if (Math.random() >= 0.5) {
              let all_actions = ['R','L','D','U'];
              all_actions.splice(all_actions.indexOf(a1), 1);
              a1 = all_actions[Math.floor(Math.random()*all_actions.length)];
              //alert(`Random action for state ${this.state.currentState} : ${action}`)
          }
        }

        log_str = `(${s1}, ${a1})`;
        console.log(log_str);
        this.props.addAction(null, log_str, 'string', 0);

        // test wall bump
        if (this.state.allowedMoves.get(this.state.currentState).includes(a1)) {
          s2 = this.moveAgent(a1, true, getPosFromState(s1));
          await sleep(50);
        } else {
          s2 = s1;
        }
        reward = this.state.rewards.get(s2);


        // next action
        a2 = getMaxArray(Q[s2])[0];
        a2 = epsilonSoftAction(a2, 0.5/t, ALL_ACTIONS);

        // new Alpha Decay
        alpha = ALPHA / update_count_sa[s1][a1];
        update_count_sa[s1][a1] += 0.005;

        // Main Update Equation
        Q[s1][a1] = Q[s1][a1] + alpha*(reward + this.state.gamma*Q[s2][a2] - Q[s1][a1]);
        log_str = `updated Q[${s1}][${a1}] = ${Q[s1][a1]} (alpha = ${alpha.toFixed(2)})`;
        console.log(log_str);
        this.props.addAction(null, log_str, 'string', 1);

        game_over = this.state.currentState === this.state.goalState || this.state.currentState === this.state.holeState;

        if (!game_over) {
          // next state become current state
          s1 = s2;
          a1 = a2;
        }

      }

      log_str = printQ(Q);
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 2);

    }


    // set the final policy and values
    let newPolicy = new Map();
    let newValues = new Map();
    let tmp;
    for (let s in Q) {
      tmp = getMaxArray(Q[s]);
      newPolicy.set(s, tmp[0]);
      newValues.set(s, tmp[1]);
    }

    log_str = 'SARSA Converged !';
    console.log(log_str);
    this.props.addAction(null, log_str, 'string', 0);


    this.setState({
      ...this.state,
      converged: true,
      working: false,
      policy: newPolicy,
      values: newValues,
    });

  }


  QLearningClick = async (ev) => {

    this.setState({
      ...this.state,
      values: initValuesToZero(this.state.values),
      gamma: parseFloat(this.gammaInput.current.value), // get Gamma from input
      converged: false,
      working: true,
    });
    await sleep(200);
  
    // Reset Log
    this.props.resetAction();

    const NBR_EPISODES = parseInt(this.nbrEpisodesInput.current.value, 10);
    const ALL_ACTIONS = ['R', 'D', 'U', 'L'];
    const ALPHA = 0.1;
    let game_over, a1, a2, s1, s2, alpha, reward, t = 1;
    let log_str;
    
    // Init all Q[s][a] = 0 and update_count_sa to 1
    let Q = [], update_count_sa = [];
    for (let s of this.state.states) {
      Q[s] = {};
      update_count_sa[s] = {};
      for (let a of ALL_ACTIONS ) {
        Q[s][a] = 0;
        update_count_sa[s][a] = 1.0;
      }
    }
    log_str = printQ(Q);
    console.log(log_str);
    this.props.addAction(null, log_str, 'string', 2);


    for (let i = 0 ; i < NBR_EPISODES ; i++) {

      ITERATION_STR = (i + 1).toString();

      log_str = `Episode ${i} :`;
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 0);

      // return to start position
      this.setState({
        ...this.state,
        currentI: this.props.startPos[0],
        currentJ: this.props.startPos[1],
        currentState: this.state.startState,
      });
      await sleep(60);

      if (i % 100 === 0) {
        t += 1e-2;
      }

      // play episode
      game_over = false;
      // choose next first action by argmaxing from Q[s] with soft epsilon
      a1 = getMaxArray(Q[this.state.currentState])[0];

      s1 = this.state.currentState;

      while (!game_over) {
        a1 = epsilonSoftAction(a1, 0.5/t, ALL_ACTIONS);
        if (this.state.windy) {
          // another action than the one chosen can occur with pr 0.5/3
          if (Math.random() >= 0.5) {
              let all_actions = ['R','L','D','U'];
              all_actions.splice(all_actions.indexOf(a1), 1);
              a1 = all_actions[Math.floor(Math.random()*all_actions.length)];
              //alert(`Random action for state ${this.state.currentState} : ${action}`)
          }
        }
        log_str = `(${s1}, ${a1})`;
        console.log(log_str);
        this.props.addAction(null, log_str, 'string', 1);

        // test wall bump
        if (this.state.allowedMoves.get(this.state.currentState).includes(a1)) {
          s2 = this.moveAgent(a1, true, getPosFromState(s1));
          await sleep(50);
        } else {
          s2 = s1;
        }
        reward = this.state.rewards.get(s2);


        // next action
        a2 = getMaxArray(Q[s2])[0];

        // new Alpha Decay
        alpha = ALPHA / update_count_sa[s1][a1];
        update_count_sa[s1][a1] += 0.005;

        // Main Update Equation
        Q[s1][a1] = Q[s1][a1] + alpha*(reward + this.state.gamma*Q[s2][a2] - Q[s1][a1]);
        log_str = `updated Q[${s1}][${a1}] = ${Q[s1][a1]} (alpha = ${alpha.toFixed(2)})`;
        console.log(log_str);
        this.props.addAction(null, log_str, 'string', 1);

        game_over = this.state.currentState === this.state.goalState || this.state.currentState === this.state.holeState;

        if (!game_over) {
          // next state become current state
          s1 = s2;
          a1 = a2;
        }

      }

      log_str = printQ(Q);
      console.log(log_str);
      this.props.addAction(null, log_str, 'string', 2);

    }


    // set the final policy and values
    let newPolicy = new Map();
    let newValues = new Map();
    let tmp;
    for (let s in Q) {
      tmp = getMaxArray(Q[s]);
      newPolicy.set(s, tmp[0]);
      newValues.set(s, tmp[1]);
    }

    log_str = 'Q Learning Converged !';
    console.log(log_str);
    this.props.addAction(null, log_str, 'string', 0);


    this.setState({
      ...this.state,
      converged: true,
      working: false,
      policy: newPolicy,
      values: newValues,
    });

  }

  render() {
    //console.log('render grid');
    let rows = [], val, s, isStartPos, isGoalPos, isHolePos, isWallPos, a;
    for (let i = 0 ; i < this.props.height ; i++) {
      let cols = [];
      for (let j = 0 ; j < this.props.width ; j++) {
        isStartPos = (i === this.props.startPos[0] && j === this.props.startPos[1]);
        isGoalPos  = (i === this.props.goalPos[0]  && j === this.props.goalPos[1]);
        isHolePos  = (i === this.props.holePos[0]  && j === this.props.holePos[1]);
        isWallPos  = (this.props.wallsPos.filter(pos=>pos[0] === i && pos[1] === j).length > 0 );
        s = `${i}${j}`;
        if (isWallPos) {
          val = '';
        } else if (this.state.gridContent === 'agent') {
          val = this.state.currentI === i && this.state.currentJ === j ? 'A' : '';
        } else if (this.state.gridContent === 'rewards') {
          val = this.state.rewards.get(s);
        } else if (this.state.gridContent === 'values') {
          val = this.state.values.get(s);
          val = val.toFixed(2);
        } else if (this.state.gridContent === 'policy' && !isGoalPos && !isHolePos && !isWallPos) {
          a = this.state.policy.get(s);
          val = a;
        } else {
          val = '';
        }
        
        cols.push(
        <td key={s}
            className={`${i+1 === this.props.height ? 'last-row' : ''} \
                        ${j === 0 ? 'first-col' : ''} \
                        ${this.state.tableIsEditable && this.state.selectedGridState === s ? 'selected' : ''}
                        ${i === this.state.currentI    && j === this.state.currentJ ? 'current' : ''} \
                        ${isStartPos ? 'start' : ''} \
                        ${isGoalPos  ? 'goal' : ''} \
                        ${isHolePos  ? 'hole' : ''} \
                        ${isWallPos  ? 'wall' : ''} `}
                        data-state={s} >
            {val}
        </td>);
      }
      rows.push(<tr key={i}>{cols}</tr>);
    }
    return (
      <div className="Grid">
          <div className="options show">
            <div className="radio">
              <p>Show :</p>
            </div>
            <div className="radio">
              <input checked={this.state.gridContent==='agent'} type="radio" value="agent" name="grid-content" onChange={this.gridContentOptionChange} />
              <label>Grid</label>
            </div>
            <div className="radio">
              <input type="radio" value="rewards" name="grid-content" onChange={this.gridContentOptionChange} />
              <label>Rewards</label>
            </div>
            <div className="radio">
              <input type="radio" value="values"  name="grid-content" onChange={this.gridContentOptionChange} />
              <label>Values</label>
            </div>
            <div className="radio">
              <input type="radio" value="policy"  name="grid-content" onChange={this.gridContentOptionChange} />
              <label>Policy</label>
            </div>
          </div>
          <div className="options grid" hidden={this.state.gridContent!=='agent'}>
            <div className="radio">
                <p>Grid Properties</p>
            </div>
            <div className="radio">
                <input type="radio" value="standard" name="grid-type" onChange={this.gridTypeOptionChange} defaultChecked={true}/>
                <label>Standard</label>
            </div>
            <div className="radio">
                <input type="radio" value="windy" name="grid-type" onChange={this.gridTypeOptionChange}/>
                <label>Windy</label>
            </div>
            <div className="radio">
                <input ref={this.dimensionsRadio} type="radio" value="dimensions" name="grid-edit" onChange={this.gridTypeOptionChange}/>
                <label>Dimensions </label>
                ( <input ref={this.widthInput} type="text" name="width" onChange={this.onDimInputChange} className="small-input" defaultValue={this.props.width} onFocus={this.onDimInputFocus} /> x <input ref={this.heightInput} type="text" name="height" onChange={this.onDimInputChange} className="small-input" defaultValue={this.props.height} onFocus={this.onDimInputFocus} /> )
            </div>
            <div className="radio">
                <input ref={this.positionsRadio} type="radio" value="positions" name="grid-edit" onChange={this.gridTypeOptionChange}/>
                <label>Positions</label>
            </div>
          </div>
          <div className="options rewards" hidden={this.state.gridContent!=='rewards'} >
            <div className="radio">
              <p>Reward :</p>
            </div>
            <div className="radio">
              <input type="radio" value="standard" name="reward" defaultChecked={true} onChange={this.rewardTypeOptionChange}/>
              <label>Standard</label>
            </div>
            <div className="radio">
              <input type="radio" value="negative" name="reward" onChange={this.rewardTypeOptionChange}/>
              <label>Negative </label>
              ( <input ref={this.stepCostInput} className="small-input" type="text" defaultValue={this.state.stepCost} onChange={this.stepCostInputChange} /> )
            </div>
          </div>
          <div hidden={this.state.gridContent!=='policy'} className="options policy">
              <div className="radio">
                <p>Policy :</p>
              </div>
              <div className="radio">
                <input ref={this.uniformizePolicyRadio} type="radio" value="uniform" name="policy" onChange={this.policyTypeOptionChange} />
                <label>Uniform</label>
              </div>
              <div className="radio">
                <input ref={this.randomizePolicyRadio} type="radio" value="random" name="policy" onChange={this.policyTypeOptionChange} />
                <label>Randomize</label>
              </div>
              <div className="radio">
                <input ref={this.customizePolicyRadio} type="radio" value="custom" name="policy" onChange={this.policyTypeOptionChange} />
                <label>Customize</label>
              </div>
          </div>
          <div className="options gamma">
            <label>Discount Factor (gamma) : </label>
            <input className="small-input" ref={this.gammaInput} type="text" defaultValue={this.state.gamma} />
          </div>
        <div className="actions">
          <div className="options algorithms">
              <div className="radio">
                <input type="radio" value="dynamicprogramming" name="algorithms" defaultChecked={true} onChange={this.onAlgorithmsRadioChange}/>
                <label>Dynamic Programming</label>
              </div>
              <div className="radio">
                <input type="radio" value="montecarlo" name="algorithms" onChange={this.onAlgorithmsRadioChange} />
                <label>Monte Carlo</label>
              </div>
              <div className="radio">
                <input type="radio" value="temporaldifference" name="algorithms" onChange={this.onAlgorithmsRadioChange} />
                <label>Temporal Difference</label>
              </div>
          </div>
          <div className="options">
            <div className="actions-option" hidden={this.state.algorithms !=='dynamicprogramming'}>
              <button ref={this.evaluatePolicyBtn} onClick={this.evaluatePolicyClick}  className="action-btn">Evaluate Policy</button>
              <button onClick={this.policyIterationClick} className="action-btn" >Policy Iteration</button>
              <button onClick={this.valueIterationClick}  className="action-btn" >Value Iteration</button>
            </div>
            <div className="actions-option" hidden={this.state.algorithms !== 'montecarlo'}>
              <button onClick={this.monteCarloPredictionClick}  className="action-btn" >Monte Carlo Prediction</button>
              <button onClick={this.monteCarloControlClick}  className="action-btn">Monte Carlo Control</button>
            </div>
            <div className="actions-option" hidden={!(this.state.algorithms === 'montecarlo' || this.state.algorithms === 'temporaldifference')} >
              <label>Nbr of Episodes </label>
              <input ref={this.nbrEpisodesInput} className="small-input" type="text" defaultValue="500" />
            </div>
            <div className="actions-option" hidden={this.state.algorithms !== 'temporaldifference'}>
              <button onClick={this.tdZeroClick} className="action-btn">TD(0) Prediction</button>
              <button onClick={this.sarsaClick} className="action-btn">SARSA</button>
              <button onClick={this.QLearningClick} className="action-btn">Q Learning</button>
            </div>
          </div>
        </div>
        <div className="table-wrapper">
          <div className="status">
            <h4 id="converged" hidden={!this.state.converged}>CONVERGED !</h4>
            <h4 id="working" hidden={!this.state.working}>WORKING ({ITERATION_STR})</h4>
          </div>
          <div>
            <table ref={this.gridTable} onFocus={this.onGridTableFocus} className={`${this.state.gridContent} ${this.state.windy ? 'windy' : ''} ${this.state.converged ? 'converged' : ''} ${this.state.working ? 'working' : ''} ${this.state.tableIsEditable ? 'editable' : ''}`}>
              <tbody>
                {rows}
              </tbody>
            </table>
            <button id="show-logs-btn" onClick={this.props.showLoggerFunc}>Show Logs</button>
          </div>
          <div className="context-menu" hidden={!this.state.contextMenuVisible}>
              <div className="item start" data-action="start"  onClick={this.onContextMenuItemClick}>Set as Start</div>
              <div className="item goal" data-action="goal"  onClick={this.onContextMenuItemClick}>Set as Goal</div>
              <div className="item hole" data-action="hole"  onClick={this.onContextMenuItemClick}>Set as Hole</div>
              <div className="item wall" data-action="wall"  onClick={this.onContextMenuItemClick}>Set as Wall</div>
              <div className="item unwall" data-action="unwall" onClick={this.onContextMenuItemClick}>Remove Wall</div>
              <div className="item cancel" data-action="cancel" onClick={this.onContextMenuItemClick}>Cancel</div>
        </div>
        </div>

      </div>
    );
  }
}

const mapDispatchToProps = (dispatch) => ({
  addAction: (action_title, data, type, level) => dispatch(addAction(action_title, data, type, level)),
  resetAction: () => dispatch(resetAction()),
});

export default connect(null, mapDispatchToProps) (Grid);
