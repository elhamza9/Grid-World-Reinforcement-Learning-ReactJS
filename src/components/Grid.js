import React, { Component } from 'react';

import '../styles/Grid.css';

const sleep = (ms) => { return new Promise(resolve => setTimeout(resolve, ms))};

class Grid extends Component {

  constructor (props) {
    super(props);
    console.log('construct grid');
    // construct list of all states (grid[1][2] => encoded as string '12' )
    // IMPORTANT: will work for now with max 10x10 grid, meaning that state will be 2 charachters ('99')
    // construct map of rewards (s->reward)
    let states = [], rewards = new Map(), possibleMoves = new Map(), values = new Map();
    let s, r, moves, isGoal, isHole, isWall; // tmp vars to work with inside the loops
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
        possibleMoves.set(s, moves.filter(e=>e!==null));
        // set initial value to zero
        values.set(s, 0);
      }
    }

    let neighbours = {r : null, l : null, u : null , d : null}, neighbour, action;
    for (let w of props.wallsPos) {
      neighbours.r = w[1] === (props.width-1) ? null : [w[0], w[1]+1];
      neighbours.l = w[1] === 0 ? null : [w[0], w[1]-1];
      neighbours.u = w[0] === 0 ? null : [w[0]-1, w[1]];
      neighbours.d = w[0] === (props.height-1) ? null : [w[0]+1, w[1]];
      for (let key in neighbours ) {
        neighbour = neighbours[key];
        if (neighbour !== null) {
          moves = possibleMoves.get(this.getStateFromPos(neighbour[0], neighbour[1]));
          if (key === 'r') {
            action = 'L';
          } else if (key === 'l') {
            action = 'R';
          } else if (key === 'u') {
            action = 'D';
          } else if (key === 'd') {
            action = 'U';
          } else {
            console.log('key unknown !!!!');
          }
          moves.splice(moves.indexOf(action), 1);
        }
      }
    }

    console.log(possibleMoves);

    this.state = {
      states : states,
      rewards: rewards,
      possibleMoves: possibleMoves,
      values: values,
      currentI: props.startPos[0],
      currentJ: props.startPos[1],
    }
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
    for (let a of this.state.possibleMoves.get(this.getStateFromPos(from_pos[0], from_pos[1]))) {
      if (action === a) {
        if (a === 'U') {
          newPos[0] = from_pos[0] - 1;
          newPos[1] = from_pos[1];
        } else if (a === 'D') {
          newPos[0] = from_pos[0] + 1;
          newPos[1] = from_pos[1];
        } else if (a === 'L') {
          newPos[0] = from_pos[0];
          newPos[1] = from_pos[1] - 1;
        } else if (a === 'R') {
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

  evaluatePolicyClick = async (ev) => {
    // alert('evaluating policy');
    let gamma = 1;
    let old_val, new_val, new_state, possible_moves, pr_a, r, delta, threshold = 1e-3, problem=false, new_values_map=new Map(this.state.values), posOfState;
    let c = 0
    while (true) {
      delta = 0;
      if (problem) {
        break;
      }
      for (let s of this.state.states) {
        old_val = new_values_map.get(s);
        possible_moves = this.state.possibleMoves.get(s);
        posOfState = this.getPosFromState(s);
        //console.log('evaluating state : ' + s + ' (' + posOfState[0] + ',' + posOfState[1] + ')');
        // console.log('possible moves: ', possible_moves);
        if (possible_moves.length > 0) { // is not terminal state 
          pr_a = 1/(possible_moves.length);
          new_val = 0;
          //console.log(possible_moves);
          for (let a of possible_moves) {
            // make the move and get the reward r and value of s' and return to s.
            new_state = this.moveAgent(a, false, posOfState);
            if (new_state.length === 2) {
              r = this.state.rewards.get(new_state);
              //console.log('move ' + a + ' --> new_state: ' + new_state + ' ---> Reward: ' + r);
              //console.log(`new_val (${a}) = ${new_val} + [${pr_a} * (${r} + ${gamma}*${new_values_map.get(new_state)})] = ${new_val}`);
              new_val += pr_a * (r + gamma*new_values_map.get(new_state));
              //console.log(`new_val = ${new_val}`);
              if (isNaN(new_val)) {
                console.log('new_val is NaN');
                problem = true;
                break;
              }
            } else {
              console.log('couldnt get state from move');
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
    let rows = [], val;
    for (let i = 0 ; i < this.props.height ; i++) {
      let cols = [];
      for (let j = 0 ; j < this.props.width ; j++) {
        if (this.props.gridContent === 'agent') {
          val = this.state.currentI === i && this.state.currentJ === j ? 'A' : '';
        } else if (this.props.gridContent === 'rewards') {
          val = this.state.rewards.get(i.toString().concat(j.toString()));
        } else if (this.props.gridContent === 'values') {
          val = this.state.values.get(i.toString().concat(j.toString()));
          val = val.toFixed(2);
        }
        cols.push(
        <td key={`${i}${j}`}
            className={`${i+1 === this.props.height ? 'last-row' : ''} \
                        ${j === 0 ? 'first-col' : ''} \
                        ${i === this.state.currentI    && j === this.state.currentJ ? 'current' : ''} \
                        ${i === this.props.startPos[0] && j === this.props.startPos[1] ? 'start' : ''} \
                        ${i === this.props.goalPos[0]  && j === this.props.goalPos[1] ? 'goal' : ''} \
                        ${i === this.props.holePos[0]  && j === this.props.holePos[1] ? 'hole' : ''} \
                        ${this.props.wallsPos.filter(pos=>pos[0] === i && pos[1] === j).length > 0 ? 'wall' : ''} `}>
            {val}
        </td>);
      }
      rows.push(<tr key={i}>{cols}</tr>);
    }
    return (
      <div className="Grid">
        <div>
          <button onClick={this.evaluatePolicyClick}>Evaluate Policy</button>
        </div>
        <table>
          <tbody>
            {rows}
          </tbody>
        </table>
      </div>
    );
  }
}

export default Grid;
