
import React, { Component } from 'react';
import { connect } from "react-redux";


import '../styles/Logger.css';
import { getStateFromPos } from './helpers/general';

class Logger extends Component {

    constructor(props) {
        super(props);
        this.loggerContent = React.createRef();
        this.state = {
            logs : [],
            visibleLogLevels: [0,1]
        }
    }

    componentWillReceiveProps (nextProps) {
        let lastActionHTML;
        if (nextProps.reset) {
            this.setState({
                ...this.state, 
                logs: []
            });
        }
        else {
            if (nextProps.type === null) {  // title
                lastActionHTML = <p className="title" >{nextProps.lastActionTitle}</p>;
            } else if (nextProps.type === 'string') { // string, check level
                lastActionHTML = <p className={this.getLevelStr(nextProps.level)} hidden={!this.state.visibleLogLevels.includes(nextProps.level)}>{nextProps.data}</p>
            } else if (nextProps.type === '2D') {    // Map state to value
                lastActionHTML = this.getTableFromMap(nextProps.data, this.getLevelStr(nextProps.level));
            }
            this.setState({
                ...this.state,
                logs : [...this.state.logs, lastActionHTML]
            });
            this.loggerContent.current.scrollTop = this.loggerContent.current.scrollHeight;
        }
        
    }

    onLogChange =  (ev) => {
        if (ev.target.value === '0' || ev.target.value === '1' || ev.target.value === '2') {
            this.setState({
                ...this.state,
                visibleLogLevels: this.getLowerLevels(parseInt(ev.target.value, 10))
            });
        }
    }

    getLevelStr (level_nbr) {
        let level_str;
        if (level_nbr === 0) {
            level_str = 'zero';
        } else if (level_nbr === 1) {
            level_str = 'one';
        } else if (level_nbr === 2) {
            level_str = 'two'
        }
        return level_str;
    }

    getLevelNbr (level_str) {
        if (level_str === 'zero') {
            return 0;
        } else if (level_str === 'one') {
            return 1;
        } else if (level_str === 'two') {
            return 2;
        }
    }

    getLowerLevels (level_nbr) {
        let arr = [];
        for(let i = 0 ; i < 3 ; i++) {
            if (i <= level_nbr) {
                arr.push(i);
            }
        }
        return arr;
    }

    getTableFromMap (map, level) {
        let rows = [], cols = [], col, val;
        let i,j, max_i = -1, max_j = -1;
        for (let s of map.keys()) {
            i = parseInt(s[0], 10);
            j = parseInt(s[1], 10);
            if (i > max_i) {
                max_i = i;
            }
            if (j > max_j) {
                max_j = j;
            }
        }
        for (i = 0 ; i <= max_i ; i++) {
            cols = [];
            for (j = 0 ; j <= max_j ; j++) {
                val = map.get(getStateFromPos(i,j));
                if (typeof(val) === 'number') {
                    val = val.toFixed(2);
                }
                col = <td>{val}</td>
                cols.push(col);
            }
            rows.push(<tr>{cols}</tr>);
        }
        return (<table className={level} hidden={!this.state.visibleLogLevels.includes(this.getLevelNbr(level))}>{[...rows]}</table>);
    }

    render () {

        return (
            <div  className="Logger">
                <div className="header">
                    <h3 className="title">LOGS</h3>
                    <div className="levels">
                        <div className="level-radio">
                            <label>Level : </label>
                        </div>
                        <div className="level-radio">
                            <input type="radio" value="0" name="level" onChange={this.onLogChange}/>
                            <label>Zero</label>
                        </div>
                        <div className="level-radio">
                            <input type="radio" value="1" name="level" onChange={this.onLogChange} defaultChecked={true}/>
                            <label>One</label>
                        </div>
                        <div className="level-radio">
                            <input type="radio" value="2" name="level" onChange={this.onLogChange} />
                            <label>Two</label>
                        </div>
                    </div>
                </div>
                <div ref={this.loggerContent} className="content">
                    {this.state.logs}
                </div>
            </div>
        );

    }

};

const mapStateToProps = (state) => {
    return {
        lastActionTitle : state.last_action_title,
        data: state.data,
        type: state.type,
        level: state.level,
        reset: state.reset,
    };
};


export default connect(mapStateToProps, null) (Logger);