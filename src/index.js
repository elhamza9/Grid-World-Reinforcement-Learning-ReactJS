import React from 'react';
import ReactDOM from 'react-dom';

import {createStore} from 'redux';
import {Provider} from 'react-redux';

import './styles/index.css';
import App from './App';
import registerServiceWorker from './registerServiceWorker';

import appReducer from './redux/reducer';

const appStore = createStore(appReducer);

ReactDOM.render(
    <Provider store={appStore}>
        <App />
   </Provider>, document.getElementById('root'));

registerServiceWorker();
