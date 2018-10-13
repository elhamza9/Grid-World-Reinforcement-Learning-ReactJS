import React, { Component } from 'react';

import './styles/App.css';
import Grid from './components/Grid';
import Logger from './components/Logger';

class App extends Component {

  render() {
    return (

      <div className="App">
        <header>
          <h1>WELCOME TO GRID WORLD !</h1>
        </header>
        <main>
          <div id="grid-wrapper">
            <Grid width={4} height={3}
                  startPos= {[2,0]}
                  goalPos = {[0,3]}
                  holePos = {[1,3]}
                  wallsPos= {[[1,1]]} />
          </div>
          <div id="logger-wrapper">
            <Logger />
          </div>
          
        </main>
      </div>
    );
  }

}

export default App;
