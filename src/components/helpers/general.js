import {clearPolicy} from './policy';

export const getStateFromPos = (i, j) => {
    return i.toString().concat(j.toString());
};

export const getPosFromState = (s) => {
    if (typeof(s) === 'string' && s.length === 2) {
      return [parseInt(s[0], 10), parseInt(s[1], 10)];
    } else {
      return [];
    }
};

export const initValuesToZero = (valuesMap) => {
    let newVals = new Map(valuesMap);
    for (let s of newVals.keys()) {
      newVals.set(s, 0.0);
    }
    return newVals;
};

export const randomizeValues = (values_map, zero_states) => {
    console.log(zero_states);
    let newVals = new Map(values_map);
    for (let s of newVals.keys()) {
        if (zero_states.includes(s)) {
            newVals.set(s, 0);
        } else {
            newVals.set(s, Math.random());
        }
    }
    return newVals;
};

export const getRandomState = (states, not_allowed_states) => {
  let random_state;

  do {
    random_state = states[Math.floor(Math.random() * states.length)];
  } while (not_allowed_states.includes(random_state))

  return random_state;
}

export const constructGrid = (width, height, startPos, goalPos, holePos, wallsPos, stepCost) => {
    console.log('Constructing Grid');
      // construct list of all states (grid[1][2] => encoded as string '12' )
      // IMPORTANT: will work for now with max 10x10 grid, meaning that state will be 2 charachters ('99')
      // construct map of rewards (s->reward)
      let states = [], rewards = new Map(), states_transitions = new Map(), values = new Map(), allowed_moves = new Map();
      let s, r, tran, moves, isStartState, isGoal, isHole, isWall; // tmp vars to work with inside the loops
      const goalReward = 1, holeReward = -1;
      let startState, goalState, holeState, wallStates=[];

      //this.setGrid(width, height, goalPos, holePos, wallsPos,)
      for (let i = 0 ; i < height ; i++) {
        for (let j = 0 ; j < width ; j++) {
          isStartState = i === startPos[0] && j === startPos[1];
          isGoal = i === goalPos[0] && j === goalPos[1];
          isHole = i === holePos[0] && j === holePos[1];
          isWall = wallsPos.filter(pos=>(pos[0] === i && pos[1] === j)).length > 0;
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
            if (isStartState) {
              startState = s;
            }
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

            if (j === (width - 1)) {
              moves.splice(3,1);
            } else if (j === 0) {
              moves.splice(2,1);
            }
            if (i === (height - 1)) {
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

      for (let w of wallsPos) {
        neighbours.r = w[1] === (width-1) ? null : [w[0], w[1]+1];
        neighbours.l = w[1] === 0 ? null : [w[0], w[1]-1];
        neighbours.u = w[0] === 0 ? null : [w[0]-1, w[1]];
        neighbours.d = w[0] === (height-1) ? null : [w[0]+1, w[1]];
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

      const ret_state = {
        states : states,
        startState: startState,
        goalState: goalState,
        holeState: holeState,
        wallStates: wallStates,
        currentI: startPos[0],
        currentJ: startPos[1],
        currentState: getStateFromPos(startPos[0], startPos[1]),
        rewards: rewards,
        goalReward: goalReward,
        holeReward: holeReward,
        statesTransitions: states_transitions, // Map: for each state S -> [['R', 0.2], ['U', 0.8]]
        allowedMoves: allowed_moves, // Map : for each s => ['D', 'R'] allowed moves
        policy: policy,
        values: values,
        stepCost: stepCost,
      };
      return ret_state;
  };


export const printQ = (Q) => {
  let ret_str = '';
  for (let s in Q) {
    ret_str += `\nQ[${s}]`;
    for (let a in Q[s]) {
      ret_str += `[${a}] = ${Q[s][a].toFixed(3)}`;
    }
  }
  return ret_str;
};

export const print2DArray = (arr, title) => {
  let ret_str = `${title} : \n`;
  for (let e of arr) {
    ret_str += `(${e}), `;
  }
  return ret_str;
}

export const printStatesActionsAllReturns = (m) => {
  let ret_str = 'All returns of (s,a): \n';
  for (let [s, v] of m) {
    ret_str += `\n(${s})`;
    for (let a in v) {
      ret_str += ` [${a}] = [ ${v[a]} ]`;
    }
  }
  return ret_str;
};

export const getMaxArray = (arr) => {
  // Associative Array has form ['A': 1, 'B': 2, ...] returns the key of the biggest val
  let max_val = Number.NEGATIVE_INFINITY;
  let max_key = null;
  for (let k in arr) {
    if (arr[k] > max_val) {
      max_val = arr[k];
      max_key = k;
    }
  }
  return [max_key, max_val];
};
