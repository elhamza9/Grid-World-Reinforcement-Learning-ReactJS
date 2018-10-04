
import React, { Component } from 'react';


import '../styles/PolicyEditor.css';

export default class PolicyEditor extends Component {

    constructor (props) {
        super(props);
        this.upInput = React.createRef();
        this.rightInput = React.createRef();
        this.leftInput = React.createRef();
        this.downInput = React.createRef();
    }

    onSaveClickHandler = (ev) => {
        // get new policy
        let newPol = [], inputs = [];
        inputs.push(this.upInput.current);
        inputs.push(this.downInput.current);
        inputs.push(this.leftInput.current);
        inputs.push(this.rightInput.current);
        for (let i of inputs) {
            if (i.value) {
                console.log(i.dataset.action);
                newPol.push([i.dataset.action, i.value]);
            }
        }
        this.props.onSavePolicy(newPol)
    }

    onCloseClickHandler = (ev) => {
        this.props.onSavePolicy(null);
    }

    getProbabilityForAction = (action) => {
        if (this.props.policy.length > 0) {
            let t = this.props.policy.filter(e => e[0] === action)[0];
            if (t !== undefined && t.length > 0) {
                return t[1];
            }
        }
    }

    hideField = (action) => {
        for (let e of this.props.policy) {
            if (e[0] === action) {
                return false;
            }
        }

        return true;
    }

    render() {
        if (this.props.policy.length > 0) {
            return (
                <div className="PolicyEditor">
                    <div className="header">
                        <h4>Edit Policy</h4>
                        <span onClick={this.onCloseClickHandler} className="close">X</span>
                    </div>

                    <div className="fields">
                        <div className="field" hidden={this.hideField('U')} >
                            <label>Up</label>
                            <input ref={this.upInput} data-action="U" type="text" defaultValue={this.getProbabilityForAction('U')} />
                        </div>
                        <div className="field" hidden={this.hideField('R')}>
                            <label>Right</label>
                            <input ref={this.rightInput} data-action="R" type="text" defaultValue={this.getProbabilityForAction('R')} />
                        </div>
                        <div className="field" hidden={this.hideField('L')}>
                            <label>Left</label>
                            <input ref={this.leftInput} data-action="L" type="text" defaultValue={this.getProbabilityForAction('L')} />
                        </div>
                        <div className="field" hidden={this.hideField('D')}>
                            <label>Down</label>
                            <input ref={this.downInput} data-action="D" type="text" defaultValue={this.getProbabilityForAction('D')} />
                        </div>
                    </div>

                    <div>
                        <button id="save-policy-btn" onClick={this.onSaveClickHandler}>save</button>
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }
};

