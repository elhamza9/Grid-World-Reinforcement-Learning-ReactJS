import React, { Component } from 'react';
import { connect } from "react-redux";

import PolicyEditor from './PolicyEditor';

import '../styles/Grid.css';

import {setRewards} from './helpers/rewards';
import {getStateFromPos, getPosFromState, initValuesToZero, randomizeValues} from './helpers/general';
import { randomizePolicy, setStatesTransitionsToUniform, clearPolicy, setStatesTransitionsToDeterministic, setStatesTransitionsToWindy } from './helpers/policy';
import { bellman_loop_actions, bellman_single_action } from './helpers/algorithms';
import { addAction, resetAction } from '../redux/actions';

const sleep = (ms) => { return new Promise(resolve => setTimeout(resolve, ms))};

class Grid extends Component {

  constructor (props) {
    super(props);
    console.log('construct grid');
    // construct list of all states (grid[1][2] => encoded as string '12' )
    // IMPORTANT: will work for now with max 10x10 grid, meaning that state will be 2 charachters ('99')
    // construct map of rewards (s->reward)
    let states = [], rewards = new Map(), states_transitions = new Map(), values = new Map(), allowed_moves = new Map();
    let s, r, tran, moves, isGoal, isHole, isWall; // tmp vars to work with inside the loops
    const goalReward = 1, holeReward = -1, stepCost = 0;
    let goalState, holeState, wallStates=[];

    for (let i = 0 ; i < props.height ; i++) {
      for (let j = 0 ; j < props.width ; j++) {
        isGoal = i === props.goalPos[0] && j === props.goalPos[1];
        isHole = i === props.holePos[0] && j === props.holePos[1];
        isWall = props.wallsPos.filter(pos=>(pos[0] === i && pos[1] === j)).length > 0;
        // add state
        s = i.toString().concat(j.toString());
        states.push(s);
        // set reward
        if (isGoal) {
          r = goalReward;
          goalState = s;
        } else if (isHole) {
          r = holeReward;
          holeState = s;
        } else if (isWall) {
          r = 0;
          wallStates.push(s);
        } else {
          r = stepCost;
        }
        rewards.set(s, r);
        // set possible moves
        tran = []; // array for each action: gives the prb of transition, each action
        if (isGoal || isHole || isWall) {
          moves = [];
        } else {
          moves = ['U', 'D', 'L', 'R'];
          for(let m of moves) {
            tran.push([m, 1]);
          }
          // example: [[U, pr(U)],[L, pr(L)], ...]
          // initialization: uniform (each action has pr 1/length_possible_moves)

          if (j === (props.width - 1)) {
            moves.splice(3,1);
          } else if (j === 0) {
            moves.splice(2,1);
          }
          if (i === (props.height - 1)) {
            moves.splice(1,1);
          } else if (i === 0) {
            moves.splice(0,1);
          }

        }

        // set State Transitions
        states_transitions.set(s, tran);
        // set allowed moves
        allowed_moves.set(s, moves);
        // set initial value to zero
        values.set(s, 0);
      }
    }

    // Behaviour of Agent when near a wall
    // for each wall go the states near it, and remove the action that leads to the wall
    let neighbours = {r : null, l : null, u : null , d : null}, neighbour, action_to_remove;

    for (let w of props.wallsPos) {
      neighbours.r = w[1] === (props.width-1) ? null : [w[0], w[1]+1];
      neighbours.l = w[1] === 0 ? null : [w[0], w[1]-1];
      neighbours.u = w[0] === 0 ? null : [w[0]-1, w[1]];
      neighbours.d = w[0] === (props.height-1) ? null : [w[0]+1, w[1]];
      for (let key in neighbours ) {
        neighbour = neighbours[key];
        if (neighbour !== null) {
          s = getStateFromPos(neighbour[0], neighbour[1]);
          moves = allowed_moves.get(s);
          if (key === 'r') {
            action_to_remove = 'L';
          } else if (key === 'l') {
            action_to_remove = 'R';
          } else if (key === 'u') {
            action_to_remove = 'D';
          } else if (key === 'd') {
            action_to_remove = 'U';
          } else {
            action_to_remove = '';
            console.log('key unknown !!!!');
          }
          if (action_to_remove.length > 0) {
            moves.splice( moves.indexOf(action_to_remove), 1);
          }
        }
      }
    }

    // Randomize initial policy, deterministic by default ( Grid is standard not windy )
    let policy = clearPolicy(states);
    console.log('state transitions', states_transitions);
    console.log('allowed moves', allowed_moves)
    console.log('policy', policy);

    // Create some references
    this.gammaInput = React.createRef();
    this.stepCostInput = React.createRef();
    this.randomizePolicyRadio = React.createRef();
    this.uniformizePolicyRadio = React.createRef();

    this.state = {
      gridContent: 'agent',
      states : states,
      goalState: goalState,
      holeState: holeState,
      wallStates: wallStates,
      rewards: rewards,
      stepCost: stepCost,
      goalReward: goalReward,
      holeReward: holeReward,
      statesTransitions: states_transitions, // Map: for each state S -> [['R', 0.2], ['U', 0.8]]
      allowedMoves: allowed_moves, // Map : for each s => ['D', 'R'] allowed moves
      policy: policy,
      policyEditable: true,    // for the child component PolicyEditor
      selectedState: '',       // for the child component PolicyEditor
      selectedStatePolicy: [], // for the child component PolicyEditor
      values: values,
      gamma: 0.9,              // Discount Factor
      windy: false,
      currentI: props.startPos[0],
      currentJ: props.startPos[1],
      converged: false,
    };
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
    const permitted_vals = ['standard', 'windy'];
    let new_states_transitions;
    if (permitted_vals.includes(ev.target.value)) {
      if (ev.target.value === 'standard') {
        new_states_transitions = setStatesTransitionsToDeterministic(this.state.statesTransitions);
      } else {
        new_states_transitions = setStatesTransitionsToWindy(this.state.statesTransitions, this.state.policy);
      }
      this.setState({
        ...this.state,
        windy: ev.target.value === 'windy',
        statesTransitions: new_states_transitions,
      });
    }
    console.log('state transitions', new_states_transitions)
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


  gridStateClick = (ev) => {
  };

  // what to do when editing policy of a state from policy editor is done
  onSavePolicy = (newPolicy) => {
  };

  evaluatePolicyClick = async (ev) => {

    // reinitialize V(s) to zero
    this.setState({
      ...this.state,
      values: initValuesToZero(this.state.values),
      gamma:  parseFloat(this.gammaInput.current.value), // get Gamma from input
      converged: false,
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
          converged: true
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
    });
    await sleep(200);

    this.props.resetAction();


    this.props.addAction('Start Value Iteration', null, null, 0);

    // First Step
    console.log('Starting First Step');
    this.props.addAction(null, '(Step 1 Start !)', 'string', 0);
  
    let old_val, v, new_val, delta, new_values_map , threshold = 1e-3;
    let new_a,  best_val;
    let state_transitions, posOfState, pr_trans, a, a2, new_policy_map;
    let step_one_count = 0;
    while (true) {
      step_one_count += 1;
      new_values_map = new Map(this.state.values);
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
    this.setState({
      ...this.state,
      policy: new_policy_map,
      statesTransitions: new_states_transitions_map,
      converged: true,
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
                        ${this.state.policyEditable && !isStartPos && !isGoalPos && !isHolePos && !isWallPos ? 'editable' : ''}
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
                <p>Grid Type</p>
            </div>
            <div className="radio">
                <input type="radio" value="standard" name="grid-type" onChange={this.gridTypeOptionChange} defaultChecked={true}/>
                <label>Standard</label>
            </div>
            <div className="radio">
                <input type="radio" value="windy" name="grid-type" onChange={this.gridTypeOptionChange}/>
                <label>Windy</label>
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
        <div>
          <table className={`${this.state.gridContent} ${this.state.windy ? 'windy' : ''}`}>
            <tbody>
              {rows}
            </tbody>
          </table>
        </div>
        <PolicyEditor policy={this.state.selectedStatePolicy} onSavePolicy={this.onSavePolicy} />
        <h2 id="converged" hidden={!this.state.converged}>CONVERGED !</h2>
      </div>
    );
  }
}

const mapDispatchToProps = (dispatch) => ({
  addAction: (action_title, data, type, level) => dispatch(addAction(action_title, data, type, level)),
  resetAction: () => dispatch(resetAction()),
});

export default connect(null, mapDispatchToProps) (Grid);
