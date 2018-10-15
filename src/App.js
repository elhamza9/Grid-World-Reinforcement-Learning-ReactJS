import React, { Component } from 'react';

import './styles/App.css';
import Grid from './components/Grid';
import Logger from './components/Logger';

class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      width: 4,
      height: 3,
      startPos: [2,0],
      goalPos: [0,3],
      holePos: [1,3],
      wallsPos: [[1,1]],
      loggerVisible: false,
    };
  }

  changeGridDimensition = (w, h) => {
    this.setState({
      ...this.state,
      width: w,
      height: h,
    });
  };

  changeGridPositions = (sp, gp, hp, wps) => {
    this.setState({
      ...this.state,
      startPos: sp,
      goalPos: gp,
      holePos: hp,
      wallsPos: wps,
    });
  }

  onShowLoggerClick = (ev) => {
    this.setState({
      ...this.state,
      loggerVisible: true,
    })
  }

  onCloseLoggerClick = (ev) => {
    this.setState({
      ...this.state,
      loggerVisible: false,
    })
  }

  render() {

    return (

      <div className="App">
        <header>
          <h1>WELCOME TO GRID WORLD !</h1>
        </header>
        <main>
          <div id="grid-wrapper">
            <Grid width={this.state.width} height={this.state.height}
                  startPos = {this.state.startPos}
                  goalPos  = {this.state.goalPos}
                  holePos  = {this.state.holePos}
                  wallsPos = {this.state.wallsPos}
                  changeDimFunc = {this.changeGridDimensition}
                  changePosFunc = {this.changeGridPositions}
                  showLoggerFunc = {this.onShowLoggerClick} />
          </div>
          <div id="logger-wrapper" hidden={!this.state.loggerVisible}>
            <span className="close" onClick={this.onCloseLoggerClick}>X</span>
            <Logger />
          </div>
          
        </main>
      </div>
    );
  }

}

export default App;
