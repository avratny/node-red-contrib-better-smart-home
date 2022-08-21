module.exports = function (RED) {
    function ClimateAutomationNode(config) {
        RED.nodes.createNode(this, config);
        let node = this;

        this.mode = config.mode || 'manual';
        this.offset = config.offset || 1;
        this.timeout = config.timeout || 15;
        this.missing_value_action = config.missing_value_action || 'off';
        this.target_temperature = config.target_temperature || 21;
        this.check_minimal_outside_temperature = config.check_minimal_outside_temperature || false;
        this.minimal_outside_temperature = config.minimal_outside_temperature || null;

        this.current_temperature = null;
        this.outside_temperature = null;

        this.climate_state = null;
        this.state_changed = false;

        let tout_outside_temperature = null;
        let tout_current_temperature = null;

        function setClimateState(newState) {
            if (newState !== node.climate_state) {
                node.state_changed = true;
            }
            node.climate_state = newState;
        }

        node.on('input', function (msg) {

            //Set the current temperature
            if (msg.topic === "current_temperature") {
                node.current_temperature = msg.payload;
                if (node.timeout > 0) {
                    clearTimeout(tout_current_temperature);
                    tout_current_temperature = setTimeout(function () {
                        node.current_temperature = null;
                    }, node.timeout * 1000 * 60)
                }
            }

            //Set the outside temperature
            if (msg.topic === "outside_temperature") {
                node.outside_temperature = msg.payload;
                if (node.timeout > 0) {
                    clearTimeout(tout_outside_temperature);
                    tout_outside_temperature = setTimeout(function () {
                        node.outside_temperature = null;
                    }, node.timeout * 1000 * 60)
                }
            }

            //Set the target temperature
            if (msg.topic === "target_temperature") {
                node.target_temperature = msg.payload;
            }


            //Check we have all values for logic
            let valuesMissing = false;
            if (node.current_temperature == null || node.target_temperature == null) {
                valuesMissing = true;
            }
            if (node.check_minimal_outside_temperature && node.outside_temperature == null) {
                valuesMissing = true;
            }

            if (valuesMissing) {
                if (node.missing_value_action === 'off') {
                    setClimateState(false);
                } else setClimateState(true);
            }
            /////


            if (!valuesMissing) {
                let climateState = true;
                if (node.check_minimal_outside_temperature && node.outside_temperature < node.minimal_outside_temperature) {
                    climateState = false;
                }
                if (node.current_temperature - node.target_temperature < config.offset) {
                    climateState = false;
                }
                setClimateState(climateState);
            }


            //pack all other infos
            msg.payload = {
                "state": node.climate_state,
                "current_temperature": node.current_temperature,
                "target_temperature": node.target_temperature,
                "outside_temperature": node.outside_temperature,
                "check_minimal_outside_temperature": node.check_minimal_outside_temperature,
                "mode": config.mode
            };

            if (node.climate_state) {
                if (node.state_changed) {
                    node.send([{"payload": true}, null, null]);
                    node.state_changed=false;
                }
                node.send([null, null, msg]);
                node.status({fill: "green", shape: "dot", text: "ON"});
            } else {
                if (node.state_changed) {
                    node.send([null, {"payload": false}, null]);
                    node.state_changed=false;
                }
                node.send([null, null, msg]);
                node.status({fill: "red", shape: "dot", text: "OFF"});
            }


        });
    }

    RED.nodes.registerType("climate-automation", ClimateAutomationNode);
}