/*
 *  Copyright (c) 2005-2014, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 *  WSO2 Inc. licenses this file to you under the Apache License,
 *  Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing,
 *  software distributed under the License is distributed on an
 *  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 *  KIND, either express or implied.  See the License for the
 *  specific language governing permissions and limitations
 *  under the License.
 *
 */
var LifecycleAPI = {};
var LifecycleUtils = {};
(function() {
    var configMap = {};
    var eventMap = {};
    var dataMap = {};
    var lifecycleImpl = {};
    var currentLifecycle;
    var constants = LifecycleAPI.constants = {}; //Sgort hand reference
    constants.API_ENDPOINT = 'lifecycle-api';
    constants.API_LC_DEFINITION = 'lifecycle-definition-api';
    constants.API_BASE = 'apiLCBase';
    constants.API_CHANGE_STATE = 'apiChangeState';
    constants.API_FETCH_STATE = 'apiFetchState';
    constants.API_UPDATE_CHECKLIST = 'apiUpdateChecklist';
    constants.UI_LIFECYCLE_SELECT_ID = '#lifecycle-selector';
    constants.CONTAINER_SVG = 'svgContainer';
    constants.CONTAINER_GRAPH = 'graphContainer';
    constants.CONTAINER_LC_ACTION_AREA = 'lifecycleActionArea';
    constants.CONTAINER_RENDERING_AREA = 'lifecycleRenderingArea';
    constants.CONTAINER_CHECKLIST_AREA = 'lifecycleChecklistArea';
    constants.CONTAINER_CHECKLIST_OVERLAY = 'lifecycleChecklistBlock';
    constants.CONTAINER_LC_ACTION_OVERLAY = 'lifecycleActionOverlay';
    constants.EVENT_LC_LOAD = 'event.lc.loaded';
    constants.EVENT_LC_UNLOAD = 'event.lc.unload';
    constants.EVENT_FETCH_STATE_START = 'event.fetch.state.start';
    constants.EVENT_FETCH_STATE_SUCCESS = 'event.fetch.state.success';
    constants.EVENT_FETCH_STATE_FAILED = 'event.fetch.state.failed';
    constants.EVENT_STATE_CHANGE = 'event.state.change';
    constants.EVENT_ACTION_START = 'event.action.invoked';
    constants.EVENT_ACTION_FAILED = 'event.action.failed';
    constants.EVENT_ACTION_SUCCESS = 'event.action.success';
    constants.EVENT_UPDATE_CHECKLIST_START ='event.update.checklist.start';
    constants.EVENT_UPDATE_CHECKLIST_SUCCESS = 'event.update.checklist.success';
    constants.EVENT_UPDATE_CHECKLIST_FAILED = 'event.update.checklist.failed';
    var processCheckItems = function(stateDetails, datamodel) {
        if (!stateDetails.hasOwnProperty('datamodel')) {
            stateDetails.datamodel = {};
        }
        stateDetails.datamodel.checkItems = datamodel.item;
        for (var index = 0; index < datamodel.item.length; index++) {
            datamodel.item[index].checked = false;
            datamodel.item[index].index = index;
        }
    }
    var processDataModel = function(stateDetails, datamodel) {
        switch (datamodel.name) {
            case 'checkItems':
                processCheckItems(stateDetails, datamodel);
                break;
            default:
                break;
        }
    };
    var triggerEvent = function(eventName, eventCb) {
        if (eventMap.hasOwnProperty(eventName)) {
            eventCb = eventCb || {};
            eventCallbacks = eventMap[eventName];
            console.log('emiting event::' + eventName + ' [active lifecycle: ' + LifecycleAPI.currentLifecycle() + ' ]');
            for (var index = 0; index < eventCallbacks.length; index++) {
                eventCallbacks[index](eventCb);
            }
        } else {
            console.log('no event listeners for event :: ' + eventName);
        }
    };
    /**
     * Converts the JSON definition returned by the lifecycles API
     * into a well structured JSOn object
     * @param  {[type]} data [description]
     * @return {[type]}      [description]
     */
    LifecycleUtils.buildStateMapFromDefinition = function(data) {
        var definition = data.data.definition.configuration.lifecycle.scxml.state;
        var initialState = data.data.definition.configuration.lifecycle.scxml.initialstate;
        var stateMap = {};
        var state;
        var stateDetails;
        var nodeCount = 0;
        var datamodels;
        var datamodel;
        var transition;
        stateMap.states = {};
        stateMap.initialState = initialState ? initialState.toLowerCase() : initialState;
        for (var stateKey in definition) {
            stateDetails = definition[stateKey];
            state = stateMap.states[stateKey] = {};
            state.id = stateKey;
            state.label = stateDetails.id;
            state.transitions = stateDetails.transition || [];
            stateDetails.datamodel = stateDetails.datamodel ? stateDetails.datamodel : [];
            datamodels = stateDetails.datamodel.data || [];
            //Convert the target states to lower case
            for (var index = 0; index < state.transitions.length; index++) {
                transition = state.transitions[index];
                transition.target = transition.target.toLowerCase();
            }
            //Process the data model
            for (var dIndex = 0; dIndex < datamodels.length; dIndex++) {
                datamodel = datamodels[dIndex];
                processDataModel(state, datamodel);
            }
            nodeCount++;
        }
        return stateMap;
    };
    /**
     * Returns meta information on the current asset
     * @return {[type]} [description]
     */
    LifecycleUtils.currentAsset = function() {
        return store.publisher.lifecycle;
    };
    LifecycleUtils.config = function(key) {
        return LifecycleAPI.configs(key);
    };
    LifecycleAPI.configs = function() {
        if ((arguments.length == 1) && (typeof arguments[0] == 'object')) {
            configMap = arguments[0]
        } else if ((arguments.length = 1) && (typeof arguments[0] == 'string')) {
            return configMap[arguments[0]];
        } else {
            return configMap;
        }
    };
    LifecycleAPI.event = function() {
        var eventName = arguments[0];
        var eventCb = arguments[1];
        var eventCallbacks;
        if (arguments.length === 1) {
            triggerEvent(eventName, eventCb);
        } else if ((arguments.length === 2) && (typeof eventCb === 'object')) {
            triggerEvent(eventName, eventCb);
        } else if ((arguments.length === 2) && (typeof eventCb === 'function')) {
            if (!eventMap.hasOwnProperty(eventName)) {
                eventMap[eventName] = [];
            }
            eventMap[eventName].push(eventCb);
        }
    };
    LifecycleAPI.data = function() {
        var dataKey = arguments[0];
        var data = arguments[1];
        if (arguments.length == 1) {
            return dataMap[dataKey];
        } else if (arguments.length == 2) {
            dataMap[dataKey] = data;
        }
    };
    LifecycleAPI.lifecycle = function() {
        var name = arguments[0];
        var impl = arguments[1];
        if (arguments.length == 0) {
            var currentLC = LifecycleAPI.currentLifecycle();
            return LifecycleAPI.lifecycle(currentLC);
        } else if ((arguments.length === 1) && (typeof name === 'string')) {
            var impl = LifecycleAPI.data(name);
            if (!impl) {
                impl = new LifecycleImpl({
                    name: name
                });
                LifecycleAPI.data(name, impl);
            }
            return impl;
        } else if ((arguments.length === 2) && (typeof impl === 'object')) {
            //Allow method overiding
        } else {
            throw 'Invalid lifecycle name provided';
        }
    };
    LifecycleAPI.currentLifecycle = function() {
        if (arguments.length === 1) {
            currentLifecycle = arguments[0];
        } else {
            return currentLifecycle;
        }
    };

    function LifecycleImpl(options) {
        options = options || {};
        this.lifecycleName = options.name ? options.name : null;
        this.currentState = null;
        this.rawAPIDefinition = null;
        this.stateMap = null;
        this.dagreD3GraphObject = null;
        this.renderingSite;
    }
    LifecycleImpl.prototype.load = function() {
        var promise;
        if (!this.rawAPIDefinition) {
            var that = this;
            //Fetch the lifecycle definition
            promise = $.ajax({
                url: this.queryDefinition(),
                success: function(data) {
                    that.rawAPIDefinition = data;
                    that.processDefinition();
                    that.currentState = that.stateMap.initialState;
                    LifecycleAPI.currentLifecycle(that.lifecycleName);
                    //Obtain the asset current state from the code block,if not set it to the initial state
                    LifecycleAPI.event(constants.EVENT_LC_LOAD, {
                        lifecycle: that.lifecycleName
                    });
                    that.fetchState();
                },
                error: function() {
                    alert('Failed to load definition');
                }
            });
        } else {
            LifecycleAPI.currentLifecycle(this.lifecycleName);
            //If the definition is present then the lifecycle has already been loaded
            LifecycleAPI.event(constants.EVENT_LC_LOAD, {
                lifecycle: this.lifecycleName
            });
            this.fetchState();
        }
    };
    LifecycleAPI.unloadActiveLifecycle = function() {
        LifecycleAPI.event(constants.EVENT_LC_UNLOAD);
    };
    LifecycleImpl.prototype.resolveRenderingSite = function() {
        this.renderingSite = {};
        this.renderingSite.svgContainer = LifecycleAPI.configs(constants.CONTAINER_SVG);
        this.renderingSite.graphContainer = LifecycleAPI.configs(constants.CONTAINER_GRAPH);
    };
    LifecycleImpl.prototype.processDefinition = function() {
        this.stateMap = LifecycleUtils.buildStateMapFromDefinition(this.rawAPIDefinition);
    };
    LifecycleImpl.prototype.render = function() {
        this.resolveRenderingSite();
        this.renderInit();
        this.fillGraphData();
        this.style();
        this.renderFinish();
    };
    LifecycleImpl.prototype.renderInit = function() {
        this.dagreD3GraphObject = new dagreD3.graphlib.Graph().setGraph({});
        if (!this.renderingSite) {
            throw 'Unable to render lifecycle as renderingSite details has not been provided';
        }
    };
    LifecycleImpl.prototype.renderFinish = function() {
        var g = this.dagreD3GraphObject;
        var svgContainer = this.renderingSite.svgContainer;
        var graphContainer = this.renderingSite.graphContainer;
        d3.select(svgContainer).append(graphContainer);
        var svg = d3.select(svgContainer),
            inner = svg.select(graphContainer);
        // Set up zoom support
        var zoom = d3.behavior.zoom().on("zoom", function() {
            inner.attr("transform", "translate(" + d3.event.translate + ")" + "scale(" + d3.event.scale + ")");
        });
        svg.call(zoom);
        // Create the renderer
        var render = new dagreD3.render();
        // Run the renderer. This is what draws the final graph.
        render(inner, g);
        // Center the graph
        var initialScale = 1;
        zoom.translate([(svg.attr("width") - g.graph().width * initialScale) / 2, 20]).scale(initialScale).event(svg);
        svg.attr('height', g.graph().height * initialScale + 40);
    };
    LifecycleImpl.prototype.fillGraphData = function() {
        var state;
        var transition;
        var source;
        var stateMap = this.stateMap;
        var g = this.dagreD3GraphObject;
        for (var key in stateMap.states) {
            state = stateMap.states[key];
            g.setNode(key, {
                label: state.id
            });
        }
        //Add the edges
        for (key in stateMap.states) {
            state = stateMap.states[key];
            source = key;
            for (var index = 0; index < state.transitions.length; index++) {
                transition = state.transitions[index];
                g.setEdge(source, transition.target, {
                    label: transition.event
                });
            }
        }
    };
    LifecycleImpl.prototype.style = function() {
        var g = this.dagreD3GraphObject;
        // Set some general styles
        g.nodes().forEach(function(v) {
            var node = g.node(v);
            node.rx = node.ry = 5;
        });
    };
    LifecycleImpl.prototype.queryDefinition = function() {
        var baseURL = LifecycleAPI.configs(constants.API_LC_DEFINITION);
        return caramel.context + baseURL + '/' + this.lifecycleName;
    };
    LifecycleImpl.prototype.queryHistory = function() {};
    LifecycleImpl.prototype.urlChangeState = function() {
        var apiBase = LifecycleUtils.config(constants.API_BASE);
        var apiChangeState = LifecycleUtils.config(constants.API_CHANGE_STATE);
        var asset = LifecycleUtils.currentAsset();
        if ((!asset) || (!asset.id)) {
            throw 'Unable to locate details about asset';
        }
        return caramel.url(apiBase + '/' + asset.id + apiChangeState+'?type='+asset.type);
    };
    LifecycleImpl.prototype.urlFetchState = function() {
        var apiBase = LifecycleUtils.config(constants.API_BASE);
        var apiChangeState = LifecycleUtils.config(constants.API_FETCH_STATE);
        var asset = LifecycleUtils.currentAsset();
        if ((!asset) || (!asset.id)) {
            throw 'Unable to locate details about asset';
        }
        return caramel.url(apiBase + '/' + asset.id + apiChangeState + '?type=' + asset.type);
    };
    LifecycleImpl.prototype.urlUpdateChecklist = function() {
        var apiBase = LifecycleUtils.config(constants.API_BASE);
        var apiUpdateChecklist = LifecycleUtils.config(constants.API_UPDATE_CHECKLIST);
        var asset = LifecycleUtils.currentAsset();
        if ((!asset) || (!asset.id)) {
            throw 'Unable to locate details about asset';
        }
        return caramel.url(apiBase + '/' + asset.id + apiUpdateChecklist + '?type=' + asset.type);
    };
    LifecycleImpl.prototype.checklist = function() {
        var state = this.state(this.currentState);
        if (arguments.length === 1) {
            console.log('changing checklist state');
            state.datamodel.checkItems = arguments[0];
        } else {
            return state.datamodel.checkItems;
        }
    };
    LifecycleImpl.prototype.actions = function() {
        //Assume that a state has not been provided
        var currentState = this.currentState;
        if ((arguments.length === 1) && (typeof arguments[0] === 'string')) {
            currentState = arguments[0];
        }
        var state = this.stateMap.states[currentState] || {};
        var transitions = state.transitions || [];
        var actions = [];
        var transition;
        for (var index = 0; index < transitions.length; index++) {
            transition = transitions[index];
            actions.push(transition.event);
        }
        return actions;
    };
    LifecycleImpl.prototype.invokeAction = function() {
        var action = arguments[0];
        var comment = arguments[1];
        if (!action) {
            throw 'Attempt to invoke an action without providing the action';
            return;
        }
        //Check if the action is one of the available actions for the current state
        var availableActions = this.actions(this.currentState);
        if ((availableActions.indexOf(action, 0) <= -1)) {
            throw 'Attempt to invoke an action (' + action + ') which is not available for the current state : ' + this.currentState;
        }
        var data = {};
        data.action = action;
        if (comment) {
            data.comment = comment;
        }
        //alert(this.urlChangeState());
        LifecycleAPI.event(constants.EVENT_ACTION_START);
        $.ajax({
            url:this.urlChangeState(),
            type:'POST',
            success:function(){
                LifecycleAPI.event(constants.EVENT_ACTION_SUCCESS);
                LifecycleAPI.event(constants.EVENT_STATE_CHANGE);
            },
            error:function(){
                LifecycleAPI.event(constants.EVENT_ACTION_FAILED);
            }
        });
    };
    LifecycleImpl.prototype.updateChecklist = function(checklistItemIndex, state) {
        var data = {};
        LifecycleAPI.event(constants.EVENT_UPDATE_CHECKLIST_START);
        $.ajax({
            type: 'POST',
            url: this.urlUpdateChecklist(),
            data:data,
            success:function(){
                LifecycleAPI.event(constants.EVENT_UPDATE_CHECKLIST_SUCCESS);
            },
            error:function(){
                LifecycleAPI.event(constants.EVENT_UPDATE_CHECKLIST_FAILED);
            }
        });
    };
    LifecycleImpl.prototype.fetchState = function() {
        LifecycleAPI.event(constants.EVENT_FETCH_STATE_START);
        $.ajax({
            url: this.urlFetchState(),
            success: function() {
                LifecycleAPI.event(constants.EVENT_FETCH_STATE_SUCCESS);
            },
            error: function() {
                LifecycleAPI.event(constants.EVENT_FETCH_STATE_FAILED);
            }
        })
    };

    LifecycleImpl.prototype.nextStates = function() {
        //Assume that a state has not been provided
        var currentState = this.currentState;
        if ((arguments.length === 1) && (typeof arguments[0] === 'string')) {
            currentState = arguments[0];
        }
        var state = this.stateMap.states[currentState] || {};
        var transitions = state.transitions || [];
        var transition;
        var states = [];
        for (var index = 0; index < transitions.length; index++) {
            transition = transitions[index];
            states.push(transition.target);
        }
        return states;
    };
    LifecycleImpl.prototype.state = function(name) {
        return this.stateMap.states[name];
    };
    LifecycleImpl.prototype.stateNode = function(name) {
        return this.dagreD3GraphObject.node(name);
    };
    LifecycleImpl.prototype.changeState = function(nextState) {
        this.currentState = nextState;
        LifecycleAPI.event(constants.EVENT_STATE_CHANGE);
    };
}());