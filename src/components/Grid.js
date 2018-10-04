import React, { Component } from 'react';

import PolicyEditor from './PolicyEditor';

import '../styles/Grid.css';

const sleep = (ms) => { return new Promise(resolve => setTimeout(resolve, ms))};

class Grid extends Component {

  constructor (props) {
    super(props);
    console.log('construct grid');
    // construct list of all states (grid[1][2] => encoded as string '12' )
    // IMPORTANT: will work for now with max 10x10 grid, meaning that state will be 2 charachters ('99')
    // construct map of rewards (s->reward)
    let states = [], rewards = new Map(), policies = new Map(), values = new Map();
    let s, r, p, moves, isGoal, isHole, isWall; // tmp vars to work with inside the loops
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
          r = 1;
        } else if (isHole) {
          r = -1;
        } else {
          r = 0;
        }
        rewards.set(s, r);
        // set possible moves
        moves = ['U', 'D', 'L', 'R'];
        if (j === (props.width - 1)) {
          moves.splice(3,1,null);
        } else if (j === 0) {
          moves.splice(2,1,null);
        }
        if (i === (props.height - 1)) {
          moves.splice(1,1,null);
        } else if (i === 0) {
          moves.splice(0,1,null);
        }
        if (isGoal || isHole || isWall) {
          moves = [];
        }
        p = []; // policy array for each state gives the prb of each action
                // example: [[U, pr(U)],[L, pr(L)], ...]
        for (let m of moves) {
          if (m !== null) {
            p.push([m, 0]);
          }
        }
        policies.set(s, p);
        // set initial value to zero
        values.set(s, 0);
      }
    }

    // Behaviour of Agent when near a wall
    // for each wall go the states near it, and remove the action that leads to the wall
    let neighbours = {r : null, l : null, u : null , d : null}, neighbour, action_to_remove;
    let policy;
    for (let w of props.wallsPos) {
      neighbours.r = w[1] === (props.width-1) ? null : [w[0], w[1]+1];
      neighbours.l = w[1] === 0 ? null : [w[0], w[1]-1];
      neighbours.u = w[0] === 0 ? null : [w[0]-1, w[1]];
      neighbours.d = w[0] === (props.height-1) ? null : [w[0]+1, w[1]];
      for (let key in neighbours ) {
        neighbour = neighbours[key];
        if (neighbour !== null) {
          s = this.getStateFromPos(neighbour[0], neighbour[1]);
          policy = policies.get(s);
          if (key === 'r') {
            action_to_remove = 'L';
          } else if (key === 'l') {
            action_to_remove = 'R';
          } else if (key === 'u') {
            action_to_remove = 'D';
          } else if (key === 'd') {
            action_to_remove = 'U';
          } else {
            console.log('key unknown !!!!');
          }
          policies.set(s, policy.filter(e => e[0] !== action_to_remove));
          //moves.splice(moves.indexOf(action), 1);
        }
      }
    }

    console.log(policies);
    this.gammaInput = React.createRef();

    this.state = {
      gridContent: 'agent',
      states : states,
      rewards: rewards,
      policies: policies,      // Map: for each state S -> [['R', 0.2], ['U', 0.8]]
      policyEditable: false,   // for the child component PolicyEditor
      selectedState: '',       // for the child component PolicyEditor
      selectedStatePolicy: [], // for the child component PolicyEditor
      values: values,
      currentI: props.startPos[0],
      currentJ: props.startPos[1],
      gamma: 1                 // Discount Factor
    };
  }

  getStateFromPos = (i, j) => {
    return i.toString().concat(j.toString());
  }

  getPosFromState = (s) => {
    if (typeof(s) === 'string' && s.length === 2) {
      return [parseInt(s[0], 10), parseInt(s[1], 10)];
    } else {
      return [];
    }
  }

  getCurrentState = () => {
    return this.getStateFromPos(this.state.currentI, this.state.currentJ);
  }

  // returns state
  moveAgent = (action, changeCurrentPos=true, from_pos=[this.state.currentI, this.state.currentJ]) => { 
    let newPos = [];
    if (from_pos.length !== 2) {
      return '';
    }
    for (let a of this.state.policies.get(this.getStateFromPos(from_pos[0], from_pos[1]))) {
      if (action === a[0] && a[1] > 0) {
        if (a[0] === 'U') {
          newPos[0] = from_pos[0] - 1;
          newPos[1] = from_pos[1];
        } else if (a[0] === 'D') {
          newPos[0] = from_pos[0] + 1;
          newPos[1] = from_pos[1];
        } else if (a[0] === 'L') {
          newPos[0] = from_pos[0];
          newPos[1] = from_pos[1] - 1;
        } else if (a[0] === 'R') {
          newPos[0] = from_pos[0];
          newPos[1] = from_pos[1] + 1;
        }
      }
    }
    if (changeCurrentPos && newPos.length === 2) { // if we did move
      // update currentI and currentJ
      this.setState({
        ...this.state,
        currentI: newPos[0],
        currentJ: newPos[1]
      });
    }
    return newPos.length === 2 ? this.getStateFromPos(newPos[0], newPos[1]) : '';
  }

  gridContentOptionChange = (ev) => {
    let v = ev.target.value;
    if (v === 'agent' || v === 'rewards' || v === 'values') {
      //this.props.setMode(v);
      this.setState({
        ...this.state,
        gridContent: v,
      })
    } else {
      alert('Unknown Mode clicked');
    }
  }

  policyOptionChange = (ev) => {
    let v = ev.target.value;
    if (v === 'uniform') {
      let pols = new Map(this.state.policies);
      let pr;
      let policy;
      for (let s of this.state.states) {
        policy = pols.get(s);
        if (policy.length > 0) {
          pr = 1/policy.length;
          for(let m of policy) {
            m[1] = pr;
          }
        }
      }
      this.setState({
        ...this.state,
        policies: pols,
        policyEditable: true,
      });
    } else if (v === 'custom') {
      this.setState({
        ...this.state,
        policyEditable: true,
      });
    } else if (v === 'iteration') {
      this.setState({
        ...this.state,
        policyEditable: false,
      });
    } else {
      alert('Unknown Policy clicked');
    }
  }

  gridStateClick = (ev) => {
    if (this.state.policyEditable) {
      let s = ev.target.dataset.state;
      this.setState({
        ...this.state,
        selectedState: s,
        selectedStatePolicy: this.state.policies.get(s),
      });
    }
  }

  onSavePolicy = (newPolicy) => {
    let newPolicies = new Map(this.state.policies);
    if (newPolicy) {
      newPolicies.set(this.state.selectedState, newPolicy);
    }
    this.setState({
      ...this.state,
      selectedState: '',
      selectedStatePolicy: [],
      policies: newPolicies
    });
  }

  evaluatePolicyClick = async (ev) => {
    // reinitialize V(s) to zero
    let newVals = new Map(this.state.values);
    for (let key of newVals.keys()) {
      newVals.set(key, 0.0);
    }
    this.setState({
      ...this.state,
      values: newVals,
      gamma: parseFloat(this.gammaInput.current.value) // get Gamma from input
    });
    await sleep(200);

    let old_val, new_val, new_state, policy, r, delta, threshold = 1e-3, problem=false, new_values_map=new Map(this.state.values), posOfState;
    while (true) {
      delta = 0;
      if (problem) {
        break;
      }
      for (let s of this.state.states) {
        old_val = new_values_map.get(s);
        policy = this.state.policies.get(s);
        posOfState = this.getPosFromState(s);
        //console.log('evaluating state : ' + s + ' (' + posOfState[0] + ',' + posOfState[1] + ')');
        // console.log('possible moves: ', possible_moves);
        if (policy.length > 0) { // is not terminal state 
          new_val = 0;
          //console.log(possible_moves);
          for (let a of policy) {
            // make the move and get the reward r and value of s' and return to s.
            new_state = this.moveAgent(a[0], false, posOfState);
            if (new_state.length === 2) {
              r = this.state.rewards.get(new_state);
              //console.log('move ' + a + ' --> new_state: ' + new_state + ' ---> Reward: ' + r);
              //console.log(`new_val (${a}) = ${new_val} + [${pr_a} * (${r} + ${gamma}*${new_values_map.get(new_state)})] = ${new_val}`);
              new_val += a[1] * (r + this.state.gamma*new_values_map.get(new_state));
              //console.log(`new_val = ${new_val}`);
              if (isNaN(new_val)) {
                console.log('new_val is NaN');
                problem = true;
                break;
              }
            } else {
              console.log(`couldnt get state from move ${a[0]} from state ${posOfState} `);
            }
          }
          // console.log('new_val: ', new_val);
          new_values_map.set(s, new_val); // set new State ?
          delta = Math.max(delta, Math.abs(old_val-new_val));
        }
      }
      this.setState({...this.state, values: new_values_map});
      await sleep(300);
      // console.log('max delta: ', delta);
      if (delta < threshold) {
        console.log('policy evaluation has converged !');
        break;
      }
    }
  };

  render() {
    console.log('render grid');
    let rows = [], val, s, isStartPos, isGoalPos, isHolePos, isWallPos;
    for (let i = 0 ; i < this.props.height ; i++) {
      let cols = [];
      for (let j = 0 ; j < this.props.width ; j++) {
        isStartPos = (i === this.props.startPos[0] && j === this.props.startPos[1]);
        isGoalPos  = (i === this.props.goalPos[0]  && j === this.props.goalPos[1]);
        isHolePos  = (i === this.props.holePos[0]  && j === this.props.holePos[1]);
        isWallPos  = (this.props.wallsPos.filter(pos=>pos[0] === i && pos[1] === j).length > 0 );
        if (isWallPos) {
          val = '';
        } else if (this.state.gridContent === 'agent') {
          val = this.state.currentI === i && this.state.currentJ === j ? 'A' : '';
        } else if (this.state.gridContent === 'rewards') {
          val = this.state.rewards.get(i.toString().concat(j.toString()));
        } else if (this.state.gridContent === 'values') {
          val = this.state.values.get(i.toString().concat(j.toString()));
          val = val.toFixed(2);
        }
        s = `${i}${j}`;
        cols.push(
        <td key={s}
            className={`${i+1 === this.props.height ? 'last-row' : ''} \
                        ${j === 0 ? 'first-col' : ''} \
                        ${this.state.policyEditable && !isStartPos && !isGoalPos && !isHolePos && !isWallPos ? 'editable' : ''}
                        ${i === this.state.currentI    && j === this.state.currentJ ? 'current' : ''} \
                        ${isStartPos ? 'start' : ''} \
                        ${isGoalPos ? 'goal' : ''} \
                        ${isHolePos ? 'hole' : ''} \
                        ${isWallPos ? 'wall' : ''} `}
                        data-state={s}
                        onClick={this.gridStateClick}>
            {val}
        </td>);
      }
      rows.push(<tr key={i}>{cols}</tr>);
    }
    return (
      <div className="Grid">
          <div className="options">
            <div className="radio">
              <p>Show :</p>
            </div>
            <div className="radio">
              <input checked={this.state.gridContent==='agent'} type="radio" value="agent" name="grid-content" onChange={this.gridContentOptionChange} />
              <label>Agent</label>
            </div>
            <div className="radio">
              <input type="radio" value="rewards" name="grid-content" onChange={this.gridContentOptionChange} />
              <label>Rewards</label>
            </div>
            <div className="radio">
              <input type="radio" value="values"  name="grid-content" onChange={this.gridContentOptionChange} />
              <label>Values</label>
            </div>
          </div>
          <div className="options">
            <div className="radio">
              <p>Policy :</p>
            </div>
            <div className="radio">
              <input type="radio" value="uniform" name="policy" onChange={this.policyOptionChange} />
              <label>Uniform</label>
            </div>
            <div className="radio">
              <input type="radio" value="custom" name="policy" onChange={this.policyOptionChange} />
              <label>Custom</label>
            </div>
            <div className="radio">
              <input type="radio" value="iteration" name="policy" onChange={this.policyOptionChange} />
              <label>Policy Iteration</label>
            </div>
          </div>
          <div className="options">
            <label>Discount Factor (gamma) : </label>
            <input id="gamma-input" ref={this.gammaInput} type="text" defaultValue={this.state.gamma} />
          </div>
        <div>
          <button onClick={this.evaluatePolicyClick}>Evaluate Policy</button>
        </div>
        <table>
          <tbody>
            {rows}
          </tbody>
        </table>
        <PolicyEditor policy={this.state.selectedStatePolicy} onSavePolicy={this.onSavePolicy} policy={this.state.selectedStatePolicy}  />
      </div>
    );
  }
}

export default Grid;
