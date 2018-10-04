import React, { Component } from 'react';
import {connect} from 'react-redux';

import './styles/App.css';
import Grid from './components/Grid';

import {setModeAction} from './redux/actions';

class App extends Component {

  render() {
    return (

      <div className="App">
        <header>
          <h1>WELCOME TO GRID WORLD !</h1>
        </header>
        <main>
          <Grid width={4} height={3}
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
