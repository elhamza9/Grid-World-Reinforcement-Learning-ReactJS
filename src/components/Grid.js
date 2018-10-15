import React, { Component } from 'react';
import { connect } from "react-redux";


import '../styles/Grid.css';

import {setRewards} from './helpers/rewards';
import {constructGrid, getStateFromPos, getPosFromState, initValuesToZero, randomizeValues} from './helpers/general';
import { randomizePolicy, setStatesTransitionsToUniform, clearPolicy, setStatesTransitionsToDeterministic, setStatesTransitionsToWindy } from './helpers/policy';
import { bellman_loop_actions, bellman_single_action } from './helpers/algorithms';
import { addAction, resetAction } from '../redux/actions';

const sleep = (ms) => { return new Promise(resolve => setTimeout(resolve, ms))};

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
    this.widthInput = React.createRef();
    this.heightInput = React.createRef();
    this.gridTable = React.createRef();


    // Add some other state properties
    state = {
      ...state, 
      gridContent: 'agent',
      gamma: 0.9,              // Discount Factor
      windy: false,
      converged: false,
      working: false,
      contextMenuVisible: false,
      selectedGridState: '', // on table right click
      tableIsEditable: false,
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
    if (this.positionsRadio.current.checked) {
      const s = ev.target.dataset.state;
      
      this.setState({
        ...this.state,
        contextMenuVisible: true,
        selectedGridState: s
      });
    }
  };


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
    })
  }

  getCurrentState = () => {
    return getStateFromPos(this.state.currentI, this.state.currentJ);
  }

  // returns state
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
        currentJ: newPos[1]
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
      });
    } else if (ev.target.name === 'grid-edit') {
      if (ev.target.value === 'positions') {
        this.gridTable.current.addEventListener('click', this.onTableClick);
        this.setState({
          ...this.state,
          tableIsEditable: true,
        });
      } else {
        this.gridTable.current.removeEventListener('click', this.onTableClick);
        this.setState({
          ...this.state,
          tableIsEditable: false,
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

  policyTypeOptionChange = (ev) => {
    let v = ev.target.value;
    let new_pol;
    let new_states_transitions;
    if (v === 'uniform') {
      new_pol = clearPolicy(this.state.states);
      new_states_transitions = setStatesTransitionsToUniform(this.state.statesTransitions, this.state.allowedMoves);
      this.setState({
        ...this.state,
        policy: new_pol,
        statesTransitions: new_states_transitions,
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
        converged: false,
      });
    }
    console.log('state transitions', new_states_transitions)
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


  render() {
    console.log('render grid');
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
                        data-state={s}
                        onClick={this.gridStateClick}>
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
              {/*
              <div className="radio">
                <input type="radio" value="custom" name="policy" onChange={this.policyOptionChange} />
                <label>Custom</label>
              </div>
              */}
          </div>
          <div className="options gamma">
            <label>Discount Factor (gamma) : </label>
            <input className="small-input" ref={this.gammaInput} type="text" defaultValue={this.state.gamma} />
          </div>
        <div className="actions">
          <button onClick={this.evaluatePolicyClick}  className="action-btn">Evaluate Policy</button>
          <button onClick={this.policyIterationClick} className="action-btn">Policy Iteration</button>
          <button onClick={this.valueIterationClick}  className="action-btn">Value Iteration</button>
        </div>
        <div className="table-wrapper">
          <div className="status">
            <h4 id="converged" hidden={!this.state.converged}>CONVERGED !</h4>
            <h4 id="working" hidden={!this.state.working}>WORKING</h4>
          </div>
          <div>
            <table ref={this.gridTable} className={`${this.state.gridContent} ${this.state.windy ? 'windy' : ''} ${this.state.converged ? 'converged' : ''} ${this.state.working ? 'working' : ''} ${this.state.tableIsEditable ? 'editable' : ''}`}>
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
