package LoopsAndConditionals {
    attribute def Temperature;
    attribute def Pressure;

    action def MonitorSystem {
        in attribute threshold : Temperature;

        /* Conditional action: check sensor reading */
        action checkTemp {
            out attribute reading : Temperature;
        }

        /* While loop: keep monitoring until stable */
        while loop monitorLoop {
            action readSensor;
            action evaluateReading;
            first readSensor then evaluateReading;
        }

        /* For loop: iterate over sensor array */
        for sensor in sensorArray {
            action calibrateSensor;
        }

        /* Assignment: store the result */
        assign currentTemp := checkTemp.reading;

        action processNormal;
        action processAlert;

        first start then checkTemp;
    }

    action def DataProcessing {
        /* If action with guard block */
        if isValid {
            action processData;
            action storeResult;
            first processData then storeResult;
        }
    }
}
