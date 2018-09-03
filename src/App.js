import React, { Component } from 'react';
import {connect} from 'react-redux';

import './styles/App.css';
import Grid from './components/Grid';

import {setModeAction} from './redux/actions';

class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      gridContent: 'agent',
      policy: 'uniform'
    };
  }

  gridContentOptionClick = (ev) => {
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

  policyOptionClick = (ev) => {
    let v = ev.target.value;
    if (v === 'uniform' || v === 'deterministic') {
      //this.props.setMode(v);
      this.setState({
        ...this.state,
        policy: v,
      })
    } else {
      alert('Unknown Policy clicked');
    }
  }

  render() {
    return (

      <div className="App">
        <header>
          <h1>WELCOME TO GRID WORLD !</h1>
        </header>
        <main>
          <div className="options">
            <div className="radio">
              <p>Show :</p>
            </div>
            <div className="radio">
              <input checked={this.state.gridContent==='agent'} type="radio" value="agent" name="grid-content" onClick={this.gridContentOptionClick} />
              <label>Agent</label>
            </div>
            <div className="radio">
              <input type="radio" value="rewards" name="grid-content" onClick={this.gridContentOptionClick} />
              <label>Rewards</label>
            </div>
            <div className="radio">
              <input type="radio" value="values"  name="grid-content" onClick={this.gridContentOptionClick} />
              <label>Values</label>
            </div>
          </div>
          <div className="options">
            <div className="radio">
              <p>Policy :</p>
            </div>
            <div className="radio">
              <input checked={this.state.policy==='uniform'} type="radio" value="uniform" name="policy" onClick={this.policyOptionClick} />
              <label>Uniform</label>
            </div>
            <div className="radio">
              <input type="radio" value="deterministic" name="policy" onClick={this.policyOptionClick} />
              <label>Deterministic</label>
            </div>
          </div>
          <Grid width={4} height={3}
                gridContent={this.state.gridContent}
                policy={this.state.policy}
                startPos={[2,0]}
                goalPos={[0,3]}
                holePos={[1,3]}
                wallsPos={[[1,1]]} />
        </main>
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    test: state.test
  }
}

const mapDispatchToProps = (dispatch) => {
  return {
    setMode: (mode) => {dispatch(setModeAction(mode))},
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(App);
